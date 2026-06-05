import { describe, it, expect } from 'vitest';
import {
  QuestionInputSchema,
  GameSettingsSchema,
  PlayerAnswerSchema,
  isValidAvatarId,
} from '@tahaddi/shared';

describe('QuestionInputSchema', () => {
  const base = {
    type: 'MULTIPLE_CHOICE',
    difficulty: 'EASY',
    categoryId: '11111111-1111-1111-1111-111111111111',
    promptAr: 'سؤال',
    options: [
      { id: 'a', textAr: 'أ' },
      { id: 'b', textAr: 'ب' },
    ],
    correctOptionId: 'a',
  };

  it('accepts a valid question', () => {
    expect(QuestionInputSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a correctOptionId not present in options (anti-misconfig)', () => {
    const r = QuestionInputSchema.safeParse({ ...base, correctOptionId: 'z' });
    expect(r.success).toBe(false);
  });

  it('rejects fewer than two options', () => {
    const r = QuestionInputSchema.safeParse({ ...base, options: [{ id: 'a', textAr: 'أ' }] });
    expect(r.success).toBe(false);
  });
});

describe('GameSettingsSchema', () => {
  const valid = {
    type: 'INDIVIDUAL', mode: 'POINTS', maxPlayers: 50, minPlayers: 2, questionTimerSec: 15,
    livesPerPlayer: 1, speedBonus: true, intermissionSec: 5, autoAdvance: true, totalRounds: null,
  };
  it('accepts valid settings', () => {
    expect(GameSettingsSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects minPlayers > maxPlayers', () => {
    expect(GameSettingsSchema.safeParse({ ...valid, minPlayers: 60 }).success).toBe(false);
  });
  it('rejects out-of-range player counts', () => {
    expect(GameSettingsSchema.safeParse({ ...valid, maxPlayers: 500 }).success).toBe(false);
  });
  it('requires teamCount + playersPerTeam for TEAMS games', () => {
    expect(GameSettingsSchema.safeParse({ ...valid, type: 'TEAMS' }).success).toBe(false);
    expect(
      GameSettingsSchema.safeParse({ ...valid, type: 'TEAMS', teamCount: 2, playersPerTeam: 3 })
        .success,
    ).toBe(true);
  });
});

describe('PlayerAnswerSchema', () => {
  it('requires roundId and optionId', () => {
    expect(PlayerAnswerSchema.safeParse({ clientTs: 1 }).success).toBe(false);
    expect(PlayerAnswerSchema.safeParse({ roundId: 'r', optionId: 'a', clientTs: 1 }).success).toBe(true);
  });
});

describe('avatar catalogue', () => {
  it('validates known/unknown avatar ids', () => {
    expect(isValidAvatarId('falcon')).toBe(true);
    expect(isValidAvatarId('not-real')).toBe(false);
  });
});
