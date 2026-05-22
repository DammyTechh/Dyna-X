'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useProfessionalSessions, useCreateSession, useMyPatients, useGenerateSOAPNote } from '@/hooks/useApi';
import { Activity, Plus, Loader2, Sparkles, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const schema = z.object({
  patient_id: z.string().min(1),
  session_date: z.string().min(1),
  duration_minutes: z.number({ coerce: true }).min(5),
  session_type: z.enum(['virtual', 'in_person']),
  subjective_note: z.string().optional(),
  objective_note: z.string().optional(),
  assessment_note: z.string().optional(),
  plan_note: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const SOAP_SECTIONS = [
  { key: 'subjective_note' as const, label: 'S — Subjective', placeholder: "Patient's reported symptoms, complaints, and history…", color: 'blue' },
  { key: 'objective_note' as const, label: 'O — Objective', placeholder: 'Measurable observations: ROM, strength, gait analysis, vital signs…', color: 'teal' },
  { key: 'assessment_note' as const, label: 'A — Assessment', placeholder: 'Clinical interpretation, diagnosis, and progress evaluation…', color: 'purple' },
  { key: 'plan_note' as const, label: 'P — Plan', placeholder: 'Next steps, exercises, follow-up schedule, referrals…', color: 'green' },
];

export default function SessionsPage() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data, isLoading } = useProfessionalSessions({ page, page_size: 20 });
  const { data: patients } = useMyPatients({ page: 1, page_size: 100 });
  const { mutateAsync: create, isPending: creating } = useCreateSession();
  const { mutateAsync: generateSOAP, isPending: generatingSOAP } = useGenerateSOAPNote();

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      session_type: 'virtual',
      duration_minutes: 60,
      session_date: new Date().toISOString().slice(0, 16),
    },
  });
  const patientId = watch('patient_id');

  const onSubmit = async (data: FormData) => {
    try {
      await create(data);
      toast.success('Session logged successfully!');
      reset();
      setShowForm(false);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to log session');
    }
  };

  const handleGenerateSOAP = async () => {
    if (!patientId) { toast.error('Select a patient first'); return; }
    try {
      const res = await generateSOAP({ patient_id: patientId });
      const lines = res.soap_note.split('\n');
      lines.forEach((line) => {
        if (line.startsWith('S:')) setValue('subjective_note', line.slice(2).trim());
        if (line.startsWith('O:')) setValue('objective_note', line.slice(2).trim());
        if (line.startsWith('A:')) setValue('assessment_note', line.slice(2).trim());
        if (line.startsWith('P:')) setValue('plan_note', line.slice(2).trim());
      });
      toast.success('SOAP note pre-filled by AI. Review before saving.');
    } catch {
      toast.error('AI generation failed');
    }
  };

  const sessions = data?.data || [];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Session Logs</h1>
            <p className="text-slate-500 text-sm mt-1">{data?.meta?.total || 0} sessions logged</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl dynax-gradient text-white text-sm font-semibold shadow-lg shadow-blue-200 hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> Log Session
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-semibold text-slate-900">New Session Log</h2>
              <button onClick={handleGenerateSOAP} disabled={generatingSOAP || !patientId}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-100 text-purple-700 rounded-xl text-sm font-semibold hover:bg-purple-200 disabled:opacity-50 transition-colors">
                {generatingSOAP ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                AI Fill SOAP
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Patient *</label>
                  <select {...register('patient_id')} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                    <option value="">Select patient…</option>
                    {patients?.data?.map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
                  </select>
                  {errors.patient_id && <p className="text-red-500 text-xs mt-1">Required</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Session Date & Time</label>
                  <input {...register('session_date')} type="datetime-local"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Duration (min)</label>
                  <input {...register('duration_minutes')} type="number" min={5} step={5}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
              </div>

              <div className="flex gap-2">
                {(['virtual', 'in_person'] as const).map((t) => (
                  <label key={t} className={cn('flex items-center gap-2 px-4 py-2 rounded-xl border-2 cursor-pointer text-sm font-medium transition-all',
                    watch('session_type') === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600')}>
                    <input {...register('session_type')} type="radio" value={t} className="sr-only" />
                    {t === 'virtual' ? 'Virtual' : 'In-Person'}
                  </label>
                ))}
              </div>

              {/* SOAP Notes */}
              <div className="space-y-4">
                <p className="text-sm font-semibold text-slate-700">SOAP Notes</p>
                {SOAP_SECTIONS.map(({ key, label, placeholder, color }) => (
                  <div key={key}>
                    <label className={cn('block text-xs font-semibold mb-1.5 uppercase tracking-wide',
                      `text-${color}-600`)}>
                      {label}
                    </label>
                    <textarea {...register(key)} placeholder={placeholder} rows={3}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={creating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {creating ? 'Saving…' : 'Save Session'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Sessions list */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
          ) : sessions.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {sessions.map((session) => (
                <div key={session.id} className="px-6 py-4">
                  <button onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
                    className="w-full flex items-start justify-between gap-4 text-left">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex flex-col items-center justify-center flex-shrink-0">
                        <Activity className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">
                          {format(new Date(session.session_date), 'MMMM d, yyyy · h:mm a')}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {session.duration_minutes} min · {session.session_type === 'virtual' ? 'Virtual' : 'In-Person'}
                          {session.patient_rating && ` · ★ ${session.patient_rating}/5`}
                        </p>
                      </div>
                    </div>
                    {expandedId === session.id
                      ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
                      : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />}
                  </button>

                  {expandedId === session.id && (
                    <div className="mt-4 grid sm:grid-cols-2 gap-4 pl-14">
                      {([
                        ['S — Subjective', session.subjective_note],
                        ['O — Objective', session.objective_note],
                        ['A — Assessment', session.assessment_note],
                        ['P — Plan', session.plan_note],
                      ] as [string, string | undefined][]).map(([label, content]) =>
                        content ? (
                          <div key={label} className="bg-slate-50 rounded-xl p-3">
                            <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">{label}</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{content}</p>
                          </div>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Activity className="w-10 h-10 text-slate-300 mb-3" />
              <h3 className="font-semibold text-slate-700 mb-1">No sessions logged yet</h3>
              <p className="text-slate-500 text-sm">Log your first therapy session using the button above.</p>
            </div>
          )}

          {data?.meta && data.meta.total_pages > 1 && (
            <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between">
              <p className="text-sm text-slate-500">Page {page} of {data.meta.total_pages}</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40">Previous</button>
                <button disabled={page >= data.meta.total_pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
