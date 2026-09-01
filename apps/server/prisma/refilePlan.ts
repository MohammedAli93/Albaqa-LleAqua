/**
 * The 2026-09-01 refile plan — data for `refileBank.ts`.
 *
 * The client played every paid format to the end of their balance and reported, in
 * their words, «عدم دقة تصنيف بعض الأسئلة داخل الفئات», with twelve examples. Every
 * one of them turned out to be the same failure: a category file that had been bulk-
 * topped-up from a neighbouring subject to reach the 350-question target, so
 * «الفن الخليجي» ended up holding Gulf bread, men's dress, falconry, folk board
 * games, the Taif rose and Arabic literary prizes, and «فنانون عرب وأجانب» ended up
 * holding a national anthem, the Prado and the Jerash festival.
 *
 * The lists below were derived, not guessed: each source category was scanned for
 * questions carrying none of its own subject's vocabulary (see `auditFit.ts` for the
 * same idea as a standing gate), and the survivors of that scan were read one by one
 * and given a destination. A question is only ever MOVED — the content is fine, the
 * shelf was wrong — except where it duplicates one that stays, or where the client
 * called the question itself out as unsound.
 *
 * INDICES ARE POSITIONS IN THE BANK ARRAY AS OF THE RUN THAT APPLIED THIS PLAN.
 * They are not stable afterwards. This file is kept for the record; do not re-run it.
 */
import type { BankQuestion } from './bank/types.js';

/**
 * PASS 1 — APPLIED 2026-09-01. Kept as the record of what moved and why; the tool
 * refuses to re-run it (the indices no longer point at the same questions), so the
 * lists are commented out of the export below and live on in `APPLIED_PASS_1`.
 */
const APPLIED_PASS_1: Record<string, Record<string, number[]>> = {
  // «الفن الخليجي» is Gulf art & music. Everything below is Gulf *life* — food,
  // dress, jewellery, falconry, folk games, forts, mosques, farm produce, book
  // prizes — filed here to pad the count. Client examples: خبز الرقاق، اللباس
  // الرجالي، الحي التاريخي في دبي، ورد الطائف، مركز إثراء، جائزة الملك فيصل.
  'art-gulf': {
    // Traditional Gulf/Arab living culture → «التراث العربي».
    'heritage-arab': [
      36, 37, 39, 41, 98, 99, 100, 101, 102, 103, 104, 105, 109, 111, 112, 113, 114,
      115, 118, 119, 120, 121, 122, 125, 126, 127, 128, 129, 130, 131, 133, 134, 135,
      137, 138, 197, 198, 200,
    ],
    // Gulf places and institutions (forts, historic quarters, mosques, souks,
    // islands, cultural districts) → «الخليج العربي».
    gulf: [38, 83, 84, 85, 86, 117, 123, 124, 155, 236, 238, 239, 240, 241, 273, 274, 275],
    // Saudi-specific traditions and produce → «التراث السعودي».
    heritage: [70, 71, 77, 78, 80, 256, 257, 258, 259, 260, 261, 262],
    // Saudi places and museums → «معالم ومدن المملكة».
    'saudi-landmarks': [82, 144, 187, 188, 189, 190, 235, 244, 245, 246, 255],
    // The Hijaz railway is Ottoman history, not art.
    history: [252, 253, 254],
    // Darb Zubaydah is an Abbasid pilgrim road.
    'islamic-history': [250, 251],
    // Literary prizes, cultural magazines and a folk legend → «الأدب واللغة العربية».
    'arabic-literature': [146, 149, 150, 151, 152, 153, 185],
    // Mahmoud Mokhtar (Egyptian sculptor) and a pan-Arab operetta are artists, but
    // they are not GULF art.
    artists: [173, 207, 208, 209],
  },

  // «التراث السعودي» had picked up pan-Gulf and Emirati/Omani/Bahraini/Kuwaiti
  // heritage. Client: «ظهور سؤال عن العطر التقليدي الأشهر في الخليج ضمن التراث
  // السعودي، رغم أن السؤال خليجي عام».
  heritage: {
    'heritage-arab': [
      52, 214, 377, 378, 381, 385, 387, 388, 389, 390, 391, 396, 399, 402, 403, 404,
      406, 412, 416, 418, 419, 427,
    ],
  },

  // «فنانون عرب وأجانب» is about artists — people and their work. Anthems, museums,
  // festivals, souks, dress, and non-art figures (scientists, footballers,
  // astronauts, a resistance leader) belong elsewhere. Client examples: النشيد
  // الوطني، متحف برادو، مهرجان جرش.
  artists: {
    general: [35], // "what is a national anthem" — a definition, not an artist
    'arab-world': [54, 55, 144], // Baalbek / Jerash festivals, Al Jazeera's HQ
    'heritage-arab': [63, 70], // Hamidiyah souk, the Palestinian embroidered thobe
    history: [116], // Omar Mukhtar
    'scientists-inventors': [118, 120, 123, 124, 125, 127, 128, 146],
    space: [130, 131, 132], // Arab astronauts
    'football-arab': [136, 137, 138, 139],
    'world-landmarks': [329, 330, 331], // the Prado / Hermitage / Uffizi buildings
  },

  // «السينما والدراما الخليجية» had Egyptian and Levantine TV, Lebanese and Jordanian
  // festivals, and four questions about the Palestinian singer Mohammed Assaf — the
  // client read the last of those as a Gulf-art misfile, and they were right.
  'cinema-gulf': {
    'movies-series': [147, 291, 306],
    'arab-world': [264, 265, 266, 267, 268],
    artists: [290, 292],
  },

  // Two Arab-music instrument questions sitting in «التراث العربي».
  'heritage-arab': {
    artists: [73],
  },

  // «الأنبياء والرسل» absorbed the old islamic-culture bank (the client's own 2026-08-07
  // merge). Caliphate-era history inside it is a category error the merge didn't intend.
  'islamic-culture': {
    'islamic-history': [201, 238, 241, 278, 279, 311],
  },
};

