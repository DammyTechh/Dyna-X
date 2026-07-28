import ARKit
import AVFoundation
import Foundation
import Metal
import simd

/// Rear-camera LiDAR provider. ARKit owns tracking and scene reconstruction;
/// DynaXcan snapshots each mesh anchor in world coordinates and writes raw PLY.
final class LiDARSessionAdapter: NSObject, CaptureSessionProtocol {
    weak var delegate: CaptureSessionDelegate?

    private struct MeshSnapshot {
        let vertices: [SIMD3<Float>]
        let normals: [SIMD3<Float>]
        let faces: [SIMD3<UInt32>]
    }

    private let scanConfiguration: ScanConfiguration
    private let arSession = ARSession()
    private let sessionQueue = DispatchQueue(
        label: "com.dynaxcan.lidar-session",
        qos: .userInitiated
    )
    private let stateLock = NSLock()

    private var arConfiguration: ARWorldTrackingConfiguration?
    private var meshSnapshots: [UUID: MeshSnapshot] = [:]
    private var frameStats = FrameStats()
    private var configured = false
    private var accumulating = false
    private var finishing = false
    private var startedAt: TimeInterval?
    private var isRecovering = false

    init(configuration: ScanConfiguration) {
        scanConfiguration = configuration
        super.init()
        arSession.delegate = self
        arSession.delegateQueue = sessionQueue
    }

