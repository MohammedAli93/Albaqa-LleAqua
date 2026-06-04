import { describe, it, expect } from 'vitest';
import { SeenJeemPhase, Lifeline, SEEN_JEEM, AppError } from '@tahaddi/shared';
import type { LiveSeenJeem, SJCategory, SJCell } from '../src/domain/rooms/types.js';
import {
  initSeenJeem,
  currentDraftTeam,
  pickCategory,
  buildBoard,
  buildCategoryCells,
  remainingForTeam,
  remainingCells,
  selectCell,
  useLifeline,
  recordAnswer,
  assertAnswerable,
  resolveCell,
  evaluateWinner,
} from '../src/domain/game/seenjeem.js';

const TEAMS: [string, string] = ['A', 'B'];

function makeCategories(): SJCategory[] {
  return Array.from({ length: SEEN_JEEM.CATEGORIES_ON_BOARD }, (_, i) => ({
    categoryId: `cat${i}`,
    nameAr: `فئة ${i}`,
    color: '#7C3AED',
  }));
}

const idFor = (cat: string, points: number, slot: number) => `${cat}-${points}-${slot}`;

/** Run the alternating draft to completion and install the board. */
function draftedGame(): {
  sj: LiveSeenJeem;
  teams: { A: { score: number }; B: { score: number } };
} {
  const sj = initSeenJeem(TEAMS, makeCategories(), 'A');
  // A,B,A,B,A,B → A owns cat0,2,4 ; B owns cat1,3,5
  const order = ['cat0', 'cat1', 'cat2', 'cat3', 'cat4', 'cat5'];
  order.forEach((catId, i) => pickCategory(sj, i % 2 === 0 ? 'A' : 'B', catId));

  const cells: SJCell[] = [];
  for (const cat of sj.categories) {
    const pool = Array.from({ length: 6 }, (_, k) => ({
      questionId: `${cat.categoryId}-q${k}`,
      correctOptionId: 'a',
    }));
    cells.push(...buildCategoryCells(cat.categoryId, pool, idFor));
  }
  buildBoard(sj, cells);
  return { sj, teams: { A: { score: 0 }, B: { score: 0 } } };
}

// ───────────────────────────────── init / draft ─────────────────────────────

describe('initSeenJeem', () => {
  it('builds an alternating draft order starting from firstTeam', () => {
    const sj = initSeenJeem(TEAMS, makeCategories(), 'B');
    expect(sj.draftOrder).toEqual(['B', 'A', 'B', 'A', 'B', 'A']);
    expect(sj.phase).toBe(SeenJeemPhase.DRAFT);
    expect(sj.turnTeamId).toBe('B');
  });

  it('grants all three lifelines to both teams', () => {
    const sj = initSeenJeem(TEAMS, makeCategories(), 'A');
    for (const t of TEAMS) {
      expect(sj.lifelines[t]).toEqual({ CALL_FRIEND: true, DISCARD: true, DOUBLE: true });
    }
  });

  it('rejects the wrong number of categories', () => {
    expect(() => initSeenJeem(TEAMS, makeCategories().slice(0, 5), 'A')).toThrow(AppError);
  });

  it('rejects a firstTeam that is not playing', () => {
    expect(() => initSeenJeem(TEAMS, makeCategories(), 'Z')).toThrow(AppError);
  });
});

describe('pickCategory', () => {
  it('enforces draft turn order', () => {
    const sj = initSeenJeem(TEAMS, makeCategories(), 'A');
    expect(() => pickCategory(sj, 'B', 'cat0')).toThrow(/Not your pick/);
  });

  it('rejects an already-taken category', () => {
    const sj = initSeenJeem(TEAMS, makeCategories(), 'A');
    pickCategory(sj, 'A', 'cat0');
    expect(() => pickCategory(sj, 'B', 'cat0')).toThrow(/already taken/);
  });

  it('assigns three categories to each team and signals completion', () => {
    const sj = initSeenJeem(TEAMS, makeCategories(), 'A');
    const order = ['cat0', 'cat1', 'cat2', 'cat3', 'cat4'];
    order.forEach((c, i) => {
      const res = pickCategory(sj, i % 2 === 0 ? 'A' : 'B', c);
      expect(res.complete).toBe(false);
    });
    const last = pickCategory(sj, 'B', 'cat5');
    expect(last.complete).toBe(true);
    expect(currentDraftTeam(sj)).toBeUndefined();
    expect(sj.categories.filter((c) => c.ownerTeamId === 'A')).toHaveLength(3);
    expect(sj.categories.filter((c) => c.ownerTeamId === 'B')).toHaveLength(3);
  });
});

