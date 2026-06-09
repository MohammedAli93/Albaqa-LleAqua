/**
 * Demo / attract mode. Spawns simulated bot players that join the host's room and
 * auto-answer each round, so the full game flow can be previewed on the Main Screen
 * without real phones. Activated via `?demo=N` (see App.tsx). Bots are real /play
 * socket connections — they know nothing the real client doesn't (the correct
 * answer is never sent to them), so they answer randomly, producing genuine
 * eliminations and a winner.
 */
import { io, type Socket } from 'socket.io-client';
import { AVATARS } from '@tahaddi/shared';
import { API_URL } from './lib/config.js';

const NAMES = [
  'سارة', 'عمر', 'لينا', 'زيد', 'مايا', 'يوسف', 'هنا', 'كريم',
  'نورا', 'طارق', 'دانة', 'فارس', 'ريم', 'سامي', 'جود', 'ليان',
];

function botName(i: number): string {
  return i < NAMES.length ? NAMES[i]! : `لاعب ${i + 1}`;
}

type TeamLite = { id: string; capacity?: number; memberIds: string[] };

export function startDemoBots(roomCode: string, count: number): Socket[] {
  const bots: Socket[] = [];
  for (let i = 0; i < count; i++) {
    const sock = io(`${API_URL}/play`, { transports: ['websocket'], auth: { roomCode } });
    let pickedTeam = false;

    sock.on('connect', () => {
      sock.emit(
        'player:join',
        { nickname: botName(i), avatarId: AVATARS[i % AVATARS.length]!.id },
        () => {},
      );
    });

    // TEAMS lobby: each bot claims a seat, distributed across the teams. Tries the
    // next team if its first pick is full, so all teams fill evenly.
    sock.on('room:state', (snap: { game?: { type?: string }; teams?: TeamLite[] }) => {
      if (pickedTeam) return;
      if (snap.game?.type !== 'TEAMS' || !snap.teams?.length) return;
      pickedTeam = true;
      const teams = snap.teams;
      const order = teams.map((_, k) => teams[(i + k) % teams.length]!);
      const tryPick = (idx: number) => {
        if (idx >= order.length) return;
        sock.emit(
          'player:pickTeam',
          { teamId: order[idx]!.id },
          (res: { ok: boolean }) => { if (!res?.ok) tryPick(idx + 1); },
        );
      };
      tryPick(0);
    });

    // Answer each question after a human-ish random delay (staggered for nice viz).
    sock.on('question:show', (q: { roundId: string; question: { options: { id: string }[] } }) => {
      const delay = 500 + Math.random() * 3200;
      window.setTimeout(() => {
        const opts = q.question.options;
        const optionId = opts[Math.floor(Math.random() * opts.length)]!.id;
        sock.emit('player:answer', { roundId: q.roundId, optionId, clientTs: Date.now() }, () => {});
      }, delay);
    });

    bots.push(sock);
  }
  return bots;
}

export function stopDemoBots(bots: Socket[]): void {
  bots.forEach((b) => b.close());
}