    func configure() throws {
        if stateLock.withLock({ configured }) {
            return
        }

        guard ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) else {
            throw ScanError.hardwareNotSupported
        }

        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .denied:
            throw ScanError.cameraPermissionDenied
        case .restricted:
            throw ScanError.cameraPermissionRestricted
        case .authorized, .notDetermined:
            break
        @unknown default:
            throw ScanError.cameraSessionFailed(reason: "Unknown camera permission state.")
        }

        let configuration = ARWorldTrackingConfiguration()
        configuration.sceneReconstruction = .mesh
        configuration.environmentTexturing = .none
        configuration.isAutoFocusEnabled = true

        if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) {
            configuration.frameSemantics.insert(.sceneDepth)
        }

        arConfiguration = configuration
        stateLock.withLock {
            configured = true
        }
    }

    func startPreview() {
        guard
            stateLock.withLock({ configured && !finishing }),
            let arConfiguration
        else {
            notifyFailure(.cameraSessionFailed(reason: "LiDAR session is not configured."))
            return
        }

        arSession.run(arConfiguration, options: [.resetTracking, .removeExistingAnchors])
        notify { $0.captureSessionDidStartPreview(self) }
    }

    func startAccumulating() {
        let canStart = stateLock.withLock { () -> Bool in
            guard configured, !finishing else { return false }
            accumulating = true
            if startedAt == nil {
                startedAt = ProcessInfo.processInfo.systemUptime
            }
            return true
        }

        if !canStart {
            notifyFailure(.cameraSessionFailed(reason: "LiDAR accumulation cannot start."))
        }
    }

    func pauseAccumulating() {
        stateLock.withLock {
            accumulating = false
        }
    }

    func stopAndFinalize(
        completion: @escaping (Result<CaptureSessionResult, ScanError>) -> Void
    ) {
        let mayFinalize = stateLock.withLock { () -> Bool in
            guard configured, !finishing else { return false }
            finishing = true
            accumulating = false
            updateDurationLocked()
            return true
        }

        guard mayFinalize else {
            completeOnMain(completion, with: .failure(.cameraSessionFailed(reason: "Finalization is already in progress.")))
            return
        }

        arSession.pause()

        sessionQueue.async { [weak self] in
            guard let self else { return }

            let result: Result<CaptureSessionResult, ScanError>
            do {
                let geometry = try self.combinedGeometry()
                guard !geometry.vertices.isEmpty, !geometry.faces.isEmpty else {
                    throw ScanError.trackingFailed
                }

                let plyData = try LiDARPLYSerializer.makeData(
                    vertices: geometry.vertices,
                    normals: geometry.normals,
                    faces: geometry.faces,
                    bodySegment: self.scanConfiguration.bodySegment.rawValue
                )
                let stats = self.stateLock.withLock { self.frameStats }
                result = .success(
                    CaptureSessionResult(
                        pointCloudData: plyData,
                        frameStats: stats,
                        scannerType: .lidar
                    )
                )
            } catch let scanError as ScanError {
                result = .failure(scanError)
            } catch {
                result = .failure(.pointCloudPersistenceFailed(reason: error.localizedDescription))
            }

            self.stateLock.withLock {
                self.finishing = false
            }
            self.completeOnMain(completion, with: result)
        }
    }

    func cancel() {
        let shouldCancel = stateLock.withLock { () -> Bool in
            guard configured, !finishing else { return false }
            accumulating = false
            finishing = true
            return true
        }
        guard shouldCancel else { return }

        arSession.pause()
        sessionQueue.async { [weak self] in
            guard let self else { return }
            self.meshSnapshots.removeAll(keepingCapacity: false)
            self.stateLock.withLock {
                self.finishing = false
            }
        }
    }

    private func capture(_ meshAnchors: [ARMeshAnchor]) {
        guard stateLock.withLock({ accumulating }) else { return }

        for anchor in meshAnchors {
            do {
                meshSnapshots[anchor.identifier] = try Self.snapshot(from: anchor)
            } catch let scanError as ScanError {
                notifyFailure(scanError)
            } catch {
                notifyFailure(.cameraSessionFailed(reason: error.localizedDescription))
            }
        }
    }

    private static func snapshot(from anchor: ARMeshAnchor) throws -> MeshSnapshot {
        let geometry = anchor.geometry
        let vertexSource = geometry.vertices
        let normalSource = geometry.normals

        guard vertexSource.format == .float3, normalSource.format == .float3 else {
            throw ScanError.cameraSessionFailed(reason: "ARKit returned an unsupported LiDAR vertex format.")
        }

        let normalMatrix = simd_float3x3(
            SIMD3(anchor.transform.columns.0.x, anchor.transform.columns.0.y, anchor.transform.columns.0.z),
            SIMD3(anchor.transform.columns.1.x, anchor.transform.columns.1.y, anchor.transform.columns.1.z),
            SIMD3(anchor.transform.columns.2.x, anchor.transform.columns.2.y, anchor.transform.columns.2.z)
        )

        var vertices: [SIMD3<Float>] = []
        var normals: [SIMD3<Float>] = []
        vertices.reserveCapacity(vertexSource.count)
        normals.reserveCapacity(vertexSource.count)

        for index in 0..<vertexSource.count {
            let localVertex = readFloat3(from: vertexSource, at: index)
            let worldVertex4 = anchor.transform * SIMD4(localVertex.x, localVertex.y, localVertex.z, 1)
            vertices.append(SIMD3(worldVertex4.x, worldVertex4.y, worldVertex4.z))

            let localNormal = index < normalSource.count
                ? readFloat3(from: normalSource, at: index)
                : SIMD3<Float>(0, 1, 0)
            let transformedNormal = normalMatrix * localNormal
            normals.append(
                simd_length_squared(transformedNormal) > 0.000_001
                    ? simd_normalize(transformedNormal)
                    : SIMD3<Float>(0, 1, 0)
            )
        }

        let element = geometry.faces
        guard element.indexCountPerPrimitive == 3 else {
            throw ScanError.cameraSessionFailed(reason: "ARKit returned non-triangular LiDAR geometry.")
        }

        var faces: [SIMD3<UInt32>] = []
        faces.reserveCapacity(element.count)
        for faceIndex in 0..<element.count {
            let baseIndex = faceIndex * element.indexCountPerPrimitive
            let first = try readIndex(from: element, at: baseIndex)
            let second = try readIndex(from: element, at: baseIndex + 1)
            let third = try readIndex(from: element, at: baseIndex + 2)

            guard
                first < vertices.count,
                second < vertices.count,
                third < vertices.count
            else {
                throw ScanError.cameraSessionFailed(reason: "ARKit returned an invalid LiDAR face index.")
            }

            faces.append(SIMD3(UInt32(first), UInt32(second), UInt32(third)))
        }

        return MeshSnapshot(vertices: vertices, normals: normals, faces: faces)
    }

    private static func readFloat3(
        from source: ARGeometrySource,
        at index: Int
    ) -> SIMD3<Float> {
        let address = source.buffer.contents()
            .advanced(by: source.offset + source.stride * index)
            .assumingMemoryBound(to: Float.self)
        return SIMD3(address[0], address[1], address[2])
    }

    private static func readIndex(
        from element: ARGeometryElement,
        at index: Int
    ) throws -> Int {
        let address = element.buffer.contents().advanced(by: index * element.bytesPerIndex)
        switch element.bytesPerIndex {
        case MemoryLayout<UInt16>.size:
            return Int(address.assumingMemoryBound(to: UInt16.self).pointee)
        case MemoryLayout<UInt32>.size:
            return Int(address.assumingMemoryBound(to: UInt32.self).pointee)
        default:
            throw ScanError.cameraSessionFailed(reason: "ARKit returned an unsupported LiDAR index width.")
        }
    }

    private func combinedGeometry() throws -> (
        vertices: [SIMD3<Float>],
        normals: [SIMD3<Float>],
        faces: [SIMD3<UInt32>]
    ) {
        var vertices: [SIMD3<Float>] = []
        var normals: [SIMD3<Float>] = []
        var faces: [SIMD3<UInt32>] = []

        for identifier in meshSnapshots.keys.sorted(by: { $0.uuidString < $1.uuidString }) {
            guard let snapshot = meshSnapshots[identifier] else { continue }
            guard vertices.count <= Int(UInt32.max) - snapshot.vertices.count else {
                throw ScanError.pointCloudPersistenceFailed(reason: "LiDAR mesh exceeds the PLY index limit.")
            }

            let offset = UInt32(vertices.count)
            vertices.append(contentsOf: snapshot.vertices)
            normals.append(contentsOf: snapshot.normals)
            faces.append(contentsOf: snapshot.faces.map { face in
                SIMD3(face.x + offset, face.y + offset, face.z + offset)
            })
        }

        return (vertices, normals, faces)
    }

    private func updateDurationLocked() {
        guard let startedAt else { return }
        frameStats.durationSeconds = ProcessInfo.processInfo.systemUptime - startedAt
    }

    private func notify(_ body: @escaping (CaptureSessionDelegate) -> Void) {
        DispatchQueue.main.async { [weak self] in
            guard let self, let delegate = self.delegate else { return }
            body(delegate)
        }
    }

    private func notifyFailure(_ error: ScanError) {
        notify { [weak self] delegate in
            guard let self else { return }
            delegate.captureSession(self, didFail: error)
        }
    }

    private func completeOnMain(
        _ completion: @escaping (Result<CaptureSessionResult, ScanError>) -> Void,
        with result: Result<CaptureSessionResult, ScanError>
    ) {
        DispatchQueue.main.async { completion(result) }
    }
}

