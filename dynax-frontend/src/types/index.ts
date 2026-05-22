// ─── Auth ──────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'admin'
  | 'prosthetist'
  | 'orthotist'
  | 'physiotherapist'
  | 'occupational_therapist'
  | 'speech_therapist'
  | 'mental_health_clinician'
  | 'patient';

export type ProfessionalRole = Exclude<UserRole, 'admin' | 'patient'>;

export interface User {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
  profile: Profile;
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone_number?: string;
  avatar_url?: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  city?: string;
  country?: string;
  personal_code?: string;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalProfile {
  id: string;
  user_id: string;
  full_name: string;
  email?: string;
  phone_number?: string;
  professional_type: string;
  license_number?: string;
  credentials?: string;
  specializations?: string[];
  experience_years?: number;
  bio?: string;
  clinic_name?: string;
  clinic_code?: string;
  personal_code?: string;
  session_rate?: number;
  virtual_sessions_enabled: boolean;
  in_person_sessions_enabled: boolean;
  approval_status: 'pending' | 'approved' | 'rejected' | 'suspended';
  is_approved: boolean;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface PatientProfile {
  id: string;
  user_id: string;
  full_name: string;
  email?: string;
  phone_number?: string;
  date_of_birth?: string;
  gender?: string;
  condition?: string;
  diagnosis_notes?: string;
  assigned_professional_id?: string;
  personal_code?: string;
  emergency_contact?: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

// ─── Connection ────────────────────────────────────────────────────────────────

export interface ProfessionalConnection {
  id: string;
  patient_id: string;
  professional_id: string;
  status: 'active' | 'paused' | 'ended';
  connected_at: string;
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export interface Appointment {
  id: string;
  patient_id: string;
  professional_id: string;
  title: string;
  description?: string;
  scheduled_at: string;
  duration_minutes: number;
  session_type: 'virtual' | 'in_person';
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  meeting_url?: string;
  notes?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export interface TherapySession {
  id: string;
  patient_id: string;
  professional_id: string;
  appointment_id?: string;
  session_date: string;
  duration_minutes: number;
  session_type: 'virtual' | 'in_person';
  status: string;
  subjective_note?: string;
  objective_note?: string;
  assessment_note?: string;
  plan_note?: string;
  goals_achieved?: boolean;
  patient_rating?: number;
  created_at: string;
  updated_at: string;
}

// ─── EMR ──────────────────────────────────────────────────────────────────────

export interface ClinicalNote {
  id: string;
  patient_id: string;
  professional_id: string;
  session_id?: string;
  note_type: 'soap' | 'progress' | 'assessment' | 'referral' | 'discharge';
  title: string;
  content: string;
  diagnosis_codes?: string[];
  is_confidential: boolean;
  created_at: string;
  updated_at: string;
}

export interface CarePlan {
  id: string;
  patient_id: string;
  professional_id: string;
  title: string;
  description?: string;
  goals?: string[];
  start_date: string;
  end_date?: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  progress_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceMeasurement {
  id: string;
  patient_id: string;
  professional_id: string;
  device_type: string;
  body_region: string;
  measurements: Record<string, unknown>;
  notes?: string;
  status: 'draft' | 'submitted' | 'approved' | 'fabricating' | 'delivered' | 'revision_needed';
  stl_file_url?: string;
  created_at: string;
  updated_at: string;
}

// ─── TheraPay ─────────────────────────────────────────────────────────────────

export interface TheraPay {
  id: string;
  patient_id: string;
  professional_id: string;
  plan_type: 'session' | 'bundle' | 'subscription' | 'installment';
  total_amount: number;
  amount_paid: number;
  sessions_total?: number;
  sessions_used?: number;
  status: 'active' | 'completed' | 'overdue' | 'cancelled' | 'pending';
  next_payment_date?: string;
  installment_amount?: number;
  installment_interval?: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

// ─── Messaging ────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  patient_id?: string;
  professional_id?: string;
  admin_id?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: 'patient' | 'professional' | 'admin';
  content: string;
  file_url?: string;
  file_name?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

// ─── AI ───────────────────────────────────────────────────────────────────────

export interface AIConversation {
  id: string;
  user_id: string;
  user_role: string;
  conversation_id?: string;
  input: string;
  response: string;
  created_at: string;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  total_users: number;
  total_patients: number;
  total_professionals: number;
  pending_approvals: number;
  total_sessions: number;
  active_care_plans: number;
  total_revenue: number;
  sessions_this_month: number;
}

// ─── 3D Share ─────────────────────────────────────────────────────────────────

export type CollaborationPermission = 'view' | 'comment' | 'annotate';

export interface ShareLink {
  id: string;
  case_id: string;
  token: string;
  permission: CollaborationPermission;
  created_by: string;
  expires_at?: string;
  comments?: ShareComment[];
  created_at: string;
}

export interface ShareComment {
  id: string;
  share_link_id: string;
  author_id: string;
  author_name: string;
  content: string;
  annotation_data?: Record<string, unknown>;
  created_at: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface APIResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
  search?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}
