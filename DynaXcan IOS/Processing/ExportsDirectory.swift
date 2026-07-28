import Foundation

struct ExportsDirectory {
    struct ExportSummary {
        let scanId: String
        let format: ExportCoordinator.ExportFormat
        let outputURL: URL
        let metadataURL: URL
        let createdAt: Date
        let fileSizeBytes: Int64
    }

    static var url: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            .appendingPathComponent("DynaXcan Exports", isDirectory: true)
    }

    static func ensureExists() throws {
        do {
            try FileManager.default.createDirectory(
                at: url,
                withIntermediateDirectories: true
            )
        } catch {
            throw ScanError.exportFailed(
                reason: "Could not create the DynaXcan Exports directory: \(error.localizedDescription)"
            )
        }
    }

    static func url(
        for scanId: String,
        format: ExportCoordinator.ExportFormat
    ) -> URL {
        switch format {
        case .ply:
            return url.appendingPathComponent(
                "\(AppConfiguration.plyExportPrefix)\(scanId).ply",
                isDirectory: false
            )
        case .obj:
            return url.appendingPathComponent(
                "\(AppConfiguration.exportDirectoryPrefix)\(scanId)",
                isDirectory: true
            )
        }
    }

    static func metadataURL(
        for scanId: String,
        format: ExportCoordinator.ExportFormat
    ) -> URL {
        switch format {
        case .ply:
            return url.appendingPathComponent("\(scanId)_metadata.json")
        case .obj:
            return url(for: scanId, format: format)
                .appendingPathComponent("\(scanId)_metadata.json")
        }
    }

    static func listExports() throws -> [ExportSummary] {
        try ensureExists()
        let fileManager = FileManager.default
        let keys: Set<URLResourceKey> = [.isDirectoryKey, .isRegularFileKey]

        do {
            let children = try fileManager.contentsOfDirectory(
                at: url,
                includingPropertiesForKeys: Array(keys),
                options: [.skipsHiddenFiles]
            )
            var results: [ExportSummary] = []

            for child in children {
                let values = try child.resourceValues(forKeys: keys)
                let name = child.lastPathComponent
                let format: ExportCoordinator.ExportFormat
                let scanId: String

                if values.isRegularFile == true,
                   name.hasPrefix(AppConfiguration.plyExportPrefix),
                   name.hasSuffix(".ply") {
                    format = .ply
                    scanId = identifier(
                        from: name,
                        prefix: AppConfiguration.plyExportPrefix,
                        suffix: ".ply"
                    )
                } else if values.isDirectory == true,
                          name.hasPrefix(AppConfiguration.exportDirectoryPrefix) {
                    format = .obj
                    scanId = identifier(
                        from: name,
                        prefix: AppConfiguration.exportDirectoryPrefix,
                        suffix: ""
                    )
                } else {
                    continue
                }

                guard !scanId.isEmpty else { continue }
                let metadataURL = metadataURL(for: scanId, format: format)
                guard fileManager.fileExists(atPath: metadataURL.path) else {
                    throw ScanError.exportFailed(
                        reason: "Export \(scanId) is missing its companion metadata file."
                    )
                }

                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                let metadata = try decoder.decode(
                    ScanMetadata.self,
                    from: Data(contentsOf: metadataURL)
                )
                results.append(
                    ExportSummary(
                        scanId: scanId,
                        format: format,
                        outputURL: child,
                        metadataURL: metadataURL,
                        createdAt: metadata.createdAt,
                        fileSizeBytes: try recursiveFileSize(at: child)
                    )
                )
            }

            return results.sorted { $0.createdAt > $1.createdAt }
        } catch let error as ScanError {
            throw error
        } catch {
            throw ScanError.exportFailed(
                reason: "Could not list DynaXcan exports: \(error.localizedDescription)"
            )
        }
    }

    static func delete(scanId: String) throws {
        try validate(scanId: scanId)
        let fileManager = FileManager.default
        let plyURL = url(for: scanId, format: .ply)
        let plyMetadataURL = metadataURL(for: scanId, format: .ply)
        let objURL = url(for: scanId, format: .obj)
        let candidates = [plyURL, plyMetadataURL, objURL]
        let existing = candidates.filter { fileManager.fileExists(atPath: $0.path) }
        guard !existing.isEmpty else {
            throw ScanError.exportFailed(reason: "No export exists for scan \(scanId).")
        }

        for item in existing {
            do {
                try fileManager.removeItem(at: item)
            } catch {
                throw ScanError.exportFailed(
                    reason: "Could not delete export \(scanId): \(error.localizedDescription)"
                )
            }
        }
    }

    private static func identifier(
        from filename: String,
        prefix: String,
        suffix: String
    ) -> String {
        let start = filename.index(filename.startIndex, offsetBy: prefix.count)
        let end = suffix.isEmpty
            ? filename.endIndex
            : filename.index(filename.endIndex, offsetBy: -suffix.count)
        return String(filename[start..<end])
    }

    private static func recursiveFileSize(at itemURL: URL) throws -> Int64 {
        let fileManager = FileManager.default
        let values = try itemURL.resourceValues(forKeys: [.isDirectoryKey, .fileSizeKey])
        guard values.isDirectory == true else {
            return Int64(values.fileSize ?? 0)
        }

        guard let enumerator = fileManager.enumerator(
            at: itemURL,
            includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey],
            options: [.skipsHiddenFiles]
        ) else {
            throw ScanError.exportFailed(
                reason: "Could not inspect export directory \(itemURL.lastPathComponent)."
            )
        }

        var total: Int64 = 0
        for case let fileURL as URL in enumerator {
            let fileValues = try fileURL.resourceValues(
                forKeys: [.isRegularFileKey, .fileSizeKey]
            )
            if fileValues.isRegularFile == true {
                total += Int64(fileValues.fileSize ?? 0)
            }
        }
        return total
    }

    private static func validate(scanId: String) throws {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        guard !scanId.isEmpty, scanId.unicodeScalars.allSatisfy(allowed.contains) else {
            throw ScanError.exportFailed(reason: "The scan identifier is invalid.")
        }
    }
}
