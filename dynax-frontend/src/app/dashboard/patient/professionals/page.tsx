'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useMyProfessionals, useConnectToProfessional } from '@/hooks/useApi';
import { UserCheck, Loader2, Plus, Link2, Star, Video, MapPin, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { getRoleLabel } from '@/lib/routing';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function PatientProfessionalsPage() {
  const { data: professionals, isLoading, refetch } = useMyProfessionals();
  const { mutateAsync: connect, isPending: connecting } = useConnectToProfessional();
  const [pinCode, setPinCode] = useState('');
  const [showConnect, setShowConnect] = useState(false);

  const handleConnect = async () => {
    if (!pinCode.trim()) return;
    try {
      await connect(pinCode.trim());
      toast.success('Connected to professional!');
      setPinCode('');
      setShowConnect(false);
      refetch();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Invalid code. Please check and try again.');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6 animate-in">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">My Care Team</h1>
            <p className="text-slate-500 text-sm mt-1">Professionals connected to your account</p>
          </div>
          <button
            onClick={() => setShowConnect(!showConnect)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl dynax-gradient text-white text-sm font-semibold shadow-lg shadow-blue-200 hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Connect Professional
          </button>
        </div>

        {/* Connect via PIN */}
        {showConnect && (
          <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5 animate-slide-up">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Link2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Connect via DX-PIN</h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Ask your professional for their DX-PIN code, or check the email they sent you.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                placeholder="DX-XXXX-XXXX"
                className="flex-1 px-4 py-2.5 rounded-xl border border-blue-200 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 uppercase"
              />
              <button
                onClick={handleConnect}
                disabled={connecting || !pinCode.trim()}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
              >
                {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                Connect
              </button>
              <button onClick={() => setShowConnect(false)}
                className="px-4 py-2.5 border border-blue-200 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100">
                Cancel
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              The format is DX-XXXX-XXXX. This connects you to a verified professional on the DynaX platform.
            </p>
          </div>
        )}

        {/* Professionals grid */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          </div>
        ) : professionals && professionals.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {professionals.map((prof) => (
              <div key={prof.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-md">
                    <span className="text-white font-display font-bold text-xl">
                      {prof.full_name?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-semibold text-slate-900 truncate">{prof.full_name}</h3>
                    <p className="text-sm text-blue-600 font-medium">
                      {getRoleLabel(prof.professional_type)}
                    </p>
                    {prof.clinic_name && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{prof.clinic_name}</p>
                    )}
                  </div>
                  <span className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase flex-shrink-0',
                    prof.is_approved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  )}>
                    {prof.is_approved ? 'Active' : 'Pending'}
                  </span>
                </div>

                {prof.bio && (
                  <p className="text-xs text-slate-600 leading-relaxed mb-3 line-clamp-2">{prof.bio}</p>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
                  {prof.virtual_sessions_enabled && (
                    <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-medium">
                      <Video className="w-3 h-3" /> Virtual
                    </span>
                  )}
                  {prof.in_person_sessions_enabled && (
                    <span className="flex items-center gap-1 text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded-lg font-medium">
                      <MapPin className="w-3 h-3" /> In-Person
                    </span>
                  )}
                  {prof.session_rate && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-medium">
                      ₦{prof.session_rate.toLocaleString()}/session
                    </span>
                  )}
                </div>

                {prof.specializations && prof.specializations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {prof.specializations.slice(0, 3).map((s) => (
                      <span key={s} className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <Link
                  href="/dashboard/messages"
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Message
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <UserCheck className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-display font-semibold text-lg text-slate-700 mb-2">No professionals connected</h3>
            <p className="text-slate-500 text-sm max-w-xs mb-4">
              Connect with your physiotherapist, prosthetist, or other professional using their DX-PIN code.
            </p>
            <button
              onClick={() => setShowConnect(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl dynax-gradient text-white text-sm font-semibold shadow-lg shadow-blue-200 hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Connect First Professional
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
