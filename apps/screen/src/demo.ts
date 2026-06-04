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

export function startDemoBots(roomCode: string, count: number): Socket[] {
  const bots: Socket[] = [];
  for (let i = 0; i < count; i++) {
    const sock = io(`${API_URL}/play`, { transports: ['websocket'], auth: { roomCode } });

    sock.on('connect', () => {
      sock.emit(
        'player:join',
        { nickname: botName(i), avatarId: AVATARS[i % AVATARS.length]!.id },
        () => {},
      );
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
