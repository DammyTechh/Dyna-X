'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  useRehabCreditPlans, useRehabCreditPlan, useApplyForRehabCredit,
  useConfirmRehabSession, useMyProfessionals,
} from '@/hooks/useApi';
import { HandCoins, Loader2, Check, Info, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { RehabCreditPlan, RehabSessionRelease } from '@/types';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_admin: { label: 'Awaiting review', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  active: { label: 'Active', color: 'bg-green-100 text-green-700 border-green-200' },
  suspended: { label: 'Paused', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  completed: { label: 'Completed', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  rejected: { label: 'Declined', color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const money = (n: number) => `₦${(n || 0).toLocaleString()}`;

export default function PatientRehabCreditPage() {
  const { data, isLoading } = useRehabCreditPlans({ page: 1, page_size: 20 });
  const plans = (data?.data as RehabCreditPlan[] | undefined) || [];

  // A live plan is anything still in play — a pending application counts, so we
  // don't invite someone to apply twice while the first is being reviewed.
  const livePlan = plans.find((p) => ['pending_admin', 'active', 'suspended'].includes(p.status));
  const pastPlans = plans.filter((p) => p.id !== livePlan?.id);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6 animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Rehab Credit</h1>
          <p className="text-slate-500 text-sm mt-1">Session-based financing through our partner Mediloan</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          </div>
        ) : livePlan ? (
          <PlanView plan={livePlan} />
        ) : (
          <ApplyCard />
        )}

        {pastPlans.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Past applications</h2>
            <div className="space-y-2">
              {pastPlans.map((p) => {
                const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.completed;
                return (
                  <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{money(p.total_credit_amount)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{format(new Date(p.created_at), 'MMM d, yyyy')}</p>
                    </div>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border', cfg.color)}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function ApplyCard() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ physio_id: '', amount: '', reason: '', context: '' });
  const { data: professionals } = useMyProfessionals();
  const apply = useApplyForRehabCredit();

  const submit = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { toast.error('Enter the amount you need'); return; }

    // The backend application only carries an amount and a free-text reason —
    // the physiotherapist is assigned by an admin at approval. So the preferred
    // physio and any extra context are folded into the reason for admin to read.
    const chosen = (professionals || []).find((p) => p.user_id === form.physio_id);
    const reason = [
      form.reason.trim(),
      chosen ? `Preferred physiotherapist: ${chosen.full_name}` : '',
      form.context.trim(),
    ].filter(Boolean).join('\n');

    try {
      await apply.mutateAsync({ total_credit_amount: amount, reason: reason || undefined });
      toast.success('Application submitted — an admin will review it shortly');
      setOpen(false);
      setForm({ physio_id: '', amount: '', reason: '', context: '' });
    } catch (e) { toast.error((e as Error).message || 'Could not submit application'); }
  };

  const field = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-3">
        <HandCoins className="w-5 h-5 text-indigo-600" />
        <h2 className="font-display font-semibold text-slate-900">Apply for Rehab Credit</h2>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">
        Rehab Credit helps you continue your rehabilitation journey with flexible session-based financing
        through our partner Mediloan, even if you can&apos;t pay for your full program upfront.
      </p>

      {!open ? (
        <button onClick={() => setOpen(true)}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
          <HandCoins className="w-4 h-4" />Apply
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Who would you like to work with?</label>
            <select value={form.physio_id} onChange={(e) => setForm({ ...form, physio_id: e.target.value })} className={field}>
              <option value="">Select a professional…</option>
              {(professionals || []).map((p) => (
                <option key={p.user_id} value={p.user_id}>{p.full_name}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              We&apos;ll pass your preference on — an admin confirms who you&apos;re assigned to when your plan is approved.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">How much do you need?</label>
            <input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Amount in ₦" className={field} />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Why are you applying?</label>
            <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3}
              placeholder="Tell us a little about your situation"
              className={cn(field, 'resize-none')} />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Anything else? (optional)</label>
            <textarea value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} rows={2}
              placeholder="Extra context about the amount you've asked for"
              className={cn(field, 'resize-none')} />
          </div>

          <div className="flex gap-2">
            <button onClick={submit} disabled={apply.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {apply.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Submit application
            </button>
            <button onClick={() => setOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanView({ plan }: { plan: RehabCreditPlan }) {
  const { data: detail, isLoading } = useRehabCreditPlan(plan.id);
  const { data: professionals } = useMyProfessionals();
  const confirm = useConfirmRehabSession();

  // The backend joins physio_name onto plans; fall back to the connected-
  // professionals list for deploys that predate that.
  const physioName = plan.physio_name
    || (plan.physio_id ? professionals?.find((p) => p.user_id === plan.physio_id)?.full_name : undefined);

  const cfg = STATUS_CONFIG[plan.status] || STATUS_CONFIG.active;
  const remaining = Math.max(plan.sessions_total - plan.sessions_released, 0);
  const pct = plan.sessions_total > 0
    ? Math.min(Math.round((plan.sessions_released / plan.sessions_total) * 100), 100)
    : 0;

  const doConfirm = async (releaseId: string) => {
    try {
      await confirm.mutateAsync(releaseId);
      toast.success('Session confirmed — thank you');
    } catch (e) { toast.error((e as Error).message || 'Could not confirm session'); }
  };

  if (plan.status === 'pending_admin') {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
        <Clock className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h2 className="font-display font-semibold text-slate-900 mb-1">Application under review</h2>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          You applied for {money(plan.total_credit_amount)} on {format(new Date(plan.created_at), 'MMM d, yyyy')}.
          We&apos;ll let you know as soon as an admin has confirmed the terms with Mediloan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Remaining credit */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Sessions remaining</p>
            <p className="font-display text-4xl font-bold text-slate-900 mt-1">{remaining}</p>
            <p className="text-sm text-slate-500 mt-1">
              of {plan.sessions_total} financed sessions{physioName ? ` with ${physioName}` : ''}
            </p>
          </div>
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 border', cfg.color)}>{cfg.label}</span>
        </div>

        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-slate-500 mt-2">{plan.sessions_released} of {plan.sessions_total} used · {money(plan.total_credit_amount)} financed</p>

        {plan.status === 'suspended' && (
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mt-4">
            Your sessions are paused because your Mediloan repayments are behind. Settle with Mediloan to resume.
          </p>
        )}
      </div>

      {/* Sessions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 text-sm mb-3">Your sessions</h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : (detail?.releases || []).length === 0 ? (
          <p className="text-xs text-slate-500">No sessions yet. Once your physiotherapist logs one, it will appear here for you to confirm.</p>
        ) : (
          <div className="space-y-2">
            {(detail?.releases || []).map((r) => (
              <PatientReleaseRow key={r.id} release={r} onConfirm={doConfirm} confirming={confirm.isPending} />
            ))}
          </div>
        )}
      </div>

      {/* Repayment note — DynaX does not collect repayment; Mediloan does. */}
      <div className="flex items-start gap-3 rounded-2xl bg-slate-100 border border-slate-200 p-4">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 leading-relaxed">
          Repayments are handled directly with Mediloan. Contact them for your repayment schedule and balance.
        </p>
      </div>
    </div>
  );
}

function PatientReleaseRow({ release, onConfirm, confirming }: {
  release: RehabSessionRelease;
  onConfirm: (id: string) => void;
  confirming: boolean;
}) {
  const needsMyConfirmation = !release.patient_confirmed_at && release.status === 'pending';

  const label = release.status === 'paid'
    ? { text: 'Paid', color: 'bg-green-100 text-green-700' }
    : release.status === 'both_confirmed' || release.status === 'payout_pending'
      ? { text: 'Confirmed', color: 'bg-blue-100 text-blue-700' }
      : needsMyConfirmation
        ? { text: 'Needs your confirmation', color: 'bg-amber-100 text-amber-700' }
        : { text: 'Waiting for your physiotherapist', color: 'bg-slate-100 text-slate-600' };

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{format(new Date(release.created_at), 'MMM d, yyyy')}</p>
        <p className="text-xs text-slate-500 mt-0.5">{money(release.amount)}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium', label.color)}>{label.text}</span>
        {needsMyConfirmation && (
          <button onClick={() => onConfirm(release.id)} disabled={confirming}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60">
            {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}Confirm
          </button>
        )}
      </div>
    </div>
  );
}
