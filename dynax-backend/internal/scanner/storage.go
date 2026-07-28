package scanner

import (
	"os"
	"path/filepath"
	"strings"
)

// StoragePort abstracts asset byte storage. The filesystem implementation is
// the default; a Supabase Storage / S3 adapter can implement the same interface
// for durable multi-instance production storage.
type StoragePort interface {
	Put(key string, bytes []byte) error
	Get(key string) ([]byte, error)
}

// FilesystemStore writes assets under a root directory.
type FilesystemStore struct{ root string }

// NewFilesystemStore roots asset storage at DYNASCAN_DATA_DIR (or ./data/scanner).
func NewFilesystemStore() *FilesystemStore {
	root := strings.TrimSpace(os.Getenv("DYNASCAN_DATA_DIR"))
	if root == "" {
		root = filepath.Join("data", "scanner")
	} else {
		root = filepath.Join(root, "scanner-assets")
	}
	return &FilesystemStore{root: root}
}

// safeKey keeps a storage key confined to the root (no traversal).
func (s *FilesystemStore) safeKey(key string) string {
	clean := filepath.Clean("/" + strings.ReplaceAll(key, "\\", "/"))
	return filepath.Join(s.root, filepath.FromSlash(strings.TrimPrefix(clean, "/")))
}

func (s *FilesystemStore) Put(key string, bytes []byte) error {
	path := s.safeKey(key)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, bytes, 0o600)
}

func (s *FilesystemStore) Get(key string) ([]byte, error) {
	return os.ReadFile(s.safeKey(key))
}
