'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAdminAuditLogs } from '@/hooks/useApi';
import { Shield, Search, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-blue-100 text-blue-700',
  logout: 'bg-slate-100 text-slate-600',
  register: 'bg-green-100 text-green-700',
  approve: 'bg-emerald-100 text-emerald-700',
  reject: 'bg-red-100 text-red-600',
  update: 'bg-amber-100 text-amber-700',
  delete: 'bg-red-100 text-red-700',
  create: 'bg-purple-100 text-purple-700',
  connect: 'bg-teal-100 text-teal-700',
};

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data, isLoading } = useAdminAuditLogs({ page, page_size: 30 });

  const logs = (data?.data || []) as Array<Record<string, unknown>>;
  const meta = data?.meta;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6 animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Audit Logs</h1>
          <p className="text-slate-500 text-sm mt-1">Complete activity trail for the DynaX platform</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by user, action, or resource…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <div className="col-span-3">User</div>
            <div className="col-span-2">Action</div>
            <div className="col-span-3">Target</div>
            <div className="col-span-2">IP Address</div>
            <div className="col-span-2">Timestamp</div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
            </div>
          ) : logs.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {logs.map((log) => {
                const id = log.id as string;
                const action = (log.action as string || '').toLowerCase();
                const actionKey = Object.keys(ACTION_COLORS).find((k) => action.includes(k)) || 'update';
                const isExpanded = expandedId === id;

                return (
                  <div key={id}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : id)}
                      className="w-full grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-3.5 items-center hover:bg-slate-50 transition-colors text-left"
                    >
                      {/* User */}
                      <div className="md:col-span-3 flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-slate-600">
                            {(log.user_email as string)?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">{log.user_email as string || 'System'}</p>
                          <p className="text-[10px] text-slate-400 capitalize">{log.user_role as string}</p>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="md:col-span-2">
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase', ACTION_COLORS[actionKey] || 'bg-slate-100 text-slate-600')}>
                          {log.action as string}
                        </span>
                      </div>

                      {/* Target */}
                      <div className="md:col-span-3">
                        {log.target_type ? (
                          <p className="text-xs text-slate-600">
                            <span className="font-medium capitalize">{log.target_type as string}</span>
                            {log.target_id && <span className="text-slate-400 ml-1 font-mono">{(log.target_id as string).slice(0, 8)}…</span>}
                          </p>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>

                      {/* IP */}
                      <div className="md:col-span-2">
                        <p className="text-xs font-mono text-slate-500">{log.ip_address as string || '—'}</p>
                      </div>

                      {/* Timestamp */}
                      <div className="md:col-span-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-400">
                          {format(new Date(log.created_at as string), 'MMM d, h:mm a')}
                        </p>
                        {log.details && (
                          isExpanded
                            ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            : <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        )}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && log.details && (
                      <div className="px-6 pb-3 pl-16">
                        <div className="bg-slate-900 rounded-xl p-3">
                          <pre className="text-xs text-green-400 font-mono overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Shield className="w-10 h-10 text-slate-300 mb-3" />
              <h3 className="font-semibold text-slate-700 mb-1">No audit logs</h3>
              <p className="text-slate-500 text-sm">Platform activity will appear here.</p>
            </div>
          )}

          {meta && meta.total_pages > 1 && (
            <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between">
              <p className="text-sm text-slate-500">Page {page} of {meta.total_pages} · {meta.total} total entries</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                  Previous
                </button>
                <button disabled={page >= meta.total_pages} onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