extension LiDARSessionAdapter: ARSessionDelegate {
    func session(
        _ session: ARSession,
        cameraDidChangeTrackingState camera: ARCamera
    ) {
        switch camera.trackingState {
        case .normal:
            let recovered = stateLock.withLock { () -> Bool in
                let recovered = isRecovering
                isRecovering = false
                return recovered
            }
            notify { [weak self] delegate in
                guard let self else { return }
                delegate.captureSession(self, didUpdateProviderGuidance: nil)
                if recovered {
                    delegate.captureSessionDidRecoverTracking(self)
                }
            }

        case .limited(let reason):
            switch reason {
            case .relocalizing:
                let enteredRecovery = stateLock.withLock { () -> Bool in
                    guard !isRecovering else { return false }
                    isRecovering = true
                    return true
                }
                notify { [weak self] delegate in
                    guard let self else { return }
                    delegate.captureSession(self, didUpdateProviderGuidance: nil)
                    if enteredRecovery {
                        delegate.captureSessionDidEnterRecovery(self)
                    }
                }

            case .excessiveMotion:
                notify { [weak self] delegate in
                    guard let self else { return }
                    delegate.captureSession(self, didUpdateProviderGuidance: .slowDown)
                }

            case .insufficientFeatures:
                notify { [weak self] delegate in
                    guard let self else { return }
                    delegate.captureSession(self, didUpdateProviderGuidance: .holdSteady)
                }

            case .initializing:
                notify { [weak self] delegate in
                    guard let self else { return }
                    delegate.captureSession(self, didUpdateProviderGuidance: nil)
                }

            @unknown default:
                notify { [weak self] delegate in
                    guard let self else { return }
                    delegate.captureSession(self, didUpdateProviderGuidance: .holdSteady)
                }
            }

        case .notAvailable:
            stateLock.withLock { isRecovering = false }
            notifyFailure(.trackingFailed)
        }
    }

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        let depthBuffer = frame.smoothedSceneDepth?.depthMap ?? frame.sceneDepth?.depthMap
        let previewFrame = CapturePreviewFrame(
            colorBuffer: frame.capturedImage,
            depthBuffer: depthBuffer,
            cameraIntrinsics: frame.camera.intrinsics,
            cameraTransform: frame.camera.transform,
            timestamp: frame.timestamp
        )
        notify { [weak self] delegate in
            guard let self else { return }
            delegate.captureSession(self, didOutput: previewFrame)
        }

