'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePatientRecords, useCreatePatientRecord, useUpdatePatientRecord, useMe } from '@/hooks/useApi';
import { uploadScan, storageConfigured } from '@/lib/storage';
import { PatientRecord, PatientRecordAttachment } from '@/types';
import {
  FileText, Plus, X, Loader2, Search, User, Paperclip, Trash2, Save, Pencil,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type MeasurementField = { key: string; label: string };

const PROSTHETIC_FIELDS: MeasurementField[] = [
  { key: 'residual_limb_length', label: 'Residual limb length' },
  { key: 'residual_limb_circumference', label: 'Residual limb circumference' },
  { key: 'device_specification', label: 'Device specification' },
  { key: 'alignment_notes', label: 'Alignment notes' },
  { key: 'follow_up_observations', label: 'Follow-up observations' },
];
const PHYSIO_FIELDS: MeasurementField[] = [
  { key: 'range_of_motion', label: 'Range of motion (ROM)' },
  { key: 'strength_assessment', label: 'Strength assessment' },
  { key: 'functional_scores', label: 'Functional outcome scores' },
  { key: 'rehab_notes', label: 'Rehabilitation progress notes' },
];

function fieldsForRole(role: string): { title: string; fields: MeasurementField[] } {
  if (role === 'prosthetist' || role === 'orthotist') {
    return { title: 'Prosthetic / Orthotic measurements', fields: PROSTHETIC_FIELDS };
  }
  if (role === 'physiotherapist') {
    return { title: 'Physiotherapy assessment', fields: PHYSIO_FIELDS };
  }
  return { title: 'Clinical measurements', fields: [] };
}

type FormState = {
  full_name: string; date_of_birth: string; gender: string; phone: string; email: string; address: string;
  clinical_history: string; case_notes: string; assessment_findings: string; progress_notes: string; outcome_measures: string;
  measurements: Record<string, string>;
  attachments: PatientRecordAttachment[];
};

const EMPTY: FormState = {
  full_name: '', date_of_birth: '', gender: '', phone: '', email: '', address: '',
  clinical_history: '', case_notes: '', assessment_findings: '', progress_notes: '', outcome_measures: '',
  measurements: {}, attachments: [],
};

export default function PatientRecordsPage() {
  const { data: me } = useMe();
  const role = (me as { role?: string } | undefined)?.role || '';
  const roleCfg = fieldsForRole(role);

  const { data: records, isLoading } = usePatientRecords();
  const createRec = useCreatePatientRecord();
  const updateRec = useUpdatePatientRecord();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setMeasure = (k: string, v: string) => setForm((f) => ({ ...f, measurements: { ...f.measurements, [k]: v } }));

  const openCreate = () => { setForm(EMPTY); setEditingId(null); setShowForm(true); };
  const openEdit = (r: PatientRecord) => {
    setForm({
      full_name: r.full_name || '', date_of_birth: r.date_of_birth || '', gender: r.gender || '',
      phone: r.phone || '', email: r.email || '', address: r.address || '',
      clinical_history: r.clinical_history || '', case_notes: r.case_notes || '',
      assessment_findings: r.assessment_findings || '', progress_notes: r.progress_notes || '',
      outcome_measures: r.outcome_measures || '',
      measurements: r.measurements || {}, attachments: r.attachments || [],
    });
    setEditingId(r.id);
    setShowForm(true);
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!storageConfigured()) { toast.error('File storage is not configured'); return; }
    setUploading(true);
    try {
      const url = await uploadScan(file);
      set('attachments', [...form.attachments, { name: file.name, url }]);
      toast.success('File uploaded');
    } catch (e) {
      toast.error((e as Error).message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.full_name.trim()) { toast.error('Patient name is required'); return; }
    const payload: Partial<PatientRecord> = {
      full_name: form.full_name.trim(),
      date_of_birth: form.date_of_birth || undefined,
      gender: form.gender || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      clinical_history: form.clinical_history || undefined,
      case_notes: form.case_notes || undefined,
      assessment_findings: form.assessment_findings || undefined,
      progress_notes: form.progress_notes || undefined,
      outcome_measures: form.outcome_measures || undefined,
      measurements: form.measurements,
      attachments: form.attachments,
    };
    try {
      if (editingId) {
        await updateRec.mutateAsync({ id: editingId, data: payload });
        toast.success('Record updated');
      } else {
        await createRec.mutateAsync(payload);
        toast.success('Record created');
      }
      setShowForm(false); setForm(EMPTY); setEditingId(null);
    } catch (e) {
      toast.error((e as Error).message || 'Could not save record');
    }
  };

  const list = (records || []).filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  );
  const saving = createRec.isPending || updateRec.isPending;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Patient Records</h1>
            <p className="text-slate-500 text-sm mt-1">
              Simple documentation for patients — works even if they aren&apos;t connected via DX-PIN.
            </p>
          </div>
          <button onClick={showForm ? () => setShowForm(false) : openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 flex-shrink-0">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Close' : 'New record'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
            <h2 className="font-semibold text-slate-900">{editingId ? 'Edit record' : 'New patient record'}</h2>

            {/* Demographics */}
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Demographics</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Full name *"><input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className={inputCls} /></Field>
                <Field label="Date of birth"><input type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} className={inputCls} /></Field>
                <Field label="Gender"><input value={form.gender} onChange={(e) => set('gender', e.target.value)} className={inputCls} /></Field>
                <Field label="Phone"><input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} /></Field>
                <Field label="Email"><input value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} /></Field>
                <Field label="Address"><input value={form.address} onChange={(e) => set('address', e.target.value)} className={inputCls} /></Field>
              </div>
            </section>

            {/* Clinical */}
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Clinical documentation</p>
              <Field label="Clinical history"><textarea rows={2} value={form.clinical_history} onChange={(e) => set('clinical_history', e.target.value)} className={textCls} /></Field>
              <Field label="Case notes & assessment findings"><textarea rows={2} value={form.case_notes} onChange={(e) => set('case_notes', e.target.value)} className={textCls} /></Field>
              <Field label="Assessment findings"><textarea rows={2} value={form.assessment_findings} onChange={(e) => set('assessment_findings', e.target.value)} className={textCls} /></Field>
            </section>

            {/* Role-specific measurements */}
            {roleCfg.fields.length > 0 && (
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{roleCfg.title}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {roleCfg.fields.map((f) => (
                    <Field key={f.key} label={f.label}>
                      <input value={form.measurements[f.key] || ''} onChange={(e) => setMeasure(f.key, e.target.value)} className={inputCls} />
                    </Field>
                  ))}
                </div>
              </section>
            )}

            {/* Progress + outcomes */}
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Progress & outcomes</p>
              <Field label="Treatment progress notes"><textarea rows={2} value={form.progress_notes} onChange={(e) => set('progress_notes', e.target.value)} className={textCls} /></Field>
              <Field label="Outcome measures"><textarea rows={2} value={form.outcome_measures} onChange={(e) => set('outcome_measures', e.target.value)} className={textCls} /></Field>
            </section>

            {/* Attachments */}
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Files & images</p>
              {form.attachments.length > 0 && (
                <ul className="space-y-1.5">
                  {form.attachments.map((a, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                      <a href={a.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate flex-1">{a.name}</a>
                      <button onClick={() => set('attachments', form.attachments.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-sm text-slate-600 cursor-pointer hover:bg-slate-50 w-fit">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                {uploading ? 'Uploading…' : 'Attach file / image'}
                <input type="file" className="hidden" disabled={uploading} onChange={(e) => onUpload(e.target.files?.[0])} />
              </label>
            </section>

            <div className="flex gap-3 pt-1">
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? 'Save changes' : 'Create record'}
              </button>
              <button onClick={() => { setShowForm(false); setForm(EMPTY); setEditingId(null); }}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        {!showForm && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search records…"
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100 text-sm focus:outline-none" />
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
        ) : list.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {list.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full dynax-gradient flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{r.full_name}</p>
                      <p className="text-xs text-slate-400">Updated {format(new Date(r.updated_at), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  <button onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                {r.case_notes && <p className="text-xs text-slate-600 mt-3 line-clamp-2">{r.case_notes}</p>}
                <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                  {r.attachments && r.attachments.length > 0 && (
                    <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> {r.attachments.length}</span>
                  )}
                  {r.date_of_birth && <span>DOB {r.date_of_birth}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <FileText className="w-10 h-10 text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-700 mb-1">No records yet</h3>
            <p className="text-slate-500 text-sm max-w-xs">Create a record for any patient — no DX-PIN connection required.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200';
const textCls = inputCls + ' resize-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
