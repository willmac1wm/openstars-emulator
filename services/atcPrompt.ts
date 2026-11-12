/** Shared ATC initial_prompt for Whisper (desktop + web). */

export function buildAtcInitialPrompt(callsigns: string[]): string {
  const base =
    'Air traffic control radio. United American Delta Southwest. '
    + 'Turn left heading, turn right heading, climb and maintain, descend and maintain, '
    + 'reduce speed, increase speed, knots, thousand, niner, flight level.';
  const cs = callsigns.slice(0, 12).join(' ');
  return cs ? `${base} Active aircraft: ${cs}.` : base;
}