        let snapshot: FrameStats? = stateLock.withLock {
            guard accumulating else { return nil }

            frameStats.totalCaptured += 1
            switch frame.camera.trackingState {
            case .normal:
                frameStats.accepted += 1
            case .limited, .notAvailable:
                frameStats.poorTracking += 1
            }
            updateDurationLocked()
            return frameStats
        }

        if let snapshot {
            notify { [weak self] delegate in
                guard let self else { return }
                delegate.captureSession(self, didUpdate: snapshot)
            }
        }
    }

    func session(_ session: ARSession, didAdd anchors: [ARAnchor]) {
        capture(anchors.compactMap { $0 as? ARMeshAnchor })
    }

    func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) {
        capture(anchors.compactMap { $0 as? ARMeshAnchor })
    }

    func session(_ session: ARSession, didFailWithError error: Error) {
        notifyFailure(.cameraSessionFailed(reason: error.localizedDescription))
    }

    func sessionWasInterrupted(_ session: ARSession) {
        let enteredRecovery = stateLock.withLock { () -> Bool in
            guard !isRecovering else { return false }
            isRecovering = true
            return true
        }
        guard enteredRecovery else { return }
        notify { [weak self] delegate in
            guard let self else { return }
            delegate.captureSessionDidEnterRecovery(self)
        }
    }

    func sessionInterruptionEnded(_ session: ARSession) {
        // ARKit now owns relocalization. Tracking-state callbacks determine
        // whether recovery succeeds without resetting any mesh anchors.
    }

    func sessionShouldAttemptRelocalization(_ session: ARSession) -> Bool {
        true
    }
}

private enum LiDARPLYSerializer {
    static func makeData(
        vertices: [SIMD3<Float>],
        normals: [SIMD3<Float>],
        faces: [SIMD3<UInt32>],
        bodySegment: String
    ) throws -> Data {
        guard vertices.count == normals.count else {
            throw ScanError.pointCloudPersistenceFailed(reason: "LiDAR vertex and normal counts differ.")
        }

        let header = """
        ply
        format binary_little_endian 1.0
        comment DynaXcan raw LiDAR scene mesh; coordinates are metres
        comment body_segment \(bodySegment)
        element vertex \(vertices.count)
        property float x
        property float y
        property float z
        property float nx
        property float ny
        property float nz
        element face \(faces.count)
        property list uchar uint vertex_indices
        end_header
        """ + "\n"

        var data = Data(header.utf8)
        data.reserveCapacity(
            data.count
                + vertices.count * 6 * MemoryLayout<Float>.size
                + faces.count * (MemoryLayout<UInt8>.size + 3 * MemoryLayout<UInt32>.size)
        )

        for index in vertices.indices {
            data.appendLittleEndian(vertices[index].x)
            data.appendLittleEndian(vertices[index].y)
            data.appendLittleEndian(vertices[index].z)
            data.appendLittleEndian(normals[index].x)
            data.appendLittleEndian(normals[index].y)
            data.appendLittleEndian(normals[index].z)
        }

        for face in faces {
            data.append(3)
            data.appendLittleEndian(face.x)
            data.appendLittleEndian(face.y)
            data.appendLittleEndian(face.z)
        }

        return data
    }
}

private extension Data {
    mutating func appendLittleEndian(_ value: Float) {
        appendLittleEndian(value.bitPattern)
    }

    mutating func appendLittleEndian(_ value: UInt32) {
        var littleEndianValue = value.littleEndian
        Swift.withUnsafeBytes(of: &littleEndianValue) {
            append(contentsOf: $0)
        }
    }
}

private extension NSLock {
    func withLock<T>(_ body: () throws -> T) rethrows -> T {
        lock()
        defer { unlock() }
        return try body()
    }
}
