'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useProfessionalFollowUps, useCreateFollowUp, useMyPatients } from '@/hooks/useApi';
import { CalendarClock, Plus, X, Loader2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CADENCES = [
  { value: 'two_week', label: '2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'custom', label: 'Custom' },
];

const STATUS = {
  scheduled: { label: 'Scheduled', cls: 'bg-blue-100 text-blue-700', icon: Clock },
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  flagged: { label: 'Needs re-eval', cls: 'bg-rose-100 text-rose-700', icon: AlertTriangle },
};

function defaultDue(cadence: string): string {
  const d = new Date();
  if (cadence === 'two_week') d.setDate(d.getDate() + 14);
  else if (cadence === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (cadence === 'quarterly') d.setMonth(d.getMonth() + 3);
  else d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

export default function ProfessionalFollowUpsPage() {
  const { data: followUps, isLoading } = useProfessionalFollowUps();
  const { data: patients } = useMyPatients({ page: 1, page_size: 100 });
  const create = useCreateFollowUp();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ patient_id: '', cadence: 'two_week', due_date: defaultDue('two_week'), note: '' });

  const patientList = (patients?.data as { user_id: string; full_name: string }[] | undefined) || [];
  const items = followUps || [];
  const flagged = items.filter((f) => f.status === 'flagged');

  const setCadence = (c: string) => setForm({ ...form, cadence: c, due_date: c === 'custom' ? form.due_date : defaultDue(c) });

  const submit = async () => {
    if (!form.patient_id || !form.due_date) { toast.error('Pick a patient and a due date'); return; }
    try {
      await create.mutateAsync({ patient_id: form.patient_id, cadence: form.cadence, due_date: form.due_date, note: form.note || undefined });
      toast.success('Follow-up scheduled');
      setShow(false);
      setForm({ patient_id: '', cadence: 'two_week', due_date: defaultDue('two_week'), note: '' });
    } catch (e) { toast.error((e as Error).message || 'Could not schedule'); }
  };

  const nameOf = (id: string) => patientList.find((p) => p.user_id === id)?.full_name || 'Patient';

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Follow-ups</h1>
            <p className="text-slate-500 text-sm mt-1">Schedule check-ins at discharge and track who needs re-evaluation.</p>
          </div>
          <button onClick={() => setShow((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 flex-shrink-0">
            {show ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{show ? 'Close' : 'Schedule follow-up'}
          </button>
        </div>

        {flagged.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-rose-800">
              <span className="font-semibold">{flagged.length}</span> patient{flagged.length > 1 ? 's' : ''} flagged for re-evaluation based on their check-in responses.
            </p>
          </div>
        )}

        {show && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Patient</label>
                <select value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                  <option value="">Select…</option>
                  {patientList.map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Cadence</label>
                <select value={form.cadence} onChange={(e) => setCadence(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                  {CADENCES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Due date</label>
                <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
            </div>
            <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2}
              placeholder="What to check in on (optional)"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
            <button onClick={submit} disabled={create.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}Schedule
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <CalendarClock className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">No follow-ups scheduled</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((f) => {
              const st = STATUS[f.status] || STATUS.scheduled;
              const Icon = st.icon;
              return (
                <div key={f.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{nameOf(f.patient_id)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Due {format(new Date(f.due_date), 'MMM d, yyyy')} · {f.cadence.replace('_', ' ')}</p>
                    </div>
                    <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium', st.cls)}>
                      <Icon className="w-3.5 h-3.5" />{st.label}
                    </span>
                  </div>
                  {f.note && <p className="text-sm text-slate-600 mt-2">{f.note}</p>}
                  {f.patient_response && (
                    <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Patient response</p>
                      <p className="text-sm text-slate-700">{f.patient_response}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