/** Pass 1 is applied; nothing index-keyed is pending. */
export const MOVES: Record<string, Record<string, number[]>> = {};

/**
 * PASS 2 — the misfiles that only became visible once the tightened `auditFit.ts`
 * rules ran over the refiled bank. Prompt-keyed, which is the shape to prefer:
 * a prompt still identifies its question after any number of earlier passes.
 */
export const MOVES_BY_PROMPT: Record<string, Record<string, string[]>> = {
  'art-gulf': {
    'heritage-arab': [
      'من أي شجرة يُستخرج العود العطري؟',
      'من أي منطقة يأتي البن الخولاني في السعودية؟',
      'ما اسم العام الذي خصّصته السعودية للاحتفاء بالقهوة؟',
      'ما اسم المهرجان السعودي الذي يحتفي بالبن؟',
      'ما اسم أكبر سفينة خشبية تقليدية بُنيت في الكويت؟',
    ],
    'arabic-literature': [
      'ما اسم المجلة الثقافية السعودية الصادرة عن دارة الملك عبدالعزيز؟',
      'ما اسم المجلة الثقافية التي تصدرها أرامكو السعودية؟',
      'ما اسم الجائزة السعودية العالمية التي تُمنح في خمسة فروع؟',
    ],
    heritage: ['ما اسم أشهر سوق للتمور في السعودية؟'],
    'saudi-landmarks': ['في أي منطقة سعودية يقع مسجد جواثا التاريخي؟'],
  },
  // «فنانون عرب وأجانب» keeps people who made art. A physician, a sociologist, an
  // astronaut, a striker, a conqueror and a king are not artists whatever else they are.
  artists: {
    'scientists-inventors': [
      'من الطبيب المسلم صاحب كتاب «القانون في الطب»؟',
      'من العالم المسلم مؤسس علم الاجتماع صاحب «المقدمة»؟',
      'من الرحّالة المغربي الذي جاب العالم ودوّن رحلاته؟',
      'من عالم الفضاء المصري الذي شارك في برنامج أبولو لدراسة سطح القمر؟',
    ],
    space: ['من أول امرأة عربية سعودية تصل إلى محطة الفضاء الدولية؟'],
    'football-gulf': ['من الأسطورة السعودية هدّاف المنتخب الملقب بـ«الصقر»؟'],
    'world-landmarks': ['ما اسم المتحف الأشهر في نيويورك للفن الحديث؟'],
    'islamic-history': [
      'من القائد المسلم الذي عبر إلى الأندلس عام 711م؟',
      'من القائد المسلم الذي فتح مصر في عهد عمر بن الخطاب؟',
    ],
    history: ['من الملك السعودي الذي وحّد البلاد وأعلن قيام المملكة عام 1932؟'],
  },
};

