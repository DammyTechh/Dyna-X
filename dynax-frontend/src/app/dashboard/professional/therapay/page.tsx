'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTherapayPlans, useCreateTherapayPlan } from '@/hooks/useApi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreditCard, Plus, X, Loader2, TrendingUp, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { TheraPay } from '@/types';

const PLAN_TYPES = [
  { value: 'session', label: 'Per Session', desc: 'Pay for one session at a time', icon: '🔂' },
  { value: 'bundle', label: 'Session Bundle', desc: 'Pre-pay for a block of sessions', icon: '📦' },
  { value: 'subscription', label: 'Subscription', desc: 'Monthly access to all sessions', icon: '♻️' },
  { value: 'installment', label: 'Installment', desc: 'Spread payments over time', icon: '📅' },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  completed: 'bg-slate-50 text-slate-600 border-slate-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-50 text-slate-400 border-slate-100',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
};

const schema = z.object({
  patient_id: z.string().min(1, 'Patient ID is required'),
  plan_type: z.string().min(1, 'Select a plan type'),
  total_amount: z.number().min(1, 'Amount must be greater than 0'),
  sessions_total: z.number().optional(),
  installment_amount: z.number().optional(),
  installment_interval: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function TherapayPage() {
  const { data: plansData, isLoading } = useTherapayPlans({ page: 1, page_size: 20 });
  const { mutateAsync: createPlan, isPending } = useCreateTherapayPlan();
  const [showForm, setShowForm] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { plan_type: '' },
  });

  const planType = watch('plan_type');

  const onSubmit = async (data: FormData) => {
    try {
      await createPlan(data);
      toast.success('TheraPay plan created successfully!');
      setShowForm(false);
      reset();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to create plan');
    }
  };

  const plans = plansData?.data || [];
  const totalActive = plans.filter((p: TheraPay) => p.status === 'active').length;
  const totalRevenue = plans.reduce((sum: number, p: TheraPay) => sum + (p.amount_paid || 0), 0);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">TheraPay</h1>
            <p className="text-slate-500 text-sm mt-1">Flexible therapy payment plans</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Plan
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <p className="text-2xl font-display font-bold text-slate-900">{plans.length}</p>
            <p className="text-sm text-slate-500 mt-0.5">Total Plans</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <p className="text-2xl font-display font-bold text-green-600">{totalActive}</p>
            <p className="text-sm text-slate-500 mt-0.5">Active Plans</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <p className="text-2xl font-display font-bold text-slate-900">
              ₦{totalRevenue.toLocaleString()}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">Collected</p>
          </div>
        </div>

        {/* Plans list */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50">
            <h2 className="font-display font-semibold text-slate-900">Payment Plans</h2>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : plans.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {plans.map((plan: TheraPay) => {
                const progress = plan.total_amount > 0 ? (plan.amount_paid / plan.total_amount) * 100 : 0;
                return (
                  <div key={plan.id} className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize', STATUS_COLORS[plan.status])}>
                            {plan.status}
                          </span>
                          <span className="text-xs text-slate-500 capitalize font-medium">
                            {plan.plan_type} plan
                          </span>
                          {plan.sessions_total && (
                            <span className="text-xs text-slate-500">
                              · {plan.sessions_used || 0}/{plan.sessions_total} sessions used
                            </span>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span>₦{plan.amount_paid.toLocaleString()} paid</span>
                            <span>₦{plan.total_amount.toLocaleString()} total</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                progress >= 100 ? 'bg-green-500' : 'bg-blue-500'
                              )}
                              style={{ width: `${Math.min(100, progress)}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{Math.round(progress)}% collected</p>
                        </div>

                        {plan.next_payment_date && plan.status === 'active' && (
                          <p className="text-xs text-amber-600 font-medium">
                            Next payment: {format(new Date(plan.next_payment_date), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="font-display font-bold text-lg text-slate-900">
                          ₦{(plan.total_amount - plan.amount_paid).toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500">outstanding</p>
                        {plan.status === 'active' && (
                          <button className="mt-2 text-xs text-blue-600 hover:underline font-medium">
                            Record payment
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CreditCard className="w-10 h-10 text-slate-200 mb-3" />
              <p className="font-medium text-slate-600 text-sm">No payment plans yet</p>
              <p className="text-xs text-slate-400 mt-1">Create a plan to manage patient payments flexibly</p>
            </div>
          )}
        </div>

        {/* Create plan modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
              <div className="sticky top-0 bg-white px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-display font-bold text-lg text-slate-900">Create TheraPay Plan</h2>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
                {/* Patient ID */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Patient ID</label>
                  <input
                    {...register('patient_id')}
                    placeholder="Enter patient UUID"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                  />
                  {errors.patient_id && <p className="text-red-500 text-xs mt-1">{errors.patient_id.message}</p>}
                </div>

                {/* Plan type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Plan Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PLAN_TYPES.map((pt) => (
                      <button
                        key={pt.value}
                        type="button"
                        onClick={() => setValue('plan_type', pt.value, { shouldValidate: true })}
                        className={cn(
                          'p-3 rounded-xl border-2 text-left transition-all',
                          planType === pt.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        )}
                      >
                        <span className="text-xl block mb-1">{pt.icon}</span>
                        <span className="text-xs font-semibold text-slate-800 block">{pt.label}</span>
                        <span className="text-xs text-slate-500">{pt.desc}</span>
                      </button>
                    ))}
                  </div>
                  {errors.plan_type && <p className="text-red-500 text-xs mt-1">{errors.plan_type.message}</p>}
                </div>

                {/* Total amount */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Total Amount (₦)</label>
                  <input
                    {...register('total_amount', { valueAsNumber: true })}
                    type="number"
                    min="1"
                    placeholder="e.g. 60000"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                  />
                  {errors.total_amount && <p className="text-red-500 text-xs mt-1">{errors.total_amount.message}</p>}
                </div>

                {/* Bundle / session count */}
                {(planType === 'bundle' || planType === 'session') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Number of Sessions</label>
                    <input
                      {...register('sessions_total', { valueAsNumber: true })}
                      type="number"
                      min="1"
                      placeholder="e.g. 12"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                    />
                  </div>
                )}

                {/* Installment fields */}
                {planType === 'installment' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Installment Amount (₦)</label>
                      <input
                        {...register('installment_amount', { valueAsNumber: true })}
                        type="number"
                        min="1"
                        placeholder="e.g. 20000"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Interval</label>
                      <select
                        {...register('installment_interval')}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                      >
                        <option value="">Select…</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3 rounded-xl dynax-gradient text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Plan
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
