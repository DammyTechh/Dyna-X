import Foundation
import StandardCyborgFusion

final class PLYExporter {
    func export(
        mesh: SCMesh,
        scanId: String,
        to directory: URL
    ) throws -> URL {
        let snapshot = try MeshExportSnapshot(mesh: mesh)
        let scanId = try validatedExportScanId(scanId)
        let fileManager = FileManager.default

        do {
            try fileManager.createDirectory(
                at: directory,
                withIntermediateDirectories: true
            )
        } catch {
            throw ScanError.exportFailed(
                reason: "Could not create the PLY export directory: \(error.localizedDescription)"
            )
        }

        let outputURL = directory.appendingPathComponent(
            "\(AppConfiguration.plyExportPrefix)\(scanId).ply"
        )
        guard !fileManager.fileExists(atPath: outputURL.path) else {
            throw ScanError.exportFailed(
                reason: "A PLY export already exists for scan \(scanId)."
            )
        }

        var headerLines = [
            "ply",
            "format binary_little_endian 1.0",
            "comment DynaXcan triangulated clinical scan",
            "element vertex \(snapshot.positions.count)",
            "property float x",
            "property float y",
            "property float z",
            "property float nx",
            "property float ny",
            "property float nz"
        ]
        if snapshot.colors != nil {
            headerLines.append(contentsOf: [
                "property uchar red",
                "property uchar green",
                "property uchar blue"
            ])
        }
        headerLines.append(contentsOf: [
            "element face \(snapshot.faces.count)",
            "property list uchar int vertex_indices",
            "end_header"
        ])

        var data = Data((headerLines.joined(separator: "\n") + "\n").utf8)
        let colorBytesPerVertex = snapshot.colors == nil ? 0 : 3
        data.reserveCapacity(
            data.count
                + snapshot.positions.count * (6 * MemoryLayout<Float>.size + colorBytesPerVertex)
                + snapshot.faces.count * (1 + 3 * MemoryLayout<Int32>.size)
        )

        for index in snapshot.positions.indices {
            let position = snapshot.positions[index]
            let normal = snapshot.normals[index]
            data.appendLittleEndian(position.x)
            data.appendLittleEndian(position.y)
            data.appendLittleEndian(position.z)
            data.appendLittleEndian(normal.x)
            data.appendLittleEndian(normal.y)
            data.appendLittleEndian(normal.z)

            if let color = snapshot.colors?[index] {
                data.append(Self.colorByte(color.x))
                data.append(Self.colorByte(color.y))
                data.append(Self.colorByte(color.z))
            }
        }

        for face in snapshot.faces {
            data.append(UInt8(3))
            data.appendLittleEndian(face.x)
            data.appendLittleEndian(face.y)
            data.appendLittleEndian(face.z)
        }

        return try writeOnce(data, to: outputURL)
    }

    private static func colorByte(_ component: Float) -> UInt8 {
        UInt8((max(0, min(1, component)) * 255).rounded())
    }

    private func writeOnce(_ data: Data, to outputURL: URL) throws -> URL {
        let fileManager = FileManager.default
        let stagingURL = outputURL.deletingLastPathComponent().appendingPathComponent(
            ".pending-\(UUID().uuidString).ply"
        )
        do {
            try data.write(to: stagingURL, options: .atomic)
            try fileManager.moveItem(at: stagingURL, to: outputURL)
            return outputURL
        } catch {
            if fileManager.fileExists(atPath: stagingURL.path) {
                do {
                    try fileManager.removeItem(at: stagingURL)
                } catch let cleanupError {
                    throw ScanError.exportFailed(
                        reason: "PLY export failed and its temporary file could not be removed: \(cleanupError.localizedDescription)"
                    )
                }
            }
            throw ScanError.exportFailed(
                reason: "Could not write the triangulated PLY: \(error.localizedDescription)"
            )
        }
    }
}

struct MeshExportSnapshot {
    let positions: [SIMD3<Float>]
    let normals: [SIMD3<Float>]
    let faces: [SIMD3<Int32>]
    let colors: [SIMD3<Float>]?

    init(mesh: SCMesh) throws {
        let vertexCount = mesh.vertexCount
        let faceCount = mesh.faceCount
        guard vertexCount > 0, faceCount > 0 else {
            throw ScanError.exportFailed(reason: "The mesh contains no triangles to export.")
        }

        positions = try Self.readFloat3Vectors(
            from: mesh.positionData,
            count: vertexCount,
            label: "positions"
        )
        normals = try Self.readFloat3Vectors(
            from: mesh.normalData,
            count: vertexCount,
            label: "normals"
        )
        faces = try Self.readFaces(from: mesh.facesData, count: faceCount)

        let colorData: Data? = mesh.colorData
        if let colorData, !colorData.isEmpty {
            colors = try Self.readFloat3Vectors(
                from: colorData,
                count: vertexCount,
                label: "vertex colors"
            )
        } else {
            colors = nil
        }

        for face in faces {
            guard
                face.x >= 0, face.y >= 0, face.z >= 0,
                Int(face.x) < vertexCount,
                Int(face.y) < vertexCount,
                Int(face.z) < vertexCount
            else {
                throw ScanError.exportFailed(reason: "The mesh contains an invalid face index.")
            }
        }
    }

    private static func readFloat3Vectors(
        from data: Data,
        count: Int,
        label: String
    ) throws -> [SIMD3<Float>] {
        let stride = 4 * MemoryLayout<Float>.size
        guard data.count >= count * stride else {
            throw ScanError.exportFailed(
                reason: "The mesh \(label) buffer is incomplete."
            )
        }

        return data.withUnsafeBytes { rawBuffer in
            let floats = rawBuffer.baseAddress!.assumingMemoryBound(to: Float.self)
            return (0..<count).map { index in
                let offset = index * 4
                return SIMD3(floats[offset], floats[offset + 1], floats[offset + 2])
            }
        }
    }

    private static func readFaces(from data: Data, count: Int) throws -> [SIMD3<Int32>] {
        let valuesPerFace = 3
        guard data.count >= count * valuesPerFace * MemoryLayout<Int32>.size else {
            throw ScanError.exportFailed(reason: "The mesh face buffer is incomplete.")
        }

        return data.withUnsafeBytes { rawBuffer in
            let integers = rawBuffer.baseAddress!.assumingMemoryBound(to: Int32.self)
            return (0..<count).map { index in
                let offset = index * valuesPerFace
                return SIMD3(integers[offset], integers[offset + 1], integers[offset + 2])
            }
        }
    }
}

func validatedExportScanId(_ scanId: String) throws -> String {
    let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
    guard !scanId.isEmpty, scanId.unicodeScalars.allSatisfy(allowed.contains) else {
        throw ScanError.exportFailed(reason: "The scan identifier is invalid.")
    }
    return scanId
}

private extension Data {
    mutating func appendLittleEndian(_ value: Float) {
        appendLittleEndian(value.bitPattern)
    }

    mutating func appendLittleEndian(_ value: Int32) {
        var littleEndianValue = value.littleEndian
        Swift.withUnsafeBytes(of: &littleEndianValue) {
            append(contentsOf: $0)
        }
    }

    mutating func appendLittleEndian(_ value: UInt32) {
        var littleEndianValue = value.littleEndian
        Swift.withUnsafeBytes(of: &littleEndianValue) {
            append(contentsOf: $0)
        }
    }
}
