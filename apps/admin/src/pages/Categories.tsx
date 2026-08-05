/**
 * Categories — the picker the host sees when creating a game.
 *
 * Two levels: a **group** (الثقافة والمعرفة، الدول العربية…) holds the **categories**
 * filed under it. The owner browses by group filter, not by scrolling one flat list
 * (client feedback 2026-07-31), and adding a category means picking its group from a
 * dropdown and a colour from named swatches instead of hunting in a colour wheel.
 *
 * Names are editable in place: the Arabic name is what shows on the phone and the TV,
 * so the owner can reword a category without a deploy. The change is live on the next
 * screen the players open. `slug` stays fixed — it is the key the question bank joins
 * on, so renaming it would orphan that category's questions.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Check, X, Search, FolderPlus, Layers, ChevronUp, ChevronDown } from 'lucide-react';
import { get, post, patch } from '../api/client.js';

/**
 * Target bank size per category — the client's brief (2026-08-05): every category is
 * a bank of 500 questions. Mirrors TARGET_BANK_SIZE in server/prisma/taxonomy.ts.
 */
const TARGET_BANK_SIZE = 500;

interface Group {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  color: string;
  icon?: string | null;
  sortOrder: number;
  _count?: { categories: number };
}

interface Category {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  color: string;
  sortOrder: number;
  groupId?: string | null;
  group?: { id: string; slug: string; nameAr: string; nameEn: string; color: string } | null;
  adminEdited?: boolean;
  _count?: { questions: number };
}

type Draft = { nameAr: string; nameEn: string; color: string; groupId: string };

/**
 * Named swatches instead of a raw colour wheel — the owner picks "أخضر" from a list,
 * the same way the taxonomy assigns group colours. Values match the group palette in
 * prisma/taxonomy.ts so a hand-added category looks native next to a seeded one.
 */
const PALETTE: { value: string; label: string }[] = [
  { value: '#F97316', label: 'Orange — برتقالي محروق' },
  { value: '#F59E0B', label: 'Amber — كهرماني' },
  { value: '#EF4444', label: 'Red — أحمر' },
  { value: '#7C3AED', label: 'Violet — بنفسجي' },
  { value: '#16A34A', label: 'Islamic green — أخضر داكن' },
  { value: '#EC4899', label: 'Pink — وردي' },
  { value: '#A855F7', label: 'Purple — أرجواني' },
  { value: '#06B6D4', label: 'Cyan — سماوي' },
  { value: '#0EA371', label: 'Green — أخضر' },
  { value: '#0EA5E9', label: 'Blue — أزرق' },
  { value: '#8B5CF6', label: 'Purple (dark) — بنفسجي داكن' },
  { value: '#22C55E', label: 'Lime — أخضر فاتح' },
  { value: '#64748B', label: 'Slate — رمادي' },
];

const UNGROUPED = '__none__';

