package studio

import (
	"errors"
	"math"
	"regexp"
	"strings"
	"time"
)

// errInvalid is returned for any payload that fails the strict contract. The
// message is deliberately generic (never reveals which field failed).
var errInvalid = errors.New("invalid payload")

var (
	allowedEventTypes = map[string]bool{
		"workflow_started": true, "workflow_completed": true, "stage_completed": true,
		"stage_skipped": true, "operator_used": true, "export_completed": true,
		"error_occurred": true, "paralink_connect_used": true, "quick_bridge_used": true,
		"session_started": true, "session_ended": true,
	}
	allowedWorkflows = map[string]bool{
		"creator": true, "paraform": true, "parafly_afo": true, "paralink_tt": true, "parafly_tlso": true,
	}
	allowedPlatforms = map[string]bool{"Windows": true, "macOS": true, "Linux": true}
	allowedValues    = map[string]map[string]bool{
		"paralink_connect_used": {"SMOOTH": true, "STRUCTURAL": true, "HYBRID": true},
		"quick_bridge_used": {
			"SMOOTH_FILLET": true, "STANDARD": true, "STRAIGHT_TAPER": true, "CURVED_TAPER": true,
			"REINFORCED_COLLAR": true, "PEDIATRIC": true, "HEAVY_DUTY": true,
		},
		"export_completed": {"stl": true, "obj": true},
		"session_started":  {"studio": true, "standalone": true},
	}
	safeIdentifier = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,64}$`)
	uuidRe         = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
)

const (
	maxFieldLen        = 64
	maxBatchSize       = 500
	maxDurationSeconds = 7 * 24 * 60 * 60
)

var (
	maxEventAge   = 90 * 24 * time.Hour
	maxFutureSkew = 10 * time.Minute
)

// validateBatch enforces the batch rules: non-empty, <= 500, every event valid,
// and all events belong to a single installation.
func validateBatch(events []EventPayload) ([]EventPayload, error) {
	if len(events) == 0 || len(events) > maxBatchSize {
		return nil, errInvalid
	}
	out := make([]EventPayload, 0, len(events))
	installIDs := map[string]struct{}{}
	for i := range events {
		v, err := validateEvent(events[i])
		if err != nil {
			return nil, err
		}
		installIDs[v.InstallID] = struct{}{}
		out = append(out, v)
	}
	if len(installIDs) != 1 {
		return nil, errInvalid
	}
	return out, nil
}

// validateEvent applies every rule from the Python contract and returns the
// normalized event (UTC timestamp, rounded duration).
func validateEvent(e EventPayload) (EventPayload, error) {
	if !uuidRe.MatchString(e.EventID) || !uuidRe.MatchString(e.InstallID) || !uuidRe.MatchString(e.SessionID) {
		return EventPayload{}, errInvalid
	}
	if !allowedEventTypes[e.EventType] {
		return EventPayload{}, errInvalid
	}
	if e.Workflow != nil && !allowedWorkflows[*e.Workflow] {
		return EventPayload{}, errInvalid
	}
	if !allowedPlatforms[e.OSPlatform] {
		return EventPayload{}, errInvalid
	}
	if values, ok := allowedValues[e.EventType]; ok {
		if e.Value == nil || !values[*e.Value] {
			return EventPayload{}, errInvalid
		}
	}
	if (e.EventType == "workflow_started" || e.EventType == "workflow_completed") && e.Workflow == nil {
		return EventPayload{}, errInvalid
	}
	if (e.EventType == "stage_completed" || e.EventType == "stage_skipped") && e.Stage == nil {
		return EventPayload{}, errInvalid
	}
	for _, s := range []*string{e.Workflow, e.Stage, e.Value, e.AddonVersion, e.BlenderVersion} {
		if s != nil && !validIdentifier(*s) {
			return EventPayload{}, errInvalid
		}
	}
	if !validIdentifier(e.EventType) || !validIdentifier(e.OSPlatform) {
		return EventPayload{}, errInvalid
	}
	if e.DurationS != nil {
		d := *e.DurationS
		if math.IsNaN(d) || math.IsInf(d, 0) || d < 0 || d > maxDurationSeconds {
			return EventPayload{}, errInvalid
		}
		rounded := math.Round(d*100) / 100
		e.DurationS = &rounded
	}
	if e.Timestamp.IsZero() {
		return EventPayload{}, errInvalid
	}
	ts := e.Timestamp.UTC()
	now := time.Now().UTC()
	if ts.Before(now.Add(-maxEventAge)) || ts.After(now.Add(maxFutureSkew)) {
		return EventPayload{}, errInvalid
	}
	e.Timestamp = ts
	return e, nil
}

func validIdentifier(v string) bool {
	if len(v) > maxFieldLen {
		return false
	}
	if strings.ContainsAny(v, "/\\@\n\r\t") {
		return false
	}
	return safeIdentifier.MatchString(v)
}
