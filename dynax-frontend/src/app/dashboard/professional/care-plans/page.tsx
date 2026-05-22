'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCarePlans, useCreateCarePlan, useMyPatients } from '@/hooks/useApi';
import { Heart, Plus, Loader2, Check, Target, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const schema = z.object({
  patient_id: z.string().min(1, 'Select a patient'),
  title: z.string().min(3, 'Title required'),
  description: z.string().optional(),
  goals: z.string().optional(),
  start_date: z.string().min(1, 'Start date required'),
  end_date: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700 border-green-200',
  completed: 'bg-blue-100 text-blue-700 border-blue-200',
  paused: 'bg-amber-100 text-amber-700 border-amber-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
};

export default function CarePlansPage() {
  const searchParams = useSearchParams();
  const defaultPatient = searchParams.get('patient') || '';
  const [patientId, setPatientId] = useState(defaultPatient);
  const [showForm, setShowForm] = useState(false);

  const { data: plans, isLoading, refetch } = useCarePlans(patientId || undefined);
  const { data: patients } = useMyPatients({ page: 1, page_size: 100 });
  const { mutateAsync: create, isPending: creating } = useCreateCarePlan();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { patient_id: defaultPatient, start_date: new Date().toISOString().split('T')[0] },
  });

  const onSubmit = async (data: FormData) => {
    const goals = data.goals
      ? data.goals.split('\n').map((g) => g.trim()).filter(Boolean)
      : [];
    try {
      await create({ ...data, goals });
      toast.success('Care plan created!');
      reset();
      setShowForm(false);
      refetch();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to create care plan');
    }
  };

  const plansList = plans || [];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Care Plans</h1>
            <p className="text-slate-500 text-sm mt-1">Rehabilitation care plans and goal tracking</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl dynax-gradient text-white text-sm font-semibold shadow-lg shadow-blue-200 hover:opacity-90">
            <Plus className="w-4 h-4" /> New Care Plan
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-slide-up">
            <h2 className="font-display font-semibold text-slate-900 mb-5">New Rehabilitation Care Plan</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Patient *</label>
                  <select {...register('patient_id')} onChange={(e) => { register('patient_id').onChange(e); setPatientId(e.target.value); }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                    <option value="">Select patient…</option>
                    {patients?.data?.map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
                  </select>
                  {errors.patient_id && <p className="text-red-500 text-xs mt-1">{errors.patient_id.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Plan Title *</label>
                  <input {...register('title')} placeholder="e.g. 12-Week Post-BKA Rehabilitation"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date *</label>
                  <input {...register('start_date')} type="date"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">End Date (optional)</label>
                  <input {...register('end_date')} type="date"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                  <textarea {...register('description')} rows={2} placeholder="Overview of the rehabilitation approach…"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Goals <span className="text-slate-400 font-normal">(one per line)</span>
                  </label>
                  <textarea {...register('goals')} rows={4}
                    placeholder={`Restore independent ambulation with prosthesis\nAchieve 90° knee flexion\nReturn to ADLs without assistance\nReduce pain to ≤ 2/10`}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
                </div>
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={creating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {creating ? 'Creating…' : 'Create Care Plan'}
                </button>
                <button type="button" onClick={() => { reset(); setShowForm(false); }}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filter by patient */}
        <div className="flex gap-3 items-center">
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
            <option value="">All patients</option>
            {patients?.data?.map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
          </select>
        </div>

        {/* Plans grid */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
        ) : plansList.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {plansList.map((plan) => (
              <div key={plan.id} className={cn('bg-white rounded-2xl border-2 shadow-sm p-5 hover:shadow-md transition-shadow', STATUS_COLORS[plan.status as keyof typeof STATUS_COLORS] || 'border-slate-200')}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-display font-semibold text-slate-900">{plan.title}</h3>
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0', STATUS_COLORS[plan.status as keyof typeof STATUS_COLORS])}>
                    {plan.status}
                  </span>
                </div>

                {plan.description && (
                  <p className="text-xs text-slate-600 mb-3 leading-relaxed line-clamp-2">{plan.description}</p>
                )}

                <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(plan.start_date), 'MMM d, yyyy')}
                  </span>
                  {plan.end_date && (
                    <span>→ {format(new Date(plan.end_date), 'MMM d, yyyy')}</span>
                  )}
                </div>

                {plan.goals && plan.goals.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Target className="w-3 h-3" /> Goals ({plan.goals.length})
                    </p>
                    {plan.goals.slice(0, 3).map((g, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                        <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{g}</span>
                      </div>
                    ))}
                    {plan.goals.length > 3 && (
                      <p className="text-xs text-slate-400 pl-4">+{plan.goals.length - 3} more goals</p>
                    )}
                  </div>
                )}

                {plan.progress_notes && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500 font-medium mb-1">Progress Notes</p>
                    <p className="text-xs text-slate-600 line-clamp-2">{plan.progress_notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Heart className="w-10 h-10 text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-700 mb-1">No care plans yet</h3>
            <p className="text-slate-500 text-sm">Create your first rehabilitation care plan above.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
