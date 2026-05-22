'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  usePatientProfile, useMyProfessionals, usePatientAppointments,
  usePatientSessions, useConnectToProfessional, useCarePlans,
} from '@/hooks/useApi';
import {
  UserCheck, Calendar, Activity, Heart, Loader2,
  Plus, Link as LinkIcon, Clock, CheckCircle2, MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isPast, isToday } from 'date-fns';
import { getRoleLabel, getRoleColor } from '@/lib/routing';
import { cn } from '@/lib/utils';

export default function PatientDashboard() {
  const { data: profile, isLoading: loadingProfile } = usePatientProfile();
  const { data: professionals } = useMyProfessionals();
  const { data: appointments } = usePatientAppointments({ page: 1, page_size: 5 });
  const { data: sessions } = usePatientSessions({ page: 1, page_size: 5 });
  const { data: carePlans } = useCarePlans();
  const { mutateAsync: connect, isPending: connecting } = useConnectToProfessional();

  const [pinCode, setPinCode] = useState('');
  const [showConnect, setShowConnect] = useState(false);

  const handleConnect = async () => {
    if (!pinCode.trim()) return;
    try {
      await connect(pinCode.trim());
      toast.success('Connected to professional successfully!');
      setPinCode('');
      setShowConnect(false);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Invalid code. Please check and try again.');
    }
  };

  const upcomingAppointments = appointments?.data?.filter(
    (a) => a.status === 'scheduled' && !isPast(new Date(a.scheduled_at))
  ) || [];

  const activePlans = carePlans?.filter((p) => p.status === 'active') || [];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6 animate-in">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-blue-600 to-teal-500 rounded-2xl p-6 text-white">
          {loadingProfile ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading your profile…</span>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold mb-1">
                Hello, {profile?.full_name?.split(' ')[0] || 'there'} 👋
              </h1>
              <p className="text-blue-100 text-sm">
                {profile?.condition ? `Managing: ${profile.condition}` : 'Track your rehabilitation journey'}
              </p>
              {profile?.personal_code && (
                <div className="mt-3 inline-flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-blue-100">Your Patient Code:</span>
                  <span className="text-sm font-mono font-bold">{profile.personal_code}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickStat icon={UserCheck} label="My Professionals" value={professionals?.length || 0} color="blue" />
          <QuickStat icon={Calendar} label="Upcoming" value={upcomingAppointments.length} color="teal" />
          <QuickStat icon={Activity} label="Sessions" value={sessions?.meta?.total || 0} color="purple" />
          <QuickStat icon={Heart} label="Active Plans" value={activePlans.length} color="green" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Connect via PIN */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-semibold text-slate-900">Connect to a Professional</h2>
                <p className="text-slate-500 text-xs mt-0.5">Enter the DX-PIN code from your professional</p>
              </div>
              <button
                onClick={() => setShowConnect(!showConnect)}
                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" />
                Connect
              </button>
            </div>

            {showConnect && (
              <div className="bg-blue-50 rounded-xl p-4 space-y-3 mb-4 border border-blue-100">
                <p className="text-xs text-blue-700 font-medium">
                  Enter the PIN code your professional shared with you or emailed you:
                </p>
                <div className="flex gap-2">
                  <input
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value.toUpperCase())}
                    placeholder="DX-XXXX-XXXX"
                    className="flex-1 px-3 py-2 rounded-lg border border-blue-200 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button
                    onClick={handleConnect}
                    disabled={connecting || !pinCode.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
                  >
                    {connecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Connect
                  </button>
                </div>
              </div>
            )}

            {/* Professionals list */}
            {professionals && professionals.length > 0 ? (
              <div className="space-y-3">
                {professionals.map((prof) => (
                  <div key={prof.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="font-semibold text-blue-600 text-sm">
                        {prof.full_name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 text-sm truncate">{prof.full_name}</p>
                      <p className="text-xs text-slate-500 capitalize">{getRoleLabel(prof.professional_type)}</p>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', prof.is_approved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                      {prof.is_approved ? 'Active' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <LinkIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No professionals connected yet.</p>
                <p className="text-slate-400 text-xs">Use your professional&apos;s DX-PIN to connect.</p>
              </div>
            )}
          </div>

          {/* Upcoming Appointments */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-slate-900">Upcoming Appointments</h2>
              <a href="/dashboard/patient/appointments" className="text-xs text-blue-600 hover:underline font-medium">View all</a>
            </div>
            {upcomingAppointments.length > 0 ? (
              <div className="space-y-3">
                {upcomingAppointments.map((appt) => {
                  const date = new Date(appt.scheduled_at);
                  const todayAppt = isToday(date);
                  return (
                    <div key={appt.id} className={cn(
                      'p-3 rounded-xl border',
                      todayAppt ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'
                    )}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm text-slate-900">{appt.title}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Clock className="w-3 h-3" />
                              {format(date, 'MMM d, h:mm a')}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="w-3 h-3" />
                              {appt.session_type === 'virtual' ? 'Virtual' : 'In-Person'}
                            </span>
                          </div>
                        </div>
                        {todayAppt && appt.meeting_url && (
                          <a
                            href={appt.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded-lg font-semibold shrink-0"
                          >
                            Join →
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No upcoming appointments.</p>
              </div>
            )}
          </div>
        </div>

        {/* Active Care Plans */}
        {activePlans.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-slate-900">Active Care Plans</h2>
              <a href="/dashboard/patient/care-plans" className="text-xs text-blue-600 hover:underline font-medium">View all</a>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {activePlans.map((plan) => (
                <div key={plan.id} className="p-4 bg-gradient-to-br from-green-50 to-teal-50 rounded-xl border border-green-100">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium text-slate-900 text-sm">{plan.title}</h3>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium shrink-0">Active</span>
                  </div>
                  {plan.description && <p className="text-xs text-slate-600 mb-2 line-clamp-2">{plan.description}</p>}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="w-3 h-3" />
                    <span>Started {format(new Date(plan.start_date), 'MMM d, yyyy')}</span>
                  </div>
                  {plan.goals && plan.goals.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {plan.goals.slice(0, 2).map((goal, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                          <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                          {goal}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function QuickStat({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    teal: 'bg-teal-50 text-teal-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
  };
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-2', colorMap[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xl font-display font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
