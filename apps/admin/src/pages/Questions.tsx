import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, Circle, Pencil, Trash2 } from 'lucide-react';
import { get, post, patch, del } from '../api/client.js';

interface QuestionRow {
  id: string;
  promptAr: string;
  difficulty: string;
  type: string;
  isApproved: boolean;
  category?: { nameEn: string; color: string };
}
interface QuestionFull {
  id: string;
  type: string;
  difficulty: string;
  categoryId: string;
  promptAr: string;
  promptEn: string | null;
  explanationAr: string | null;
  explanationEn: string | null;
  options: { id: string; textAr: string; textEn?: string | null }[];
  correctOptionId: string;
  timeLimitSec: number;
  basePoints: number;
  speedBonus: boolean;
  tags: string[];
}
interface Category { id: string; nameEn: string; nameAr: string }

const LETTERS = ['a', 'b', 'c', 'd'];

type FormState = {
  categoryId: string;
  difficulty: string;
  promptAr: string;
  promptEn: string;
  options: { ar: string; en: string }[];
  correctIdx: number;
  // Preserved across edits (not exposed in the form UI):
  type: string;
  explanationAr: string;
  explanationEn: string;
  timeLimitSec: number;
  basePoints: number;
  speedBonus: boolean;
  tags: string[];
};

const EMPTY: FormState = {
  categoryId: '', difficulty: 'MEDIUM', promptAr: '', promptEn: '',
  options: [{ ar: '', en: '' }, { ar: '', en: '' }, { ar: '', en: '' }, { ar: '', en: '' }],
  correctIdx: 0,
  type: 'MULTIPLE_CHOICE', explanationAr: '', explanationEn: '',
  timeLimitSec: 15, basePoints: 100, speedBonus: true, tags: [],
};

