'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useMyPatients } from '@/hooks/useApi';
import { Search, Users, ChevronRight, Loader2, User } from 'lucide-react';
import { format } from 'date-fns';

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyPatients({ page, page_size: 20, search });

  const patients = data?.data || [];
  const meta = data?.meta;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">My Patients</h1>
            <p className="text-slate-500 text-sm mt-1">{meta?.total || 0} patients connected</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search patients by name…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm" />
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
          ) : patients.length > 0 ? (
            <>
              <div className="divide-y divide-slate-50">
                {patients.map((patient) => (
                  <Link key={patient.id} href={`/dashboard/professional/patients/${patient.user_id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold">{patient.full_name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm">{patient.full_name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {patient.email && <p className="text-xs text-slate-500 truncate">{patient.email}</p>}
                        {patient.condition && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium truncate">
                            {patient.condition}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {patient.personal_code && (
                        <p className="text-xs font-mono text-slate-400 mb-1">{patient.personal_code}</p>
                      )}
                      <p className="text-xs text-slate-400">
                        Since {format(new Date(patient.created_at), 'MMM yyyy')}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {meta && meta.total_pages > 1 && (
                <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, meta.total)} of {meta.total}
                  </p>
                  <div className="flex gap-2">
                    <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                      Previous
                    </button>
                    <button disabled={page >= meta.total_pages} onClick={() => setPage(page + 1)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="font-semibold text-slate-700 mb-1">No patients yet</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                Share your DX-PIN code with patients from your dashboard. Once they connect, they&apos;ll appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