describe('buildCategoryCells', () => {
  it('produces 6 cells across the point tiers', () => {
    const pool = Array.from({ length: 6 }, (_, k) => ({ questionId: `q${k}`, correctOptionId: 'a' }));
    const cells = buildCategoryCells('cat0', pool, idFor);
    expect(cells).toHaveLength(6);
    expect(cells.map((c) => c.points).sort((a, b) => a - b)).toEqual([200, 200, 400, 400, 600, 600]);
  });

  it('round-robins a short pool so the board always fills', () => {
    const cells = buildCategoryCells('cat0', [{ questionId: 'only', correctOptionId: 'a' }], idFor);
    expect(cells).toHaveLength(6);
    expect(cells.every((c) => c.questionId === 'only')).toBe(true);
  });

  it('rejects an empty pool', () => {
    expect(() => buildCategoryCells('cat0', [], idFor)).toThrow(AppError);
  });
});

describe('buildBoard', () => {
  it('moves to SELECT with the first-drafting team on turn', () => {
    const { sj } = draftedGame();
    expect(sj.phase).toBe(SeenJeemPhase.SELECT);
    expect(sj.turnTeamId).toBe('A');
    expect(sj.board).toHaveLength(36);
    expect(remainingForTeam(sj, 'A')).toHaveLength(18);
    expect(remainingForTeam(sj, 'B')).toHaveLength(18);
  });

  it('refuses to build before the draft is complete', () => {
    const sj = initSeenJeem(TEAMS, makeCategories(), 'A');
    expect(() => buildBoard(sj, [])).toThrow(/Draft not complete/);
  });
});

// ──────────────────────────────── cell selection ────────────────────────────

describe('selectCell', () => {
  it('opens a cell owned by the team on turn', () => {
    const { sj } = draftedGame();
    const cell = remainingForTeam(sj, 'A')[0]!;
    selectCell(sj, 'A', cell.cellId, 1000, 1000 + 45_000);
    expect(sj.phase).toBe(SeenJeemPhase.ANSWERING);
    expect(sj.active?.cellId).toBe(cell.cellId);
    expect(sj.active?.answeringTeamId).toBe('A');
  });

  it('rejects selecting out of turn', () => {
    const { sj } = draftedGame();
    const bCell = remainingForTeam(sj, 'B')[0]!;
    expect(() => selectCell(sj, 'B', bCell.cellId, 0, 1)).toThrow(/Not your turn/);
  });

  it('rejects selecting a cell on the opponent board', () => {
    const { sj } = draftedGame();
    const bCell = remainingForTeam(sj, 'B')[0]!;
    expect(() => selectCell(sj, 'A', bCell.cellId, 0, 1)).toThrow(/not on your board/);
  });
});

// ─────────────────────────────────── lifelines ──────────────────────────────

describe('useLifeline', () => {
  function openCell() {
    const { sj, teams } = draftedGame();
    const cell = remainingForTeam(sj, 'A')[0]!;
    selectCell(sj, 'A', cell.cellId, 1000, 1000 + 45_000);
    return { sj, teams, cell };
  }

  it('CALL_FRIEND extends the answer window', () => {
    const { sj } = openCell();
    const before = sj.active!.endsAt;
    const eff = useLifeline(sj, 'A', Lifeline.CALL_FRIEND, {});
    expect(eff.lifeline).toBe(Lifeline.CALL_FRIEND);
    expect(sj.active!.endsAt).toBe(before + SEEN_JEEM.CALL_FRIEND_EXTRA_SEC * 1000);
    expect(sj.lifelines.A!.CALL_FRIEND).toBe(false);
  });

  it('DISCARD removes two wrong options deterministically', () => {
    const { sj } = openCell();
    const eff = useLifeline(sj, 'A', Lifeline.DISCARD, {
      optionIds: ['a', 'b', 'c', 'd'],
      correctOptionId: 'a',
    });
    expect(eff).toEqual({ lifeline: Lifeline.DISCARD, removedOptionIds: ['b', 'c'] });
    expect(sj.active!.removedOptionIds).toEqual(['b', 'c']);
  });

  it('DOUBLE marks the stake doubled', () => {
    const { sj } = openCell();
    useLifeline(sj, 'A', Lifeline.DOUBLE, {});
    expect(sj.active!.doubled).toBe(true);
  });

  it('rejects a lifeline used twice', () => {
    const { sj } = openCell();
    useLifeline(sj, 'A', Lifeline.DOUBLE, {});
    expect(() => useLifeline(sj, 'A', Lifeline.DOUBLE, {})).toThrow(/already used/);
  });

  it('rejects the non-answering team spending a lifeline', () => {
    const { sj } = openCell();
    expect(() => useLifeline(sj, 'B', Lifeline.DOUBLE, {})).toThrow(/Not your question/);
  });
});

