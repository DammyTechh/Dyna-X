import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { GlassCard, StatusPill, Button } from '@/components/ui';
import { ModelWebView } from '@/components/ModelWebView';
import { scannerApi, ScanSession } from '@/api/scanner';
import { apiClient } from '@/api/client';
import { theme, ANATOMICAL_REGIONS } from '@/theme';

function regionLabel(v: string) {
  return ANATOMICAL_REGIONS.find((r) => r.value === v)?.label ?? v ?? 'Scan';
}

export default function ScanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [sharing, setSharing] = useState(false);

  const { data: scan, isLoading } = useQuery({
    queryKey: ['scan', id],
    queryFn: () => scannerApi.getScan(id),
    enabled: !!id,
    refetchInterval: (q) => {
      const s = q.state.data as ScanSession | undefined;
      return s && (s.reconstructionState === 'QUEUED' || s.reconstructionState === 'PROCESSING') ? 4000 : false;
    },
  });

  const complete = scan?.reconstructionState === 'COMPLETE' && !!scan?.activeAssetId;

  const { data: objText, isLoading: modelLoading } = useQuery({
    queryKey: ['model', scan?.activeAssetId],
    enabled: !!complete,
    staleTime: Infinity,
    queryFn: async () => {
      const headers = await apiClient.authHeader();
      const res = await fetch(apiClient.assetDownloadUrl(scan!.activeAssetId!), { headers });
      if (!res.ok) throw new Error('Could not download the model.');
      return res.text();
    },
  });

  const retry = useMutation({
    mutationFn: () => scannerApi.startReconstruction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scan', id] }),
  });

  async function share() {
    if (!objText) return;
    try {
      setSharing(true);
      const uri = `${FileSystem.cacheDirectory}${(scan?.subjectDisplayName || 'scan').replace(/[^\w.-]+/g, '_')}.obj`;
      await FileSystem.writeAsStringAsync(uri, objText);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch {
      /* ignore */
    } finally {
      setSharing(false);
    }
  }

  return (
    <Screen scroll={false}>
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
        <Ionicons name="chevron-back" size={22} color={theme.color.textMuted} />
        <Text style={styles.backText}>Scans</Text>
      </Pressable>

      {isLoading || !scan ? (
        <ActivityIndicator color={theme.color.teal} style={{ marginTop: 60 }} />
      ) : (
        <View style={{ flex: 1, gap: theme.space(4) }}>
          <View>
            <Text style={styles.title} numberOfLines={1}>{scan.subjectDisplayName || 'Untitled scan'}</Text>
            <Text style={styles.sub}>{regionLabel(scan.anatomicalRegion)}</Text>
            <View style={{ marginTop: 8 }}><StatusPill state={scan.reconstructionState} /></View>
          </View>

          {complete ? (
            <>
              <View style={styles.viewer}>
                {modelLoading || !objText ? (
                  <View style={styles.center}><ActivityIndicator color={theme.color.teal} /></View>
                ) : (
                  <ModelWebView objText={objText} />
                )}
              </View>
              <Button label="Share model" icon="share-outline" onPress={share} loading={sharing} variant="glass" />
            </>
          ) : scan.reconstructionState === 'QUEUED' || scan.reconstructionState === 'PROCESSING' ? (
            <GlassCard style={{ marginTop: theme.space(6) }}>
              <View style={styles.center2}>
                <ActivityIndicator size="large" color={theme.color.teal} />
                <Text style={styles.procTitle}>Reconstructing your model…</Text>
                <Text style={styles.procText}>This can take a few minutes. This screen updates automatically.</Text>
              </View>
            </GlassCard>
          ) : scan.reconstructionState === 'FAILED' ? (
            <GlassCard style={{ marginTop: theme.space(6) }}>
              <View style={styles.center2}>
                <Ionicons name="alert-circle-outline" size={36} color={theme.color.red} />
                <Text style={styles.procTitle}>Reconstruction failed</Text>
                <Text style={styles.procText}>{scan.errorMessage || 'The service could not generate a model from this capture.'}</Text>
                <Button label="Try again" icon="refresh" onPress={() => retry.mutate()} loading={retry.isPending} variant="glass" style={{ marginTop: 8 }} />
              </View>
            </GlassCard>
          ) : (
            <GlassCard style={{ marginTop: theme.space(6) }}>
              <Text style={styles.procText}>This scan has no reconstruction yet.</Text>
            </GlassCard>
          )}

          <Text style={styles.note}>
            Models are not automatically scale-verified or clinically validated. Confirm dimensions before clinical use.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: theme.space(2) },
  backText: { color: theme.color.textMuted, fontSize: theme.font.body },
  title: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: '800' },
  sub: { color: theme.color.textMuted, fontSize: theme.font.body, marginTop: 2 },
  viewer: { flex: 1, borderRadius: theme.radius.lg, overflow: 'hidden', minHeight: 320 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.bgTop },
  center2: { alignItems: 'center', gap: theme.space(3), paddingVertical: theme.space(4) },
  procTitle: { color: theme.color.text, fontSize: theme.font.h3, fontWeight: '700' },
  procText: { color: theme.color.textMuted, fontSize: theme.font.small, textAlign: 'center', maxWidth: 280 },
  note: { color: theme.color.textFaint, fontSize: theme.font.tiny, textAlign: 'center' },
});
