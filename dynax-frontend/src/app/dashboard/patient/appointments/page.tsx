'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePatientAppointments } from '@/hooks/useApi';
import { Calendar, Loader2, Clock, Video, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  no_show: 'bg-slate-100 text-slate-600',
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
  const { data, isLoading } = usePatientAppointments({ page, page_size: 20 });

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
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">My Appointments</h1>
          <p className="text-slate-500 text-sm mt-1">{data?.meta?.total || 0} total appointments</p>
        </div>

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
                      {appt.status === 'scheduled' && appt.meeting_url && (
                        <a
                          href={appt.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                        >
                          <Video className="w-4 h-4" />
                          Join Virtual Session
                        </a>
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
    </DashboardLayout>
  );
}
