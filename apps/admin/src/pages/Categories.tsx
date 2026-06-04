import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { get, post } from '../api/client.js';

interface Category {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  color: string;
}

export function Categories() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['categories'], queryFn: () => get<{ categories: Category[] }>('/api/v1/admin/categories') });
  const [form, setForm] = useState({ slug: '', nameAr: '', nameEn: '', color: '#7C3AED' });
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: () => post('/api/v1/admin/categories', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setOpen(false);
      setForm({ slug: '', nameAr: '', nameEn: '', color: '#7C3AED' });
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
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

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-sm text-slate-500">
            <tr><th className="p-3">Color</th><th className="p-3">Slug</th><th className="p-3">Arabic</th><th className="p-3">English</th></tr>
          </thead>
          <tbody>
            {data?.categories.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="p-3"><span className="inline-block h-5 w-5 rounded" style={{ background: c.color }} /></td>
                <td className="p-3 font-mono text-sm">{c.slug}</td>
                <td className="p-3" dir="rtl">{c.nameAr}</td>
                <td className="p-3">{c.nameEn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
