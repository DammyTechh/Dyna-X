'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCarePlans } from '@/hooks/useApi';
import { Heart, Loader2, Target, Calendar, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700 border-green-200' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  paused: { label: 'Paused', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export default function PatientCarePlansPage() {
  const { data: plans, isLoading } = useCarePlans();

  const activePlans = (plans || []).filter((p) => p.status === 'active');
  const otherPlans = (plans || []).filter((p) => p.status !== 'active');

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6 animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">My Care Plans</h1>
          <p className="text-slate-500 text-sm mt-1">Rehabilitation plans created by your care team</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          </div>
        ) : (plans || []).length > 0 ? (
          <div className="space-y-6">
            {/* Active plans */}
            {activePlans.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Active Plans</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {activePlans.map((plan) => (
                    <CarePlanCard key={plan.id} plan={plan} />
                  ))}
                </div>
              </div>
            )}

            {/* Past plans */}
            {otherPlans.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Past Plans</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {otherPlans.map((plan) => (
                    <CarePlanCard key={plan.id} plan={plan} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Heart className="w-10 h-10 text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-700 mb-1">No care plans yet</h3>
            <p className="text-slate-500 text-sm max-w-xs">
              Your professional will create a personalised care plan for your rehabilitation journey.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function CarePlanCard({ plan }: { plan: ReturnType<typeof useCarePlans>['data'] extends (infer T)[] | undefined ? T : never }) {
  if (!plan) return null;
  const statusCfg = STATUS_CONFIG[plan.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.active;

  return (
    <div className={cn('bg-white rounded-2xl border-2 shadow-sm p-5', statusCfg.color)}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-display font-semibold text-slate-900 leading-tight">{plan.title}</h3>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 border', statusCfg.color)}>
          {statusCfg.label}
        </span>
      </div>

      {plan.description && (
        <p className="text-xs text-slate-600 leading-relaxed mb-3 line-clamp-2">{plan.description}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Started {format(new Date(plan.start_date), 'MMM d, yyyy')}
        </span>
        {plan.end_date && (
          <span className="text-slate-400">→ {format(new Date(plan.end_date), 'MMM d')}</span>
        )}
      </div>

      {plan.goals && plan.goals.length > 0 && (
        <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-2">
            <Target className="w-3.5 h-3.5" /> Your Goals
          </p>
          {plan.goals.slice(0, 4).map((goal, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
              <CheckCircle2 className={cn(
                'w-3.5 h-3.5 flex-shrink-0 mt-0.5',
                plan.status === 'completed' ? 'text-green-500' : 'text-slate-300'
              )} />
              <span className="leading-relaxed">{goal}</span>
            </div>
          ))}
          {plan.goals.length > 4 && (
            <p className="text-xs text-slate-400 pl-5">+{plan.goals.length - 4} more goals</p>
          )}
        </div>
      )}

      {plan.progress_notes && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 mb-1">Latest Progress</p>
          <p className="text-xs text-slate-600 italic line-clamp-2">{plan.progress_notes}</p>
        </div>
      )}
    </div>
  );
}
