/**
 * Question bank editor — category-first.
 *
 * The client's complaint about the old screen was that every question landed in one
 * flat list and editing meant opening a separate box. So: pick a category on the
 * left, see that category's questions in full on the right (prompt + all options,
 * correct one marked), and edit any of them inline, in place.
 */
import { useMemo, useState } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, Circle, Pencil, Trash2, Search, X, Check } from 'lucide-react';
import { get, post, patch, del } from '../api/client.js';

const PAGE_SIZE = 100;
/** EXPERT was retired from play — the bank only serves these three. */
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
const LETTERS = ['a', 'b', 'c', 'd'];

interface Option { id: string; textAr: string; textEn?: string | null }
interface Question {
  id: string;
  type: string;
  difficulty: string;
  categoryId: string;
  promptAr: string;
  promptEn: string | null;
  explanationAr: string | null;
  explanationEn: string | null;
  options: Option[];
  correctOptionId: string;
  timeLimitSec: number;
  basePoints: number;
  speedBonus: boolean;
  tags: string[];
  isApproved: boolean;
  usageCount: number;
  category?: { id: string; nameAr: string; nameEn: string; color: string };
}
interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  color: string;
  _count?: { questions: number };
}

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

function toForm(q: Question): FormState {
  const options = (q.options ?? []).map((o) => ({ ar: o.textAr ?? '', en: o.textEn ?? '' }));
  while (options.length < 4) options.push({ ar: '', en: '' });
  return {
    categoryId: q.categoryId,
    difficulty: q.difficulty,
    promptAr: q.promptAr,
    promptEn: q.promptEn ?? '',
    options,
    correctIdx: Math.max(0, (q.options ?? []).findIndex((o) => o.id === q.correctOptionId)),
    type: q.type,
    explanationAr: q.explanationAr ?? '',
    explanationEn: q.explanationEn ?? '',
    timeLimitSec: q.timeLimitSec,
    basePoints: q.basePoints,
    speedBonus: q.speedBonus,
    tags: q.tags ?? [],
  };
}

