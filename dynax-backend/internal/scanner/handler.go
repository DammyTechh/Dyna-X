package scanner

import (
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/dynalimb/dynax-backend/internal/middleware"
	"github.com/dynalimb/dynax-backend/internal/repository/db"
	"github.com/dynalimb/dynax-backend/pkg/response"
)

const defaultMaxUploadBytes = 524_288_000 // 500 MB

// Handler serves the scanner endpoints (all under DynaX auth).
type Handler struct {
	svc            *Service
	maxUploadBytes int64
}

// NewHandler builds the scanner Handler over the shared pool.
func NewHandler(pool *db.Pool) *Handler {
	return &Handler{svc: NewService(pool), maxUploadBytes: defaultMaxUploadBytes}
}

// CaptureConfig describes accepted input + capture bounds for the client.
//
// @Summary  Scanner capture configuration
// @Tags     scanner
// @Security BearerAuth
// @Produce  json
// @Router   /api/v1/scanner/capture/config [get]
func (h *Handler) CaptureConfig(c *gin.Context) {
	response.OK(c, "Capture configuration", gin.H{
		"captureMinDurationMs": 15_000,
		"captureMaxDurationMs": 180_000,
		"maxUploadBytes":       h.maxUploadBytes,
		"acceptedMediaTypes":   []string{"video/mp4", "video/quicktime"},
		"reconstructionModes":  []string{ModeStandard, ModeFeatureless},
	})
}

// ListScans returns the caller's scans.
//
// @Summary  List scans
// @Tags     scanner
// @Security BearerAuth
// @Produce  json
// @Router   /api/v1/scanner/scans [get]
func (h *Handler) ListScans(c *gin.Context) {
	scans, err := h.svc.ListScans(c.Request.Context(), middleware.GetUserID(c))
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.OK(c, "Scans retrieved", gin.H{"scans": scans})
}

// CreateScan starts a new scan session.
//
// @Summary  Create scan
// @Tags     scanner
// @Security BearerAuth
// @Accept   json
// @Produce  json
// @Router   /api/v1/scanner/scans [post]
func (h *Handler) CreateScan(c *gin.Context) {
	var in CreateScanInput
	_ = c.ShouldBindJSON(&in)
	scan, err := h.svc.CreateScan(c.Request.Context(), middleware.GetUserID(c), in)
	if err != nil {
		response.InternalError(c, err)
		return
	}
	response.Created(c, "Scan created", scan)
}

// GetScan returns one scan the caller owns.
//
// @Summary  Get scan
// @Tags     scanner
// @Security BearerAuth
// @Produce  json
// @Router   /api/v1/scanner/scans/{id} [get]
func (h *Handler) GetScan(c *gin.Context) {
	scan, err := h.svc.GetScan(c.Request.Context(), middleware.GetUserID(c), c.Param("id"))
	if err != nil {
		response.NotFound(c, "scan")
		return
	}
	response.OK(c, "Scan retrieved", scan)
}

// UploadInput stores the scan's input video (raw request body).
//
// @Summary  Upload scan input video
// @Tags     scanner
// @Security BearerAuth
// @Accept   octet-stream
// @Produce  json
// @Router   /api/v1/scanner/scans/{id}/input [put]
func (h *Handler) UploadInput(c *gin.Context) {
	mediaType := c.GetHeader("Content-Type")
	if i := strings.IndexByte(mediaType, ';'); i >= 0 {
		mediaType = strings.TrimSpace(mediaType[:i])
	}
	fileName := c.Query("fileName")
	if fileName == "" {
		fileName = "input.mp4"
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, h.maxUploadBytes)
	data, err := io.ReadAll(c.Request.Body)
	if err != nil {
		response.UnprocessableEntity(c, "The upload was too large or could not be read.", nil)
		return
	}
	if len(data) == 0 {
		response.BadRequest(c, "EMPTY_UPLOAD", "The request body was empty.")
		return
	}
	asset, err := h.svc.SaveInput(c.Request.Context(), middleware.GetUserID(c), c.Param("id"), data, mediaType, fileName)
	if err != nil {
		h.writeServiceError(c, err)
		return
	}
	response.Created(c, "Input stored", asset)
}

