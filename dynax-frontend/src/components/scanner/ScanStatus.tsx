'use client';

import { CheckCircle2, Clock, Loader2, XCircle, CircleDashed } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReconstructionState } from '@/types/scanner';

const MAP: Record<ReconstructionState, { label: string; className: string; icon: React.ElementType; spin?: boolean }> = {
  NOT_STARTED: { label: 'Draft', className: 'bg-slate-100 text-slate-600 ring-slate-200', icon: CircleDashed },
  QUEUED: { label: 'Queued', className: 'bg-amber-50 text-amber-700 ring-amber-200', icon: Clock },
  PROCESSING: { label: 'Reconstructing', className: 'bg-blue-50 text-blue-700 ring-blue-200', icon: Loader2, spin: true },
  COMPLETE: { label: 'Ready', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CheckCircle2 },
  FAILED: { label: 'Failed', className: 'bg-red-50 text-red-700 ring-red-200', icon: XCircle },
  CANCELLED: { label: 'Cancelled', className: 'bg-slate-100 text-slate-600 ring-slate-200', icon: XCircle },
};

export function ScanStatusBadge({ state, className }: { state: ReconstructionState; className?: string }) {
  const s = MAP[state] ?? MAP.NOT_STARTED;
  const Icon = s.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        s.className,
        className,
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', s.spin && 'animate-spin')} />
      {s.label}
    </span>
  );
}

export function isProcessing(state: ReconstructionState): boolean {
  return state === 'QUEUED' || state === 'PROCESSING';
}
