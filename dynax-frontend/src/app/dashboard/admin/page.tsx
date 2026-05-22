'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAdminStats, useAdminProfessionals, useApproveProfessional } from '@/hooks/useApi';
import { Users, UserCheck, Activity, TrendingUp, Clock, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { AdminStats } from '@/types';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminStats();
  const { data: pendingProfs } = useAdminProfessionals('pending');
  const { mutateAsync: approve, isPending: approving } = useApproveProfessional();

  const handleApprove = async (id: string, approved: boolean) => {
    try {
      await approve({ id, is_approved: approved });
      toast.success(`Professional ${approved ? 'approved' : 'rejected'} successfully`);
    } catch {
      toast.error('Action failed. Please try again.');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Platform overview and management</p>
        </div>

        {/* Stats grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Total Users" value={stats?.total_users || 0} color="blue" />
            <StatCard icon={UserCheck} label="Professionals" value={stats?.total_professionals || 0} color="teal" />
            <StatCard icon={Users} label="Patients" value={stats?.total_patients || 0} color="green" />
            <StatCard icon={Clock} label="Pending Approvals" value={stats?.pending_approvals || 0} color="amber" alert />
            <StatCard icon={Activity} label="Total Sessions" value={stats?.total_sessions || 0} color="purple" />
            <StatCard icon={TrendingUp} label="Sessions This Month" value={stats?.sessions_this_month || 0} color="pink" />
            <StatCard icon={CheckCircle} label="Active Care Plans" value={stats?.active_care_plans || 0} color="indigo" />
            <StatCard
              icon={TrendingUp}
              label="Total Revenue"
              value={`₦${(stats?.total_revenue || 0).toLocaleString()}`}
              color="emerald"
              format="currency"
            />
          </div>
        )}

        {/* Pending Professionals */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold text-lg text-slate-900">Pending Professional Approvals</h2>
              <p className="text-slate-500 text-sm">Review and approve new professional registrations</p>
            </div>
            {pendingProfs?.data && pendingProfs.data.length > 0 && (
              <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm font-semibold rounded-full">
                {pendingProfs.data.length} pending
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {pendingProfs?.data && pendingProfs.data.length > 0 ? (
              pendingProfs.data.slice(0, 10).map((prof: {
                id?: string; user_id?: string; full_name: string; email?: string;
                professional_type?: string; license_number?: string; created_at: string;
              }) => (
                <div key={prof.id || prof.user_id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <span className="font-semibold text-slate-600 text-sm">
                        {prof.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">{prof.full_name}</p>
                      <p className="text-slate-500 text-xs truncate">{prof.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-blue-600 font-medium capitalize">
                          {(prof.professional_type || '').replace(/_/g, ' ')}
                        </span>
                        {prof.license_number && (
                          <span className="text-xs text-slate-400">· License: {prof.license_number}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-400 hidden sm:block">
                      {format(new Date(prof.created_at), 'MMM d, yyyy')}
                    </span>
                    <button
                      onClick={() => handleApprove(prof.user_id || prof.id || '', true)}
                      disabled={approving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleApprove(prof.user_id || prof.id || '', false)}
                      disabled={approving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-12 text-center">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">All caught up!</p>
                <p className="text-slate-400 text-sm">No pending approvals right now.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { label: 'View All Users', href: '/dashboard/admin/users', color: 'blue', icon: '👥' },
            { label: 'All Professionals', href: '/dashboard/admin/professionals', color: 'teal', icon: '🏥' },
            { label: 'Analytics', href: '/dashboard/admin/analytics', color: 'purple', icon: '📊' },
          ].map((a) => (
            <a
              key={a.label}
              href={a.href}
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all text-sm font-medium text-slate-700"
            >
              <span className="text-2xl">{a.icon}</span>
              {a.label}
            </a>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  icon: Icon, label, value, color, alert, format: fmt,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  alert?: boolean;
  format?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    teal: 'bg-teal-50 text-teal-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    pink: 'bg-pink-50 text-pink-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  return (
    <div className={`bg-white rounded-2xl p-5 border shadow-sm ${alert && Number(value) > 0 ? 'border-amber-200' : 'border-slate-100'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-display font-bold text-slate-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
