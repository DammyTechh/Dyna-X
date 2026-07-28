import Foundation

final class RawPointCloudStore {
    private let storageDirectory: URL
    private let fileManager: FileManager

    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
        let appSupport = fileManager.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first!
        storageDirectory = appSupport.appendingPathComponent(
            "RawPointClouds",
            isDirectory: true
        )
    }

    func save(plyData: Data, scanId: String) throws -> URL {
        let scanId = try validatedScanId(scanId)
        guard !plyData.isEmpty, plyData.starts(with: Data("ply".utf8)) else {
            throw ScanError.pointCloudPersistenceFailed(
                reason: "The finalized point cloud is not valid PLY data."
            )
        }

        try ensureStorageDirectory()
        let fileURL = url(for: scanId)
        guard !fileManager.fileExists(atPath: fileURL.path) else {
            throw ScanError.pointCloudPersistenceFailed(
                reason: "Raw scan data already exists for scan \(scanId) and cannot be overwritten."
            )
        }

        let stagingURL = storageDirectory.appendingPathComponent(
            ".pending-\(UUID().uuidString).ply"
        )
        do {
            try plyData.write(to: stagingURL, options: .atomic)
            try fileManager.moveItem(at: stagingURL, to: fileURL)
            return fileURL
        } catch {
            if fileManager.fileExists(atPath: stagingURL.path) {
                do {
                    try fileManager.removeItem(at: stagingURL)
                } catch let cleanupError {
                    throw ScanError.pointCloudPersistenceFailed(
                        reason: "Raw scan saving failed, and its temporary file could not be cleaned up: \(cleanupError.localizedDescription)"
                    )
                }
            }
            throw ScanError.pointCloudPersistenceFailed(
                reason: "Could not save immutable raw scan data: \(error.localizedDescription)"
            )
        }
    }

    func pruneExpired() throws {
        let expirationDate = Date().addingTimeInterval(
            -AppConfiguration.rawPointCloudRetentionSeconds
        )
        for item in try list() where item.createdAt < expirationDate {
            do {
                try fileManager.removeItem(at: item.fileURL)
            } catch {
                throw ScanError.pointCloudPersistenceFailed(
                    reason: "Could not remove expired raw scan \(item.scanId): \(error.localizedDescription)"
                )
            }
        }
    }

    func delete(scanId: String) throws {
        let scanId = try validatedScanId(scanId)
        let fileURL = url(for: scanId)
        guard fileManager.fileExists(atPath: fileURL.path) else {
            throw ScanError.pointCloudPersistenceFailed(
                reason: "No raw point cloud exists for scan \(scanId)."
            )
        }

        do {
            try fileManager.removeItem(at: fileURL)
        } catch {
            throw ScanError.pointCloudPersistenceFailed(
                reason: "Could not delete raw scan \(scanId): \(error.localizedDescription)"
            )
        }
    }

    func list() throws -> [(scanId: String, createdAt: Date, fileURL: URL)] {
        try ensureStorageDirectory()
        let keys: Set<URLResourceKey> = [.creationDateKey, .isRegularFileKey]

        do {
            return try fileManager.contentsOfDirectory(
                at: storageDirectory,
                includingPropertiesForKeys: Array(keys),
                options: [.skipsHiddenFiles]
            ).compactMap { fileURL in
                let filename = fileURL.lastPathComponent
                guard
                    filename.hasPrefix(AppConfiguration.rawExportPrefix),
                    filename.hasSuffix(".ply")
                else {
                    return nil
                }

                let values = try fileURL.resourceValues(forKeys: keys)
                guard values.isRegularFile == true else { return nil }
                let start = filename.index(
                    filename.startIndex,
                    offsetBy: AppConfiguration.rawExportPrefix.count
                )
                let end = filename.index(filename.endIndex, offsetBy: -4)
                let scanId = String(filename[start..<end])
                guard !scanId.isEmpty else { return nil }

                return (
                    scanId: scanId,
                    createdAt: values.creationDate ?? .distantPast,
                    fileURL: fileURL
                )
            }.sorted { $0.createdAt > $1.createdAt }
        } catch let error as ScanError {
            throw error
        } catch {
            throw ScanError.pointCloudPersistenceFailed(
                reason: "Could not list stored raw scans: \(error.localizedDescription)"
            )
        }
    }

    private func ensureStorageDirectory() throws {
        do {
            try fileManager.createDirectory(
                at: storageDirectory,
                withIntermediateDirectories: true
            )
        } catch {
            throw ScanError.pointCloudPersistenceFailed(
                reason: "Could not create protected raw-scan storage: \(error.localizedDescription)"
            )
        }
    }

    private func url(for scanId: String) -> URL {
        storageDirectory.appendingPathComponent(
            "\(AppConfiguration.rawExportPrefix)\(scanId).ply",
            isDirectory: false
        )
    }

    private func validatedScanId(_ scanId: String) throws -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        guard
            !scanId.isEmpty,
            scanId.unicodeScalars.allSatisfy(allowed.contains)
        else {
            throw ScanError.pointCloudPersistenceFailed(reason: "The scan identifier is invalid.")
        }
        return scanId
    }
}
