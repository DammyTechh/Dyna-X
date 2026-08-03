'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRehabCreditPlans, useRehabCreditPlan, useConfirmRehabSession, useMyPatients } from '@/hooks/useApi';
import { HandCoins, Loader2, Check, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { RehabCreditPlan, RehabSessionRelease } from '@/types';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700 border-green-200' },
  suspended: { label: 'Suspended', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  completed: { label: 'Completed', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  pending_admin: { label: 'Awaiting review', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  rejected: { label: 'Declined', color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const money = (n: number) => `₦${(n || 0).toLocaleString()}`;

export default function ProfessionalRehabCreditPage() {
  const { data, isLoading } = useRehabCreditPlans({ page: 1, page_size: 50 });
  const { data: patientsData } = useMyPatients({ page: 1, page_size: 200 });

  const plans = (data?.data as RehabCreditPlan[] | undefined) || [];
  const patients = patientsData?.data || [];
  // The backend joins patient_name onto plans; fall back to a local lookup for
  // deploys that predate that.
  const patientName = (plan: RehabCreditPlan) =>
    plan.patient_name
    || patients.find((p) => p.user_id === plan.patient_id || p.id === plan.patient_id)?.full_name
    || `${plan.patient_id.slice(0, 8)}…`;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6 animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Rehab Credit</h1>
          <p className="text-slate-500 text-sm mt-1">
            Patients financing their programme through Mediloan. Confirm each session so the payout can be released.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          </div>
        ) : plans.length > 0 ? (
          <div className="space-y-4">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} patientName={patientName(plan)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <HandCoins className="w-10 h-10 text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-700 mb-1">No Rehab Credit plans yet</h3>
            <p className="text-slate-500 text-sm max-w-xs">
              When an admin assigns you to a patient&apos;s Mediloan-backed plan, it will appear here.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function PlanCard({ plan, patientName }: { plan: RehabCreditPlan; patientName: string }) {
  const [open, setOpen] = useState(false);
  const { data: detail, isLoading } = useRehabCreditPlan(open ? plan.id : undefined);
  const confirm = useConfirmRehabSession();

  const statusCfg = STATUS_CONFIG[plan.status] || STATUS_CONFIG.active;
  const released = plan.sessions_released * plan.session_rate;
  const remaining = Math.max(plan.total_credit_amount - released, 0);

  const doConfirm = async (releaseId: string) => {
    try {
      await confirm.mutateAsync(releaseId);
      toast.success('Session confirmed');
    } catch (e) { toast.error((e as Error).message || 'Could not confirm session'); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-display font-semibold text-slate-900 leading-tight">{patientName}</h3>
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 border', statusCfg.color)}>
            {statusCfg.label}
          </span>
        </div>

        {plan.status === 'suspended' && (
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-3">
            Repayments are behind with Mediloan. Please pause sessions — no further payments will be released until the account is current.
          </p>
        )}

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Committed</p>
            <p className="text-sm font-bold text-slate-900 mt-1">{money(plan.total_credit_amount)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Released</p>
            <p className="text-sm font-bold text-green-700 mt-1">{money(released)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Remaining</p>
            <p className="text-sm font-bold text-slate-900 mt-1">{money(remaining)}</p>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-3">
          {plan.sessions_released}/{plan.sessions_total} sessions released · {money(plan.session_rate)} per session
        </p>
      </div>

      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-100 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
        <span>Sessions</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : (detail?.releases || []).length === 0 ? (
            <p className="text-xs text-slate-500 py-2">No sessions logged against this plan yet.</p>
          ) : (
            (detail?.releases || []).map((r) => (
              <ReleaseRow key={r.id} release={r} onConfirm={doConfirm} confirming={confirm.isPending} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ReleaseRow({ release, onConfirm, confirming }: {
  release: RehabSessionRelease;
  onConfirm: (id: string) => void;
  confirming: boolean;
}) {
  const needsMyConfirmation = !release.physio_confirmed_at && release.status === 'pending';

  const label = release.status === 'paid'
    ? { text: 'Paid', color: 'bg-green-100 text-green-700' }
    : release.status === 'both_confirmed' || release.status === 'payout_pending'
      ? { text: 'Both confirmed', color: 'bg-blue-100 text-blue-700' }
      : needsMyConfirmation
        ? { text: 'Waiting for you', color: 'bg-amber-100 text-amber-700' }
        : { text: 'Waiting for patient', color: 'bg-slate-100 text-slate-600' };

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{format(new Date(release.created_at), 'MMM d, yyyy')}</p>
        <p className="text-xs text-slate-500 mt-0.5">{money(release.amount)}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-1', label.color)}>
          {label.text === 'Waiting for patient' && <Clock className="w-3 h-3" />}
          {label.text}
        </span>
        {needsMyConfirmation && (
          <button onClick={() => onConfirm(release.id)} disabled={confirming}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60">
            {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}Confirm session
          </button>
        )}
      </div>
    </div>
  );
}
