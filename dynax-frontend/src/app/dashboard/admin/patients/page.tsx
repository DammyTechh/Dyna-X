'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAdminPatients } from '@/hooks/useApi';
import { Search, Users, Loader2, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminPatientsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { data, isLoading } = useAdminPatients({ page, page_size: 25, search });

  const patients = data?.data || [];
  const meta = data?.meta;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Patient Management</h1>
          <p className="text-slate-500 text-sm mt-1">{meta?.total || 0} registered patients</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
          ) : patients.length > 0 ? (
            <>
              <div className="divide-y divide-slate-50">
                {patients.map((p: Record<string, unknown>) => (
                  <div key={p.id as string} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-teal-400 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold text-sm">
                        {(p.full_name as string)?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm">{p.full_name as string}</p>
                      <p className="text-xs text-slate-500 truncate">{p.email as string}</p>
                    </div>
                    {p.condition && (
                      <span className="hidden sm:block text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {p.condition as string}
                      </span>
                    )}
                    <div className="text-right text-xs text-slate-400">
                      {format(new Date(p.created_at as string), 'MMM d, yyyy')}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </div>
                ))}
              </div>
              {meta && meta.total_pages > 1 && (
                <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between">
                  <p className="text-sm text-slate-500">{(page - 1) * 25 + 1}–{Math.min(page * 25, meta.total)} of {meta.total}</p>
                  <div className="flex gap-2">
                    <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Previous</button>
                    <button disabled={page >= meta.total_pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Next</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Users className="w-10 h-10 text-slate-300 mb-3" />
              <h3 className="font-semibold text-slate-700 mb-1">No patients found</h3>
              <p className="text-slate-500 text-sm">Try adjusting your search.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
