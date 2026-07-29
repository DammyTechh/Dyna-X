// Design tokens for the DynaX Scanner mobile app — dark, glassy, modern.
export const theme = {
  color: {
    bg: '#0b1220',
    bgTop: '#0f172a',
    bgTeal: '#0d3b3a',
    card: 'rgba(255,255,255,0.06)',
    cardBorder: 'rgba(255,255,255,0.12)',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    textFaint: '#64748b',
    teal: '#14b8a6',
    tealDeep: '#0d9488',
    amber: '#f59e0b',
    green: '#10b981',
    red: '#ef4444',
    blue: '#3b82f6',
    white: '#ffffff',
  },
  radius: { sm: 12, md: 18, lg: 24, xl: 32, pill: 999 },
  space: (n: number) => n * 4,
  font: {
    h1: 28,
    h2: 22,
    h3: 18,
    body: 15,
    small: 13,
    tiny: 11,
  },
} as const;

export type ReconstructionState =
  | 'NOT_STARTED' | 'QUEUED' | 'PROCESSING' | 'COMPLETE' | 'FAILED' | 'CANCELLED';

export const ANATOMICAL_REGIONS: { value: string; label: string }[] = [
  { value: 'residual_limb_tt', label: 'Residual Limb (Below Knee)' },
  { value: 'residual_limb_tf', label: 'Residual Limb (Above Knee)' },
  { value: 'foot', label: 'Foot & Ankle' },
  { value: 'hand', label: 'Hand & Wrist' },
  { value: 'lower_leg', label: 'Lower Leg' },
  { value: 'upper_limb', label: 'Upper Limb' },
  { value: 'torso', label: 'Torso' },
  { value: 'spinal_region', label: 'Spinal Region' },
  { value: 'generic', label: 'Other / Generic' },
];
