/** Human-readable labels for game type/mode enums (admin dashboard). */
export function modeLabel(mode: string): string {
  switch (mode) {
    case 'POINTS':
      return 'Points Game (لعبة النقاط)';
    case 'ELIMINATION':
      return 'Elimination Game (لعبة التصفيات)';
    case 'SEEN_JEEM':
      return 'Seen Jeem (سين جيم)';
    default:
      return mode;
  }
}

export function typeLabel(type: string): string {
  switch (type) {
    case 'INDIVIDUAL':
      return 'Individual (فردي)';
    case 'TEAMS':
      return 'Teams (فرق)';
    default:
      return type;
  }
}
