'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  useProfessionalProfile, useGeneratePersonalCode, useMyPatients,
  useProfessionalAppointments, useProfessionalSessions,
} from '@/hooks/useApi';
import {
  Users, Calendar, Activity, Copy, RefreshCw, Mail, Check,
  Loader2, Clock, Video, MapPin, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday } from 'date-fns';
import { getRoleLabel } from '@/lib/routing';
import { cn } from '@/lib/utils';

export default function ProfessionalDashboard() {
  const { data: profile, isLoading } = useProfessionalProfile();
  const { data: patients } = useMyPatients({ page: 1, page_size: 5 });
  const { data: appointments } = useProfessionalAppointments({ page: 1, page_size: 5 });
  const { data: sessions } = useProfessionalSessions({ page: 1, page_size: 5 });
  const { mutateAsync: generateCode, isPending: generating } = useGeneratePersonalCode();

  const [copied, setCopied] = useState(false);
  const [emailTarget, setEmailTarget] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const code = profile?.personal_code;

  const handleGenerateCode = async () => {
    try {
      await generateCode();
      toast.success('New personal code generated!');
    } catch {
      toast.error('Failed to generate code');
    }
  };

  const handleCopyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Code copied to clipboard!');
  };

  const handleEmailCode = async () => {
    if (!emailTarget || !code) return;
    setSendingEmail(true);
    try {
      // POST to backend which sends via Resend
      const { default: api } = await import('@/lib/api');
      await api.post('/professional/send-code-email', { email: emailTarget, code });
      toast.success(`Code emailed to ${emailTarget}`);
      setEmailTarget('');
    } catch {
      toast.error('Failed to send email. Try copying the code manually.');
    } finally {
      setSendingEmail(false);
    }
  };

  const todayAppts = appointments?.data?.filter(
    (a) => isToday(new Date(a.scheduled_at)) && a.status === 'scheduled'
  ) || [];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6 animate-in">
        {/* Welcome banner */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-700 rounded-2xl p-6 text-white">
          {isLoading ? (
            <div className="flex items-center gap-3"><Loader2 className="w-5 h-5 animate-spin" /><span>Loading…</span></div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold">
                  Welcome back, {profile?.full_name?.split(' ')[0] || 'Doctor'} 👋
                </h1>
                <p className="text-slate-300 text-sm mt-1">
                  {getRoleLabel(profile?.professional_type || '')}
                  {profile?.clinic_name && ` · ${profile.clinic_name}`}
                </p>
                {!profile?.is_approved && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-lg px-3 py-1.5 text-xs font-medium">
                    ⏳ Your account is pending admin approval. You&apos;ll be notified via email once approved.
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="text-center bg-white/10 rounded-xl px-4 py-2">
                  <p className="text-2xl font-display font-bold">{patients?.meta?.total || 0}</p>
                  <p className="text-slate-300 text-xs">Patients</p>
                </div>
                <div className="text-center bg-white/10 rounded-xl px-4 py-2">
                  <p className="text-2xl font-display font-bold">{sessions?.meta?.total || 0}</p>
                  <p className="text-slate-300 text-xs">Sessions</p>
                </div>
                <div className="text-center bg-white/10 rounded-xl px-4 py-2">
                  <p className="text-2xl font-display font-bold">{todayAppts.length}</p>
                  <p className="text-slate-300 text-xs">Today</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Personal Code / PIN Panel */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-display font-semibold text-slate-900 mb-1">Your Patient Connection Code</h2>
            <p className="text-slate-500 text-xs mb-5">
              Share this code with patients so they can connect to you. Email it directly or copy it.
            </p>

            {/* Code display */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-700 rounded-xl p-5 mb-4">
              <p className="text-slate-400 text-xs mb-2 uppercase tracking-wider font-medium">Your DX-PIN</p>
              {code ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-2xl font-bold text-white tracking-widest">{code}</span>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ) : (
                <p className="text-slate-400 text-sm">No code generated yet</p>
              )}
            </div>

            {/* Generate new code */}
            <button
              onClick={handleGenerateCode}
              disabled={generating}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 font-medium mb-5 transition-colors disabled:opacity-60"
            >
              <RefreshCw className={cn('w-4 h-4', generating && 'animate-spin')} />
              {generating ? 'Generating…' : 'Generate new code'}
            </button>

            {/* Email code to patient */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Email code to a patient</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailTarget}
                  onChange={(e) => setEmailTarget(e.target.value)}
                  placeholder="patient@email.com"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
                <button
                  onClick={handleEmailCode}
                  disabled={sendingEmail || !emailTarget || !code}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Send
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                The patient will receive an email with your PIN and registration instructions.
              </p>
            </div>
          </div>

          {/* Today's Appointments */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-slate-900">Today&apos;s Appointments</h2>
              <a href="/dashboard/professional/appointments" className="text-xs text-blue-600 hover:underline font-medium">
                View all
              </a>
            </div>
            {todayAppts.length > 0 ? (
              <div className="space-y-3">
                {todayAppts.map((appt) => (
                  <div key={appt.id} className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm text-slate-900">{appt.title}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            {format(new Date(appt.scheduled_at), 'h:mm a')}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            {appt.session_type === 'virtual'
                              ? <Video className="w-3 h-3" />
                              : <MapPin className="w-3 h-3" />
                            }
                            {appt.session_type === 'virtual' ? 'Virtual' : 'In-Person'}
                          </span>
                        </div>
                      </div>
                      {appt.meeting_url && (
                        <a
                          href={appt.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded-lg font-semibold"
                        >
                          Join
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No appointments today</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Patients */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
            <h2 className="font-display font-semibold text-slate-900">Recent Patients</h2>
            <a href="/dashboard/professional/patients" className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className="divide-y divide-slate-50">
            {patients?.data && patients.data.length > 0 ? (
              patients.data.map((patient) => (
                <a
                  key={patient.id}
                  href={`/dashboard/professional/patients/${patient.user_id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold text-sm">
                      {patient.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm">{patient.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {patient.condition || patient.email || 'No condition noted'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </a>
              ))
            ) : (
              <div className="px-6 py-10 text-center">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No patients connected yet.</p>
                <p className="text-slate-400 text-xs">Share your DX-PIN with patients to connect.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
