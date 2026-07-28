package scanner

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// Normalizer converts capture videos to MP4 (H.264) so any browser's recording
// — including the WebM that Chrome/Android produce — can be reconstructed. This
// mirrors the original scanner's ffmpeg-based normalizer.
type Normalizer struct{ ffmpegPath string }

// NewNormalizer locates ffmpeg (FFMPEG_PATH, then PATH). If absent, only inputs
// that are already MP4 can proceed.
func NewNormalizer() *Normalizer {
	p := strings.TrimSpace(os.Getenv("FFMPEG_PATH"))
	if p == "" {
		if lp, err := exec.LookPath("ffmpeg"); err == nil {
			p = lp
		}
	}
	return &Normalizer{ffmpegPath: p}
}

func isMP4(mediaType, fileName string) bool {
	return mediaType == "video/mp4" || strings.HasSuffix(strings.ToLower(fileName), ".mp4")
}

// EnsureMP4 returns MP4 bytes for the input, transcoding when necessary.
func (n *Normalizer) EnsureMP4(ctx context.Context, data []byte, mediaType, fileName string) ([]byte, string, error) {
	if isMP4(mediaType, fileName) {
		return data, "capture.mp4", nil
	}
	if n.ffmpegPath == "" {
		return nil, "", errors.New("this capture needs server-side conversion, but the video converter (ffmpeg) is not available")
	}

	in, err := os.CreateTemp("", "dynascan-in-*"+sourceExt(mediaType, fileName))
	if err != nil {
		return nil, "", err
	}
	inPath := in.Name()
	defer os.Remove(inPath)
	if _, err := in.Write(data); err != nil {
		in.Close()
		return nil, "", err
	}
	in.Close()

	outPath := inPath + ".out.mp4"
	defer os.Remove(outPath)

	var stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, n.ffmpegPath,
		"-y", "-i", inPath,
		"-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
		"-movflags", "+faststart", "-an", outPath)
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return nil, "", fmt.Errorf("video conversion failed: %s", tail(stderr.String(), 300))
	}
	out, err := os.ReadFile(outPath)
	if err != nil || len(out) == 0 {
		return nil, "", errors.New("video conversion produced no output")
	}
	return out, "capture.mp4", nil
}

func sourceExt(mediaType, fileName string) string {
	lower := strings.ToLower(fileName)
	for _, ext := range []string{".webm", ".mov", ".mp4", ".m4v", ".avi", ".mkv"} {
		if strings.HasSuffix(lower, ext) {
			return ext
		}
	}
	switch mediaType {
	case "video/webm":
		return ".webm"
	case "video/quicktime":
		return ".mov"
	default:
		return ".bin"
	}
}

func tail(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) > n {
		return s[len(s)-n:]
	}
	return s
}
