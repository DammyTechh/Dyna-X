import Foundation
import StandardCyborgFusion

final class OBJExporter {
    func export(
        mesh: SCMesh,
        scanId: String,
        to parentDirectory: URL
    ) throws -> URL {
        let snapshot = try MeshExportSnapshot(mesh: mesh)
        let scanId = try validatedExportScanId(scanId)
        let fileManager = FileManager.default
        let directoryName = "\(AppConfiguration.exportDirectoryPrefix)\(scanId)"
        let outputDirectory = parentDirectory.appendingPathComponent(
            directoryName,
            isDirectory: true
        )
        guard !fileManager.fileExists(atPath: outputDirectory.path) else {
            throw ScanError.exportFailed(
                reason: "An OBJ export already exists for scan \(scanId)."
            )
        }

        do {
            try fileManager.createDirectory(
                at: parentDirectory,
                withIntermediateDirectories: true
            )
        } catch {
            throw ScanError.exportFailed(
                reason: "Could not create the OBJ export directory: \(error.localizedDescription)"
            )
        }

        let stagingDirectory = parentDirectory.appendingPathComponent(
            ".\(directoryName)-pending-\(UUID().uuidString)",
            isDirectory: true
        )

        do {
            try fileManager.createDirectory(
                at: stagingDirectory,
                withIntermediateDirectories: false
            )
            let objURL = stagingDirectory.appendingPathComponent("mesh.obj")
            let mtlURL = stagingDirectory.appendingPathComponent("mesh.mtl")
            try makeOBJ(snapshot: snapshot).write(
                to: objURL,
                atomically: true,
                encoding: .utf8
            )
            try Self.canonicalMTL.write(
                to: mtlURL,
                atomically: true,
                encoding: .utf8
            )
            try fileManager.moveItem(at: stagingDirectory, to: outputDirectory)
            return outputDirectory
        } catch {
            if fileManager.fileExists(atPath: stagingDirectory.path) {
                do {
                    try fileManager.removeItem(at: stagingDirectory)
                } catch let cleanupError {
                    throw ScanError.exportFailed(
                        reason: "OBJ export failed and its temporary directory could not be removed: \(cleanupError.localizedDescription)"
                    )
                }
            }
            throw ScanError.exportFailed(
                reason: "Could not write the OBJ export: \(error.localizedDescription)"
            )
        }
    }

    private func makeOBJ(snapshot: MeshExportSnapshot) -> String {
        var lines: [String] = [
            "# DynaXcan export",
            "mtllib mesh.mtl"
        ]
        lines.reserveCapacity(
            4 + snapshot.positions.count * (snapshot.colors == nil ? 2 : 3)
                + snapshot.faces.count
        )

        for position in snapshot.positions {
            lines.append(
                "v \(format(position.x)) \(format(position.y)) \(format(position.z))"
            )
        }
        for normal in snapshot.normals {
            lines.append(
                "vn \(format(normal.x)) \(format(normal.y)) \(format(normal.z))"
            )
        }
        if let colors = snapshot.colors {
            for color in colors {
                lines.append(
                    "vc \(format(clamp(color.x))) \(format(clamp(color.y))) \(format(clamp(color.z)))"
                )
            }
        }

        lines.append("usemtl DynaXcanMaterial")
        for face in snapshot.faces {
            let first = face.x + 1
            let second = face.y + 1
            let third = face.z + 1
            lines.append(
                "f \(first)//\(first) \(second)//\(second) \(third)//\(third)"
            )
        }
        return lines.joined(separator: "\n") + "\n"
    }

    private func format(_ value: Float) -> String {
        String(
            format: "%.6f",
            locale: Locale(identifier: "en_US_POSIX"),
            Double(value)
        )
    }

    private func clamp(_ value: Float) -> Float {
        max(0, min(1, value))
    }

    private static let canonicalMTL = """
    # DynaXcan material
    newmtl DynaXcanMaterial
    Ka 0.000000 0.000000 0.000000
    Kd 1.000000 1.000000 1.000000
    Ks 0.000000 0.000000 0.000000
    Ns 0.000000
    d 1.000000
    illum 1
    """ + "\n"
}
