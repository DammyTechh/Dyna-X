import Foundation

/// Uploads a finished on-device DynaXcan scan (mesh + optional raw point cloud +
/// capture metadata) to the DynaX backend.
///
/// Contract (verified server-side): `POST {baseURL}/api/v1/scanner/device-scans`
/// with `Authorization: Bearer <DynaX JWT>` and a multipart/form-data body:
///   - `metadata`   application/json  — the ScanMetadata (optionally with
///                                      patientId / caseRef / subjectDisplayName)
///   - `mesh`       file              — the exported OBJ or PLY
///   - `pointCloud` file (optional)   — the raw PLY point cloud
///
/// The server responds `201` with `{ success, message, data: <scan> }`.
///
/// Foundation-only; drop into the DynaXcan iOS target and build in Xcode.
public struct DynaXBackendClient {

    public struct Configuration {
        /// Ecosystem host, e.g. `https://dynax.app`.
        public var baseURL: URL
        /// DynaX account token from "Sign in with DynaX".
        public var bearerToken: String

        public init(baseURL: URL, bearerToken: String) {
            self.baseURL = baseURL
            self.bearerToken = bearerToken
        }
    }

    /// The scan record the backend returns (subset of the fields it sends).
    public struct UploadedScan: Decodable {
        public let id: String
        public let ownerId: String
        public let reconstructionState: String
        public let activeAssetId: String?
    }

    public enum UploadError: Error {
        case invalidResponse
        case server(status: Int, message: String?)
        case fileUnreadable(URL)
    }

    private let configuration: Configuration
    private let session: URLSession

    public init(configuration: Configuration, session: URLSession = .shared) {
        self.configuration = configuration
        self.session = session
    }

    /// Upload a completed scan. `metadataJSON` is the encoded `ScanMetadata`
    /// (you may merge in `patientId` / `caseRef` before encoding).
    public func uploadDeviceScan(
        metadataJSON: Data,
        meshURL: URL,
        pointCloudURL: URL? = nil,
        completion: @escaping (Result<UploadedScan, Error>) -> Void
    ) {
        let endpoint = configuration.baseURL.appendingPathComponent("api/v1/scanner/device-scans")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("Bearer \(configuration.bearerToken)", forHTTPHeaderField: "Authorization")

        let boundary = "dynaxcan-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        func append(_ string: String) { body.append(Data(string.utf8)) }
        func appendPart(name: String, value: Data, filename: String?, contentType: String) {
            append("--\(boundary)\r\n")
            if let filename {
                append("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\n")
            } else {
                append("Content-Disposition: form-data; name=\"\(name)\"\r\n")
            }
            append("Content-Type: \(contentType)\r\n\r\n")
            body.append(value)
            append("\r\n")
        }

        appendPart(name: "metadata", value: metadataJSON, filename: nil, contentType: "application/json")

        guard let meshData = try? Data(contentsOf: meshURL) else {
            completion(.failure(UploadError.fileUnreadable(meshURL)))
            return
        }
        appendPart(name: "mesh", value: meshData, filename: meshURL.lastPathComponent,
                   contentType: Self.contentType(for: meshURL))

        if let pointCloudURL {
            if let pcData = try? Data(contentsOf: pointCloudURL) {
                appendPart(name: "pointCloud", value: pcData, filename: pointCloudURL.lastPathComponent,
                           contentType: "application/octet-stream")
            }
        }

        append("--\(boundary)--\r\n")
        request.httpBody = body

        session.dataTask(with: request) { data, response, error in
            if let error {
                completion(.failure(error))
                return
            }
            guard let http = response as? HTTPURLResponse else {
                completion(.failure(UploadError.invalidResponse))
                return
            }
            guard (200..<300).contains(http.statusCode) else {
                let message = data.flatMap { String(data: $0, encoding: .utf8) }
                completion(.failure(UploadError.server(status: http.statusCode, message: message)))
                return
            }
            guard let data else {
                completion(.failure(UploadError.invalidResponse))
                return
            }
            do {
                let envelope = try JSONDecoder().decode(Envelope.self, from: data)
                completion(.success(envelope.data))
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }

    private struct Envelope: Decodable { let data: UploadedScan }

    private static func contentType(for url: URL) -> String {
        url.pathExtension.lowercased() == "ply" ? "application/octet-stream" : "model/obj"
    }
}