// StartReconstruction submits the input video for reconstruction.
//
// @Summary  Start reconstruction
// @Tags     scanner
// @Security BearerAuth
// @Produce  json
// @Router   /api/v1/scanner/scans/{id}/reconstruction [post]
func (h *Handler) StartReconstruction(c *gin.Context) {
	scan, err := h.svc.StartReconstruction(c.Request.Context(), middleware.GetUserID(c), c.Param("id"))
	if err != nil {
		h.writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"success": true, "message": "Reconstruction started", "data": scan})
}

// DownloadAsset streams an owned asset's bytes.
//
// @Summary  Download an asset
// @Tags     scanner
// @Security BearerAuth
// @Produce  octet-stream
// @Router   /api/v1/scanner/assets/{id}/download [get]
func (h *Handler) DownloadAsset(c *gin.Context) {
	asset, data, err := h.svc.AssetBytes(c.Request.Context(), middleware.GetUserID(c), c.Param("id"))
	if err != nil {
		response.NotFound(c, "asset")
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, safeFileName(asset.FileName)))
	c.Header("Content-Length", strconv.FormatInt(int64(len(data)), 10))
	c.Data(http.StatusOK, asset.MediaType, data)
}

// UploadDeviceScan ingests a finished on-device (LiDAR/TrueDepth) reconstruction.
// multipart/form-data: `metadata` (JSON), `mesh` (file), optional `pointCloud`.
//
// @Summary  Upload an on-device scan
// @Tags     scanner
// @Security BearerAuth
// @Accept   mpfd
// @Produce  json
// @Router   /api/v1/scanner/device-scans [post]
func (h *Handler) UploadDeviceScan(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, h.maxUploadBytes)
	if err := c.Request.ParseMultipartForm(32 << 20); err != nil {
		response.UnprocessableEntity(c, "The upload was too large or malformed.", nil)
		return
	}
	metaRaw := []byte(c.Request.FormValue("metadata"))
	meshBytes, meshName, meshType, err := readFormFile(c, "mesh")
	if err != nil {
		response.BadRequest(c, "MESH_REQUIRED", "A mesh file part named 'mesh' is required.")
		return
	}
	pcBytes, pcName, _, _ := readFormFile(c, "pointCloud") // optional
	scan, err := h.svc.IngestDeviceScan(c.Request.Context(), middleware.GetUserID(c), metaRaw, meshBytes, meshName, meshType, pcBytes, pcName)
	if err != nil {
		h.writeServiceError(c, err)
		return
	}
	response.Created(c, "Device scan stored", scan)
}

func readFormFile(c *gin.Context, field string) ([]byte, string, string, error) {
	fh, err := c.FormFile(field)
	if err != nil {
		return nil, "", "", err
	}
	f, err := fh.Open()
	if err != nil {
		return nil, "", "", err
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		return nil, "", "", err
	}
	return data, fh.Filename, fh.Header.Get("Content-Type"), nil
}

func (h *Handler) writeServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, errNotFound):
		response.NotFound(c, "scan")
	case errors.Is(err, errBusy):
		response.Conflict(c, err.Error())
	case errors.Is(err, errNoInput):
		response.Conflict(c, err.Error())
	case errors.Is(err, errBadInputType):
		response.UnprocessableEntity(c, err.Error(), nil)
	case errors.Is(err, errMeshRequired):
		response.BadRequest(c, "MESH_REQUIRED", err.Error())
	case errors.Is(err, errBadMetadata), errors.Is(err, errBadSegment), errors.Is(err, errBadScanner):
		response.UnprocessableEntity(c, err.Error(), nil)
	default:
		response.InternalError(c, err)
	}
}

func uuidV4() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
