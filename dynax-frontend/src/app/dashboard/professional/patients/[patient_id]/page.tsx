'use client';

import { use } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePatient, useClinicalNotes, useCarePlans, usePatientSessions, usePatientBalance } from '@/hooks/useApi';
import { Loader2, User, Phone, Mail, Calendar, Heart, Activity, ClipboardList, CreditCard, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function PatientDetailPage({ params }: { params: Promise<{ patient_id: string }> }) {
  const { patient_id } = use(params);
  const { data: patient, isLoading } = usePatient(patient_id);
  const { data: notesData } = useClinicalNotes(patient_id, { page: 1, page_size: 5 });
  const { data: carePlans } = useCarePlans(patient_id);
  const { data: sessionsData } = usePatientSessions({ page: 1, page_size: 5 });
  const { data: balance } = usePatientBalance(patient_id);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (!patient) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">
          <p className="text-slate-500">Patient not found or you don&apos;t have access.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6 animate-in">
        {/* Patient header */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-display font-bold text-2xl">
                {patient.full_name?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold text-slate-900">{patient.full_name}</h1>
              {patient.condition && (
                <span className="inline-block mt-1 text-sm bg-blue-100 text-blue-700 px-3 py-0.5 rounded-full font-medium">
                  {patient.condition}
                </span>
              )}
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-500">
                {patient.email && (
                  <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" />{patient.email}</span>
                )}
                {patient.phone_number && (
                  <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" />{patient.phone_number}</span>
                )}
                {patient.date_of_birth && (
                  <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />
                    {format(new Date(patient.date_of_birth), 'MMM d, yyyy')}
                  </span>
                )}
                {patient.gender && <span className="capitalize">{patient.gender}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/dashboard/messages`}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
                <MessageSquare className="w-4 h-4" /> Message
              </Link>
              <Link href={`/dashboard/professional/sessions?patient=${patient_id}`}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                <Activity className="w-4 h-4" /> Log Session
              </Link>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Balance card */}
          {balance && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-slate-700">TheraPay</span>
              </div>
              <p className="text-2xl font-display font-bold text-slate-900">
                ₦{(balance.outstanding || 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Outstanding balance</p>
              {balance.credits > 0 && (
                <p className="text-xs text-green-600 font-medium mt-1">{balance.credits} session credits</p>
              )}
            </div>
          )}

          {/* Sessions count */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-700">Sessions</span>
            </div>
            <p className="text-2xl font-display font-bold text-slate-900">{sessionsData?.meta?.total || 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total sessions logged</p>
          </div>

          {/* Active care plans */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-red-500" />
              <span className="text-sm font-semibold text-slate-700">Care Plans</span>
            </div>
            <p className="text-2xl font-display font-bold text-slate-900">
              {carePlans?.filter((p) => p.status === 'active').length || 0}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Active plans</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Notes */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-slate-500" /> Clinical Notes
              </h2>
              <Link href={`/dashboard/professional/notes?patient=${patient_id}`}
                className="text-xs text-blue-600 hover:underline font-medium">View all</Link>
            </div>
            <div className="divide-y divide-slate-50">
              {notesData?.data && notesData.data.length > 0 ? (
                notesData.data.map((note) => (
                  <div key={note.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm text-slate-900 truncate">{note.title}</p>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 uppercase',
                        note.note_type === 'soap' ? 'bg-blue-100 text-blue-700' :
                        note.note_type === 'progress' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600')}>
                        {note.note_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{note.content}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{format(new Date(note.created_at), 'MMM d, yyyy')}</p>
                  </div>
                ))
              ) : (
                <div className="px-5 py-8 text-center">
                  <p className="text-slate-400 text-sm">No clinical notes yet</p>
                  <Link href={`/dashboard/professional/notes?patient=${patient_id}`}
                    className="text-xs text-blue-600 hover:underline font-medium mt-1 inline-block">Create first note</Link>
                </div>
              )}
            </div>
          </div>

          {/* Care Plans */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Heart className="w-4 h-4 text-slate-500" /> Care Plans
              </h2>
              <Link href={`/dashboard/professional/care-plans?patient=${patient_id}`}
                className="text-xs text-blue-600 hover:underline font-medium">Manage</Link>
            </div>
            <div className="divide-y divide-slate-50">
              {carePlans && carePlans.length > 0 ? (
                carePlans.slice(0, 4).map((plan) => (
                  <div key={plan.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm text-slate-900 truncate">{plan.title}</p>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0',
                        plan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600')}>
                        {plan.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {format(new Date(plan.start_date), 'MMM d, yyyy')}
                      {plan.end_date && ` → ${format(new Date(plan.end_date), 'MMM d, yyyy')}`}
                    </p>
                  </div>
                ))
              ) : (
                <div className="px-5 py-8 text-center">
                  <p className="text-slate-400 text-sm">No care plans yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Emergency contact */}
        {patient.emergency_contact && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">Emergency Contact</p>
            <p className="text-sm text-amber-700">{patient.emergency_contact}</p>
          </div>
        )}

        {/* Diagnosis notes */}
        {patient.diagnosis_notes && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-2">Diagnosis Notes</h2>
            <p className="text-sm text-slate-700 leading-relaxed">{patient.diagnosis_notes}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
