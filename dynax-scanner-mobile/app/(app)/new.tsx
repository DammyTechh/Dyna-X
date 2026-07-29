import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { GlassCard, Button } from '@/components/ui';
import { CaptureCamera } from '@/components/CaptureCamera';
import { scannerApi } from '@/api/scanner';
import { theme, ANATOMICAL_REGIONS } from '@/theme';

type Step = 'idle' | 'creating' | 'uploading' | 'starting';

export default function NewScan() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: config } = useQuery({ queryKey: ['capture-config'], queryFn: scannerApi.captureConfig });

  const [subject, setSubject] = useState('');
  const [region, setRegion] = useState(ANATOMICAL_REGIONS[0].value);
  const [mode, setMode] = useState('STANDARD');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [camOpen, setCamOpen] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);

  const maxSeconds = Math.round((config?.captureMaxDurationMs ?? 180000) / 1000);
  const busy = step !== 'idle';

  async function pickFromLibrary() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (!res.canceled && res.assets?.[0]?.uri) setVideoUri(res.assets[0].uri);
  }

  function mimeFor(uri: string): string {
    const u = uri.toLowerCase();
    if (u.endsWith('.mov')) return 'video/quicktime';
    if (u.endsWith('.webm')) return 'video/webm';
    return 'video/mp4';
  }

  async function submit() {
    setError(null);
    if (!videoUri) return setError('Capture or choose a video first.');
    if (!subject.trim()) return setError('Give the scan a subject name.');
    try {
      setStep('creating');
      const scan = await scannerApi.createScan({
        subjectDisplayName: subject.trim(),
        anatomicalRegion: region,
        reconstructionMode: mode,
        captureMethod: 'VIDEO_CAPTURE',
      });
      setStep('uploading');
      await scannerApi.uploadInput(scan.id, videoUri, mimeFor(videoUri));
      setStep('starting');
      await scannerApi.startReconstruction(scan.id);
      qc.invalidateQueries({ queryKey: ['scans'] });
      router.replace(`/(app)/scan/${scan.id}`);
    } catch (e) {
      setStep('idle');
      setError(e instanceof Error ? e.message : 'Could not start the scan.');
    }
  }

  const stepLabel = step === 'creating' ? 'Creating scan…' : step === 'uploading' ? 'Uploading…' : step === 'starting' ? 'Starting…' : '';

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
        <Ionicons name="chevron-back" size={22} color={theme.color.textMuted} />
        <Text style={styles.backText}>Scans</Text>
      </Pressable>
      <Text style={styles.title}>New 3D scan</Text>
      <Text style={styles.subtitle}>Record or choose a short, slow orbit video. DynaX reconstructs a 3D model.</Text>

      {/* Capture */}
      <GlassCard>
        {videoUri ? (
          <View style={styles.videoPicked}>
            <View style={styles.videoIcon}><Ionicons name="videocam" size={22} color={theme.color.white} /></View>
            <Text style={styles.videoText}>Capture ready</Text>
            <Pressable onPress={() => setVideoUri(null)} hitSlop={10}><Ionicons name="close-circle" size={22} color={theme.color.textMuted} /></Pressable>
          </View>
        ) : (
          <View style={{ gap: theme.space(3) }}>
            <Button label="Record video" icon="videocam-outline" onPress={() => setCamOpen(true)} />
            <Button label="Choose from library" icon="images-outline" variant="glass" onPress={pickFromLibrary} />
          </View>
        )}
      </GlassCard>

      {/* Details */}
      <GlassCard>
        <View style={{ gap: theme.space(4) }}>
          <View>
            <Text style={styles.label}>Subject name</Text>
            <TextInput
              value={subject} onChangeText={setSubject}
              placeholder="e.g. John D. — left residual limb"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
            />
          </View>

          <View>
            <Text style={styles.label}>Anatomical region</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {ANATOMICAL_REGIONS.map((r) => (
                <Chip key={r.value} label={r.label} active={region === r.value} onPress={() => setRegion(r.value)} />
              ))}
            </ScrollView>
          </View>

          <View>
            <Text style={styles.label}>Mode</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip label="Standard" active={mode === 'STANDARD'} onPress={() => setMode('STANDARD')} />
              <Chip label="Featureless" active={mode === 'FEATURELESS_EXPERIMENTAL'} onPress={() => setMode('FEATURELESS_EXPERIMENTAL')} />
            </View>
          </View>
        </View>
      </GlassCard>

      {error && <Text style={styles.error}>{error}</Text>}
      <Button label={busy ? stepLabel : 'Create & reconstruct'} icon="sparkles-outline" onPress={submit} loading={busy} disabled={!videoUri} />

      <CaptureCamera
        visible={camOpen}
        maxSeconds={maxSeconds}
        onClose={() => setCamOpen(false)}
        onCaptured={(uri) => { setCamOpen(false); setVideoUri(uri); }}
      />
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: theme.space(1) },
  backText: { color: theme.color.textMuted, fontSize: theme.font.body },
  title: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: '800' },
  subtitle: { color: theme.color.textMuted, fontSize: theme.font.small, marginBottom: theme.space(2) },
  label: { color: theme.color.textMuted, fontSize: theme.font.small, marginBottom: 8, fontWeight: '600' },
  input: {
    color: theme.color.text, fontSize: theme.font.body,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.cardBorder, paddingHorizontal: theme.space(4), height: 50,
  },
  videoPicked: { flexDirection: 'row', alignItems: 'center', gap: theme.space(3) },
  videoIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.tealDeep },
  videoText: { flex: 1, color: theme.color.text, fontSize: theme.font.body, fontWeight: '600' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: theme.color.cardBorder,
  },
  chipActive: { backgroundColor: theme.color.teal, borderColor: theme.color.teal },
  chipText: { color: theme.color.textMuted, fontSize: theme.font.small, fontWeight: '600' },
  chipTextActive: { color: theme.color.white },
  error: { color: theme.color.red, fontSize: theme.font.small },
});
