import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete, apiGetPaginated } from '@/lib/api';
import { authService } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';
import type {
  AuthResponse, ProfessionalProfile, PatientProfile, Appointment,
  TherapySession, ClinicalNote, CarePlan, TheraPay, Conversation, Message,
  Notification, AIConversation, AdminStats, User, PaginationParams,
  PaginatedResponse, DeviceMeasurement,
} from '@/types';

// ─── Keys ─────────────────────────────────────────────────────────────────────
export const qk = {
  me: ['auth', 'me'],
  professionalProfile: ['professional', 'profile'],
  patientProfile: ['patient', 'profile'],
  myPatients: (p?: PaginationParams) => ['professional', 'patients', p],
  patient: (id: string) => ['professional', 'patients', id],
  myProfessionals: ['patient', 'professionals'],
  appointments: (role: string, p?: PaginationParams) => [role, 'appointments', p],
  appointment: (id: string) => ['appointment', id],
  sessions: (role: string, p?: PaginationParams) => [role, 'sessions', p],
  session: (id: string) => ['session', id],
  notes: (patientId: string, p?: PaginationParams) => ['emr', 'notes', patientId, p],
  carePlans: (patientId?: string) => ['emr', 'care-plans', patientId],
  devices: (patientId?: string) => ['emr', 'devices', patientId],
  therapayPlans: (p?: PaginationParams) => ['therapay', 'plans', p],
  therapayBalance: (patientId: string) => ['therapay', 'balance', patientId],
  conversations: ['messages', 'conversations'],
  messages: (convId: string, p?: PaginationParams) => ['messages', convId, p],
  notifications: (p?: PaginationParams) => ['notifications', p],
  notifUnread: ['notifications', 'unread-count'],
  aiHistory: (p?: PaginationParams) => ['ai', 'history', p],
  adminStats: ['admin', 'stats'],
  adminUsers: (p?: PaginationParams) => ['admin', 'users', p],
  adminProfessionals: (status?: string) => ['admin', 'professionals', status],
  adminPatients: (p?: PaginationParams) => ['admin', 'patients', p],
  adminAnalytics: (period: string) => ['admin', 'analytics', period],
  adminAuditLogs: (p?: PaginationParams) => ['admin', 'audit-logs', p],
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const useMe = () =>
  useQuery({ queryKey: qk.me, queryFn: () => authService.me(), retry: false });

export const useLogin = () => {
  const { setUser } = useAuthStore();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.login(email, password),
    onSuccess: (data) => setUser(data.user),
  });
};

export const useRegister = () =>
  useMutation({
    mutationFn: (payload: { email: string; password: string; full_name: string; role: string }) =>
      authService.register(payload),
  });

export const useVerifyEmail = () =>
  useMutation({
    mutationFn: (payload: { email: string; code: string }) =>
      authService.verifyEmail(payload.email, payload.code),
  });

export const useResendVerification = () =>
  useMutation({
    mutationFn: (email: string) => authService.resendVerification(email),
  });

export const useLogout = () => {
  const { clearAuth } = useAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => { clearAuth(); qc.clear(); },
  });
};

// ─── Professional ─────────────────────────────────────────────────────────────
export const useProfessionalProfile = () =>
  useQuery<ProfessionalProfile>({ queryKey: qk.professionalProfile, queryFn: () => apiGet('/professional/profile') });

export const useUpdateProfessionalProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ProfessionalProfile>) => apiPatch('/professional/profile', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.professionalProfile }),
  });
};

export const useGeneratePersonalCode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ personal_code: string }>('/professional/generate-code'),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.professionalProfile }),
  });
};

export const useMyPatients = (params?: PaginationParams) =>
  useQuery<PaginatedResponse<PatientProfile>>({
    queryKey: qk.myPatients(params),
    queryFn: () => apiGetPaginated('/professional/patients', params as Record<string, unknown>),
  });

export const usePatient = (patientId: string) =>
  useQuery<PatientProfile>({
    queryKey: qk.patient(patientId),
    queryFn: () => apiGet(`/professional/patients/${patientId}`),
    enabled: !!patientId,
  });

// ─── Patient ──────────────────────────────────────────────────────────────────
export const usePatientProfile = () =>
  useQuery<PatientProfile>({ queryKey: qk.patientProfile, queryFn: () => apiGet('/patient/profile') });

export const useUpdatePatientProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PatientProfile>) => apiPatch('/patient/profile', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.patientProfile }),
  });
};

export const useConnectToProfessional = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pin: string) => apiPost('/patient/connect', { pin }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myProfessionals }),
  });
};

// Professional issues a one-time DX-PIN to a patient's email.
export const useShareDxPin = () =>
  useMutation({
    mutationFn: (patient_email: string) =>
      apiPost<{ sent: boolean }>('/professional/share-code', { patient_email }),
  });

export const useMyProfessionals = () =>
  useQuery<ProfessionalProfile[]>({ queryKey: qk.myProfessionals, queryFn: () => apiGet('/patient/professionals') });

