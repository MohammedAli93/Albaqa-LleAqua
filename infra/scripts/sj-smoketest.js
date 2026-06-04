/**
 * Seen-Jeem live smoke test — plays a FULL turn-based board game against a running
 * server (REST + Socket.IO), with two bot players reacting to the live board.
 *
 *   node infra/scripts/sj-smoketest.js --api http://localhost:8080
 *
 * Requires the stack up (pnpm infra:up && pnpm db:migrate && pnpm db:seed) and a
 * published package spanning ≥6 categories. It:
 *   1. creates a SEEN_JEEM room over REST,
 *   2. connects two controllers + a host, joins, starts,
 *   3. each bot drafts / picks / answers / spends a lifeline on its own turn,
 *   4. prints the final winner + scores.
 *
 * Each team has one bot here, so there is no intra-team race; a bot acts only on
 * its turn and only once per board state (guarded by a fingerprint).
 */
import { io } from 'socket.io-client';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const API = args.api ?? 'http://localhost:8080';

async function rest(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message ?? `REST ${path} failed`);
  return json.data;
}

const log = (...a) => console.log(...a);

function makeBot(roomCode, index) {
  const sock = io(`${API}/play`, { transports: ['websocket'], auth: { roomCode } });
  const bot = { sock, participantId: null, teamId: null, lastFingerprint: '', usedLifeline: false };

  sock.on('connect', () => {
    sock.emit('player:join', { nickname: `Bot${index}`, avatarId: 'falcon' }, (res) => {
      if (res?.ok) bot.participantId = res.data.participantId;
      else log(`Bot${index} join failed:`, res?.error);
    });
  });

  // Learn our team from the full snapshot.
  sock.on('room:state', (snap) => {
    const me = snap.participants?.find((p) => p.id === bot.participantId);
    if (me?.teamId) bot.teamId = me.teamId;
    if (snap.seenJeem) act(bot, snap.seenJeem, index);
  });
  // React to every board mutation.
  sock.on('sj:state', (sj) => act(bot, sj, index));
  return bot;
}

/** Decide and perform this bot's move for the current board state (idempotent). */
function act(bot, sj, index) {
  if (!bot.teamId) return;
  const fp = `${sj.phase}:${sj.turnTeamId}:${sj.draftPickTeamId ?? ''}:${sj.active?.cellId ?? ''}`;
  if (fp === bot.lastFingerprint) return; // already acted on this state

  if (sj.phase === 'DRAFT' && sj.draftPickTeamId === bot.teamId) {
    const open = sj.categories.find((c) => !c.ownerTeamId);
    if (open) {
      bot.lastFingerprint = fp;
      bot.sock.emit('sj:draft:pick', { categoryId: open.categoryId }, ack(index, 'draft'));
    }
  } else if (sj.phase === 'SELECT' && sj.turnTeamId === bot.teamId) {
    const owned = new Set(sj.categories.filter((c) => c.ownerTeamId === bot.teamId).map((c) => c.categoryId));
    const cell = sj.board.find((c) => owned.has(c.categoryId) && !c.consumed);
    if (cell) {
      bot.lastFingerprint = fp;
      bot.sock.emit('sj:cell:select', { cellId: cell.cellId }, ack(index, 'select'));
    }
  } else if (sj.phase === 'ANSWERING' && sj.active?.answeringTeamId === bot.teamId) {
    bot.lastFingerprint = fp;
    const answer = () => {
      const opt = sj.active.question.options[0]; // bot always answers the first option
      bot.sock.emit('sj:team:answer', { cellId: sj.active.cellId, optionId: opt.id }, ack(index, 'answer'));
    };
    // Spend DOUBLE once, then answer shortly after.
    if (!bot.usedLifeline) {
      bot.usedLifeline = true;
      bot.sock.emit('sj:lifeline:use', { lifeline: 'DOUBLE' }, ack(index, 'lifeline'));
    }
    setTimeout(answer, 150);
  }
}

const ack = (index, what) => (res) => {
  if (!res?.ok) log(`Bot${index} ${what} rejected:`, res?.error?.code ?? res?.error?.message);
};

async function main() {
  const packageId = args.package ?? (await rest('/api/v1/packages/public')).packages[0]?.id;
  if (!packageId) throw new Error('No published package — run the seed');

  const settings = {
    mode: 'SEEN_JEEM', maxPlayers: 100, minPlayers: 2, questionTimerSec: 45,
    livesPerPlayer: 1, speedBonus: false, intermissionSec: 2, autoAdvance: true, totalRounds: null,
  };
  const room = await rest('/api/v1/rooms', { packageId, settings });
  log(`Seen-Jeem room ${room.roomCode} created. Connecting bots…`);

  const bots = [makeBot(room.roomCode, 0), makeBot(room.roomCode, 1)];

  const host = io(`${API}/screen`, { transports: ['websocket'], auth: { hostToken: room.hostToken, roomCode: room.roomCode } });
  await new Promise((r) => host.on('connect', r));

  const done = new Promise((resolve) => host.on('game:completed', resolve));
  // Give the bots a moment to join, then start.
  setTimeout(() => host.emit('game:start', {}, (res) => { if (!res?.ok) log('start failed:', res?.error); }), 1500);

  const result = await done;
  log('\n── Result ──');
  log('winner team :', result.winnerTeam ? `${result.winnerTeam.name} (${result.winnerTeam.score})` : 'tie');
  log('rounds      :', result.stats.totalRounds);
  log('duration    :', result.stats.durationSec, 's');

  bots.forEach((b) => b.sock.close());
  host.close();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