function toPayload(form: FormState) {
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

const DIFF_STYLE: Record<string, string> = {
  EASY: 'bg-emerald-50 text-emerald-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  HARD: 'bg-rose-50 text-rose-700',
};

export function Questions() {
  const qc = useQueryClient();

  const [categoryId, setCategoryId] = useState<string>('');   // '' = all categories
  const [catFilter, setCatFilter] = useState('');             // filters the category rail
  const [search, setSearch] = useState('');                   // committed question search
  const [searchInput, setSearchInput] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: cats } = useQuery({
    queryKey: ['categories'],
    queryFn: () => get<{ categories: Category[] }>('/api/v1/admin/categories'),
  });

  const categories = useMemo(() => {
    const list = cats?.categories ?? [];
    const needle = catFilter.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (c) => c.nameAr.toLowerCase().includes(needle) || c.nameEn.toLowerCase().includes(needle),
    );
  }, [cats, catFilter]);

  const totalQuestions = useMemo(
    () => (cats?.categories ?? []).reduce((sum, c) => sum + (c._count?.questions ?? 0), 0),
    [cats],
  );

  const listKey = ['questions', { categoryId, search, difficulty }] as const;
  const { data, fetchNextPage, hasNextPage, isFetching, isLoading } = useInfiniteQuery({
    queryKey: listKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (categoryId) p.set('categoryId', categoryId);
      if (difficulty) p.set('difficulty', difficulty);
      if (search) p.set('q', search);
      if (pageParam) p.set('cursor', pageParam);
      return get<{ items: Question[]; nextCursor: string | null }>(`/api/v1/admin/questions?${p}`);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const questions = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const selectedCategory = cats?.categories.find((c) => c.id === categoryId);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['questions'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
  }

  const save = useMutation({
    mutationFn: () =>
      editingId
        ? patch(`/api/v1/admin/questions/${editingId}`, toPayload(form))
        : post('/api/v1/admin/questions', toPayload(form)),
    onSuccess: () => {
      invalidate();
      closeEditor();
    },
  });

  const approve = useMutation({
    mutationFn: ({ id, isApproved }: { id: string; isApproved: boolean }) =>
      post(`/api/v1/admin/questions/${id}/approve`, { isApproved }),
    onSuccess: () => invalidate(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/api/v1/admin/questions/${id}`),
    onSuccess: () => {
      invalidate();
      setConfirmDelete(null);
    },
  });

  function closeEditor() {
    setEditingId(null);
    setCreating(false);
    setForm(EMPTY);
    save.reset();
  }

  function startEdit(q: Question) {
    setCreating(false);
    setEditingId(q.id);
    setForm(toForm(q));
    save.reset();
  }

  function startCreate() {
    setEditingId(null);
    setCreating(true);
    setForm({ ...EMPTY, categoryId: categoryId || cats?.categories[0]?.id || '' });
    save.reset();
  }

  const editor = (
    <div className="space-y-3 rounded-lg border border-brand-violet/30 bg-violet-50/40 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">Select…</option>
            {cats?.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.nameAr} — {c.nameEn}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Difficulty</label>
          <select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
            {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Question (AR)</label>
        <textarea className="input min-h-[4.5rem]" dir="rtl" value={form.promptAr}
          onChange={(e) => setForm({ ...form, promptAr: e.target.value })} />
      </div>
      <div>
        <label className="label">Question (EN) — optional</label>
        <input className="input" value={form.promptEn} onChange={(e) => setForm({ ...form, promptEn: e.target.value })} />
      </div>
      <div>
        <label className="label">Answers — click the circle to mark the correct one</label>
        <div className="space-y-2">
          {form.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <button type="button" onClick={() => setForm({ ...form, correctIdx: i })} title="Mark as the correct answer">
                {form.correctIdx === i ? <CheckCircle2 className="text-emerald-600" /> : <Circle className="text-slate-300" />}
              </button>
              <span className="w-5 text-center text-sm font-bold text-slate-400">{LETTERS[i]?.toUpperCase()}</span>
              <input className="input flex-1" dir="rtl" placeholder="Answer (AR)" value={o.ar}
                onChange={(e) => { const ops = [...form.options]; ops[i] = { ...ops[i]!, ar: e.target.value }; setForm({ ...form, options: ops }); }} />
              <input className="input w-48" placeholder="(EN)" value={o.en}
                onChange={(e) => { const ops = [...form.options]; ops[i] = { ...ops[i]!, en: e.target.value }; setForm({ ...form, options: ops }); }} />
            </div>
          ))}
        </div>
      </div>
      {save.isError && <p className="text-sm font-semibold text-danger">{(save.error as Error).message}</p>}
      <div className="flex items-center justify-end gap-2">
        <p className="me-auto text-xs text-slate-500">
          {editingId
            ? 'Saved changes reach the next game that draws this question.'
            : 'Added questions go into rotation immediately — no deploy needed.'}
        </p>
        <button className="btn-ghost" onClick={closeEditor}>Cancel</button>
        <button
          className="btn-primary"
          disabled={save.isPending || !form.categoryId || !form.promptAr.trim() || !form.options[form.correctIdx]?.ar.trim()}
          onClick={() => save.mutate()}
        >
          <Check size={16} /> {save.isPending ? 'Saving…' : editingId ? 'Save changes' : 'Add question'}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Questions</h1>
          <p className="text-sm text-slate-500">
            {selectedCategory
              ? `${selectedCategory.nameAr} — ${selectedCategory._count?.questions ?? 0} questions`
              : `All categories — ${totalQuestions} questions`}
          </p>
        </div>
        <button className="btn-primary" onClick={() => (creating ? closeEditor() : startCreate())}>
          <Plus size={18} /> New Question
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[17rem_1fr]">
        {/* ── Category rail: pick a category, see its questions ── */}
        <aside className="card h-fit overflow-hidden lg:sticky lg:top-4">
          <div className="border-b border-slate-100 p-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9 text-sm" placeholder="Find a category…" value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)} />
            </div>
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
            <button
              onClick={() => { setCategoryId(''); closeEditor(); }}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${!categoryId ? 'bg-violet-50 font-semibold text-brand-violet' : ''}`}
            >
              <span>All categories</span>
              <span className="tnum text-xs text-slate-400">{totalQuestions}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCategoryId(c.id); closeEditor(); }}
                className={`flex w-full items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${categoryId === c.id ? 'bg-violet-50 font-semibold text-brand-violet' : ''}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="truncate" dir="auto">{c.nameAr}</span>
                </span>
                <span className="tnum shrink-0 text-xs text-slate-400">{c._count?.questions ?? 0}</span>
              </button>
            ))}
            {!categories.length && <p className="p-4 text-center text-sm text-slate-400">No match.</p>}
          </div>
        </aside>

        {/* ── Questions of the selected category, in full, editable in place ── */}
        <section>
          <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
            <form
              className="relative min-w-[16rem] flex-1"
              onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }}
            >
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" dir="auto" placeholder="Search the question text… (Enter)"
                value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
              {search && (
                <button type="button" title="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => { setSearchInput(''); setSearch(''); }}>
                  <X size={16} />
                </button>
              )}
            </form>
            <select className="input w-40" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">All difficulties</option>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {creating && <div className="mb-4">{editor}</div>}

          {isLoading ? (
            <p className="card p-6 text-center text-slate-400">Loading…</p>
          ) : !questions.length ? (
            <p className="card p-6 text-center text-slate-400">No questions here yet.</p>
          ) : (
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div key={q.id} className="card p-4">
                  {editingId === q.id ? (
                    editor
                  ) : (
                    <>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                            <span className="tnum text-slate-400">#{idx + 1}</span>
                            {q.category && (
                              <span className="rounded px-2 py-0.5 font-medium text-white" style={{ background: q.category.color }}>
                                {q.category.nameAr}
                              </span>
                            )}
                            <span className={`rounded px-2 py-0.5 font-semibold ${DIFF_STYLE[q.difficulty] ?? 'bg-slate-100 text-slate-600'}`}>
                              {q.difficulty}
                            </span>
                            <button
                              className={`rounded px-2 py-0.5 font-semibold ${q.isApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                              title="Toggle: only approved questions are served in games"
                              disabled={approve.isPending}
                              onClick={() => approve.mutate({ id: q.id, isApproved: !q.isApproved })}
                            >
                              {q.isApproved ? '✓ Approved' : 'Not approved'}
                            </button>
                            <span className="text-slate-400">used {q.usageCount}×</span>
                          </div>
                          <p className="font-semibold leading-snug" dir="rtl">{q.promptAr}</p>
                          {q.promptEn && <p className="text-sm text-slate-400">{q.promptEn}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          {confirmDelete === q.id ? (
                            <>
                              <span className="text-sm text-slate-500">Delete?</span>
                              <button className="text-sm font-semibold text-danger disabled:opacity-50" disabled={remove.isPending}
                                onClick={() => remove.mutate(q.id)}>Yes</button>
                              <button className="text-sm text-slate-500" onClick={() => setConfirmDelete(null)}>No</button>
                            </>
                          ) : (
                            <>
                              <button className="btn-ghost !px-3 !py-1.5 text-sm" onClick={() => startEdit(q)}>
                                <Pencil size={14} /> Edit
                              </button>
                              <button className="text-slate-400 hover:text-danger" title="Delete" onClick={() => setConfirmDelete(q.id)}>
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {/* All answers visible at a glance — the correct one highlighted. */}
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {(q.options ?? []).map((o) => {
                          const isCorrect = o.id === q.correctOptionId;
                          return (
                            <div
                              key={o.id}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${isCorrect ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-800' : 'border-slate-200 text-slate-600'}`}
                            >
                              {isCorrect ? <CheckCircle2 size={15} className="shrink-0 text-emerald-600" /> : <Circle size={15} className="shrink-0 text-slate-300" />}
                              <span className="truncate" dir="rtl">{o.textAr}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {hasNextPage && (
            <div className="mt-4 flex justify-center">
              <button className="btn-ghost" disabled={isFetching} onClick={() => fetchNextPage()}>
                {isFetching ? 'Loading…' : `Load more (${questions.length} shown)`}
              </button>
            </div>
          )}
          {remove.isError && <p className="mt-3 text-danger">{(remove.error as Error).message}</p>}
        </section>
      </div>
    </div>
  );
}
