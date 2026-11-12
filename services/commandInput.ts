/**
 * Command-line input helpers (pure, unit-tested).
 *
 * The input auto-fills the selected aircraft's callsign when it is empty.
 * It must NEVER retarget a clearance the controller already typed for a
 * different aircraft: the selection effect re-runs on every sim tick (the
 * selected aircraft object is recreated each frame), so an unconditional
 * rewrite turned "DAL456 H090" into "AAL421 H090" — a clearance issued to
 * the wrong aircraft. Only rewrite the prefix while no command follows it.
 */
export function applySelectionToCommandInput(
  currentValue: string,
  selectedCallsign: string,
): string | null {
  const selected = selectedCallsign.toUpperCase();
  if (currentValue.trim() === '') return `${selected} `;

  const callsignMatch = currentValue.match(/^([A-Z]+[0-9]+[A-Z]*)/i);
  if (callsignMatch) {
    const existing = callsignMatch[1].toUpperCase();
    const rest = currentValue.substring(callsignMatch[0].length);
    // A complete callsign for another aircraft + a command: leave it alone.
    if (existing !== selected && rest.trim() !== '') return null;
    // Bare callsign (no command yet) for another aircraft: switch to selected.
    if (existing !== selected) return `${selected}${rest}`;
    return null;
  }

  // Bare letter prefix ("DA") — complete it to the selected callsign.
  const prefixOnly = currentValue.match(/^([A-Z]+)\d*$/i);
  if (prefixOnly) {
    const prefix = prefixOnly[1].toUpperCase();
    if (selected.startsWith(prefix)) return `${selected} `;
  }
  return null;
}
