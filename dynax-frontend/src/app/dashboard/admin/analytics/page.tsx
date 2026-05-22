'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAdminAnalytics, useAdminStats } from '@/hooks/useApi';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Users, Activity, CreditCard, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PERIODS = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
];

// Mock chart data until backend returns real analytics
const MOCK_SESSIONS = [
  { name: 'Mon', sessions: 24 }, { name: 'Tue', sessions: 31 },
  { name: 'Wed', sessions: 28 }, { name: 'Thu', sessions: 42 },
  { name: 'Fri', sessions: 38 }, { name: 'Sat', sessions: 15 },
  { name: 'Sun', sessions: 9 },
];

const MOCK_REGISTRATIONS = [
  { name: 'Jan', patients: 12, professionals: 4 },
  { name: 'Feb', patients: 18, professionals: 7 },
  { name: 'Mar', patients: 25, professionals: 5 },
  { name: 'Apr', patients: 32, professionals: 9 },
  { name: 'May', patients: 28, professionals: 6 },
  { name: 'Jun', patients: 41, professionals: 11 },
];

const MOCK_ROLE_DIST = [
  { name: 'Physiotherapy', value: 42 },
  { name: 'Prosthetics', value: 28 },
  { name: 'Orthotics', value: 18 },
  { name: 'Occupational', value: 15 },
  { name: 'Speech', value: 12 },
  { name: 'Mental Health', value: 9 },
];

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState('week');
  const { data: stats, isLoading: loadingStats } = useAdminStats();
  const { data: analytics } = useAdminAnalytics(period);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Platform Analytics</h1>
            <p className="text-slate-500 text-sm mt-1">Insights across the DynaX ecosystem</p>
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {PERIODS.map((p) => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  period === p.value ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Key metrics */}
        {loadingStats ? (
          <div className="flex justify-center py-8"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Users', value: stats?.total_users || 0, icon: Users, trend: '+12%', color: 'blue' },
              { label: 'Active Professionals', value: stats?.total_professionals || 0, icon: TrendingUp, trend: '+8%', color: 'teal' },
              { label: 'Sessions This Month', value: stats?.sessions_this_month || 0, icon: Activity, trend: '+24%', color: 'purple' },
              { label: 'Total Revenue', value: `₦${((stats?.total_revenue || 0) / 1000).toFixed(0)}k`, icon: CreditCard, trend: '+18%', color: 'green' },
            ].map((m) => {
              const Icon = m.icon;
              const colorMap: Record<string, string> = {
                blue: 'bg-blue-50 text-blue-600',
                teal: 'bg-teal-50 text-teal-600',
                purple: 'bg-purple-50 text-purple-600',
                green: 'bg-green-50 text-green-600',
              };
              return (
                <div key={m.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', colorMap[m.color])}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-display font-bold text-slate-900">{typeof m.value === 'number' ? m.value.toLocaleString() : m.value}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{m.label}</p>
                  <p className="text-xs font-semibold text-green-600 mt-1">{m.trend} vs last period</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Sessions chart */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-display font-semibold text-slate-900 mb-5">Sessions per Day (This Week)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={MOCK_SESSIONS} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="sessions" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Registrations chart */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-display font-semibold text-slate-900 mb-5">New Registrations (6 Months)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={MOCK_REGISTRATIONS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="patients" stroke="#2563eb" strokeWidth={2.5} dot={{ fill: '#2563eb', r: 4 }} name="Patients" />
                <Line type="monotone" dataKey="professionals" stroke="#0d9488" strokeWidth={2.5} dot={{ fill: '#0d9488', r: 4 }} name="Professionals" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3 justify-center">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <div className="w-3 h-3 rounded-full bg-blue-600" /> Patients
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <div className="w-3 h-3 rounded-full bg-teal-600" /> Professionals
              </div>
            </div>
          </div>

          {/* Professional roles breakdown */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-display font-semibold text-slate-900 mb-5">Professional Specialties</h2>
            <div className="space-y-3">
              {MOCK_ROLE_DIST.map((item, i) => {
                const max = Math.max(...MOCK_ROLE_DIST.map((x) => x.value));
                const pct = (item.value / max) * 100;
                const colors = ['bg-blue-500', 'bg-teal-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-indigo-500'];
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <p className="text-sm text-slate-600 w-32 flex-shrink-0 truncate">{item.name}</p>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div className={cn('h-2 rounded-full transition-all', colors[i % colors.length])}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 w-6 text-right">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary stats */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-display font-semibold text-slate-900 mb-5">Platform Health</h2>
            <div className="space-y-4">
              {[
                { label: 'API Uptime', value: '99.9%', status: 'green' },
                { label: 'Avg Session Duration', value: '52 min', status: 'blue' },
                { label: 'Patient Satisfaction', value: '4.8 / 5', status: 'green' },
                { label: 'Pending Approvals', value: stats?.pending_approvals || 0, status: stats?.pending_approvals ? 'amber' : 'green' },
                { label: 'Active Care Plans', value: stats?.active_care_plans || 0, status: 'blue' },
                { label: 'Message Response Rate', value: '94%', status: 'green' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">{item.label}</p>
                  <span className={cn('text-sm font-bold',
                    item.status === 'green' ? 'text-green-600' :
                    item.status === 'amber' ? 'text-amber-600' : 'text-blue-600')}>
                    {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
