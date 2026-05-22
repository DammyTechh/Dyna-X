import { UserRole } from '@/types';

export function getDashboardRoute(role: UserRole | string): string {
  switch (role) {
    case 'admin':               return '/dashboard/admin';
    case 'patient':             return '/dashboard/patient';
    case 'physiotherapist':     return '/dashboard/professional/physio';
    case 'prosthetist':         return '/dashboard/professional/prosthetist';
    case 'orthotist':           return '/dashboard/professional/orthotist';
    case 'occupational_therapist': return '/dashboard/professional/ot';
    case 'speech_therapist':    return '/dashboard/professional/speech';
    case 'mental_health_clinician': return '/dashboard/professional/mental-health';
    default:                    return '/dashboard/patient';
  }
}

export function isProfessionalRole(role: string): boolean {
  return ['physiotherapist', 'prosthetist', 'orthotist', 'occupational_therapist',
    'speech_therapist', 'mental_health_clinician'].includes(role);
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: 'Administrator',
    patient: 'Patient',
    physiotherapist: 'Physiotherapist',
    prosthetist: 'Prosthetist',
    orthotist: 'Orthotist',
    occupational_therapist: 'Occupational Therapist',
    speech_therapist: 'Speech Therapist',
    mental_health_clinician: 'Mental Health Clinician',
  };
  return labels[role] || role;
}

export function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    patient: 'bg-green-100 text-green-700',
    physiotherapist: 'bg-blue-100 text-blue-700',
    prosthetist: 'bg-teal-100 text-teal-700',
    orthotist: 'bg-cyan-100 text-cyan-700',
    occupational_therapist: 'bg-purple-100 text-purple-700',
    speech_therapist: 'bg-orange-100 text-orange-700',
    mental_health_clinician: 'bg-pink-100 text-pink-700',
  };
  return colors[role] || 'bg-slate-100 text-slate-700';
}
