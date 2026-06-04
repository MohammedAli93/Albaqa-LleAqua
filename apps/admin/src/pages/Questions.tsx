import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, Circle } from 'lucide-react';
import { get, post } from '../api/client.js';

interface QuestionRow {
  id: string;
  promptAr: string;
  difficulty: string;
  type: string;
  isApproved: boolean;
  category?: { nameEn: string; color: string };
}
interface Category { id: string; nameEn: string; nameAr: string }

const LETTERS = ['a', 'b', 'c', 'd'];

export function Questions() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['questions'], queryFn: () => get<{ items: QuestionRow[] }>('/api/v1/admin/questions?limit=50') });
  const { data: cats } = useQuery({ queryKey: ['categories'], queryFn: () => get<{ categories: Category[] }>('/api/v1/admin/categories') });
  const [open, setOpen] = useState(false);

  const empty = {
    categoryId: '', difficulty: 'MEDIUM', promptAr: '', promptEn: '',
    options: [{ ar: '', en: '' }, { ar: '', en: '' }, { ar: '', en: '' }, { ar: '', en: '' }],
    correctIdx: 0,
  };
  const [form, setForm] = useState(empty);

  const create = useMutation({
    mutationFn: () =>
      post('/api/v1/admin/questions', {
        type: 'MULTIPLE_CHOICE',
        difficulty: form.difficulty,
        categoryId: form.categoryId,
        promptAr: form.promptAr,
        promptEn: form.promptEn || undefined,
        options: form.options
          .map((o, i) => ({ id: LETTERS[i], textAr: o.ar, textEn: o.en || undefined }))
          .filter((o) => o.textAr),
        correctOptionId: LETTERS[form.correctIdx],
        timeLimitSec: 15,
        basePoints: 100,
        speedBonus: true,
        tags: [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      setOpen(false);
      setForm(empty);
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Questions</h1>
        <button className="btn-primary" onClick={() => setOpen((v) => !v)}><Plus size={18} /> New Question</button>
      </div>

      {open && (
        <div className="card mb-6 space-y-4 p-5">
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
          {create.isError && <p className="text-danger">{(create.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={create.isPending || !form.categoryId || !form.promptAr} onClick={() => create.mutate()}>Save</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-sm text-slate-500">
            <tr><th className="p-3">Prompt</th><th className="p-3">Category</th><th className="p-3">Difficulty</th><th className="p-3">Approved</th></tr>
          </thead>
          <tbody>
            {data?.items.map((q) => (
              <tr key={q.id} className="border-t border-slate-100">
                <td className="max-w-md truncate p-3" dir="rtl">{q.promptAr}</td>
                <td className="p-3">{q.category && <span className="rounded px-2 py-0.5 text-sm text-white" style={{ background: q.category.color }}>{q.category.nameEn}</span>}</td>
                <td className="p-3 text-sm">{q.difficulty}</td>
                <td className="p-3">{q.isApproved ? <CheckCircle2 className="text-success" size={18} /> : <Circle className="text-slate-300" size={18} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.items.length && <p className="p-6 text-center text-slate-400">No questions yet.</p>}
      </div>
    </div>
  );
}
