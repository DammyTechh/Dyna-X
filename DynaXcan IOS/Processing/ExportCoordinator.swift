import Foundation
import StandardCyborgFusion

final class ExportCoordinator {
    enum ExportFormat: String, Codable, Hashable {
        case ply
        case obj
    }

    struct ExportResult {
        let scanId: String
        let format: ExportFormat
        let outputURL: URL
        let metadata: ScanMetadata
        let rawPointCloudURL: URL
    }

    private let rawPointCloudStore: RawPointCloudStore
    private let meshGenerator: MeshGenerator
    private let plyExporter: PLYExporter
    private let objExporter: OBJExporter
    private let processingQueue = DispatchQueue(
        label: "com.dynaxcan.export-coordinator",
        qos: .userInitiated
    )

    init(
        rawPointCloudStore: RawPointCloudStore = RawPointCloudStore(),
        meshGenerator: MeshGenerator = MeshGenerator(),
        plyExporter: PLYExporter = PLYExporter(),
        objExporter: OBJExporter = OBJExporter()
    ) {
        self.rawPointCloudStore = rawPointCloudStore
        self.meshGenerator = meshGenerator
        self.plyExporter = plyExporter
        self.objExporter = objExporter
    }

    func process(
        pointCloudData: Data,
        pointCloud: SCPointCloud,
        configuration: ScanConfiguration,
        frameStats: FrameStats,
        scannerType: DeviceCapabilities.ScannerType,
        exportFormat: ExportFormat,
        environmentOverridden: Bool,
        progressHandler: @escaping (Float, String) -> Void,
        completion: @escaping (Result<ExportResult, ScanError>) -> Void
    ) {
        beginProcess(
            pointCloudData: pointCloudData,
            pointCloud: pointCloud,
            configuration: configuration,
            frameStats: frameStats,
            scannerType: scannerType,
            exportFormat: exportFormat,
            environmentOverridden: environmentOverridden,
            progressHandler: progressHandler,
            completion: completion
        )
    }

    /// Produces another format for an already-persisted immutable raw scan.
    /// The original scan identifier and raw source are reused without rewriting.
    func processExistingRawPointCloud(
        at rawPointCloudURL: URL,
        scanId: String,
        configuration: ScanConfiguration,
        frameStats: FrameStats,
        scannerType: DeviceCapabilities.ScannerType,
        exportFormat: ExportFormat,
        environmentOverridden: Bool,
        progressHandler: @escaping (Float, String) -> Void,
        completion: @escaping (Result<ExportResult, ScanError>) -> Void
    ) {
        reportProgress(0.15, "Building 3D mesh…", using: progressHandler)
        meshGenerator.generate(
            fromPLYAt: rawPointCloudURL,
            quality: .standard,
            progressHandler: { [weak self] progress in
                self?.reportProgress(
                    0.15 + 0.55 * progress,
                    "Building 3D mesh…",
                    using: progressHandler
                )
            },
            completion: { [weak self] result in
                guard let self else { return }
                switch result {
                case .failure(let error):
                    self.finish(.failure(error), completion: completion)
                case .success(let mesh):
                    self.export(
                        mesh: mesh,
                        scanId: scanId,
                        rawPointCloudURL: rawPointCloudURL,
                        configuration: configuration,
                        frameStats: frameStats,
                        scannerType: scannerType,
                        exportFormat: exportFormat,
                        environmentOverridden: environmentOverridden,
                        progressHandler: progressHandler,
                        completion: completion
                    )
                }
            }
        )
    }

    /// Provider-neutral entry point for CaptureSessionResult. Meshing reads the
    /// immutable raw PLY directly, so StandardCyborg types do not cross into UI.
    func process(
        pointCloudData: Data,
        configuration: ScanConfiguration,
        frameStats: FrameStats,
        scannerType: DeviceCapabilities.ScannerType,
        exportFormat: ExportFormat,
        environmentOverridden: Bool,
        progressHandler: @escaping (Float, String) -> Void,
        completion: @escaping (Result<ExportResult, ScanError>) -> Void
    ) {
        beginProcess(
            pointCloudData: pointCloudData,
            pointCloud: nil,
            configuration: configuration,
            frameStats: frameStats,
            scannerType: scannerType,
            exportFormat: exportFormat,
            environmentOverridden: environmentOverridden,
            progressHandler: progressHandler,
            completion: completion
        )
    }

    private func beginProcess(
        pointCloudData: Data,
        pointCloud: SCPointCloud?,
        configuration: ScanConfiguration,
        frameStats: FrameStats,
        scannerType: DeviceCapabilities.ScannerType,
        exportFormat: ExportFormat,
        environmentOverridden: Bool,
        progressHandler: @escaping (Float, String) -> Void,
        completion: @escaping (Result<ExportResult, ScanError>) -> Void
    ) {
        let scanId = UUID().uuidString
        reportProgress(0, "Saving raw scan data…", using: progressHandler)

        processingQueue.async { [self] in
            let rawPointCloudURL: URL
            do {
                rawPointCloudURL = try self.rawPointCloudStore.save(
                    plyData: pointCloudData,
                    scanId: scanId
                )
            } catch {
                self.finish(
                    .failure(
                        .pointCloudPersistenceFailed(
                            reason: "Saving raw scan data failed: \(error.localizedDescription)"
                        )
                    ),
                    completion: completion
                )
                return
            }

            self.reportProgress(0.15, "Building 3D mesh…", using: progressHandler)
            let meshingProgress: (Float) -> Void = { progress in
                self.reportProgress(
                    0.15 + 0.55 * progress,
                    "Building 3D mesh…",
                    using: progressHandler
                )
            }
            let meshingCompletion: (Result<SCMesh, ScanError>) -> Void = {
                [self] meshResult in
                switch meshResult {
                case .failure(let error):
                    self.finish(
                        .failure(
                            .meshingFailed(
                                reason: "Building the 3D mesh failed: \(error.localizedDescription)"
                            )
                        ),
                        completion: completion
                    )

                case .success(let mesh):
                    self.export(
                        mesh: mesh,
                        scanId: scanId,
                        rawPointCloudURL: rawPointCloudURL,
                        configuration: configuration,
                        frameStats: frameStats,
                        scannerType: scannerType,
                        exportFormat: exportFormat,
                        environmentOverridden: environmentOverridden,
                        progressHandler: progressHandler,
                        completion: completion
                    )
                }
            }

            if let pointCloud {
                self.meshGenerator.generate(
                    from: pointCloud,
                    quality: .standard,
                    progressHandler: meshingProgress,
                    completion: meshingCompletion
                )
            } else {
                self.meshGenerator.generate(
                    fromPLYAt: rawPointCloudURL,
                    quality: .standard,
                    progressHandler: meshingProgress,
                    completion: meshingCompletion
                )
            }
        }
    }

