'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTherapayApplications, useReviewApplication, useAnnounce } from '@/hooks/useApi';
import { CreditCard, Loader2, Check, X, Megaphone, Send } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Application = {
  id: string; patient_id: string; plan_type: string;
  requested_amount?: number | null; status: string; review_notes?: string | null; created_at: string;
};

const STATUS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-rose-100 text-rose-700',
};

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
      </div>
    </DashboardLayout>
  );
}
