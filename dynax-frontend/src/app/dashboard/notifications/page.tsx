'use client';

import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useNotifications, useMarkAllRead } from '@/hooks/useApi';
import { apiPost } from '@/lib/api';
import { Bell, BellOff, Loader2, Check, Calendar, CreditCard, MessageSquare, UserCheck, Activity, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types';

const NOTIF_ICONS: Record<string, React.ElementType> = {
  appointment_reminder: Calendar,
  appointment_cancelled: Calendar,
  session_logged: Activity,
  payment_due: CreditCard,
  payment_received: CreditCard,
  professional_approved: UserCheck,
  patient_connected: UserCheck,
  message_received: MessageSquare,
  general: Bell,
};

const NOTIF_COLORS: Record<string, string> = {
  appointment_reminder: 'bg-blue-50 text-blue-600',
  appointment_cancelled: 'bg-red-50 text-red-600',
  session_logged: 'bg-purple-50 text-purple-600',
  payment_due: 'bg-orange-50 text-orange-600',
  payment_received: 'bg-green-50 text-green-600',
  professional_approved: 'bg-teal-50 text-teal-600',
  patient_connected: 'bg-indigo-50 text-indigo-600',
  message_received: 'bg-sky-50 text-sky-600',
  general: 'bg-slate-50 text-slate-600',
};

// Where a notification should take you. Returns null for types with no
// meaningful destination — those rows stay non-interactive.
const getNotificationAction = (notif: Notification): string | null => {
  const data = notif.data || {};
  switch (notif.type) {
    case 'message_received':
      return data.conversation_id
        ? `/dashboard/messages?conversation=${String(data.conversation_id)}`
        : '/dashboard/messages';
    case 'appointment_reminder':
    case 'appointment_cancelled':
      return data.role === 'patient'
        ? '/dashboard/patient/appointments'
        : '/dashboard/professional/appointments';
    case 'payment_due':
      return '/dashboard/patient/payments';
    case 'payment_received':
      return '/dashboard/professional/therapay';
    case 'professional_approved':
      return '/dashboard/professional';
    case 'patient_connected':
      return '/dashboard/professional/patients';
    case 'session_logged':
      return data.role === 'patient'
        ? '/dashboard/patient/sessions'
        : '/dashboard/professional/sessions';
    default:
      return null;
  }
};

const ACTION_LABELS: Record<string, string> = {
  message_received: 'View message',
  appointment_reminder: 'View appointment',
  appointment_cancelled: 'View appointment',
  payment_due: 'View payment',
  payment_received: 'View payment',
  patient_connected: 'View patient',
  session_logged: 'View session',
  professional_approved: 'Go to dashboard',
};

export default function NotificationsPage() {
  const { data, isLoading, refetch } = useNotifications({ page: 1, page_size: 50 });
  const { mutateAsync: markAll, isPending: marking } = useMarkAllRead();
  const qc = useQueryClient();
  const router = useRouter();

  const notifications = data?.data || [];
  const unread = notifications.filter((n: Notification) => !n.is_read);

  const handleMarkOne = async (id: string) => {
    try {
      await apiPost(`/notifications/${id}/read`);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    } catch { /* silent */ }
  };

  const handleMarkAll = async () => {
    try {
      await markAll();
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6 animate-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Notifications</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {unread.length > 0 ? `${unread.length} unread` : 'All caught up'}
            </p>
          </div>
          {unread.length > 0 && (
            <button
              onClick={handleMarkAll}
              disabled={marking}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors disabled:opacity-60"
            >
              {marking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications list */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : notifications.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {notifications.map((notif: Notification) => {
                const Icon = NOTIF_ICONS[notif.type] || Bell;
                const colorClass = NOTIF_COLORS[notif.type] || 'bg-slate-50 text-slate-600';
                const actionUrl = getNotificationAction(notif);
                const actionLabel = ACTION_LABELS[notif.type];

                const openAction = () => {
                  if (!actionUrl) return;
                  if (!notif.is_read) handleMarkOne(notif.id);
                  router.push(actionUrl);
                };

                return (
                  <div
                    key={notif.id}
                    onClick={actionUrl ? openAction : undefined}
                    onKeyDown={
                      actionUrl
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openAction();
                            }
                          }
                        : undefined
                    }
                    role={actionUrl ? 'button' : undefined}
                    tabIndex={actionUrl ? 0 : undefined}
                    className={cn(
                      'flex items-start gap-4 px-6 py-4 transition-colors',
                      !notif.is_read ? 'bg-blue-50/40' : 'hover:bg-slate-50',
                      actionUrl && 'cursor-pointer hover:bg-slate-50'
                    )}
                  >
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', colorClass)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-sm', notif.is_read ? 'font-medium text-slate-700' : 'font-semibold text-slate-900')}>
                          {notif.title}
                        </p>
                        <span className="text-xs text-slate-400 flex-shrink-0 mt-0.5">
                          {format(new Date(notif.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.body}</p>
                    </div>
                    {/* Unread dot sits to the left of the action button. */}
                    <div className="flex items-center gap-3 flex-shrink-0 mt-1.5">
                      {!notif.is_read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // marking read must not navigate
                            handleMarkOne(notif.id);
                          }}
                          className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 hover:bg-blue-600 transition-colors"
                          title="Mark as read"
                        />
                      )}
                      {actionUrl && actionLabel && (
                        <span className="flex items-center gap-1 text-xs font-medium text-teal-600 whitespace-nowrap">
                          {actionLabel}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <BellOff className="w-12 h-12 text-slate-200 mb-4" />
              <h3 className="font-display font-semibold text-lg text-slate-700 mb-1">No notifications</h3>
              <p className="text-slate-400 text-sm max-w-xs">
                You&apos;re all caught up! New notifications will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
