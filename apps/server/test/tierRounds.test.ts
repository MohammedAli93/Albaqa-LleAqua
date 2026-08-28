/**
 * Round counts per tier + format (client 2026-08-28).
 *   - FREE is the fixed 15-question trial in EVERY format — points, elimination
 *     and teams alike — and never widens into the paid bank.
 *   - PAID differs per format: individual points 35, teams 15, elimination plays
 *     on to the last survivor (its number is only the scripted minimum).
 */
import { describe, it, expect } from 'vitest';
import {
  GameType,
  GameMode,
  GameTier,
  TIER_ROUNDS,
  TEAM_ROUNDS,
  roundsForGame,
  roundsCopyAr,
} from '@tahaddi/shared';

describe('roundsForGame', () => {
  it('gives every FREE format the same fixed 15-question trial', () => {
    for (const [type, mode] of [
      [GameType.INDIVIDUAL, GameMode.POINTS],
      [GameType.INDIVIDUAL, GameMode.ELIMINATION],
      [GameType.TEAMS, GameMode.POINTS],
    ] as const) {
      expect(roundsForGame(type, mode, GameTier.FREE)).toBe(TIER_ROUNDS.FREE);
      expect(roundsForGame(type, mode, GameTier.FREE)).toBe(15);
    }
  });

  it('gives a PAID individual points game 35 rounds', () => {
    expect(roundsForGame(GameType.INDIVIDUAL, GameMode.POINTS, GameTier.PAID)).toBe(35);
  });

  it('gives a PAID team game 15 rounds, not 35', () => {
    expect(roundsForGame(GameType.TEAMS, GameMode.POINTS, GameTier.PAID)).toBe(TEAM_ROUNDS);
    expect(roundsForGame(GameType.TEAMS, GameMode.POINTS, GameTier.PAID)).toBe(15);
  });

  it('scripts a PAID elimination game to 15 (it plays on to the last survivor)', () => {
    expect(roundsForGame(GameType.INDIVIDUAL, GameMode.ELIMINATION, GameTier.PAID)).toBe(15);
  });
});

describe('roundsCopyAr', () => {
  it('describes each format the way the client asked', () => {
    expect(roundsCopyAr(GameType.INDIVIDUAL, GameMode.POINTS)).toBe('٣٥ جولة');
    expect(roundsCopyAr(GameType.TEAMS, GameMode.POINTS)).toBe('١٥ جولة');
    expect(roundsCopyAr(GameType.INDIVIDUAL, GameMode.ELIMINATION)).toBe('تستمر حتى يبقى لاعب واحد');
  });
});
