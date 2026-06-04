/**
 * Socket load test — simulates a full game with N concurrent players to validate
 * the < 100ms / 100-player target (doc 09 §3). Run against a live server.
 *
 *   node infra/scripts/loadtest.js --players 100 --api http://localhost:8080 \
 *        --package <packageId>
 *
 * It: creates a room over REST, connects `players` controllers, joins them,
 * starts the game via a host socket, answers every question, and reports the
 * p50/p95/p99 answer-ack latency plus error counts.
 *
 * Requires: `npm i socket.io-client` (already a server devDependency).
 */
import { io } from 'socket.io-client';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const API = args.api ?? 'http://localhost:8080';
const PLAYERS = Number(args.players ?? 100);

const latencies = [];
let errors = 0;

async function rest(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message ?? 'rest failed');
  return json.data;
}

function pctile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function main() {
  const packageId = args.package ?? (await rest('/api/v1/packages/public')).packages[0]?.id;
  if (!packageId) throw new Error('No package available — run the seed');

  const settings = {
    mode: 'INDIVIDUAL', maxPlayers: 100, minPlayers: 2, questionTimerSec: 8,
    livesPerPlayer: 99, speedBonus: true, intermissionSec: 1, autoAdvance: true, totalRounds: 5,
  };
  const room = await rest('/api/v1/rooms', { packageId, settings });
  console.log(`Room ${room.roomCode} created. Connecting ${PLAYERS} players…`);

  // Players
  const players = await Promise.all(
    Array.from({ length: PLAYERS }, (_, i) =>
      new Promise((resolve) => {
        const sock = io(`${API}/play`, { transports: ['websocket'], auth: { roomCode: room.roomCode } });
        sock.on('connect', () => {
          sock.emit('player:join', { nickname: `Bot${i}`, avatarId: 'falcon' }, (res) => {
            if (!res?.ok) errors++;
            resolve(sock);
          });
        });
        sock.on('question:show', (q) => {
          const optionId = q.question.options[i % q.question.options.length].id;
          const t0 = performance.now();
          sock.emit('player:answer', { roundId: q.roundId, optionId, clientTs: Date.now() }, (res) => {
            latencies.push(performance.now() - t0);
            if (!res?.ok) errors++;
          });
        });
        sock.on('connect_error', () => { errors++; resolve(sock); });
      }),
    ),
  );
  console.log(`Connected ${players.length}. Starting game…`);

  // Host starts the game.
  const host = io(`${API}/screen`, { transports: ['websocket'], auth: { hostToken: room.hostToken, roomCode: room.roomCode } });
  await new Promise((r) => host.on('connect', r));

  const done = new Promise((resolve) => host.on('game:completed', resolve));
  host.emit('game:start', {}, (res) => { if (!res?.ok) errors++; });

  await done;
  console.log('\n── Results ──');
  console.log(`answers measured : ${latencies.length}`);
  console.log(`errors           : ${errors}`);
  console.log(`ack p50          : ${pctile(latencies, 50).toFixed(1)} ms`);
  console.log(`ack p95          : ${pctile(latencies, 95).toFixed(1)} ms`);
  console.log(`ack p99          : ${pctile(latencies, 99).toFixed(1)} ms`);

  players.forEach((s) => s.close());
  host.close();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