/** A colour field: swatch list + the exact hex, so presets are one click and custom is still possible. */
function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const known = PALETTE.some((p) => p.value.toLowerCase() === value.toLowerCase());
  return (
    <div className="flex items-center gap-2">
      <span className="h-9 w-9 shrink-0 rounded-lg border border-slate-200" style={{ background: value }} />
      <select className="input flex-1" value={known ? value : 'custom'} onChange={(e) => e.target.value !== 'custom' && onChange(e.target.value)}>
        {PALETTE.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        {!known && <option value="custom">Custom — {value}</option>}
      </select>
      <input type="color" className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-200"
        title="Pick any colour" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Categories() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['categories'], queryFn: () => get<{ categories: Category[] }>('/api/v1/admin/categories') });
  const { data: groupData } = useQuery({ queryKey: ['categoryGroups'], queryFn: () => get<{ groups: Group[] }>('/api/v1/admin/category-groups') });

  const groups = groupData?.groups ?? [];

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>(''); // '' = every group

  const [form, setForm] = useState({ slug: '', nameAr: '', nameEn: '', color: PALETTE[0]!.value, groupId: '' });
  const [open, setOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({ slug: '', nameAr: '', nameEn: '', color: PALETTE[0]!.value });
  const [groupOpen, setGroupOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ nameAr: '', nameEn: '', color: PALETTE[0]!.value, groupId: '' });

  const create = useMutation({
    mutationFn: () => post('/api/v1/admin/categories', { ...form, groupId: form.groupId || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['categoryGroups'] });
      setOpen(false);
      setForm({ slug: '', nameAr: '', nameEn: '', color: PALETTE[0]!.value, groupId: '' });
    },
  });

  const createGroup = useMutation({
    mutationFn: () => post<Group>('/api/v1/admin/category-groups', groupForm),
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: ['categoryGroups'] });
      setGroupOpen(false);
      // Land the owner where they just created: the new group becomes the add-form's parent.
      setForm((f) => ({ ...f, groupId: g.id, color: groupForm.color }));
      setGroupForm({ slug: '', nameAr: '', nameEn: '', color: PALETTE[0]!.value });
    },
  });

  /**
   * Reordering: swap the two rows' `sortOrder` values. The order the client asked for
   * (المتشابه والمختلف → نكهة محلية → الرياضة → …) ships in the taxonomy, but the owner
   * can re-rank both levels from here without a deploy — a moved row is flagged
   * `sortEdited` server-side so the next content deploy leaves its position alone.
   *
   * When two rows happen to share a `sortOrder` a swap would be a no-op, so the moving
   * row steps past its neighbour instead.
   */
  const reorder = useMutation({
    mutationFn: async ({ kind, a, b, dir }: {
      kind: 'categories' | 'category-groups';
      a: { id: string; sortOrder: number };
      b: { id: string; sortOrder: number };
      dir: -1 | 1;
    }) => {
      if (a.sortOrder === b.sortOrder) {
        await patch(`/api/v1/admin/${kind}/${a.id}`, { sortOrder: Math.max(0, a.sortOrder + dir) });
        return;
      }
      await patch(`/api/v1/admin/${kind}/${a.id}`, { sortOrder: b.sortOrder });
      await patch(`/api/v1/admin/${kind}/${b.id}`, { sortOrder: a.sortOrder });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['categoryGroups'] });
      qc.invalidateQueries({ queryKey: ['adminCategories'] });
    },
  });

  const save = useMutation({
    mutationFn: (id: string) => patch(`/api/v1/admin/categories/${id}`, { ...draft, groupId: draft.groupId || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['categoryGroups'] });
      qc.invalidateQueries({ queryKey: ['adminCategories'] });
      setEditId(null);
    },
  });

  function startEdit(c: Category) {
    setEditId(c.id);
    setDraft({ nameAr: c.nameAr, nameEn: c.nameEn, color: c.color, groupId: c.groupId ?? '' });
    save.reset();
  }

  const all = data?.categories ?? [];

  /** Search + group filter, then bucketed under their group for display. */
  const sections = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matched = all.filter((c) => {
      if (groupFilter && (c.groupId ?? UNGROUPED) !== groupFilter) return false;
      if (!needle) return true;
      return (
        c.nameAr.toLowerCase().includes(needle) ||
        c.nameEn.toLowerCase().includes(needle) ||
        c.slug.toLowerCase().includes(needle)
      );
    });
    // `siblings` is the group's FULL category list (ignoring search/filter) — the
    // ↑/↓ buttons must move a row past its real neighbour, not past whatever the
    // current search happens to show.
    const buckets: { key: string; group: Group | null; items: Category[]; siblings: Category[] }[] = [];
    for (const g of groups) {
      const items = matched.filter((c) => c.groupId === g.id);
      if (items.length) buckets.push({ key: g.id, group: g, items, siblings: all.filter((c) => c.groupId === g.id) });
    }
    const loose = matched.filter((c) => !c.groupId);
    if (loose.length) buckets.push({ key: UNGROUPED, group: null, items: loose, siblings: all.filter((c) => !c.groupId) });
    return buckets;
  }, [all, groups, search, groupFilter]);

  const shown = sections.reduce((n, s) => n + s.items.length, 0);
  const ungroupedCount = all.filter((c) => !c.groupId).length;

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-slate-500">
            Two levels: a <b>group</b> (فئة رئيسية) holds the <b>categories</b> (فئات فرعية) under it.
            The list below is in the exact order players see it — use ↑/↓ to re-rank a group or a
            category. Rename in place; changes reach players immediately, no deploy needed.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Target bank size: <b className="tnum">{TARGET_BANK_SIZE}</b> questions per category. The
            bar in each row shows how full that bank is — add questions on the <b>Questions</b> page
            or in bulk from <b>Import</b>.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="btn-ghost" onClick={() => { setGroupOpen((v) => !v); setOpen(false); }}>
            <FolderPlus size={18} /> New group — فئة رئيسية
          </button>
          <button className="btn-primary" onClick={() => { setOpen((v) => !v); setGroupOpen(false); }}>
            <Plus size={18} /> New category — فئة فرعية
          </button>
        </div>
      </div>

      {/* ── Add a group (the parent bucket categories hang off) ── */}
      {groupOpen && (
        <div className="card mb-6 grid grid-cols-2 gap-4 p-5">
          <p className="col-span-2 text-sm text-slate-500">
            A group is the top-level bucket in the host's picker — e.g. «الرياضة» holding كرة القدم، الأولمبياد…
          </p>
          <div><label className="label">Slug (permanent id)</label><input className="input" value={groupForm.slug}
            onChange={(e) => setGroupForm({ ...groupForm, slug: e.target.value })} placeholder="sports" /></div>
          <div><label className="label">Colour</label><ColorField value={groupForm.color} onChange={(v) => setGroupForm({ ...groupForm, color: v })} /></div>
          <div><label className="label">Name (AR) — shown to players</label><input className="input" dir="rtl" value={groupForm.nameAr}
            onChange={(e) => setGroupForm({ ...groupForm, nameAr: e.target.value })} /></div>
          <div><label className="label">Name (EN)</label><input className="input" value={groupForm.nameEn}
            onChange={(e) => setGroupForm({ ...groupForm, nameEn: e.target.value })} /></div>
          <div className="col-span-2 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setGroupOpen(false)}>Cancel</button>
            <button className="btn-primary"
              disabled={createGroup.isPending || !groupForm.slug.trim() || !groupForm.nameAr.trim() || !groupForm.nameEn.trim()}
              onClick={() => createGroup.mutate()}>Create group</button>
          </div>
          {createGroup.isError && <p className="col-span-2 text-danger">{(createGroup.error as Error).message}</p>}
        </div>
      )}

      {/* ── Add a category under a group ── */}
      {open && (
        <div className="card mb-6 grid grid-cols-2 gap-4 p-5">
          <div className="col-span-2">
            <label className="label">Group (الفئة الرئيسية) — where this category is filed</label>
            <select className="input" value={form.groupId}
              onChange={(e) => {
                const g = groups.find((x) => x.id === e.target.value);
                // A new category inherits its group's colour by default, like the seeded ones.
                setForm({ ...form, groupId: e.target.value, ...(g ? { color: g.color } : {}) });
              }}>
              <option value="">— No group (loose) —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.nameAr} — {g.nameEn} ({g._count?.categories ?? 0})</option>
              ))}
            </select>
          </div>
          <div><label className="label">Slug (permanent id)</label><input className="input" value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="football" /></div>
          <div><label className="label">Colour</label><ColorField value={form.color} onChange={(v) => setForm({ ...form, color: v })} /></div>
          <div><label className="label">Name (AR) — shown to players</label><input className="input" dir="rtl" value={form.nameAr}
            onChange={(e) => setForm({ ...form, nameAr: e.target.value })} /></div>
          <div><label className="label">Name (EN)</label><input className="input" value={form.nameEn}
            onChange={(e) => setForm({ ...form, nameEn: e.target.value })} /></div>
          <div className="col-span-2 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary"
              disabled={create.isPending || !form.slug.trim() || !form.nameAr.trim() || !form.nameEn.trim()}
              onClick={() => create.mutate()}>Save</button>
          </div>
          {create.isError && <p className="col-span-2 text-danger">{(create.error as Error).message}</p>}
        </div>
      )}

      {(save.isError || reorder.isError) && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {((save.error ?? reorder.error) as Error).message}
        </div>
      )}

      {/* ── Filters: search + one chip per group ── */}
      <div className="card mb-5 space-y-3 p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" dir="auto" placeholder="Search a category by Arabic name, English name or slug…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && (
            <button type="button" title="Clear" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setSearch('')}>
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={!groupFilter} color="#64748B" label="All groups" count={all.length} onClick={() => setGroupFilter('')} />
          {groups.map((g) => (
            <FilterChip key={g.id} active={groupFilter === g.id} color={g.color}
              label={g.nameAr} count={g._count?.categories ?? 0} onClick={() => setGroupFilter(g.id)} />
          ))}
          {ungroupedCount > 0 && (
            <FilterChip active={groupFilter === UNGROUPED} color="#94A3B8" label="No group"
              count={ungroupedCount} onClick={() => setGroupFilter(UNGROUPED)} />
          )}
        </div>
      </div>

      {!shown ? (
        <p className="card p-8 text-center text-slate-400">Nothing matches that filter.</p>
      ) : (
        <div className="space-y-5">
          {sections.map((section) => {
            const gi = section.group ? groups.findIndex((g) => g.id === section.group!.id) : -1;
            return (
            <div key={section.key} className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3"
                style={{ background: `${section.group?.color ?? '#94A3B8'}12` }}>
                {gi >= 0 && (
                  <span className="tnum me-1 grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white"
                    style={{ background: section.group!.color }} title="Order players see this group in">
                    {gi + 1}
                  </span>
                )}
                <Layers size={16} style={{ color: section.group?.color ?? '#94A3B8' }} />
                <span className="font-semibold" dir="auto">{section.group?.nameAr ?? 'No group'}</span>
                <span className="text-sm text-slate-400">{section.group?.nameEn ?? 'unfiled'}</span>
                {gi >= 0 && (
                  <span className="ms-3 flex gap-1">
                    <MoveBtn label="Move group up" disabled={gi === 0 || reorder.isPending}
                      onClick={() => reorder.mutate({ kind: 'category-groups', a: groups[gi]!, b: groups[gi - 1]!, dir: -1 })}>
                      <ChevronUp size={14} />
                    </MoveBtn>
                    <MoveBtn label="Move group down" disabled={gi === groups.length - 1 || reorder.isPending}
                      onClick={() => reorder.mutate({ kind: 'category-groups', a: groups[gi]!, b: groups[gi + 1]!, dir: 1 })}>
                      <ChevronDown size={14} />
                    </MoveBtn>
                  </span>
                )}
                <span className="tnum ms-auto text-sm text-slate-400">{section.items.length} categories</span>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-sm text-slate-500">
                  <tr>
                    <th className="p-3">Order</th>
                    <th className="p-3">Colour</th>
                    <th className="p-3">Slug</th>
                    <th className="p-3">Arabic (shown to players)</th>
                    <th className="p-3">English</th>
                    <th className="p-3">Group</th>
                    <th className="p-3">Bank ({TARGET_BANK_SIZE} target)</th>
                    <th className="p-3 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((c) => {
                    const ci = section.siblings.findIndex((s) => s.id === c.id);
                    return editId === c.id ? (
                      <tr key={c.id} className="border-t border-slate-100 bg-violet-50/40">
                        <td className="p-3 tnum text-slate-400">{ci + 1}</td>
                        <td className="p-3">
                          <ColorField value={draft.color} onChange={(v) => setDraft({ ...draft, color: v })} />
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
                        <td className="p-3">
                          <select className="input" value={draft.groupId} title="Move this category to another group"
                            onChange={(e) => setDraft({ ...draft, groupId: e.target.value })}>
                            <option value="">— No group —</option>
                            {groups.map((g) => <option key={g.id} value={g.id}>{g.nameAr}</option>)}
                          </select>
                        </td>
                        <td className="p-3"><BankBar count={c._count?.questions ?? 0} color={c.color} /></td>
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
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <span className="tnum w-5 text-slate-400">{ci + 1}</span>
                            <MoveBtn label="Move up" disabled={ci <= 0 || reorder.isPending}
                              onClick={() => reorder.mutate({ kind: 'categories', a: c, b: section.siblings[ci - 1]!, dir: -1 })}>
                              <ChevronUp size={14} />
                            </MoveBtn>
                            <MoveBtn label="Move down" disabled={ci < 0 || ci >= section.siblings.length - 1 || reorder.isPending}
                              onClick={() => reorder.mutate({ kind: 'categories', a: c, b: section.siblings[ci + 1]!, dir: 1 })}>
                              <ChevronDown size={14} />
                            </MoveBtn>
                          </div>
                        </td>
                        <td className="p-3"><span className="inline-block h-5 w-5 rounded" style={{ background: c.color }} /></td>
                        <td className="p-3 font-mono text-sm">{c.slug}</td>
                        <td className="p-3 font-semibold" dir="rtl">{c.nameAr}</td>
                        <td className="p-3">{c.nameEn}</td>
                        <td className="p-3 text-sm text-slate-500" dir="auto">{c.group?.nameAr ?? '—'}</td>
                        <td className="p-3"><BankBar count={c._count?.questions ?? 0} color={c.color} /></td>
                        <td className="p-3 text-right">
                          <button className="btn-ghost !px-3 !py-1.5 text-sm" onClick={() => startEdit(c)}>
                            <Pencil size={14} /> Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A square ↑/↓ nudge button used for both group and category ordering. */
function MoveBtn({ label, disabled, onClick, children }: {
  label: string; disabled: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-6 w-6 place-items-center rounded border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/**
 * How full this category's question bank is against the 500-per-category target.
 * The number is what the owner actually needs; the bar just makes the short banks
 * findable at a glance when scanning sixty rows.
 */
function BankBar({ count, color }: { count: number; color: string }) {
  const pct = Math.min(100, Math.round((count / TARGET_BANK_SIZE) * 100));
  return (
    <div className="min-w-[7rem]">
      <div className="tnum mb-1 text-sm text-slate-600">
        {count}
        <span className="text-slate-400"> / {TARGET_BANK_SIZE}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: count ? color : '#E2E8F0' }} />
      </div>
    </div>
  );
}

function FilterChip({ active, color, label, count, onClick }: {
  active: boolean; color: string; label: string; count: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      dir="auto"
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
        active ? 'border-transparent font-semibold text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
      style={active ? { background: color } : undefined}
    >
      {!active && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
      <span>{label}</span>
      <span className={`tnum text-xs ${active ? 'text-white/75' : 'text-slate-400'}`}>{count}</span>
    </button>
  );
}