// ─── Appointments ─────────────────────────────────────────────────────────────
export const useProfessionalAppointments = (params?: PaginationParams) =>
  useQuery<PaginatedResponse<Appointment>>({
    queryKey: qk.appointments('professional', params),
    queryFn: () => apiGetPaginated('/professional/appointments', params as Record<string, unknown>),
  });

export const usePatientAppointments = (params?: PaginationParams) =>
  useQuery<PaginatedResponse<Appointment>>({
    queryKey: qk.appointments('patient', params),
    queryFn: () => apiGetPaginated('/patient/appointments', params as Record<string, unknown>),
  });

export const useCreateAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      patient_id: string; title: string; scheduled_at: string;
      duration_minutes: number; session_type: string; description?: string; meeting_url?: string;
    }) => apiPost<Appointment>('/professional/appointments', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professional', 'appointments'] }),
  });
};

export const useCancelAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/professional/appointments/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professional', 'appointments'] }),
  });
};

// ─── Sessions ─────────────────────────────────────────────────────────────────
export const useProfessionalSessions = (params?: PaginationParams) =>
  useQuery<PaginatedResponse<TherapySession>>({
    queryKey: qk.sessions('professional', params),
    queryFn: () => apiGetPaginated('/professional/sessions', params as Record<string, unknown>),
  });

export const usePatientSessions = (params?: PaginationParams) =>
  useQuery<PaginatedResponse<TherapySession>>({
    queryKey: qk.sessions('patient', params),
    queryFn: () => apiGetPaginated('/patient/sessions', params as Record<string, unknown>),
  });

export const useCreateSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      patient_id: string; session_date: string; duration_minutes: number;
      session_type: string; subjective_note?: string; objective_note?: string;
      assessment_note?: string; plan_note?: string;
    }) => apiPost<TherapySession>('/professional/sessions', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professional', 'sessions'] }),
  });
};

// ─── EMR ──────────────────────────────────────────────────────────────────────
export const useClinicalNotes = (patientId: string, params?: PaginationParams) =>
  useQuery<PaginatedResponse<ClinicalNote>>({
    queryKey: qk.notes(patientId, params),
    queryFn: () => apiGetPaginated('/emr/notes', { patient_id: patientId, ...params } as Record<string, unknown>),
    enabled: !!patientId,
  });

export const useCreateNote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      patient_id: string; note_type: string; title: string;
      content: string; diagnosis_codes?: string[]; is_confidential?: boolean;
    }) => apiPost<ClinicalNote>('/emr/notes', data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['emr', 'notes', vars.patient_id] }),
  });
};

export const useCarePlans = (patientId?: string) =>
  useQuery<CarePlan[]>({
    queryKey: qk.carePlans(patientId),
    queryFn: () => apiGet('/emr/care-plans', patientId ? { patient_id: patientId } : undefined),
  });

export const useCreateCarePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { patient_id: string; title: string; description?: string; goals?: string[]; start_date: string }) =>
      apiPost<CarePlan>('/emr/care-plans', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emr', 'care-plans'] }),
  });
};

export const useDeviceMeasurements = (patientId?: string) =>
  useQuery<DeviceMeasurement[]>({
    queryKey: qk.devices(patientId),
    queryFn: () => apiGet('/emr/devices', patientId ? { patient_id: patientId } : undefined),
  });

export const useCreateDeviceMeasurement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { patient_id: string; device_type: string; body_region: string; measurements: Record<string, unknown>; notes?: string; model_3d_url?: string; stl_file_url?: string }) =>
      apiPost<DeviceMeasurement>('/emr/devices', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emr', 'devices'] }),
  });
};

// ─── TheraPay ─────────────────────────────────────────────────────────────────
export const useTherapayPlans = (params?: PaginationParams) =>
  useQuery<PaginatedResponse<TheraPay>>({
    queryKey: qk.therapayPlans(params),
    queryFn: () => apiGetPaginated('/therapay/plans', params as Record<string, unknown>),
  });

export const useCreateTherapayPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { patient_id: string; plan_type: string; total_amount: number; sessions_total?: number }) =>
      apiPost<TheraPay>('/therapay/plans', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['therapay', 'plans'] }),
  });
};

export const usePatientBalance = (patientId: string) =>
  useQuery({
    queryKey: qk.therapayBalance(patientId),
    queryFn: () => apiGet<{ outstanding: number; credits: number }>(`/therapay/balance/${patientId}`),
    enabled: !!patientId,
  });

// ─── Messaging ────────────────────────────────────────────────────────────────
export const useConversations = () =>
  useQuery<Conversation[]>({ queryKey: qk.conversations, queryFn: () => apiGet('/messages/conversations') });

export const useMessages = (conversationId: string, params?: PaginationParams) =>
  useQuery<PaginatedResponse<Message>>({
    queryKey: qk.messages(conversationId, params),
    queryFn: () => apiGetPaginated(`/messages/conversations/${conversationId}/messages`, params as Record<string, unknown>),
    enabled: !!conversationId,
    refetchInterval: 5000, // poll every 5s
  });

export const useSendMessage = (conversationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      apiPost<Message>(`/messages/conversations/${conversationId}/messages`, { content }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.messages(conversationId) }),
  });
};

