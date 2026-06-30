'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePatientAppointments, useMyProfessionals, useRequestAppointment, useCancelPatientAppointment, useReschedulePatientAppointment } from '@/hooks/useApi';
import { VideoCall } from '@/components/video/VideoCall';
import { Calendar, Loader2, Clock, Video, MapPin, ChevronDown, ChevronUp, Plus, X, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  no_show: 'bg-slate-100 text-slate-600',
  requested: 'bg-amber-100 text-amber-700',
  rejected: 'bg-rose-100 text-rose-700',
};

function getDateLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEEE, MMMM d');
}

export default function PatientAppointmentsPage() {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [callRoom, setCallRoom] = useState<string | null>(null);
  const { data, isLoading } = usePatientAppointments({ page, page_size: 20 });
  const { data: professionals } = useMyProfessionals();
  const requestAppt = useRequestAppointment();
  const cancelAppt = useCancelPatientAppointment();
  const rescheduleAppt = useReschedulePatientAppointment();
  const [showRequest, setShowRequest] = useState(false);
  const [form, setForm] = useState({ professional_id: '', title: '', scheduled_at: '', duration_minutes: 30, session_type: 'virtual', description: '' });
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState('');

  const submitRequest = async () => {
    if (!form.professional_id || !form.title || !form.scheduled_at) {
      toast.error('Pick a professional, a title and a time');
      return;
    }
    try {
      await requestAppt.mutateAsync({
        professional_id: form.professional_id,
        title: form.title,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        duration_minutes: Number(form.duration_minutes) || 30,
        session_type: form.session_type,
        description: form.description || undefined,
      });
      toast.success('Appointment requested');
      setShowRequest(false);
      setForm({ professional_id: '', title: '', scheduled_at: '', duration_minutes: 30, session_type: 'virtual', description: '' });
    } catch (e) {
      toast.error((e as Error).message || 'Could not request appointment');
    }
  };

  const doCancel = async (id: string) => {
    try { await cancelAppt.mutateAsync(id); toast.success('Appointment cancelled'); }
    catch (e) { toast.error((e as Error).message || 'Could not cancel'); }
  };

  const doReschedule = async (id: string) => {
    if (!rescheduleAt) { toast.error('Pick a new time'); return; }
    try {
      await rescheduleAppt.mutateAsync({ id, scheduled_at: new Date(rescheduleAt).toISOString() });
      toast.success('New time proposed');
      setRescheduleId(null); setRescheduleAt('');
    } catch (e) { toast.error((e as Error).message || 'Could not reschedule'); }
  };

  const allAppts = data?.data || [];
  const appointments = allAppts.filter((a) => {
    const d = new Date(a.scheduled_at);
    if (filter === 'upcoming') return !isPast(d) || a.status === 'scheduled';
    if (filter === 'past') return isPast(d) || a.status === 'completed';
    return true;
  });

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6 animate-in">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">My Appointments</h1>
            <p className="text-slate-500 text-sm mt-1">{data?.meta?.total || 0} total appointments</p>
          </div>
          <button
            onClick={() => setShowRequest((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            {showRequest ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showRequest ? 'Close' : 'Request appointment'}
          </button>
        </div>

        {showRequest && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-slate-900">Request an appointment</h2>
            {(!professionals || professionals.length === 0) ? (
              <p className="text-sm text-slate-500">
                You need to be connected to a professional first. Connect with one, then request a time.
              </p>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Professional</label>
                    <select value={form.professional_id} onChange={(e) => setForm({ ...form, professional_id: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                      <option value="">Select…</option>
                      {professionals.map((pr) => (
                        <option key={pr.user_id} value={pr.user_id}>{pr.full_name} · {pr.professional_type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Reason / title</label>
                    <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Follow-up review"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Preferred date &amp; time</label>
                    <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Duration</label>
                      <select value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                        {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                      <select value={form.session_type} onChange={(e) => setForm({ ...form, session_type: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                        <option value="virtual">Virtual</option>
                        <option value="in_person">In-person</option>
                      </select>
                    </div>
                  </div>
                </div>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2} placeholder="Anything your professional should know (optional)"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
                <button onClick={submitRequest} disabled={requestAppt.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {requestAppt.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Send request
                </button>
              </>
            )}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {(['upcoming', 'past', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize',
                filter === f ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16 bg-white rounded-2xl border border-slate-100">
            <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          </div>
        ) : appointments.length > 0 ? (
          <div className="space-y-3">
            {appointments.map((appt) => {
              const date = new Date(appt.scheduled_at);
              const isExpanded = expandedId === appt.id;
              const todayAppt = isToday(date);

              return (
                <div
                  key={appt.id}
                  className={cn(
                    'bg-white rounded-2xl border shadow-sm overflow-hidden',
                    todayAppt && appt.status === 'scheduled'
                      ? 'border-blue-200 ring-1 ring-blue-100'
                      : 'border-slate-100'
                  )}
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : appt.id)}
                    className="w-full p-5 flex items-start gap-4 text-left"
                  >
                    {/* Date block */}
                    <div className={cn(
                      'w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0',
                      appt.status === 'completed' ? 'bg-green-50' :
                      appt.status === 'cancelled' ? 'bg-slate-100' :
                      todayAppt ? 'dynax-gradient' : 'bg-blue-50'
                    )}>
                      <span className={cn(
                        'text-xs font-semibold',
                        todayAppt && appt.status === 'scheduled' ? 'text-white/80' :
                        appt.status === 'completed' ? 'text-green-600' :
                        appt.status === 'cancelled' ? 'text-slate-500' : 'text-blue-600'
                      )}>
                        {format(date, 'MMM')}
                      </span>
                      <span className={cn(
                        'text-xl font-display font-bold leading-none',
                        todayAppt && appt.status === 'scheduled' ? 'text-white' :
                        appt.status === 'completed' ? 'text-green-700' :
                        appt.status === 'cancelled' ? 'text-slate-600' : 'text-blue-700'
                      )}>
                        {format(date, 'd')}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">{appt.title}</p>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">
                            {getDateLabel(date)} · {format(date, 'h:mm a')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase', STATUS_STYLES[appt.status])}>
                            {appt.status}
                          </span>
                          {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-slate-400" />
                            : <ChevronDown className="w-4 h-4 text-slate-400" />
                          }
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {appt.duration_minutes} min
                        </span>
                        <span className="flex items-center gap-1">
                          {appt.session_type === 'virtual'
                            ? <><Video className="w-3.5 h-3.5" /> Virtual</>
                            : <><MapPin className="w-3.5 h-3.5" /> In-Person</>
                          }
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-slate-50 pt-4 space-y-3">
                      {appt.description && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 mb-1">Description</p>
                          <p className="text-sm text-slate-700">{appt.description}</p>
                        </div>
                      )}
                      {appt.notes && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 mb-1">Notes</p>
                          <p className="text-sm text-slate-700">{appt.notes}</p>
                        </div>
                      )}
                      {appt.status === 'scheduled' && appt.session_type === 'virtual' && (
                        <button
                          onClick={() => setCallRoom(appt.id)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                        >
                          <Video className="w-4 h-4" />
                          Join Video Call
                        </button>
                      )}

                      {(appt.status === 'requested' || appt.status === 'scheduled') && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {rescheduleId === appt.id ? (
                            <div className="flex flex-wrap items-center gap-2 w-full">
                              <input type="datetime-local" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)}
                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                              <button onClick={() => doReschedule(appt.id)} disabled={rescheduleAppt.isPending}
                                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60">Propose time</button>
                              <button onClick={() => { setRescheduleId(null); setRescheduleAt(''); }}
                                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold">Cancel</button>
                            </div>
                          ) : (
                            <>
                              <button onClick={() => { setRescheduleId(appt.id); setRescheduleAt(''); }}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50">
                                <CalendarClock className="w-3.5 h-3.5" /> Reschedule
                              </button>
                              <button onClick={() => doCancel(appt.id)} disabled={cancelAppt.isPending}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50 disabled:opacity-60">
                                <X className="w-3.5 h-3.5" /> Cancel
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Calendar className="w-10 h-10 text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-700 mb-1">No {filter === 'all' ? '' : filter} appointments</h3>
            <p className="text-slate-500 text-sm max-w-xs">
              Your professional will schedule appointments with you. Connect with one first if you haven&apos;t.
            </p>
          </div>
        )}

        {data?.meta && data.meta.total_pages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-slate-500">Page {page} of {data.meta.total_pages}</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                Previous
              </button>
              <button disabled={page >= data.meta.total_pages} onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {callRoom && (
        <VideoCall
          roomId={callRoom}
          displayName="DynaX patient"
          subject="Scheduled video session"
          onClose={() => setCallRoom(null)}
        />
      )}
    </DashboardLayout>
  );
}
