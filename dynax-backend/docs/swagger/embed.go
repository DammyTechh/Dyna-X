package swagger

import _ "embed"

// SwaggerJSON holds the raw generated OpenAPI 2.0 spec, served directly at
// /swagger/doc.json. Serving the embedded file avoids relying on
// gin-swagger's runtime template rendering, which was returning 500.
//
//go:embed swagger.json
var SwaggerJSON []byte
