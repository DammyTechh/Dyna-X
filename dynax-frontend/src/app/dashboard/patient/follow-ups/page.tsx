'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePatientFollowUps, useRespondFollowUp } from '@/hooks/useApi';
import { CalendarClock, Loader2, CheckCircle2, Clock, AlertTriangle, Send } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUS = {
  scheduled: { label: 'Awaiting your check-in', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  flagged: { label: 'Flagged for review', cls: 'bg-rose-100 text-rose-700', icon: AlertTriangle },
};

export default function PatientFollowUpsPage() {
  const { data: followUps, isLoading } = usePatientFollowUps();
  const respond = useRespondFollowUp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [needsReeval, setNeedsReeval] = useState(false);

  const items = followUps || [];

  const submit = async (id: string) => {
    if (!text.trim()) { toast.error('Please write how you are doing'); return; }
    try {
      await respond.mutateAsync({ id, response: text.trim(), needs_reevaluation: needsReeval });
      toast.success('Check-in submitted');
      setOpenId(null); setText(''); setNeedsReeval(false);
    } catch (e) { toast.error((e as Error).message || 'Could not submit'); }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Check-ins</h1>
          <p className="text-slate-500 text-sm mt-1">Follow-ups from your care team. Let them know how you&apos;re doing.</p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <CalendarClock className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">No check-ins yet</p>
            <p className="text-xs text-slate-400 mt-1">Your professional will schedule these after a session or at discharge.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((f) => {
              const st = STATUS[f.status] || STATUS.scheduled;
              const Icon = st.icon;
              const isOpen = openId === f.id;
              const answered = f.status !== 'scheduled';
              return (
                <div key={f.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">Check-in</p>
                      <p className="text-xs text-slate-500 mt-0.5">Due {format(new Date(f.due_date), 'MMM d, yyyy')}</p>
                    </div>
                    <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium', st.cls)}>
                      <Icon className="w-3.5 h-3.5" />{st.label}
                    </span>
                  </div>
                  {f.note && <p className="text-sm text-slate-600 mt-2">{f.note}</p>}

                  {answered && f.patient_response && (
                    <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Your response</p>
                      <p className="text-sm text-slate-700">{f.patient_response}</p>
                    </div>
                  )}

                  {!answered && (
                    isOpen ? (
                      <div className="mt-3 space-y-2">
                        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
                          placeholder="How have you been since your last visit? Any pain, concerns, or progress?"
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={needsReeval} onChange={(e) => setNeedsReeval(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-200" />
                          I think I may need to be seen again
                        </label>
                        <div className="flex gap-2">
                          <button onClick={() => submit(f.id)} disabled={respond.isPending}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60">
                            {respond.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}Submit check-in
                          </button>
                          <button onClick={() => { setOpenId(null); setText(''); setNeedsReeval(false); }}
                            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setOpenId(f.id); setText(''); setNeedsReeval(false); }}
                        className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100">
                        <Send className="w-3.5 h-3.5" />Respond
                      </button>
                    )
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