    private func export(
        mesh: SCMesh,
        scanId: String,
        rawPointCloudURL: URL,
        configuration: ScanConfiguration,
        frameStats: FrameStats,
        scannerType: DeviceCapabilities.ScannerType,
        exportFormat: ExportFormat,
        environmentOverridden: Bool,
        progressHandler: @escaping (Float, String) -> Void,
        completion: @escaping (Result<ExportResult, ScanError>) -> Void
    ) {
        reportProgress(0.70, "Exporting scan…", using: progressHandler)
        processingQueue.async { [self] in
            let outputURL: URL
            do {
                try ExportsDirectory.ensureExists()
                switch exportFormat {
                case .ply:
                    outputURL = try self.plyExporter.export(
                        mesh: mesh,
                        scanId: scanId,
                        to: ExportsDirectory.url
                    )
                case .obj:
                    outputURL = try self.objExporter.export(
                        mesh: mesh,
                        scanId: scanId,
                        to: ExportsDirectory.url
                    )
                }
            } catch {
                self.finish(
                    .failure(
                        .exportFailed(
                            reason: "Exporting the triangulated mesh failed: \(error.localizedDescription)"
                        )
                    ),
                    completion: completion
                )
                return
            }

            self.reportProgress(0.90, "Finalising…", using: progressHandler)
            let metadata = ScanMetadata.create(
                scanId: scanId,
                bodySegment: configuration.bodySegment,
                scannerType: scannerType,
                frameStats: frameStats,
                exportFormat: exportFormat.rawValue,
                environmentOverridden: environmentOverridden
            )
            let metadataURL = ExportsDirectory.metadataURL(
                for: scanId,
                format: exportFormat
            )

            do {
                try self.writeMetadata(metadata, to: metadataURL)
            } catch {
                let cleanupDescription = self.cleanupPartialExport(
                    outputURL: outputURL,
                    metadataURL: metadataURL
                )
                let suffix = cleanupDescription.map { " Cleanup also failed: \($0)" } ?? ""
                self.finish(
                    .failure(
                        .exportFailed(
                            reason: "Writing scan metadata failed: \(error.localizedDescription).\(suffix)"
                        )
                    ),
                    completion: completion
                )
                return
            }

            self.reportProgress(1, "Finalising…", using: progressHandler)
            self.finish(
                .success(
                    ExportResult(
                        scanId: scanId,
                        format: exportFormat,
                        outputURL: outputURL,
                        metadata: metadata,
                        rawPointCloudURL: rawPointCloudURL
                    )
                ),
                completion: completion
            )
        }
    }

    private func writeMetadata(_ metadata: ScanMetadata, to metadataURL: URL) throws {
        let fileManager = FileManager.default
        guard !fileManager.fileExists(atPath: metadataURL.path) else {
            throw ScanError.exportFailed(reason: "The companion metadata file already exists.")
        }

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(metadata)
        let stagingURL = metadataURL.deletingLastPathComponent().appendingPathComponent(
            ".metadata-pending-\(UUID().uuidString).json"
        )

        do {
            try data.write(to: stagingURL, options: .atomic)
            try fileManager.moveItem(at: stagingURL, to: metadataURL)
        } catch {
            if fileManager.fileExists(atPath: stagingURL.path) {
                do {
                    try fileManager.removeItem(at: stagingURL)
                } catch let cleanupError {
                    throw ScanError.exportFailed(
                        reason: "Metadata writing failed and its temporary file could not be removed: \(cleanupError.localizedDescription)"
                    )
                }
            }
            throw error
        }
    }

    private func cleanupPartialExport(
        outputURL: URL,
        metadataURL: URL
    ) -> String? {
        let fileManager = FileManager.default
        do {
            if fileManager.fileExists(atPath: outputURL.path) {
                try fileManager.removeItem(at: outputURL)
            }
            if fileManager.fileExists(atPath: metadataURL.path) {
                try fileManager.removeItem(at: metadataURL)
            }
            return nil
        } catch {
            return error.localizedDescription
        }
    }

    private func reportProgress(
        _ progress: Float,
        _ label: String,
        using handler: @escaping (Float, String) -> Void
    ) {
        DispatchQueue.main.async {
            handler(max(0, min(1, progress)), label)
        }
    }

    private func finish(
        _ result: Result<ExportResult, ScanError>,
        completion: @escaping (Result<ExportResult, ScanError>) -> Void
    ) {
        DispatchQueue.main.async {
            completion(result)
        }
    }
}
