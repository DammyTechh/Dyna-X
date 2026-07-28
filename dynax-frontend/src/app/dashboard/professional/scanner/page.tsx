'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Plus, ScanLine, Box, ChevronRight, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useScans } from '@/hooks/useScanner';
import { ScanStatusBadge } from '@/components/scanner/ScanStatus';
import { ANATOMICAL_REGIONS } from '@/types/scanner';

function regionLabel(value: string): string {
  return ANATOMICAL_REGIONS.find((r) => r.value === value)?.label ?? value ?? 'Scan';
}

export default function ScannerListPage() {
  const { data: scans, isLoading } = useScans();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 p-8 text-white shadow-xl">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-md">
                <ScanLine className="h-3.5 w-3.5" /> DynaX Scanner
              </div>
              <h1 className="text-2xl font-bold sm:text-3xl">3D Scans</h1>
              <p className="mt-1 max-w-lg text-sm text-slate-300">
                Turn a short capture video into a 3D model, or review scans captured on the DynaXcan mobile app.
              </p>
            </div>
            <Link
              href="/dashboard/professional/scanner/new"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" /> New Scan
            </Link>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-24 text-slate-400">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : !scans || scans.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scans.map((scan, i) => (
              <motion.div
                key={scan.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  href={`/dashboard/professional/scanner/${scan.id}`}
                  className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-slate-700 text-white">
                      <Box className="h-5 w-5" />
                    </div>
                    <ScanStatusBadge state={scan.reconstructionState} />
                  </div>
                  <h3 className="font-semibold text-slate-900">
                    {scan.subjectDisplayName || 'Untitled scan'}
                  </h3>
                  <p className="text-sm text-slate-500">{regionLabel(scan.anatomicalRegion)}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                    <span>{format(new Date(scan.createdAt), 'dd MMM yyyy, HH:mm')}</span>
                    <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:text-teal-600" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-slate-700 text-white">
        <ScanLine className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">No scans yet</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Capture a slow orbit video of the anatomy and DynaX will reconstruct a 3D model you can review and export.
      </p>
      <Link
        href="/dashboard/professional/scanner/new"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        <Plus className="h-4 w-4" /> Start your first scan
      </Link>
    </div>
  );
}
