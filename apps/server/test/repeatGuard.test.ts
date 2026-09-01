/**
 * The per-game repeat guard — client 2026-09-01, point 2: «تكرار الأسئلة أو الأفكار
 * داخل الفئة والمباراة نفسها». Each case below is one of the repeats they actually
 * hit in a paid match.
 */
import { describe, it, expect } from 'vitest';
import { RepeatGuard, correctAnswerText } from '../src/domain/rooms/repeatGuard.js';

const q = (id: string, promptAr: string, answerAr: string) => ({ id, promptAr, answerAr });

describe('RepeatGuard', () => {
  it('accepts the first question and rejects the identical prompt', () => {
    const g = new RepeatGuard();
    expect(g.accept(q('a', 'ما اسم أقدم مسجد في الخليج العربي؟', 'مسجد جواثا'))).toBe(true);
    expect(g.accept(q('b', 'ما اسم أقدم مسجد في الخليج العربي؟', 'مسجد جواثا'))).toBe(false);
  });

  it('rejects a re-phrasing that reaches the same answer', () => {
    // «تكرر سؤال التخت الشرقي بصيغتين متقاربتين والإجابة نفسها»
    const g = new RepeatGuard();
    expect(g.accept(q('a', 'ما اسم الفرقة الشرقية التقليدية التي تضم العود والقانون والناي والكمان؟', 'التخت الشرقي'))).toBe(true);
    expect(g.accept(q('b', 'ما اسم الفرقة التقليدية في الموسيقى العربية التي يقودها العود؟', 'التخت الشرقي'))).toBe(false);
  });

  it('rejects a prompt that only adds detail to one already asked', () => {
    const g = new RepeatGuard();
    expect(g.accept(q('a', 'من الفنانة المصرية الملقبة بالسندريلا؟', 'سعاد حسني'))).toBe(true);
    expect(g.accept(q('b', 'من الفنانة المصرية الملقبة بسندريلا الشاشة العربية؟', 'سعاد حسني'))).toBe(false);
  });

  it('sees through a leading waw — the prefix that hid the Fairuz pair in the bank', () => {
    const g = new RepeatGuard();
    expect(g.accept(q('a', 'من الثنائي الذي لحّن وكتب معظم أعمال فيروز؟', 'الأخوان رحباني'))).toBe(true);
    expect(g.accept(q('b', 'من الثنائي الذي كتب ولحّن معظم أعمال فيروز؟', 'الأخوان رحباني'))).toBe(false);
  });

  it('allows two unrelated questions that happen to share an answer', () => {
    // The word overlap is what keeps the same-answer rule honest: nothing else about
    // these two lines up, so both are legitimate questions in one game.
    const g = new RepeatGuard();
    expect(g.accept(q('a', 'كم عدد أركان الإسلام؟', 'خمسة'))).toBe(true);
    expect(g.accept(q('b', 'كم لاعباً في فريق كرة السلة داخل الملعب؟', 'خمسة'))).toBe(true);
  });

  it('allows two questions about one subject that ask different things', () => {
    const g = new RepeatGuard();
    expect(g.accept(q('a', 'من الممثل الصيني الشهير بأفلام الفنون القتالية والكوميديا؟', 'جاكي شان'))).toBe(true);
    expect(g.accept(q('b', 'ما اسم فن القتال الذي طوّره بروس لي؟', 'جيت كون دو'))).toBe(true);
  });
});

describe('correctAnswerText', () => {
  const options = [
    { id: 'o1', textAr: 'العود' },
    { id: 'o2', textAr: 'القانون' },
  ];
  it('reads the correct option out of a question row', () => {
    expect(correctAnswerText(options, 'o2')).toBe('القانون');
  });
  it('is empty rather than throwing when the row is malformed', () => {
    expect(correctAnswerText(null, 'o2')).toBe('');
    expect(correctAnswerText(options, undefined)).toBe('');
  });
});
