import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { theme, ReconstructionState } from '@/theme';

// Frosted glass card — the "floating glass" surface used across the app.
// The blur sits BEHIND the content as an absolute fill so the card sizes to its
// content (a flex:1 blur child collapses to zero height in an auto-height parent).
export function GlassCard({
  children,
  style,
  intensity = 24,
  padded = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  padded?: boolean;
}) {
  return (
    <View style={[styles.cardWrap, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[styles.cardInner, padded && styles.cardPadded]}>{children}</View>
    </View>
  );
}

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'glass' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const isPrimary = variant === 'primary';
  const isGlass = variant === 'glass';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        isPrimary && styles.btnPrimary,
        isGlass && styles.btnGlass,
        variant === 'ghost' && styles.btnGhost,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.color.white} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={theme.color.white} />}
          <Text style={styles.btnText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const STATUS: Record<ReconstructionState, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  NOT_STARTED: { label: 'Draft', color: theme.color.textFaint, icon: 'ellipse-outline' },
  QUEUED: { label: 'Queued', color: theme.color.amber, icon: 'time-outline' },
  PROCESSING: { label: 'Reconstructing', color: theme.color.blue, icon: 'sync-outline' },
  COMPLETE: { label: 'Ready', color: theme.color.green, icon: 'checkmark-circle' },
  FAILED: { label: 'Failed', color: theme.color.red, icon: 'close-circle' },
  CANCELLED: { label: 'Cancelled', color: theme.color.textFaint, icon: 'close-circle-outline' },
};

export function StatusPill({ state }: { state: ReconstructionState }) {
  const s = STATUS[state] ?? STATUS.NOT_STARTED;
  return (
    <View style={[styles.pill, { borderColor: s.color + '55', backgroundColor: s.color + '1f' }]}>
      <Ionicons name={s.icon} size={13} color={s.color} />
      <Text style={[styles.pillText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.cardBorder,
    overflow: 'hidden',
    backgroundColor: 'rgba(148,163,184,0.10)',
  },
  cardInner: { backgroundColor: 'transparent' },
  cardPadded: { padding: theme.space(5) },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(2),
    height: 52,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(5),
  },
  btnPrimary: { backgroundColor: theme.color.teal },
  btnGlass: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: theme.color.cardBorder,
  },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { color: theme.color.white, fontSize: theme.font.body, fontWeight: '700' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: theme.font.tiny, fontWeight: '700' },
});
