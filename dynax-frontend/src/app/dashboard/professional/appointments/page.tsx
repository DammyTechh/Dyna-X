'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useProfessionalAppointments, useCreateAppointment, useMyPatients, useCancelAppointment } from '@/hooks/useApi';
import { Calendar, Plus, Video, MapPin, Clock, Loader2, X, Check } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const schema = z.object({
  patient_id: z.string().min(1, 'Select a patient'),
  title: z.string().min(3, 'Title required'),
  description: z.string().optional(),
  scheduled_at: z.string().min(1, 'Date and time required'),
  duration_minutes: z.number({ coerce: true }).min(15),
  session_type: z.enum(['virtual', 'in_person']),
  meeting_url: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-slate-100 text-slate-600',
};

export default function AppointmentsPage() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const { data, isLoading, refetch } = useProfessionalAppointments({ page, page_size: 20 });
  const { data: patients } = useMyPatients({ page: 1, page_size: 100 });
  const { mutateAsync: create, isPending: creating } = useCreateAppointment();
  const { mutateAsync: cancel } = useCancelAppointment();

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { session_type: 'virtual', duration_minutes: 60 },
  });
  const sessionType = watch('session_type');

  const onSubmit = async (data: FormData) => {
    try {
      await create(data);
      toast.success('Appointment scheduled!');
      reset();
      setShowForm(false);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to create appointment');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this appointment?')) return;
    try {
      await cancel(id);
      toast.success('Appointment cancelled');
      refetch();
    } catch {
      toast.error('Failed to cancel');
    }
  };

  const appointments = data?.data || [];
  const meta = data?.meta;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Appointments</h1>
            <p className="text-slate-500 text-sm mt-1">{meta?.total || 0} total appointments</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl dynax-gradient text-white text-sm font-semibold shadow-lg shadow-blue-200 hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> Schedule Appointment
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-slide-up">
            <h2 className="font-display font-semibold text-slate-900 mb-5">New Appointment</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Patient *</label>
                <select {...register('patient_id')}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                  <option value="">Select patient…</option>
                  {patients?.data?.map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
                </select>
                {errors.patient_id && <p className="text-red-500 text-xs mt-1">{errors.patient_id.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Title *</label>
                <input {...register('title')} placeholder="e.g. Initial Assessment"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Date & Time *</label>
                <input {...register('scheduled_at')} type="datetime-local"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                {errors.scheduled_at && <p className="text-red-500 text-xs mt-1">{errors.scheduled_at.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Duration (minutes)</label>
                <input {...register('duration_minutes')} type="number" min={15} step={15}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Session Type</label>
                <div className="flex gap-2">
                  {(['virtual', 'in_person'] as const).map((t) => (
                    <label key={t} className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 cursor-pointer text-sm font-medium transition-all',
                      sessionType === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600')}>
                      <input {...register('session_type')} type="radio" value={t} className="sr-only" />
                      {t === 'virtual' ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                      {t === 'virtual' ? 'Virtual' : 'In-Person'}
                    </label>
                  ))}
                </div>
              </div>

              {sessionType === 'virtual' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Meeting URL</label>
                  <input {...register('meeting_url')} type="url" placeholder="https://meet.google.com/…"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description (optional)</label>
                <textarea {...register('description')} rows={2} placeholder="Session notes or agenda…"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
              </div>

              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={creating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {creating ? 'Scheduling…' : 'Schedule Appointment'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
          ) : appointments.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {appointments.map((appt) => {
                const date = new Date(appt.scheduled_at);
                const past = isPast(date) && appt.status === 'scheduled';
                return (
                  <div key={appt.id} className="px-6 py-4 flex items-start gap-4">
                    <div className={cn('w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 font-display',
                      appt.status === 'completed' ? 'bg-green-50' : appt.status === 'cancelled' ? 'bg-red-50' : 'bg-blue-50')}>
                      <span className={cn('text-xs font-semibold', appt.status === 'completed' ? 'text-green-600' : appt.status === 'cancelled' ? 'text-red-500' : 'text-blue-600')}>
                        {format(date, 'MMM')}
                      </span>
                      <span className={cn('text-lg font-bold leading-none', appt.status === 'completed' ? 'text-green-700' : appt.status === 'cancelled' ? 'text-red-600' : 'text-blue-700')}>
                        {format(date, 'd')}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 text-sm">{appt.title}</p>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase', STATUS_COLORS[appt.status])}>
                          {appt.status}
                        </span>
                        {past && <span className="text-[10px] text-amber-600 font-medium">Overdue</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(date, 'h:mm a')} · {appt.duration_minutes} min</span>
                        <span className="flex items-center gap-1">
                          {appt.session_type === 'virtual' ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                          {appt.session_type === 'virtual' ? 'Virtual' : 'In-Person'}
                        </span>
                      </div>
                      {appt.description && <p className="text-xs text-slate-500 mt-1 truncate">{appt.description}</p>}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {appt.status === 'scheduled' && appt.meeting_url && (
                        <a href={appt.meeting_url} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                          Join
                        </a>
                      )}
                      {appt.status === 'scheduled' && (
                        <button onClick={() => handleCancel(appt.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Calendar className="w-10 h-10 text-slate-300 mb-3" />
              <h3 className="font-semibold text-slate-700 mb-1">No appointments</h3>
              <p className="text-slate-500 text-sm">Schedule your first appointment using the button above.</p>
            </div>
          )}

          {meta && meta.total_pages > 1 && (
            <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between">
              <p className="text-sm text-slate-500">Page {page} of {meta.total_pages}</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Previous</button>
                <button disabled={page >= meta.total_pages} onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