/**
 * Questions removed outright.
 *
 * Two sources:
 *  1. NEAR-DUPLICATES — same category, same correct answer, and one prompt's content
 *     words a subset of the other's once the ال/و/ف/ب/ل prefixes are stemmed. That
 *     stemming is what the gate in validateBank.ts was missing: «من الثنائي الذي لحّن
 *     وكتب معظم أعمال فيروز؟» and «من الثنائي الذي كتب ولحّن معظم أعمال فيروز؟» are the
 *     same question, and «وكتب» vs «كتب» was enough to hide it. The earlier-written
 *     copy of each pair is the one kept.
 *  2. Questions the client named as unsound (below, with a note).
 */
const APPLIED_DROPS_PASS_1: Record<string, number[]> = {
  vision2030: [30, 181],
  'saudi-landmarks': [150, 180],
  'world-cup': [116, 269, 344],
  'football-europe': [149],
  'football-asia': [103, 109, 146],
  'football-southamerica': [86, 89, 92, 93],
  'football-arab': [180, 195, 196, 255],
  'premier-league': [90, 299],
  laliga: [88],
  general: [342],
  'arab-world': [311, 468],
  gulf: [117, 261, 262, 334],
  'military-history': [279],
  'flags-capitals': [272, 280],
  currencies: [19, 20, 23, 30, 33, 59, 68, 173, 181, 182, 183, 273, 275],
  quran: [271, 290, 292],
  // 239 + 361: «ما الدولة التي أوصلت الإسلام إلى أفريقيا؟» — asked twice, and the
  // client is right that it is unsound: the four options are dynasties, not «دول» in
  // the sense the prompt implies, and Islam reached Africa long before any of them.
  // There is no honest one-word answer, so the question goes rather than gets reworded.
  'islamic-culture': [239, 361, 392, 425, 438],
  seerah: [271],
  'prophets-companions': [14, 39, 207, 239],
  'ramadan-drama': [33],
  'movies-series': [79],
  // 87: a third «التخت الشرقي» question with the same answer as 34 (client:
  // «تكرر سؤال التخت الشرقي بصيغتين متقاربتين والإجابة نفسها»).
  // 252: the second Bruce Lee question in a row (client: «سؤالان متقاربان عن بروس لي»);
  //      251 (Jackie Chan) and 253 (Jeet Kune Do) stay — they ask different things.
  artists: [87, 111, 252],
  // 289 repeats artists[50] — the same Arab Idol 2013 question in two categories.
  'cinema-gulf': [289],
  // 71 asks what artists[33] already asks (the qanun in the takht).
  'heritage-arab': [71],
  'video-games': [343],
  // 109 «أي دولة تتبع لها جزيرة غرينلاند؟» — kept as the reworded geography[452] below.
  'world-wonders': [109, 273, 284],
  'weird-facts': [36, 49, 126, 244, 322],
  'puzzles-logic': [259, 260, 261, 263, 265],
  'medicine-health': [348, 350],
  science: [74, 103, 402],
  space: [132, 136, 153, 269],
  ai: [257],
  'internet-apps': [227],
  economy: [100, 256],
  poetry: [236, 263, 349],
  cars: [53, 270],
  aviation: [246],
};

/** Pass 1's drops are applied; nothing index-keyed is pending. */
export const DROPS: Record<string, number[]> = {};

/**
 * Whole-line rewrites, keyed by array index. Pass 1's single edit is applied.
 */
const APPLIED_EDITS_PASS_1: Record<string, Record<number, string>> = {
  // Client: «السؤال: أين توجد أكبر جزيرة في العالم؟ والإجابة المقصودة الدنمارك بسبب
  // غرينلاند. الأفضل أن تكون الصياغة: تتبع جزيرة غرينلاند سياسيًا لأي دولة؟» — the old
  // prompt asked where an island *is* and expected the country that governs it, which
  // is a different question. Reworded exactly as asked.
  geography: {
    452: `  { ar: "تتبع جزيرة غرينلاند سياسياً لأي دولة؟", en: "Greenland is politically part of which country?", o: ["الدنمارك", "كندا", "النرويج", "أيسلندا"], c: 0, d: 'MEDIUM' },`,
  },
};

export const EDITS: Record<string, Record<number, string>> = {};

/** Referenced so the applied records are not dead code to the linter. */
export const APPLIED = { APPLIED_PASS_1, APPLIED_DROPS_PASS_1, APPLIED_EDITS_PASS_1 };

/** Re-exported so the tool's imports read as one unit. */
export type { BankQuestion };
