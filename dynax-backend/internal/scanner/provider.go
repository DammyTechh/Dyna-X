package scanner

import (
	"context"
	"crypto/rand"
	"fmt"
)

// ProviderResult is a completed reconstruction: the model bytes plus naming.
type ProviderResult struct {
	Bytes     []byte
	FileName  string
	MediaType string
}

// Provider is a reconstruction backend (KIRI Engine, or the deterministic mock).
type Provider interface {
	Key() string
	CreateJob(ctx context.Context, video []byte, mediaType, fileName, mode string) (privateID string, err error)
	GetStatus(ctx context.Context, privateID string) (string, error)
	GetResult(ctx context.Context, privateID string) (ProviderResult, error)
}

// mockOBJ is a tiny valid OBJ (a single tetrahedron) so the full pipeline works
// end to end without KIRI credits when DYNASCAN_PROVIDER=mock.
const mockOBJ = `# DynaScan mock reconstruction
v 0 0 0
v 1 0 0
v 0 1 0
v 0 0 1
f 1 3 2
f 1 2 4
f 1 4 3
f 2 3 4
`

// MockProvider returns a deterministic model immediately.
type MockProvider struct{}

func (MockProvider) Key() string { return "mock" }

func (MockProvider) CreateJob(_ context.Context, _ []byte, _, _, _ string) (string, error) {
	return "mock-" + randomHex(8), nil
}

func (MockProvider) GetStatus(_ context.Context, _ string) (string, error) {
	return "COMPLETE", nil
}

func (MockProvider) GetResult(_ context.Context, _ string) (ProviderResult, error) {
	return ProviderResult{Bytes: []byte(mockOBJ), FileName: "raw-reconstruction.obj", MediaType: "model/obj"}, nil
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x", b)
}
