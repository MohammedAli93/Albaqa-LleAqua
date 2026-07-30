/**
 * Categories — the picker the host sees when creating a game.
 *
 * Names are editable in place: the Arabic name is what shows on the phone and the TV,
 * so the owner can reword a category without a deploy. The change is live on the next
 * screen the players open. `slug` stays fixed — it is the key the question bank joins
 * on, so renaming it would orphan that category's questions.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Check, X } from 'lucide-react';
import { get, post, patch } from '../api/client.js';

interface Category {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  color: string;
  adminEdited?: boolean;
  _count?: { questions: number };
}

type Draft = { nameAr: string; nameEn: string; color: string };

export function Categories() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['categories'], queryFn: () => get<{ categories: Category[] }>('/api/v1/admin/categories') });
  const [form, setForm] = useState({ slug: '', nameAr: '', nameEn: '', color: '#7C3AED' });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ nameAr: '', nameEn: '', color: '#7C3AED' });

  const create = useMutation({
    mutationFn: () => post('/api/v1/admin/categories', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setOpen(false);
      setForm({ slug: '', nameAr: '', nameEn: '', color: '#7C3AED' });
    },
  });

  const save = useMutation({
    mutationFn: (id: string) => patch(`/api/v1/admin/categories/${id}`, draft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['adminCategories'] });
      setEditId(null);
    },
  });

  function startEdit(c: Category) {
    setEditId(c.id);
    setDraft({ nameAr: c.nameAr, nameEn: c.nameEn, color: c.color });
    save.reset();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-slate-500">
            Rename any category in place — the new name reaches players immediately, no deploy needed.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setOpen((v) => !v)}>
          <Plus size={18} /> New
        </button>
      </div>

      {open && (
        <div className="card mb-6 grid grid-cols-2 gap-4 p-5">
          <div><label className="label">Slug</label><input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="general" /></div>
          <div><label className="label">Color</label><input type="color" className="input h-10" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
          <div><label className="label">Name (AR)</label><input className="input" dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} /></div>
          <div><label className="label">Name (EN)</label><input className="input" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} /></div>
          <div className="col-span-2 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>Save</button>
          </div>
          {create.isError && <p className="col-span-2 text-danger">{(create.error as Error).message}</p>}
        </div>
      )}

      {save.isError && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {(save.error as Error).message}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-sm text-slate-500">
            <tr>
              <th className="p-3">Color</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Arabic (shown to players)</th>
              <th className="p-3">English</th>
              <th className="p-3">Questions</th>
              <th className="p-3 text-right">Edit</th>
            </tr>
          </thead>
          <tbody>
            {data?.categories.map((c) =>
              editId === c.id ? (
                <tr key={c.id} className="border-t border-slate-100 bg-violet-50/40">
                  <td className="p-3">
                    <input type="color" className="h-8 w-10 cursor-pointer rounded border border-slate-200"
                      value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
                  </td>
                  <td className="p-3 font-mono text-sm text-slate-400" title="Slug can't change — questions are linked by it">{c.slug}</td>
                  <td className="p-3">
                    <input className="input" dir="rtl" autoFocus value={draft.nameAr}
                      onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') save.mutate(c.id); if (e.key === 'Escape') setEditId(null); }} />
                  </td>
                  <td className="p-3">
                    <input className="input" value={draft.nameEn}
                      onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') save.mutate(c.id); if (e.key === 'Escape') setEditId(null); }} />
                  </td>
                  <td className="p-3 tnum text-slate-400">{c._count?.questions ?? 0}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button className="btn-primary !px-3 !py-1.5 text-sm" disabled={save.isPending || !draft.nameAr.trim() || !draft.nameEn.trim()}
                        onClick={() => save.mutate(c.id)}>
                        <Check size={14} /> {save.isPending ? 'Saving…' : 'Save'}
                      </button>
                      <button className="btn-ghost !px-3 !py-1.5 text-sm" onClick={() => setEditId(null)}>
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="p-3"><span className="inline-block h-5 w-5 rounded" style={{ background: c.color }} /></td>
                  <td className="p-3 font-mono text-sm">{c.slug}</td>
                  <td className="p-3 font-semibold" dir="rtl">{c.nameAr}</td>
                  <td className="p-3">{c.nameEn}</td>
                  <td className="p-3 tnum text-slate-500">{c._count?.questions ?? 0}</td>
                  <td className="p-3 text-right">
                    <button className="btn-ghost !px-3 !py-1.5 text-sm" onClick={() => startEdit(c)}>
                      <Pencil size={14} /> Rename
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
