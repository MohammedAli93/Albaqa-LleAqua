import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Globe, Lock } from 'lucide-react';
import { get, post } from '../api/client.js';

interface Pkg {
  id: string;
  slug: string;
  titleAr: string;
  titleEn?: string;
  isPublished: boolean;
  isPremium: boolean;
  _count?: { questions: number };
}

export function Packages() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['packages'], queryFn: () => get<{ packages: Pkg[] }>('/api/v1/admin/packages') });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ slug: '', titleAr: '', titleEn: '' });

  const create = useMutation({
    mutationFn: () => post('/api/v1/admin/packages', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['packages'] }); setOpen(false); setForm({ slug: '', titleAr: '', titleEn: '' }); },
  });
  const publish = useMutation({
    mutationFn: (p: Pkg) => post(`/api/v1/admin/packages/${p.id}/publish`, { isPublished: !p.isPublished }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Packages</h1>
        <button className="btn-primary" onClick={() => setOpen((v) => !v)}><Plus size={18} /> New</button>
      </div>

      {open && (
        <div className="card mb-6 grid grid-cols-3 gap-4 p-5">
          <div><label className="label">Slug</label><input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
          <div><label className="label">Title (AR)</label><input className="input" dir="rtl" value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} /></div>
          <div><label className="label">Title (EN)</label><input className="input" value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} /></div>
          <div className="col-span-3 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>Save</button>
          </div>
          {create.isError && <p className="col-span-3 text-danger">{(create.error as Error).message}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {data?.packages.map((p) => (
          <div key={p.id} className="card p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs text-slate-400">{p.slug}</span>
              {p.isPremium ? <Lock size={16} className="text-warning" /> : null}
            </div>
            <h3 className="text-lg font-bold" dir="rtl">{p.titleAr}</h3>
            <p className="text-sm text-slate-500">{p._count?.questions ?? 0} questions</p>
            <button
              onClick={() => publish.mutate(p)}
              className={`btn mt-4 w-full justify-center text-sm ${p.isPublished ? 'bg-success/10 text-success' : 'btn-ghost'}`}
            >
              <Globe size={16} /> {p.isPublished ? 'Published' : 'Publish'}
            </button>
          </div>
        ))}
      </div>
      {!data?.packages.length && <p className="text-slate-400">No packages yet.</p>}
    </div>
  );
}
