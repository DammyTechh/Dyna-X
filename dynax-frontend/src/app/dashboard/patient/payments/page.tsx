'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTherapayPlans } from '@/hooks/useApi';
import { CreditCard, Loader2, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn, formatCurrency } from '@/lib/utils';
import type { TheraPay } from '@/types';

const PLAN_ICONS: Record<string, string> = {
  session: '🎯', bundle: '📦', subscription: '🔄', installment: '📅',
};

const PLAN_LABELS: Record<string, string> = {
  session: 'Per Session', bundle: 'Session Bundle', subscription: 'Subscription', installment: 'Installment Plan',
};

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
  active: { color: 'text-green-600 bg-green-50', icon: CheckCircle, label: 'Active' },
  completed: { color: 'text-blue-600 bg-blue-50', icon: CheckCircle, label: 'Completed' },
  overdue: { color: 'text-red-600 bg-red-50', icon: AlertCircle, label: 'Overdue' },
  pending: { color: 'text-amber-600 bg-amber-50', icon: Clock, label: 'Pending' },
  cancelled: { color: 'text-slate-500 bg-slate-100', icon: Clock, label: 'Cancelled' },
};

export default function PatientPaymentsPage() {
  const { data, isLoading } = useTherapayPlans({ page: 1, page_size: 20 });
  const plans = data?.data || [];

  const totalOwed = plans.filter((p) => p.status === 'active' || p.status === 'overdue')
    .reduce((s, p) => s + (p.total_amount - p.amount_paid), 0);
  const totalPaid = plans.reduce((s, p) => s + p.amount_paid, 0);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6 animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">My Payments</h1>
          <p className="text-slate-500 text-sm mt-1">Your TheraPay therapy payment plans</p>
        </div>

        {/* Summary cards */}
        {!isLoading && plans.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center mb-3">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-2xl font-display font-bold text-slate-900">{formatCurrency(totalPaid)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Total paid to date</p>
            </div>
            <div className={cn('rounded-2xl border shadow-sm p-5', totalOwed > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100')}>
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', totalOwed > 0 ? 'bg-amber-100' : 'bg-slate-50')}>
                <CreditCard className={cn('w-4 h-4', totalOwed > 0 ? 'text-amber-600' : 'text-slate-500')} />
              </div>
              <p className={cn('text-2xl font-display font-bold', totalOwed > 0 ? 'text-amber-700' : 'text-slate-900')}>
                {formatCurrency(totalOwed)}
              </p>
              <p className={cn('text-xs mt-0.5', totalOwed > 0 ? 'text-amber-600' : 'text-slate-500')}>
                {totalOwed > 0 ? 'Outstanding balance' : 'No outstanding balance'}
              </p>
            </div>
          </div>
        )}

        {/* Plans */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-16 bg-white rounded-2xl border border-slate-100">
              <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
            </div>
          ) : plans.length > 0 ? (
            plans.map((plan) => {
              const pct = plan.total_amount > 0 ? (plan.amount_paid / plan.total_amount) * 100 : 0;
              const statusCfg = STATUS_CONFIG[plan.status] || STATUS_CONFIG.pending;
              const StatusIcon = statusCfg.icon;
              return (
                <div key={plan.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-2xl">
                        {PLAN_ICONS[plan.plan_type] || '💳'}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{PLAN_LABELS[plan.plan_type] || plan.plan_type}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full', statusCfg.color)}>
                            <StatusIcon className="w-3 h-3" />
                            {statusCfg.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold text-xl text-slate-900">{formatCurrency(plan.amount_paid)}</p>
                      <p className="text-xs text-slate-500">of {formatCurrency(plan.total_amount)}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Payment progress</span>
                      <span className="font-semibold text-slate-700">{Math.round(pct)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-green-500' : plan.status === 'overdue' ? 'bg-red-400' : 'bg-blue-500')}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>Balance: <strong className="text-slate-700">{formatCurrency(plan.total_amount - plan.amount_paid)}</strong></span>
                    {plan.sessions_total && (
                      <span>Sessions: <strong className="text-slate-700">{plan.sessions_used || 0}/{plan.sessions_total}</strong></span>
                    )}
                    {plan.next_payment_date && (
                      <span className={cn('flex items-center gap-1', plan.status === 'overdue' ? 'text-red-600 font-medium' : '')}>
                        <Calendar className="w-3 h-3" />
                        Next: {format(new Date(plan.next_payment_date), 'MMM d, yyyy')}
                      </span>
                    )}
                    {plan.installment_amount && (
                      <span>{formatCurrency(plan.installment_amount)} / {plan.installment_interval}</span>
                    )}
                  </div>

                  {plan.status === 'overdue' && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-xs text-red-700 font-medium">
                        ⚠️ Payment overdue. Please contact your professional to arrange payment.
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
              <CreditCard className="w-10 h-10 text-slate-300 mb-3" />
              <h3 className="font-semibold text-slate-700 mb-1">No payment plans</h3>
              <p className="text-slate-500 text-sm max-w-xs">
                Your professional will set up a TheraPay plan for you when you start sessions.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
