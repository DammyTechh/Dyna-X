'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAdminProfessionals, useApproveProfessional } from '@/hooks/useApi';
import {
  Search, Loader2, CheckCircle, XCircle, Clock,
  UserCheck, Filter, ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getRoleLabel, getRoleColor } from '@/lib/routing';

const STATUS_TABS = [
  { value: 'pending', label: 'Pending', icon: Clock, color: 'text-amber-600' },
  { value: 'approved', label: 'Approved', icon: CheckCircle, color: 'text-green-600' },
  { value: 'rejected', label: 'Rejected', icon: XCircle, color: 'text-red-500' },
  { value: '', label: 'All', icon: UserCheck, color: 'text-slate-600' },
];

export default function AdminProfessionalsPage() {
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const { data, isLoading, refetch } = useAdminProfessionals(status || undefined);
  const { mutateAsync: approve, isPending: approving } = useApproveProfessional();

  const handleApprove = async (id: string, name: string) => {
    try {
      await approve({ id, is_approved: true, notes: 'Credentials verified.' });
      toast.success(`${name} has been approved. Email notification sent.`);
      refetch();
    } catch {
      toast.error('Failed to approve. Please try again.');
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal) return;
    try {
      await approve({ id: rejectModal.id, is_approved: false, notes: rejectNotes });
      toast.success(`${rejectModal.name} has been rejected.`);
      setRejectModal(null);
      setRejectNotes('');
      refetch();
    } catch {
      toast.error('Failed to reject. Please try again.');
    }
  };

  const professionals = (data?.data || []).filter((p: Record<string, unknown>) => {
    if (!search) return true;
    const name = (p.full_name as string || '').toLowerCase();
    const email = (p.email as string || '').toLowerCase();
    return name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
  });

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Professional Management</h1>
          <p className="text-slate-500 text-sm mt-1">Review, approve, and manage professional registrations</p>
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {STATUS_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => setStatus(tab.value)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  status === tab.value
                    ? 'bg-white shadow-sm text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', status === tab.value ? tab.color : '')} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
            </div>
          ) : professionals.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {professionals.map((prof: Record<string, unknown>) => {
                const profId = (prof.user_id || prof.id) as string;
                const fullName = prof.full_name as string;
                const email = prof.email as string;
                const profType = (prof.professional_type || '') as string;
                const licenseNumber = prof.license_number as string | undefined;
                const clinicName = prof.clinic_name as string | undefined;
                const approvalStatus = (prof.approval_status || 'pending') as string;
                const createdAt = prof.created_at as string;

                return (
                  <div key={profId} className="px-6 py-5">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      {/* Avatar + info */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">
                            {fullName?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900">{fullName}</p>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', getRoleColor(profType))}>
                              {getRoleLabel(profType)}
                            </span>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold',
                              approvalStatus === 'approved' ? 'bg-green-100 text-green-700' :
                              approvalStatus === 'rejected' ? 'bg-red-100 text-red-600' :
                              'bg-amber-100 text-amber-700')}>
                              {approvalStatus}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">{email}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-slate-400 flex-wrap">
                            {licenseNumber && <span>License: <span className="font-mono">{licenseNumber}</span></span>}
                            {clinicName && <span>Clinic: {clinicName}</span>}
                            <span>Registered: {format(new Date(createdAt), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {approvalStatus === 'pending' && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleApprove(profId, fullName)}
                            disabled={approving}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors"
                          >
                            {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectModal({ id: profId, name: fullName })}
                            className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      )}
                      {approvalStatus === 'approved' && (
                        <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium flex-shrink-0">
                          <CheckCircle className="w-4 h-4" /> Approved
                        </span>
                      )}
                      {approvalStatus === 'rejected' && (
                        <button
                          onClick={() => handleApprove(profId, fullName)}
                          disabled={approving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-100 transition-colors flex-shrink-0"
                        >
                          Reinstate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <UserCheck className="w-10 h-10 text-slate-300 mb-3" />
              <h3 className="font-semibold text-slate-700 mb-1">
                No {status || ''} professionals
              </h3>
              <p className="text-slate-500 text-sm">
                {status === 'pending'
                  ? 'All applications have been reviewed.'
                  : 'No professionals match your filter.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up">
            <h2 className="font-display font-bold text-lg text-slate-900 mb-1">Reject Application</h2>
            <p className="text-slate-500 text-sm mb-4">
              You are rejecting <strong>{rejectModal.name}</strong>. Provide a reason that will be emailed to them.
            </p>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="e.g. License number could not be verified. Please resubmit with valid documentation…"
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={handleRejectSubmit}
                disabled={approving}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {approving && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Rejection
              </button>
              <button
                onClick={() => { setRejectModal(null); setRejectNotes(''); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
