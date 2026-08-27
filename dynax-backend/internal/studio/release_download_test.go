package studio

import (
	"os"
	"testing"
)

func TestResolveArtifactURLVersionSubstitution(t *testing.T) {
	os.Setenv("DYNAX_CURRENT_RELEASE_VERSION", "1.20.12")
	os.Setenv("DYNAX_RELEASE_ARTIFACT_URL", "https://x.supabase.co/storage/v1/object/public/studio-releases/DynaX-Studio-{version}-windows.zip.zip")
	defer os.Unsetenv("DYNAX_RELEASE_ARTIFACT_URL")

	got, err := resolveArtifactURL()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := "https://x.supabase.co/storage/v1/object/public/studio-releases/DynaX-Studio-1.20.12-windows.zip.zip"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestResolveArtifactURLRejectsSelfReference(t *testing.T) {
	os.Setenv("DYNAX_RELEASE_ARTIFACT_URL", "https://api.dynax.app/api/v1/releases/current/download")
	defer os.Unsetenv("DYNAX_RELEASE_ARTIFACT_URL")
	if _, err := resolveArtifactURL(); err == nil {
		t.Fatal("expected loop guard to reject self-referential artefact URL")
	}
}

func TestResolveArtifactURLFallsBackToDownloadURL(t *testing.T) {
	os.Unsetenv("DYNAX_RELEASE_ARTIFACT_URL")
	os.Setenv("DYNAX_RELEASE_DOWNLOAD_URL", "https://x.supabase.co/a/DynaX-1.0.0-windows.zip")
	defer os.Unsetenv("DYNAX_RELEASE_DOWNLOAD_URL")
	got, err := resolveArtifactURL()
	if err != nil || got != "https://x.supabase.co/a/DynaX-1.0.0-windows.zip" {
		t.Fatalf("got %q err %v", got, err)
	}
}

func TestWithAttachmentCollapsesDoubleExtension(t *testing.T) {
	in := "https://x.supabase.co/storage/v1/object/public/studio-releases/DynaX-Studio-1.20.12-windows.zip.zip"
	got := withAttachment(in)
	want := in + "?download=DynaX-Studio-1.20.12-windows.zip"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestWithAttachmentLeavesNonSupabaseAlone(t *testing.T) {
	in := "https://cdn.example.com/a.zip"
	if got := withAttachment(in); got != in {
		t.Fatalf("got %q want unchanged", got)
	}
}