// ──────────────────────────────── answer / resolve ──────────────────────────

describe('assertAnswerable', () => {
  it('rejects a stale cell and a closed window', () => {
    const { sj } = draftedGame();
    const cell = remainingForTeam(sj, 'A')[0]!;
    selectCell(sj, 'A', cell.cellId, 1000, 5000);
    expect(() => assertAnswerable(sj, 'A', 'nope', 2000)).toThrow(/Stale cell/);
    expect(() => assertAnswerable(sj, 'A', cell.cellId, 9999)).toThrow(/window closed/);
    expect(() => assertAnswerable(sj, 'A', cell.cellId, 2000)).not.toThrow();
  });
});

describe('recordAnswer', () => {
  it('keeps the first submission (idempotent)', () => {
    const { sj } = draftedGame();
    const cell = remainingForTeam(sj, 'A')[0]!;
    selectCell(sj, 'A', cell.cellId, 0, 9_999);
    recordAnswer(sj, 'a');
    recordAnswer(sj, 'b');
    expect(sj.active!.selectedOptionId).toBe('a');
  });
});

describe('resolveCell', () => {
  it('awards the cell value on a correct answer and passes the turn', () => {
    const { sj, teams } = draftedGame();
    const cell = remainingForTeam(sj, 'A').find((c) => c.points === 400)!;
    selectCell(sj, 'A', cell.cellId, 0, 9_999);
    recordAnswer(sj, 'a');
    const res = resolveCell(sj, teams, true);
    expect(res.pointsAwarded).toBe(400);
    expect(teams.A.score).toBe(400);
    expect(res.nextTeamId).toBe('B');
    expect(sj.turnTeamId).toBe('B');
    expect(sj.phase).toBe(SeenJeemPhase.SELECT);
    expect(cell.consumed).toBe(true);
  });

  it('doubles the award when DOUBLE was spent', () => {
    const { sj, teams } = draftedGame();
    const cell = remainingForTeam(sj, 'A').find((c) => c.points === 600)!;
    selectCell(sj, 'A', cell.cellId, 0, 9_999);
    useLifeline(sj, 'A', Lifeline.DOUBLE, {});
    const res = resolveCell(sj, teams, true);
    expect(res.pointsAwarded).toBe(1200);
    expect(teams.A.score).toBe(1200);
  });

  it('awards nothing on a wrong answer but still consumes the cell', () => {
    const { sj, teams } = draftedGame();
    const cell = remainingForTeam(sj, 'A')[0]!;
    selectCell(sj, 'A', cell.cellId, 0, 9_999);
    const res = resolveCell(sj, teams, false);
    expect(res.pointsAwarded).toBe(0);
    expect(teams.A.score).toBe(0);
    expect(cell.consumed).toBe(true);
  });
});

// ──────────────────────────── full playthrough ──────────────────────────────

describe('full game', () => {
  it('plays all 36 cells, ends COMPLETE, and crowns the higher score', () => {
    const { sj, teams } = draftedGame();
    let guard = 0;
    while (sj.phase !== SeenJeemPhase.COMPLETE) {
      if (guard++ > 100) throw new Error('did not terminate');
      const team = sj.turnTeamId;
      const cell = remainingForTeam(sj, team)[0]!;
      selectCell(sj, team, cell.cellId, 0, 9_999);
      recordAnswer(sj, 'a');
      // Team A answers everything correctly; B always wrong.
      resolveCell(sj, teams, team === 'A');
    }
    expect(remainingCells(sj)).toHaveLength(0);
    // Each owned board = 3 × (200+200+400+400+600+600) = 7200.
    expect(teams.A.score).toBe(7200);
    expect(teams.B.score).toBe(0);

    const win = evaluateWinner(sj, teams);
    expect(win.tie).toBe(false);
    expect(win.winnerTeamId).toBe('A');
  });

  it('reports a tie when scores are equal', () => {
    const { sj, teams } = draftedGame();
    teams.A.score = 3000;
    teams.B.score = 3000;
    const win = evaluateWinner(sj, teams);
    expect(win.tie).toBe(true);
    expect(win.winnerTeamId).toBeUndefined();
  });
});
