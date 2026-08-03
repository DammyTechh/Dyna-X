'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  useTherapayApplications, useReviewApplication, useAnnounce,
  useRehabCreditPlans, useRehabCreditPlan, useRehabPendingPayouts,
  useReviewRehabCreditPlan, useMarkRehabSessionPaid, useMarkRehabRepayment,
  useAdminPatients, useAdminProfessionals,
} from '@/hooks/useApi';
import {
  CreditCard, Loader2, Check, X, Megaphone, Send,
  HandCoins, Flag, ChevronDown, ChevronRight, Banknote,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { RehabCreditPlan } from '@/types';

type Application = {
  id: string; patient_id: string; plan_type: string;
  requested_amount?: number | null; status: string; review_notes?: string | null; created_at: string;
};

const STATUS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-rose-100 text-rose-700',
  // Rehab Credit plan statuses
  pending_admin: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-rose-100 text-rose-700',
  completed: 'bg-slate-100 text-slate-600',
};

const money = (n: number) => `₦${(n || 0).toLocaleString()}`;

export default function AdminTherapayPage() {
  const { data, isLoading } = useTherapayApplications({ page: 1, page_size: 50 });
  const review = useReviewApplication();
  const announce = useAnnounce();

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [ann, setAnn] = useState({ title: '', body: '', audience: 'all' });

  const apps = (data?.data as Application[] | undefined) || [];
  const pending = apps.filter((a) => a.status === 'pending');

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await review.mutateAsync({ id, status, notes: notes[id] });
      toast.success(`Application ${status}`);
    } catch (e) { toast.error((e as Error).message || 'Could not update'); }
  };

  const sendAnnouncement = async () => {
    if (!ann.title.trim() || !ann.body.trim()) { toast.error('Title and message are required'); return; }
    try {
      await announce.mutateAsync({ title: ann.title.trim(), body: ann.body.trim(), audience: ann.audience });
      toast.success('Announcement sent');
      setAnn({ title: '', body: '', audience: 'all' });
    } catch (e) { toast.error((e as Error).message || 'Could not send'); }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Announcements */}
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">TheraPay &amp; Announcements</h1>
          <p className="text-slate-500 text-sm mt-1">Review financing applications and broadcast announcements.</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-indigo-600" />
            <h2 className="font-semibold text-slate-900">Send an announcement</h2>
          </div>
          <div className="grid sm:grid-cols-[1fr,auto] gap-3">
            <input value={ann.title} onChange={(e) => setAnn({ ...ann, title: e.target.value })}
              placeholder="Title" className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <select value={ann.audience} onChange={(e) => setAnn({ ...ann, audience: e.target.value })}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">
              <option value="all">Everyone</option>
              <option value="patient">Patients</option>
              <option value="physiotherapist">Physiotherapists</option>
              <option value="prosthetist">Prosthetists</option>
              <option value="orthotist">Orthotists</option>
            </select>
          </div>
          <textarea value={ann.body} onChange={(e) => setAnn({ ...ann, body: e.target.value })} rows={2}
            placeholder="Message" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none" />
          <button onClick={sendAnnouncement} disabled={announce.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
            {announce.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Send
          </button>
        </div>

        {/* Applications */}
        <div>
          <h2 className="font-semibold text-slate-900 mb-3">Financing applications {pending.length > 0 && <span className="text-amber-600">({pending.length} pending)</span>}</h2>
          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : apps.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <CreditCard className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">No applications yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apps.map((a) => (
                <div key={a.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm capitalize">{a.plan_type} plan</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {a.requested_amount ? `₦${a.requested_amount.toLocaleString()} · ` : ''}{format(new Date(a.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium capitalize', STATUS[a.status] || 'bg-slate-100 text-slate-600')}>{a.status}</span>
                  </div>
                  {a.status === 'pending' && (
                    <div className="mt-3 space-y-2">
                      <input value={notes[a.id] || ''} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })}
                        placeholder="Review note (optional)"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                      <div className="flex gap-2">
                        <button onClick={() => decide(a.id, 'approved')} disabled={review.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-60">
                          <Check className="w-3.5 h-3.5" />Approve
                        </button>
                        <button onClick={() => decide(a.id, 'rejected')} disabled={review.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50 disabled:opacity-60">
                          <X className="w-3.5 h-3.5" />Reject
                        </button>
                      </div>
                    </div>
                  )}
                  {a.review_notes && <p className="text-xs text-slate-500 mt-2">Note: {a.review_notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rehab Credit */}
        <RehabCreditSection />
      </div>
    </DashboardLayout>
  );
}

// ─── Rehab Credit ─────────────────────────────────────────────────────────────
// Mediloan lends the money and collects repayment. Everything here is DynaX
// recording what an admin reports from Mediloan — no status moves on its own.

function RehabCreditSection() {
  const { data: plansData, isLoading } = useRehabCreditPlans({ page: 1, page_size: 100 });
  const { data: payouts, isLoading: payoutsLoading } = useRehabPendingPayouts();
  const { data: patientsData } = useAdminPatients({ page: 1, page_size: 200 });
  const { data: profData } = useAdminProfessionals('approved');

  const markPaid = useMarkRehabSessionPaid();

  const plans = (plansData?.data as RehabCreditPlan[] | undefined) || [];
  const pending = plans.filter((p) => p.status === 'pending_admin');
  const live = plans.filter((p) => p.status !== 'pending_admin');

  // The backend joins display names onto plans. Older deploys don't, so fall
  // back to resolving ids against the admin directories.
  const patients = (patientsData?.data || []) as Record<string, unknown>[];
  const professionals = (profData?.data || []) as Record<string, unknown>[];
  const nameFor = (list: Record<string, unknown>[], id?: string, joined?: string) => {
    if (joined) return joined;
    if (!id) return '—';
    const hit = list.find((r) => ((r.user_id || r.id) as string) === id);
    return (hit?.full_name as string) || `${id.slice(0, 8)}…`;
  };
  const physios = professionals.filter(
    (p) => !p.professional_type || p.professional_type === 'physiotherapist'
  );

  const pay = async (releaseId: string) => {
    try {
      await markPaid.mutateAsync(releaseId);
      toast.success('Payout marked as paid');
    } catch (e) { toast.error((e as Error).message || 'Could not mark paid'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <HandCoins className="w-4 h-4 text-indigo-600" />
        <h2 className="font-semibold text-slate-900">Rehab Credit</h2>
        <span className="text-xs text-slate-400">financed by Mediloan</span>
      </div>

      {/* Pending payouts — the most actionable queue, so it leads. */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Banknote className="w-4 h-4 text-green-600" />
          <h3 className="font-semibold text-slate-900 text-sm">
            Payouts awaiting release {(payouts?.length || 0) > 0 && <span className="text-green-600">({payouts?.length})</span>}
          </h3>
        </div>
        {payoutsLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : (payouts || []).length === 0 ? (
          <p className="text-sm text-slate-500">Nothing waiting. Payouts appear here once both the patient and physiotherapist confirm a session.</p>
        ) : (
          <div className="space-y-2">
            {(payouts || []).map((p) => (
              <div key={p.release_id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{p.patient_name || '—'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.physio_name || '—'}
                    {p.confirmed_at ? ` · confirmed ${format(new Date(p.confirmed_at), 'MMM d, yyyy')}` : ''}
                    {p.mediloan_ref ? ` · ref ${p.mediloan_ref}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-slate-900">{money(p.amount)}</span>
                  <button onClick={() => pay(p.release_id)} disabled={markPaid.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-60">
                    {markPaid.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}Mark as paid
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending applications */}
      <div>
        <h3 className="font-semibold text-slate-900 text-sm mb-3">
          Rehab Credit applications {pending.length > 0 && <span className="text-amber-600">({pending.length} pending)</span>}
        </h3>
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : pending.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <HandCoins className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">No applications awaiting review</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((p) => (
              <ApplicationRow key={p.id} plan={p} patientName={nameFor(patients, p.patient_id, p.patient_name)} physios={physios} />
            ))}
          </div>
        )}
      </div>

      {/* Active plans */}
      <div>
        <h3 className="font-semibold text-slate-900 text-sm mb-3">Plans</h3>
        {live.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <p className="text-sm font-medium text-slate-600">No approved plans yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {live.map((p) => (
              <PlanRow key={p.id} plan={p}
                patientName={nameFor(patients, p.patient_id, p.patient_name)}
                physioName={nameFor(professionals, p.physio_id, p.physio_name)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ApplicationRow({ plan, patientName, physios }: {
  plan: RehabCreditPlan; patientName: string; physios: Record<string, unknown>[];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    physio_id: '', session_rate: '', sessions_total: '', duration_months: '', mediloan_ref: '', notes: '',
  });
  const review = useReviewRehabCreditPlan();

  const approve = async () => {
    const rate = Number(form.session_rate);
    const total = Number(form.sessions_total);
    const months = Number(form.duration_months);
    if (!form.physio_id) { toast.error('Assign a physiotherapist'); return; }
    if (!rate || rate <= 0) { toast.error('Session rate must be greater than 0'); return; }
    if (!total || total <= 0) { toast.error('Sessions total must be greater than 0'); return; }
    if (!months || months <= 0) { toast.error('Duration in months must be greater than 0'); return; }
    try {
      await review.mutateAsync({
        planId: plan.id, decision: 'approve', physio_id: form.physio_id,
        session_rate: rate, sessions_total: total, duration_months: months,
        mediloan_ref: form.mediloan_ref || undefined, notes: form.notes || undefined,
      });
      toast.success('Plan approved — patient and physiotherapist notified');
      setOpen(false);
    } catch (e) { toast.error((e as Error).message || 'Could not approve'); }
  };

  const reject = async () => {
    try {
      await review.mutateAsync({ planId: plan.id, decision: 'reject', notes: form.notes || undefined });
      toast.success('Application declined');
      setOpen(false);
    } catch (e) { toast.error((e as Error).message || 'Could not decline'); }
  };

  const field = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 text-left">
        <div>
          <p className="font-semibold text-slate-900 text-sm">{patientName}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Requested {money(plan.total_credit_amount)} · {format(new Date(plan.created_at), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium', STATUS[plan.status] || 'bg-slate-100 text-slate-600')}>Pending review</span>
          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {plan.review_notes && !open && (
        <p className="text-xs text-slate-500 mt-2">Patient note: {plan.review_notes}</p>
      )}

      {open && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          {plan.review_notes && <p className="text-xs text-slate-500">Patient note: {plan.review_notes}</p>}
          <div className="grid sm:grid-cols-2 gap-2">
            <select value={form.physio_id} onChange={(e) => setForm({ ...form, physio_id: e.target.value })} className={field}>
              <option value="">Assign physiotherapist…</option>
              {physios.map((p) => {
                const uid = (p.user_id || p.id) as string;
                return <option key={uid} value={uid}>{(p.full_name as string) || uid}</option>;
              })}
            </select>
            <input type="number" min={0} value={form.session_rate} onChange={(e) => setForm({ ...form, session_rate: e.target.value })}
              placeholder="Session rate (₦)" className={field} />
            <input type="number" min={0} value={form.sessions_total} onChange={(e) => setForm({ ...form, sessions_total: e.target.value })}
              placeholder="Sessions total" className={field} />
            <input type="number" min={0} value={form.duration_months} onChange={(e) => setForm({ ...form, duration_months: e.target.value })}
              placeholder="Duration (months)" className={field} />
            <input value={form.mediloan_ref} onChange={(e) => setForm({ ...form, mediloan_ref: e.target.value })}
              placeholder="Mediloan reference" className={field} />
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Review note (optional)" className={field} />
          </div>
          <div className="flex gap-2">
            <button onClick={approve} disabled={review.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-60">
              {review.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}Approve
            </button>
            <button onClick={reject} disabled={review.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50 disabled:opacity-60">
              <X className="w-3.5 h-3.5" />Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanRow({ plan, patientName, physioName }: {
  plan: RehabCreditPlan; patientName: string; physioName: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: detail, isLoading } = useRehabCreditPlan(open ? plan.id : undefined);
  const markRepayment = useMarkRehabRepayment();

  const mark = async (checkId: string, status: 'on_time' | 'missed') => {
    try {
      await markRepayment.mutateAsync({ checkId, status });
      toast.success(status === 'on_time' ? 'Recorded as paid on time' : 'Recorded as missed');
    } catch (e) { toast.error((e as Error).message || 'Could not record'); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50 transition-colors">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">
            {patientName}
            <span className="font-normal text-slate-400"> · {physioName}</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {money(plan.total_credit_amount)} · {plan.sessions_released}/{plan.sessions_total} sessions released
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {plan.consecutive_missed_payments > 0 && (
            <span className="flex items-center gap-1 text-rose-600 text-xs font-semibold" title={`${plan.consecutive_missed_payments} missed installment(s)`}>
              <Flag className="w-3.5 h-3.5" />{plan.consecutive_missed_payments}
            </span>
          )}
          <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium capitalize', STATUS[plan.status] || 'bg-slate-100 text-slate-600')}>{plan.status}</span>
          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mediloan repayment schedule</p>
                {(detail?.repayment_checks || []).length === 0 ? (
                  <p className="text-xs text-slate-500">No schedule generated.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(detail?.repayment_checks || []).map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-600">
                          {c.period_label} · due {format(new Date(c.due_date), 'MMM d, yyyy')}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {c.status === 'upcoming' ? (
                            <>
                              <button onClick={() => mark(c.id, 'on_time')} disabled={markRepayment.isPending}
                                className="px-2 py-1 rounded-md border border-green-200 text-green-700 font-semibold hover:bg-green-50 disabled:opacity-60">
                                On time
                              </button>
                              <button onClick={() => mark(c.id, 'missed')} disabled={markRepayment.isPending}
                                className="px-2 py-1 rounded-md border border-rose-200 text-rose-600 font-semibold hover:bg-rose-50 disabled:opacity-60">
                                Missed
                              </button>
                            </>
                          ) : (
                            <span className={cn('px-2 py-0.5 rounded-md font-medium',
                              c.status === 'on_time' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700')}>
                              {c.status === 'on_time' ? 'On time' : 'Missed'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Session releases</p>
                {(detail?.releases || []).length === 0 ? (
                  <p className="text-xs text-slate-500">No sessions logged against this plan yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(detail?.releases || []).map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-600">{format(new Date(r.created_at), 'MMM d, yyyy')} · {money(r.amount)}</span>
                        <span className={cn('px-2 py-0.5 rounded-md font-medium',
                          r.status === 'paid' ? 'bg-green-100 text-green-700'
                            : r.status === 'both_confirmed' ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700')}>
                          {r.status === 'paid' ? 'Paid' : r.status === 'both_confirmed' ? 'Ready for payout' : 'Awaiting confirmation'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {detail?.plan.mediloan_ref && (
                <p className="text-xs text-slate-500">Mediloan reference: {detail.plan.mediloan_ref}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
