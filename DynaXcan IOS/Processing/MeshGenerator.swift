import Foundation
import StandardCyborgFusion

final class MeshGenerator {
    enum MeshQuality {
        case standard
        case high
    }

    private let workQueue = DispatchQueue(
        label: "com.dynaxcan.mesh-generator",
        qos: .userInitiated
    )
    private let fileManager: FileManager

    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
    }

    func generate(
        from pointCloud: SCPointCloud,
        quality: MeshQuality = .standard,
        progressHandler: ((Float) -> Void)? = nil,
        completion: @escaping (Result<SCMesh, ScanError>) -> Void
    ) {
        enqueue(
            quality: quality,
            progressHandler: progressHandler,
            completion: completion
        ) { workingDirectory in
            let inputURL = workingDirectory.appendingPathComponent("input.ply")
            guard pointCloud.writeToPLY(atPath: inputURL.path) else {
                throw ScanError.meshingFailed(
                    reason: "The finalized point cloud could not be prepared for meshing."
                )
            }
            return inputURL
        }
    }

    /// Internal framework-boundary entry point used when CaptureSession only
    /// exposes immutable PLY bytes (including the LiDAR provider).
    func generate(
        fromPLYAt inputURL: URL,
        quality: MeshQuality = .standard,
        progressHandler: ((Float) -> Void)? = nil,
        completion: @escaping (Result<SCMesh, ScanError>) -> Void
    ) {
        enqueue(
            quality: quality,
            progressHandler: progressHandler,
            completion: completion
        ) { _ in
            guard FileManager.default.fileExists(atPath: inputURL.path) else {
                throw ScanError.meshingFailed(reason: "The raw PLY input file is missing.")
            }
            return inputURL
        }
    }

    private func enqueue(
        quality: MeshQuality,
        progressHandler: ((Float) -> Void)?,
        completion: @escaping (Result<SCMesh, ScanError>) -> Void,
        prepareInput: @escaping (URL) throws -> URL
    ) {
        workQueue.async { [self] in
            let workingDirectory = fileManager.temporaryDirectory.appendingPathComponent(
                "DynaXcan-Meshing-\(UUID().uuidString)",
                isDirectory: true
            )
            let result: Result<SCMesh, ScanError>

            do {
                try fileManager.createDirectory(
                    at: workingDirectory,
                    withIntermediateDirectories: false
                )
                let inputURL = try prepareInput(workingDirectory)
                let outputURL = workingDirectory.appendingPathComponent("mesh.ply")
                let operation = SCMeshingOperation(
                    inputPLYPath: inputURL.path,
                    outputPLYPath: outputURL.path
                )
                operation.parameters = Self.parameters(for: quality)
                operation.progressHandler = { progress in
                    guard let progressHandler else { return }
                    DispatchQueue.main.async {
                        progressHandler(max(0, min(1, progress)))
                    }
                }

                // SCMeshingOperation is synchronous when explicitly started;
                // this call is already isolated on the user-initiated queue.
                operation.start()
                guard !operation.isCancelled else {
                    throw ScanError.meshingFailed(reason: "Mesh generation was cancelled.")
                }
                guard
                    fileManager.fileExists(atPath: outputURL.path),
                    let attributes = try? fileManager.attributesOfItem(atPath: outputURL.path),
                    let size = attributes[.size] as? NSNumber,
                    size.int64Value > 0
                else {
                    throw ScanError.meshingFailed(
                        reason: "StandardCyborg did not produce a mesh file."
                    )
                }

                let mesh: SCMesh? = SCMesh(
                    plyPath: outputURL.path,
                    jpegPath: ""
                )
                guard let mesh, mesh.vertexCount > 0, mesh.faceCount > 0 else {
                    throw ScanError.meshingFailed(
                        reason: "The generated mesh contains no usable triangles."
                    )
                }
                result = .success(mesh)
            } catch let error as ScanError {
                result = .failure(error)
            } catch {
                result = .failure(
                    .meshingFailed(reason: "Mesh generation failed: \(error.localizedDescription)")
                )
            }

            let finalResult: Result<SCMesh, ScanError>
            do {
                if fileManager.fileExists(atPath: workingDirectory.path) {
                    try fileManager.removeItem(at: workingDirectory)
                }
                finalResult = result
            } catch {
                finalResult = .failure(
                    .meshingFailed(
                        reason: "Temporary meshing data could not be cleaned up: \(error.localizedDescription)"
                    )
                )
            }

            DispatchQueue.main.async {
                completion(finalResult)
            }
        }
    }

    private static func parameters(for quality: MeshQuality) -> SCMeshingParameters {
        let parameters = SCMeshingParameters()
        switch quality {
        case .standard:
            parameters.resolution = 5
            parameters.smoothness = 2
            parameters.surfaceTrimmingAmount = 5
        case .high:
            parameters.resolution = 8
            parameters.smoothness = 2
            parameters.surfaceTrimmingAmount = 4
        }
        parameters.closed = true
        return parameters
    }
}
