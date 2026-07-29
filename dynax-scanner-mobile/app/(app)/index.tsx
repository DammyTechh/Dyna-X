import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { GlassCard, StatusPill, Button } from '@/components/ui';
import { scannerApi, ScanSession } from '@/api/scanner';
import { useAuth } from '@/auth/auth';
import { theme, ANATOMICAL_REGIONS } from '@/theme';

function regionLabel(v: string) {
  return ANATOMICAL_REGIONS.find((r) => r.value === v)?.label ?? v ?? 'Scan';
}

export default function ScansHome() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { data: scans, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['scans'],
    queryFn: scannerApi.listScans,
    refetchInterval: (q) => {
      const list = (q.state.data as ScanSession[] | undefined) ?? [];
      return list.some((s) => s.reconstructionState === 'QUEUED' || s.reconstructionState === 'PROCESSING') ? 5000 : false;
    },
  });

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hi}>DynaX Scanner</Text>
          <Text style={styles.sub}>Your 3D scans</Text>
        </View>
        <Pressable onPress={signOut} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="log-out-outline" size={20} color={theme.color.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ gap: theme.space(3), paddingBottom: theme.space(28) }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.color.teal} />}
      >
        {isLoading ? (
          <ActivityIndicator color={theme.color.teal} style={{ marginTop: 60 }} />
        ) : !scans || scans.length === 0 ? (
          <GlassCard style={{ marginTop: theme.space(6) }}>
            <View style={{ alignItems: 'center', gap: theme.space(3), paddingVertical: theme.space(4) }}>
              <View style={styles.emptyIcon}><Ionicons name="scan-outline" size={30} color={theme.color.white} /></View>
              <Text style={styles.emptyTitle}>No scans yet</Text>
              <Text style={styles.emptyText}>Capture a slow orbit video and DynaX will build a 3D model.</Text>
            </View>
          </GlassCard>
        ) : (
          scans.map((scan) => (
            <Pressable key={scan.id} onPress={() => router.push(`/(app)/scan/${scan.id}`)}>
              <GlassCard>
                <View style={styles.row}>
                  <View style={styles.thumb}><Ionicons name="cube-outline" size={22} color={theme.color.white} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.scanTitle} numberOfLines={1}>{scan.subjectDisplayName || 'Untitled scan'}</Text>
                    <Text style={styles.scanSub} numberOfLines={1}>{regionLabel(scan.anatomicalRegion)}</Text>
                    <View style={{ marginTop: 8 }}><StatusPill state={scan.reconstructionState} /></View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.color.textFaint} />
                </View>
              </GlassCard>
            </Pressable>
          ))
        )}
      </ScrollView>

      <View style={styles.fab}>
        <Button label="New Scan" icon="add" onPress={() => router.push('/(app)/new')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.space(4) },
  hi: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: '800' },
  sub: { color: theme.color.textMuted, fontSize: theme.font.body, marginTop: 2 },
  iconBtn: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space(3) },
  thumb: {
    width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.color.tealDeep,
  },
  scanTitle: { color: theme.color.text, fontSize: theme.font.h3, fontWeight: '700' },
  scanSub: { color: theme.color.textMuted, fontSize: theme.font.small, marginTop: 1 },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.tealDeep },
  emptyTitle: { color: theme.color.text, fontSize: theme.font.h3, fontWeight: '700' },
  emptyText: { color: theme.color.textMuted, fontSize: theme.font.small, textAlign: 'center', maxWidth: 260 },
  fab: { position: 'absolute', left: theme.space(5), right: theme.space(5), bottom: theme.space(6) },
});
