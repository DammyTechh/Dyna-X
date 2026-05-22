'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePatientSessions } from '@/hooks/useApi';
import { Activity, Loader2, Star, ChevronDown, ChevronUp, Video, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function PatientSessionsPage() {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data, isLoading } = usePatientSessions({ page, page_size: 20 });
  const sessions = data?.data || [];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6 animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Session History</h1>
          <p className="text-slate-500 text-sm mt-1">{data?.meta?.total || 0} therapy sessions recorded</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16 bg-white rounded-2xl border border-slate-100">
            <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          </div>
        ) : sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((session) => {
              const isExpanded = expandedId === session.id;
              const hasSOAP = session.subjective_note || session.objective_note || session.assessment_note || session.plan_note;
              return (
                <div key={session.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => hasSOAP && setExpandedId(isExpanded ? null : session.id)}
                    className={cn('w-full p-5 flex items-start gap-4 text-left', !hasSOAP && 'cursor-default')}
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Activity className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {format(new Date(session.session_date), 'MMMM d, yyyy')}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Activity className="w-3 h-3" />
                              {session.duration_minutes} min
                            </span>
                            <span className="flex items-center gap-1">
                              {session.session_type === 'virtual'
                                ? <><Video className="w-3 h-3" /> Virtual</>
                                : <><MapPin className="w-3 h-3" /> In-Person</>}
                            </span>
                            {session.goals_achieved !== undefined && (
                              <span className={cn('font-medium', session.goals_achieved ? 'text-green-600' : 'text-amber-600')}>
                                {session.goals_achieved ? '✓ Goals achieved' : '⚬ Goals in progress'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {session.patient_rating && (
                            <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-lg">
                              <Star className="w-3 h-3 fill-amber-500" />
                              <span className="text-xs font-bold">{session.patient_rating}/5</span>
                            </div>
                          )}
                          {hasSOAP && (
                            isExpanded
                              ? <ChevronUp className="w-4 h-4 text-slate-400" />
                              : <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  {isExpanded && hasSOAP && (
                    <div className="px-5 pb-5 pt-4 border-t border-slate-50">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Session Notes</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {[
                          { label: 'S — Subjective', content: session.subjective_note, color: 'border-l-blue-400' },
                          { label: 'O — Objective', content: session.objective_note, color: 'border-l-teal-400' },
                          { label: 'A — Assessment', content: session.assessment_note, color: 'border-l-purple-400' },
                          { label: 'P — Plan', content: session.plan_note, color: 'border-l-green-400' },
                        ].map(({ label, content, color }) =>
                          content ? (
                            <div key={label} className={cn('bg-slate-50 rounded-xl p-3 border-l-4', color)}>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
                              <p className="text-sm text-slate-700 leading-relaxed">{content}</p>
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Activity className="w-10 h-10 text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-700 mb-1">No sessions yet</h3>
            <p className="text-slate-500 text-sm max-w-xs">
              Your therapy sessions will appear here once your professional logs them.
            </p>
          </div>
        )}

        {data?.meta && data.meta.total_pages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-slate-500">Page {page} of {data.meta.total_pages}</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Previous</button>
              <button disabled={page >= data.meta.total_pages} onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