// Get-or-create a conversation with another user (by their USER id).
// The backend route param is historically named ":conversation_id" but it is
// actually the *target user* id — passing it returns/creates the 1:1 thread.
export const useStartConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) =>
      apiPost<Conversation>(`/messages/conversations/${targetUserId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.conversations }),
  });
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const useNotifications = (params?: PaginationParams) =>
  useQuery<PaginatedResponse<Notification>>({
    queryKey: qk.notifications(params),
    queryFn: () => apiGetPaginated('/notifications', params as Record<string, unknown>),
    refetchInterval: 30000,
  });

export const useUnreadCount = () =>
  useQuery<{ unread_count: number }>({
    queryKey: qk.notifUnread,
    queryFn: () => apiGet('/notifications/unread-count'),
    refetchInterval: 15000,
  });

export const useMarkAllRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

// ─── AI ───────────────────────────────────────────────────────────────────────
export const useAIQuery = () =>
  useMutation({
    mutationFn: (data: { input: string; conversation_id?: string; context?: string }) =>
      apiPost<AIConversation>('/ai/query', data),
  });

export const useAIHistory = (params?: PaginationParams) =>
  useQuery<PaginatedResponse<AIConversation>>({
    queryKey: qk.aiHistory(params),
    queryFn: () => apiGetPaginated('/ai/history', params as Record<string, unknown>),
  });

export const useGenerateSOAPNote = () =>
  useMutation({
    mutationFn: (context: Record<string, unknown>) =>
      apiPost<{ soap_note: string }>('/ai/generate/soap-note', context),
  });

export const useGenerateCarePlan = () =>
  useMutation({
    mutationFn: (patientId: string) =>
      apiPost<{ suggestion: string }>(`/ai/generate/care-plan/${patientId}`),
  });

// ─── Admin ────────────────────────────────────────────────────────────────────
export const useAdminStats = () =>
  useQuery<AdminStats>({ queryKey: qk.adminStats, queryFn: () => apiGet('/admin/stats') });

export const useAdminUsers = (params?: PaginationParams) =>
  useQuery({ queryKey: qk.adminUsers(params), queryFn: () => apiGetPaginated<User>('/admin/users', params as Record<string, unknown>) });

export const useAdminProfessionals = (status?: string) =>
  useQuery({
    queryKey: qk.adminProfessionals(status),
    queryFn: () => apiGetPaginated('/admin/professionals', status ? { status } : undefined),
  });

export const useApproveProfessional = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_approved, notes }: { id: string; is_approved: boolean; notes?: string }) =>
      apiPost(`/admin/professionals/${id}/approve`, { is_approved, notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'professionals'] }),
  });
};

export const useAdminPatients = (params?: PaginationParams) =>
  useQuery({ queryKey: qk.adminPatients(params), queryFn: () => apiGetPaginated('/admin/patients', params as Record<string, unknown>) });

export const useAdminAnalytics = (period = 'month') =>
  useQuery({ queryKey: qk.adminAnalytics(period), queryFn: () => apiGet<Record<string, unknown>>(`/admin/analytics?period=${period}`) });

export const useAdminAuditLogs = (params?: PaginationParams) =>
  useQuery({ queryKey: qk.adminAuditLogs(params), queryFn: () => apiGetPaginated('/admin/audit-logs', params as Record<string, unknown>) });

// ─── 3D editor: device share + comments ───────────────────────────────────────
export interface DeviceShare {
  id: string; device_id: string; token: string; permission: string; url?: string; created_at: string;
}
export interface DeviceComment {
  id: string; device_id: string; author_id: string; author_name: string; author_role: string; content: string; created_at: string;
}

export const useDeviceComments = (deviceId?: string) =>
  useQuery({
    queryKey: ['device-comments', deviceId],
    queryFn: () => apiGet<DeviceComment[]>(`/emr/devices/${deviceId}/comments`),
    enabled: !!deviceId,
  });

export const useAddDeviceComment = (deviceId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => apiPost<DeviceComment>(`/emr/devices/${deviceId}/comments`, { content }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['device-comments', deviceId] }),
  });
};

export const useCreateDeviceShare = (deviceId?: string) =>
  useMutation({
    mutationFn: (permission: string) => apiPost<DeviceShare>(`/emr/devices/${deviceId}/share`, { permission }),
  });

// Variant that takes the device id at call time — needed when the device was
// just created in the same handler (state hasn't re-rendered the hook yet).
export const useCreateDeviceShareById = () =>
  useMutation({
    mutationFn: ({ deviceId, permission }: { deviceId: string; permission: string }) =>
      apiPost<DeviceShare>(`/emr/devices/${deviceId}/share`, { permission }),
  });

export const useAddDeviceCommentById = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, content }: { deviceId: string; content: string }) =>
      apiPost<DeviceComment>(`/emr/devices/${deviceId}/comments`, { content }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['device-comments', v.deviceId] }),
  });
};

export const useSharedDevice = (token?: string) =>
  useQuery({
    queryKey: ['shared-device', token],
    queryFn: () => apiGet<{ device: Record<string, unknown>; permission: string }>(`/shared/${token}`),
    enabled: !!token,
    retry: false,
  });