export function Questions() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['questions'], queryFn: () => get<{ items: QuestionRow[] }>('/api/v1/admin/questions?limit=50') });
  const { data: cats } = useQuery({ queryKey: ['categories'], queryFn: () => get<{ categories: Category[] }>('/api/v1/admin/categories') });
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  function payload() {
    return {
      type: form.type,
      difficulty: form.difficulty,
      categoryId: form.categoryId,
      promptAr: form.promptAr,
      promptEn: form.promptEn || undefined,
      explanationAr: form.explanationAr || undefined,
      explanationEn: form.explanationEn || undefined,
      options: form.options
        .map((o, i) => ({ id: LETTERS[i], textAr: o.ar, textEn: o.en || undefined }))
        .filter((o) => o.textAr),
      correctOptionId: LETTERS[form.correctIdx],
      timeLimitSec: form.timeLimitSec,
      basePoints: form.basePoints,
      speedBonus: form.speedBonus,
      tags: form.tags,
    };
  }

  function closeForm() {
    setOpen(false);
    setEditingId(null);
    setForm(EMPTY);
  }

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setOpen(true);
  }

  async function startEdit(id: string) {
    setLoadingEdit(true);
    try {
      const q = await get<QuestionFull>(`/api/v1/admin/questions/${id}`);
      const opts = (q.options ?? []).map((o) => ({ ar: o.textAr ?? '', en: o.textEn ?? '' }));
      while (opts.length < 4) opts.push({ ar: '', en: '' });
      const correctIdx = Math.max(0, q.options.findIndex((o) => o.id === q.correctOptionId));
      setForm({
        categoryId: q.categoryId,
        difficulty: q.difficulty,
        promptAr: q.promptAr,
        promptEn: q.promptEn ?? '',
        options: opts,
        correctIdx,
        type: q.type,
        explanationAr: q.explanationAr ?? '',
        explanationEn: q.explanationEn ?? '',
        timeLimitSec: q.timeLimitSec,
        basePoints: q.basePoints,
        speedBonus: q.speedBonus,
        tags: q.tags ?? [],
      });
      setEditingId(id);
      setOpen(true);
    } finally {
      setLoadingEdit(false);
    }
  }

  const save = useMutation({
    mutationFn: () =>
      editingId
        ? patch(`/api/v1/admin/questions/${editingId}`, payload())
        : post('/api/v1/admin/questions', payload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      closeForm();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/api/v1/admin/questions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      setConfirmDelete(null);
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Questions</h1>
        <button className="btn-primary" onClick={() => (open ? closeForm() : startCreate())}><Plus size={18} /> New Question</button>
      </div>

      {open && (
        <div className="card mb-6 space-y-4 p-5">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Question' : 'New Question'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Select…</option>
                {cats?.categories.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Difficulty</label>
              <select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                {['EASY', 'MEDIUM', 'HARD', 'EXPERT'].map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Prompt (AR)</label><input className="input" dir="rtl" value={form.promptAr} onChange={(e) => setForm({ ...form, promptAr: e.target.value })} /></div>
          <div><label className="label">Prompt (EN)</label><input className="input" value={form.promptEn} onChange={(e) => setForm({ ...form, promptEn: e.target.value })} /></div>
          <div>
            <label className="label">Options (click the circle to mark the correct one)</label>
            <div className="space-y-2">
              {form.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button type="button" onClick={() => setForm({ ...form, correctIdx: i })} aria-label="mark correct">
                    {form.correctIdx === i ? <CheckCircle2 className="text-success" /> : <Circle className="text-slate-300" />}
                  </button>
                  <input className="input flex-1" dir="rtl" placeholder={`Option ${LETTERS[i]?.toUpperCase()} (AR)`} value={o.ar}
                    onChange={(e) => { const ops = [...form.options]; ops[i] = { ...ops[i]!, ar: e.target.value }; setForm({ ...form, options: ops }); }} />
                  <input className="input flex-1" placeholder="(EN)" value={o.en}
                    onChange={(e) => { const ops = [...form.options]; ops[i] = { ...ops[i]!, en: e.target.value }; setForm({ ...form, options: ops }); }} />
                </div>
              ))}
            </div>
          </div>
          {save.isError && <p className="text-danger">{(save.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={closeForm}>Cancel</button>
            <button className="btn-primary" disabled={save.isPending || !form.categoryId || !form.promptAr} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : editingId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-sm text-slate-500">
            <tr><th className="p-3">Prompt</th><th className="p-3">Category</th><th className="p-3">Difficulty</th><th className="p-3">Approved</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {data?.items.map((q) => (
              <tr key={q.id} className="border-t border-slate-100">
                <td className="max-w-md truncate p-3" dir="rtl">{q.promptAr}</td>
                <td className="p-3">{q.category && <span className="rounded px-2 py-0.5 text-sm text-white" style={{ background: q.category.color }}>{q.category.nameEn}</span>}</td>
                <td className="p-3 text-sm">{q.difficulty}</td>
                <td className="p-3">{q.isApproved ? <CheckCircle2 className="text-success" size={18} /> : <Circle className="text-slate-300" size={18} />}</td>
                <td className="p-3">
                  {confirmDelete === q.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-sm text-slate-500">Delete?</span>
                      <button className="text-sm font-semibold text-danger disabled:opacity-50" disabled={remove.isPending} onClick={() => remove.mutate(q.id)}>Yes</button>
                      <button className="text-sm text-slate-500" onClick={() => setConfirmDelete(null)}>No</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-3">
                      <button className="text-slate-400 hover:text-primary disabled:opacity-50" title="Edit" disabled={loadingEdit} onClick={() => startEdit(q.id)}><Pencil size={16} /></button>
                      <button className="text-slate-400 hover:text-danger" title="Delete" onClick={() => setConfirmDelete(q.id)}><Trash2 size={16} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {remove.isError && <p className="p-3 text-danger">{(remove.error as Error).message}</p>}
        {!data?.items.length && <p className="p-6 text-center text-slate-400">No questions yet.</p>}
      </div>
    </div>
  );
}
