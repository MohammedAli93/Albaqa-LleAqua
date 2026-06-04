import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { get, post } from '../api/client.js';

interface ImportRow { line: number; ok: boolean; errors: string[] }
interface Preview { importId: string; total: number; valid: number; invalid: number; rows: ImportRow[] }

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function Import() {
  const [filename, setFilename] = useState('');
  const [b64, setB64] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [committed, setCommitted] = useState<number | null>(null);

  const doPreview = useMutation({
    mutationFn: () => post<Preview>('/api/v1/admin/questions/import/preview', { filename, contentBase64: b64 }),
    onSuccess: (p) => { setPreview(p); setCommitted(null); },
  });
  const doCommit = useMutation({
    mutationFn: () => post<{ created: number }>('/api/v1/admin/questions/import/commit', { importId: preview!.importId }),
    onSuccess: (r) => { setCommitted(r.created); setPreview(null); },
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setB64(await fileToBase64(file));
    setPreview(null);
  }

  async function downloadTemplate() {
    const { headers } = await get<{ headers: string[] }>('/api/v1/admin/questions/import/template');
    const csv = headers.join(',') + '\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'tahaddi-import-template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">Bulk Import</h1>
      <p className="mb-6 text-slate-500">Upload a CSV or XLSX of questions. Rows are validated before anything is written.</p>

      <div className="card space-y-4 p-6">
        <div className="flex items-center gap-3">
          <label className="btn-primary cursor-pointer">
            <Upload size={18} /> Choose file
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={onFile} />
          </label>
          {filename && <span className="text-sm text-slate-600">{filename}</span>}
          <button className="btn-ghost ml-auto text-sm" onClick={downloadTemplate}>Download template</button>
        </div>

        <button className="btn-primary" disabled={!b64 || doPreview.isPending} onClick={() => doPreview.mutate()}>
          Validate
        </button>
        {doPreview.isError && <p className="text-danger">{(doPreview.error as Error).message}</p>}

        {committed !== null && (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 p-4 text-success">
            <CheckCircle2 /> Imported {committed} questions (pending approval).
          </div>
        )}

        {preview && (
          <div>
            <div className="mb-3 flex gap-4 text-sm">
              <span>Total: <b>{preview.total}</b></span>
              <span className="text-success">Valid: <b>{preview.valid}</b></span>
              <span className="text-danger">Invalid: <b>{preview.invalid}</b></span>
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
              {preview.rows.filter((r) => !r.ok).map((r) => (
                <div key={r.line} className="flex items-start gap-2 border-b border-slate-100 p-2 text-sm">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
                  <span className="font-mono text-slate-400">L{r.line}</span>
                  <span className="text-danger">{r.errors.join('; ')}</span>
                </div>
              ))}
              {preview.invalid === 0 && <p className="p-3 text-success">All rows valid ✓</p>}
            </div>
            <button className="btn-primary mt-4" disabled={preview.valid === 0 || doCommit.isPending} onClick={() => doCommit.mutate()}>
              Import {preview.valid} valid rows
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
