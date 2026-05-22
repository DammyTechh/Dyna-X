'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/store/auth';
import { tokenStore } from '@/lib/api';
import { apiPost, apiPatch } from '@/lib/api';
import { isProfessionalRole, getRoleLabel, getRoleColor } from '@/lib/routing';
import {
  User, Lock, Bell, Shield, ChevronRight,
  Loader2, Check, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Section = 'profile' | 'security' | 'notifications' | 'privacy';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const role = tokenStore.getRole() || 'patient';
  const [section, setSection] = useState<Section>('profile');

  const SECTIONS = [
    { id: 'profile' as Section, label: 'Profile', icon: User },
    { id: 'security' as Section, label: 'Security', icon: Lock },
    { id: 'notifications' as Section, label: 'Notifications', icon: Bell },
    { id: 'privacy' as Section, label: 'Privacy', icon: Shield },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto animate-in">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your account preferences</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar nav */}
          <div className="md:w-56 flex-shrink-0">
            <nav className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSection(s.id)}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium transition-colors border-b border-slate-50 last:border-0',
                      section === s.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      {s.label}
                    </div>
                    <ChevronRight className={cn('w-4 h-4', section === s.id ? 'text-blue-400' : 'text-slate-300')} />
                  </button>
                );
              })}
            </nav>

            {/* Account info */}
            <div className="mt-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full dynax-gradient flex items-center justify-center">
                  <span className="text-white font-bold">
                    {user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {user?.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                </div>
              </div>
              <span className={cn('inline-block text-xs font-semibold px-2.5 py-1 rounded-full', getRoleColor(role))}>
                {getRoleLabel(role)}
              </span>
            </div>
          </div>

          {/* Content panel */}
          <div className="flex-1 min-w-0">
            {section === 'profile' && <ProfileSection role={role} />}
            {section === 'security' && <SecuritySection />}
            {section === 'notifications' && <NotificationsSection />}
            {section === 'privacy' && <PrivacySection />}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ─── Profile Section ─────────────────────────────────────────────────────────

function ProfileSection({ role }: { role: string }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: '', phone_number: '', bio: '',
    clinic_name: '', date_of_birth: '', address: '',
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const endpoint = isProfessionalRole(role) ? '/professional/profile' : '/patient/profile';
      await apiPatch(endpoint, form);
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
      <h2 className="font-display font-semibold text-lg text-slate-900">Profile Information</h2>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Full Name" value={form.full_name} onChange={(v) => set('full_name', v)} placeholder="Your full name" />
        <Field label="Phone Number" value={form.phone_number} onChange={(v) => set('phone_number', v)} placeholder="+234 800 000 0000" />
        {!isProfessionalRole(role) && (
          <Field label="Date of Birth" value={form.date_of_birth} onChange={(v) => set('date_of_birth', v)} type="date" />
        )}
        {isProfessionalRole(role) && (
          <Field label="Clinic Name" value={form.clinic_name} onChange={(v) => set('clinic_name', v)} placeholder="Your clinic or practice" />
        )}
        <div className="sm:col-span-2">
          <Field label="Address" value={form.address} onChange={(v) => set('address', v)} placeholder="Your address" />
        </div>
        {isProfessionalRole(role) && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Bio / About</label>
            <textarea
              value={form.bio}
              onChange={(e) => set('bio', e.target.value)}
              placeholder="Brief professional bio shown to patients…"
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
            />
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl dynax-gradient text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60 transition-opacity shadow-lg shadow-blue-200"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}

// ─── Security Section ─────────────────────────────────────────────────────────

function SecuritySection() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleChange = async () => {
    if (form.new_password !== form.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    if (form.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      await apiPost('/auth/change-password', {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      toast.success('Password changed successfully');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch {
      toast.error('Current password is incorrect');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
      <h2 className="font-display font-semibold text-lg text-slate-900">Security</h2>

      <div className="space-y-4">
        <h3 className="font-medium text-slate-700 text-sm">Change Password</h3>

        {(['current', 'new', 'confirm'] as const).map((k) => {
          const labels: Record<typeof k, string> = {
            current: 'Current Password',
            new: 'New Password',
            confirm: 'Confirm New Password',
          };
          const keys: Record<typeof k, keyof typeof form> = {
            current: 'current_password',
            new: 'new_password',
            confirm: 'confirm_password',
          };
          return (
            <div key={k}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{labels[k]}</label>
              <div className="relative">
                <input
                  type={showPwd[k] ? 'text' : 'password'}
                  value={form[keys[k]]}
                  onChange={(e) => set(keys[k], e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => ({ ...p, [k]: !p[k] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPwd[k] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}

        <button
          onClick={handleChange}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          {saving ? 'Updating…' : 'Update Password'}
        </button>
      </div>

      {/* Active sessions info */}
      <div className="border-t border-slate-100 pt-5">
        <h3 className="font-medium text-slate-700 text-sm mb-3">Account Security</h3>
        <div className="space-y-3">
          {[
            { label: 'Two-factor authentication', status: 'Coming soon', badge: 'slate' },
            { label: 'Login notifications', status: 'Active', badge: 'green' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-sm text-slate-700">{item.label}</span>
              <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full',
                item.badge === 'green' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500')}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Notifications Section ────────────────────────────────────────────────────

function NotificationsSection() {
  const [prefs, setPrefs] = useState({
    email_enabled: true,
    push_enabled: true,
    sms_enabled: false,
    appointment_reminders: true,
    session_alerts: true,
    payment_alerts: true,
    message_alerts: true,
  });
  const [saving, setSaving] = useState(false);

  const toggle = (k: keyof typeof prefs) =>
    setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPatch('/notifications/preferences', prefs);
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const groups = [
    {
      title: 'Channels',
      items: [
        { key: 'email_enabled' as const, label: 'Email notifications', desc: 'Receive notifications via email' },
        { key: 'push_enabled' as const, label: 'Push notifications', desc: 'Browser and mobile push alerts' },
        { key: 'sms_enabled' as const, label: 'SMS notifications', desc: 'Text message alerts (premium)' },
      ],
    },
    {
      title: 'Alert types',
      items: [
        { key: 'appointment_reminders' as const, label: 'Appointment reminders', desc: '24h and 1h before sessions' },
        { key: 'session_alerts' as const, label: 'Session updates', desc: 'When sessions are logged or modified' },
        { key: 'payment_alerts' as const, label: 'Payment alerts', desc: 'TheraPay dues and confirmations' },
        { key: 'message_alerts' as const, label: 'Message alerts', desc: 'New messages in conversations' },
      ],
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
      <h2 className="font-display font-semibold text-lg text-slate-900">Notification Preferences</h2>

      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{group.title}</h3>
          <div className="space-y-2">
            {group.items.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
                <button
                  onClick={() => toggle(key)}
                  className={cn(
                    'relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0',
                    prefs[key] ? 'bg-blue-600' : 'bg-slate-200'
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
                    prefs[key] ? 'translate-x-5' : 'translate-x-0'
                  )} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl dynax-gradient text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60 shadow-lg shadow-blue-200"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {saving ? 'Saving…' : 'Save Preferences'}
      </button>
    </div>
  );
}

// ─── Privacy Section ──────────────────────────────────────────────────────────

function PrivacySection() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
      <h2 className="font-display font-semibold text-lg text-slate-900">Privacy & Data</h2>

      <div className="space-y-3">
        {[
          { title: 'Data Processing', desc: 'Your health data is encrypted at rest and in transit. Only connected professionals can access your clinical records.' },
          { title: 'Profile Visibility', desc: 'Your profile is only visible to professionals you are connected with. Patients cannot be searched publicly.' },
          { title: 'AI Conversations', desc: 'AI queries are stored to improve your experience. You can delete your AI conversation history at any time from the AI Assistant page.' },
          { title: '3D Model Shares', desc: 'Shared 3D model links expire based on settings you configure. All annotations and comments are sent back to the sharer.' },
        ].map((item) => (
          <div key={item.title} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="font-medium text-sm text-slate-800 mb-1">{item.title}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h3 className="font-medium text-slate-700 text-sm mb-3">Data Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
            Download My Data
          </button>
          <button className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors">
            Delete Account
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-3">Account deletion is permanent and irreversible. Your data will be removed within 30 days.</p>
      </div>
    </div>
  );
}

// ─── Shared field component ───────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
      />
    </div>
  );
}
