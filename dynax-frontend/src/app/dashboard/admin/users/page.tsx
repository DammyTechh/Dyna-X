'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAdminUsers } from '@/hooks/useApi';
import { apiPost } from '@/lib/api';
import { Search, Users, Loader2, CheckCircle, XCircle, ShieldOff, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getRoleColor, getRoleLabel } from '@/lib/routing';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const { data, isLoading, refetch } = useAdminUsers({ page, page_size: 25, search });

  const users = data?.data || [];
  const meta = data?.meta;

  const handleToggleActive = async (user: User) => {
    setActing(user.id);
    try {
      const endpoint = user.is_active
        ? `/admin/users/${user.id}/deactivate`
        : `/admin/users/${user.id}/reactivate`;
      await apiPost(endpoint);
      toast.success(`User ${user.is_active ? 'deactivated' : 'reactivated'} successfully`);
      refetch();
    } catch {
      toast.error('Action failed. Please try again.');
    } finally {
      setActing(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500 text-sm mt-1">{meta?.total || 0} total users on the platform</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by email or name…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
            </div>
          ) : users.length > 0 ? (
            <>
              {/* Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <div className="col-span-4">User</div>
                <div className="col-span-2">Role</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Joined</div>
                <div className="col-span-2">Actions</div>
              </div>

              <div className="divide-y divide-slate-50">
                {users.map((user) => (
                  <div key={user.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 items-center">
                    {/* User */}
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-sm">
                          {user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">{user.email}</p>
                        <p className="text-xs text-slate-400 font-mono truncate">{user.id.slice(0, 12)}…</p>
                      </div>
                    </div>

                    {/* Role */}
                    <div className="col-span-2">
                      <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold', getRoleColor(user.role))}>
                        {getRoleLabel(user.role)}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="col-span-2">
                      <span className={cn('inline-flex items-center gap-1 text-xs font-semibold',
                        user.is_active ? 'text-green-600' : 'text-red-500')}>
                        {user.is_active
                          ? <><CheckCircle className="w-3.5 h-3.5" /> Active</>
                          : <><XCircle className="w-3.5 h-3.5" /> Disabled</>}
                      </span>
                    </div>

                    {/* Joined */}
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500">{format(new Date(user.created_at), 'MMM d, yyyy')}</p>
                    </div>

                    {/* Actions */}
                    <div className="col-span-2">
                      <button
                        onClick={() => handleToggleActive(user)}
                        disabled={acting === user.id}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60',
                          user.is_active
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                        )}
                      >
                        {acting === user.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : user.is_active
                            ? <><ShieldOff className="w-3.5 h-3.5" /> Deactivate</>
                            : <><Shield className="w-3.5 h-3.5" /> Reactivate</>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {meta && meta.total_pages > 1 && (
                <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    {(page - 1) * 25 + 1}–{Math.min(page * 25, meta.total)} of {meta.total}
                  </p>
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
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Users className="w-10 h-10 text-slate-300 mb-3" />
              <h3 className="font-semibold text-slate-700 mb-1">No users found</h3>
              <p className="text-slate-500 text-sm">Try adjusting your search query.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
