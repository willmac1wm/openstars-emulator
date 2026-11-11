import { Aircraft } from '../types';
import { repairAtcTranscript, scoreAtcTranscript } from './atcSpeechNormalize';
import { AIRLINE_TELEPHONY, speakAltitudeHundreds, speakCallsign, speakDigits, speakHeading, speakKnots } from './phraseology';

/** Auto-issue when scored confidence is at or above this; otherwise leave in the command line. */
export const SPEECH_AUTO_ISSUE_CONFIDENCE = 0.72;

const WORD_DIGITS: Record<string, string> = {
  zero: '0', oh: '0', o: '0',
  one: '1', won: '1',
  two: '2', to: '2', too: '2',
  three: '3', tree: '3',
  four: '4', for: '4',
  five: '5', fife: '5',
  six: '6',
  seven: '7',
  eight: '8', ate: '8',
  nine: '9', niner: '9',
};

const PHONETIC_LETTER: Record<string, string> = {
  alpha: 'A', alfa: 'A',
  bravo: 'B',
  charlie: 'C',
  delta: 'D',
  echo: 'E',
  foxtrot: 'F',
  golf: 'G',
  hotel: 'H',
  india: 'I',
  juliet: 'J', juliett: 'J',
  kilo: 'K',
  lima: 'L',
  mike: 'M',
  november: 'N',
  oscar: 'O',
  papa: 'P',
  quebec: 'Q',
  romeo: 'R',
  sierra: 'S',
  tango: 'T',
  uniform: 'U',
  victor: 'V',
  whiskey: 'W', whisky: 'W',
  xray: 'X', 'x-ray': 'X',
  yankee: 'Y',
  zulu: 'Z',
};

const TEENS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const TELEPHONY_TO_ICAO: Record<string, string> = {
  american: 'AAL',
  united: 'UAL',
  delta: 'DAL',
  southwest: 'SWA',
  skywest: 'SKW',
  'air shuttle': 'ASH',
  jetblue: 'JBU',
  'jet blue': 'JBU',
  alaska: 'ASA',
  frontier: 'FFT',
  spirit: 'NKS',
  envoy: 'ENY',
  brickyard: 'RPA',
  endeavor: 'EDV',
  horizon: 'QXE',
  'blue streak': 'JIA',
  lifeguard: 'MEDEVAC',
  medevac: 'MEDEVAC',
};

for (const [icao, name] of Object.entries(AIRLINE_TELEPHONY)) {
  TELEPHONY_TO_ICAO[name.toLowerCase()] = icao;
}

export interface SpeechParseResult {
  ok: boolean;
  command?: string;
  callsign?: string;
  transcript: string;
  reason?: 'say_again' | 'station_calling' | 'no_aircraft' | 'ambiguous_callsign';
  message?: string;
  /** 0–1 score used for auto-issue vs confirm-with-Enter. */
  confidence?: number;
}

export interface SpeechAlternative {
  transcript: string;
  /** Engine confidence when available (Web Speech). */
  confidence?: number;
}

function normalizeTranscript(raw: string): string {
  return repairAtcTranscript(raw);
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function isDigitWord(w: string): boolean {
  return WORD_DIGITS[w] !== undefined || /^\d$/.test(w);
}

/** Individual digits as spoken for headings/speeds: "two seven zero" → "270". */
export function spokenDigitsSequence(words: string[]): string | null {
  if (words.length === 0) return null;
  let out = '';
  for (const w of words) {
    if (WORD_DIGITS[w] !== undefined) out += WORD_DIGITS[w];
    else if (/^\d+$/.test(w)) out += w;
    else return null;
  }
  return out || null;
}

/**
 * Group-form numbers for callsigns / "four twenty-one" → "421".
 * Also accepts digit sequences.
 */
export function spokenGroupNumber(words: string[]): string | null {
  if (words.length === 0) return null;
  const digitsOnly = spokenDigitsSequence(words);
  if (digitsOnly) return digitsOnly;

  let i = 0;
  let value = 0;
  if (WORD_DIGITS[words[0]] !== undefined && words.length > 1 && (TENS[words[1]] || TEENS[words[1]])) {
    value = Number(WORD_DIGITS[words[0]]) * 100;
    i = 1;
  } else if (/^\d$/.test(words[0]) && words.length > 1 && (TENS[words[1]] || TEENS[words[1]])) {
    value = Number(words[0]) * 100;
    i = 1;
  }

  if (TEENS[words[i]] !== undefined) {
    value += TEENS[words[i]];
    i += 1;
  } else if (TENS[words[i]] !== undefined) {
    value += TENS[words[i]];
    i += 1;
    if (i < words.length && WORD_DIGITS[words[i]] !== undefined) {
      value += Number(WORD_DIGITS[words[i]]);
      i += 1;
    }
  } else if (WORD_DIGITS[words[i]] !== undefined) {
    value += Number(WORD_DIGITS[words[i]]);
    i += 1;
  } else {
    return null;
  }

  if (i !== words.length) return null;
  return String(value);
}

/** Altitude words → hundreds of feet string ("060", "100", "095"). */
export function spokenAltitudeToHundreds(words: string[]): string | null {
  if (words.length === 0) return null;
  const joined = words.join(' ');

  if (joined.startsWith('flight level')) {
    const rest = tokenize(joined.replace(/^flight level\s*/, ''));
    const digits = spokenDigitsSequence(rest) || spokenGroupNumber(rest);
    if (!digits) return null;
    return digits.padStart(3, '0').slice(-3);
  }

  const thousandMatch = joined.match(/^(.*)\s+thousand(?:\s+(.*))?$/);
  if (thousandMatch) {
    const leftWords = tokenize(thousandMatch[1]);
    const left = spokenDigitsSequence(leftWords) || spokenGroupNumber(leftWords);
    if (!left) return null;
    let hundredDigit = 0;
    if (thousandMatch[2]) {
      const rem = thousandMatch[2].replace(/\s*hundred$/, '').trim();
      if (WORD_DIGITS[rem] !== undefined) hundredDigit = Number(WORD_DIGITS[rem]);
      else if (/^\d+$/.test(rem)) hundredDigit = Number(rem);
      else return null;
    }
    const feet = Number(left) * 1000 + hundredDigit * 100;
    return String(Math.round(feet / 100));
  }

  // Bare feet like "8000" / "8000" from "$8000" repair → hundreds
  if (words.length === 1 && /^\d{4,5}$/.test(words[0])) {
    const feet = Number(words[0]);
    if (feet >= 1000 && feet <= 60000) return String(Math.round(feet / 100));
  }

  // Bare digit altitude like "seven zero" (already hundreds) or group form
  const digits = spokenDigitsSequence(words) || spokenGroupNumber(words);
  if (digits && /^\d{4,5}$/.test(digits)) {
    const feet = Number(digits);
    if (feet >= 1000 && feet <= 60000) return String(Math.round(feet / 100));
  }
  return digits;
}

function collectWhile(tokens: string[], start: number, pred: (w: string) => boolean): { words: string[]; next: number } {
  const words: string[] = [];
  let i = start;
  while (i < tokens.length && pred(tokens[i])) {
    words.push(tokens[i]);
    i += 1;
  }
  return { words, next: i };
}

function isNumberWord(w: string): boolean {
  return isDigitWord(w)
    || TEENS[w] !== undefined
    || TENS[w] !== undefined
    || w === 'thousand'
    || w === 'hundred'
    || /^\d+$/.test(w);
}

export type CallsignMatch =
  | { kind: 'match'; callsign: string; confidence: number }
  | { kind: 'ambiguous'; candidates: string[] }
  | { kind: 'none' };

function matchNovemberCallsign(tokens: string[], aircraft: Aircraft[]): CallsignMatch {
  if (tokens[0] !== 'november' && tokens[0] !== 'n') return { kind: 'none' };
  let i = 1;
  let tail = 'N';
  while (i < tokens.length) {
    const w = tokens[i];
    if (PHONETIC_LETTER[w] && w !== 'november') {
      tail += PHONETIC_LETTER[w];
      i += 1;
      continue;
    }
    if (WORD_DIGITS[w] !== undefined || /^\d+$/.test(w)) {
      const dig = WORD_DIGITS[w] ?? w;
      tail += dig;
      i += 1;
      continue;
    }
    break;
  }
  if (tail.length < 2) return { kind: 'none' };
  const exact = aircraft.filter((ac) => ac.callsign === tail);
  if (exact.length === 1) return { kind: 'match', callsign: exact[0].callsign, confidence: 0.96 };
  const loose = aircraft.filter((ac) => ac.callsign.startsWith('N') && (
    ac.callsign === tail || ac.callsign.startsWith(tail) || tail.startsWith(ac.callsign)
  ));
  if (loose.length === 1) return { kind: 'match', callsign: loose[0].callsign, confidence: 0.88 };
  if (loose.length > 1) return { kind: 'ambiguous', candidates: loose.map((a) => a.callsign) };
  return { kind: 'none' };
}

export function fuzzyMatchCallsign(
  spoken: string,
  aircraft: Aircraft[],
): CallsignMatch {
  const normalized = normalizeTranscript(spoken);
  if (!normalized || aircraft.length === 0) return { kind: 'none' };
  const tokens = tokenize(normalized);

  const november = matchNovemberCallsign(tokens, aircraft);
  if (november.kind !== 'none') return november;

  for (let len = 3; len >= 1; len--) {
    const airline = tokens.slice(0, len).join(' ');
    const icao = TELEPHONY_TO_ICAO[airline];
    if (!icao) continue;
    const numWords = collectWhile(tokens, len, isNumberWord);
    if (numWords.words.length === 0) continue;
    // stop before altitude/heading keywords accidentally eaten
    const cleaned: string[] = [];
    for (const w of numWords.words) {
      if (['thousand', 'hundred'].includes(w)) break;
      cleaned.push(w);
    }
    if (cleaned.length === 0) continue;
    const num = spokenGroupNumber(cleaned);
    if (!num) continue;
    const prefix = icao === 'MEDEVAC' ? 'MEDEVAC' : icao;
    const exact = aircraft.filter((ac) => ac.callsign === `${prefix}${num}`);
    if (exact.length === 1) return { kind: 'match', callsign: exact[0].callsign, confidence: 0.98 };
    if (exact.length > 1) return { kind: 'ambiguous', candidates: exact.map((a) => a.callsign) };
    const loose = aircraft.filter((ac) => ac.callsign.startsWith(prefix) && ac.callsign.endsWith(num));
    if (loose.length === 1) return { kind: 'match', callsign: loose[0].callsign, confidence: 0.9 };
    if (loose.length > 1) return { kind: 'ambiguous', candidates: loose.map((a) => a.callsign) };
  }

  // Fallback: telephony name appears — only if exactly one active aircraft of that airline
  for (const [name, icao] of Object.entries(TELEPHONY_TO_ICAO)) {
    if (!normalized.includes(name)) continue;
    const matches = aircraft.filter((ac) => ac.callsign.startsWith(icao === 'MEDEVAC' ? 'MEDEVAC' : icao));
    if (matches.length === 1) return { kind: 'match', callsign: matches[0].callsign, confidence: 0.8 };
    if (matches.length > 1) return { kind: 'ambiguous', candidates: matches.map((a) => a.callsign) };
  }

  return { kind: 'none' };
}

function extractInstructions(tokens: string[]): string[] {
  const parts: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    // turn left / left heading
    if (tokens[i] === 'turn' && (tokens[i + 1] === 'left' || tokens[i + 1] === 'right')) {
      const dir = tokens[i + 1] === 'left' ? 'TL' : 'TR';
      let start = i + 2;
      if (tokens[start] === 'heading') start += 1;
      const { words, next } = collectWhile(tokens, start, isNumberWord);
      const digits = spokenDigitsSequence(words.filter((w) => w !== 'thousand' && w !== 'hundred')) || spokenDigitsSequence(words);
      if (digits && digits.length >= 2) {
        parts.push(`${dir}${digits.padStart(3, '0').slice(-3)}`);
        i = next;
        continue;
      }
    }
    if ((tokens[i] === 'left' || tokens[i] === 'right') && tokens[i + 1] === 'heading') {
      const dir = tokens[i] === 'left' ? 'TL' : 'TR';
      const { words, next } = collectWhile(tokens, i + 2, isNumberWord);
      const digits = spokenDigitsSequence(words);
      if (digits) {
        parts.push(`${dir}${digits.padStart(3, '0').slice(-3)}`);
        i = next;
        continue;
      }
    }
    if (tokens[i] === 'heading' || (tokens[i] === 'fly' && tokens[i + 1] === 'heading')) {
      const start = tokens[i] === 'fly' ? i + 2 : i + 1;
      const { words, next } = collectWhile(tokens, start, isNumberWord);
      const digits = spokenDigitsSequence(words);
      if (digits) {
        parts.push(`H${digits.padStart(3, '0').slice(-3)}`);
        i = next;
        continue;
      }
    }

    if (tokens[i] === 'climb' || tokens[i] === 'descend' || tokens[i] === 'maintain' || (tokens[i] === 'flight' && tokens[i + 1] === 'level')) {
      let start = i;
      if (tokens[i] === 'climb' || tokens[i] === 'descend') {
        start = i + 1;
        while (start < tokens.length && ['and', 'maintain', 'to'].includes(tokens[start])) start += 1;
      } else if (tokens[i] === 'maintain') {
        start = i + 1;
        if (tokens[start] === 'speed') {
          i += 1;
          continue;
        }
      }
      if (tokens[start] === 'flight' && tokens[start + 1] === 'level') {
        const { words, next } = collectWhile(tokens, start + 2, isNumberWord);
        const alt = spokenAltitudeToHundreds(['flight', 'level', ...words]);
        if (alt) {
          parts.push(`A${alt.padStart(3, '0')}`);
          i = next;
          continue;
        }
      }
      const { words, next } = collectWhile(tokens, start, (w) => isNumberWord(w) || w === 'flight' || w === 'level');
      const alt = spokenAltitudeToHundreds(words);
      if (alt) {
        parts.push(`A${alt.padStart(3, '0')}`);
        i = next;
        continue;
      }
    }

    if (
      tokens[i] === 'speed'
      || ((tokens[i] === 'reduce' || tokens[i] === 'increase') && tokens.slice(i, i + 3).includes('speed'))
      || (tokens[i] === 'maintain' && tokens[i + 1] === 'speed')
    ) {
      let start = i;
      while (start < tokens.length && ['reduce', 'increase', 'maintain', 'speed', 'to', 'at', 'knots', 'and'].includes(tokens[start])) {
        start += 1;
      }
      const { words, next } = collectWhile(tokens, start, isNumberWord);
      const digits = spokenDigitsSequence(words.filter((w) => w !== 'thousand' && w !== 'hundred'));
      if (digits) {
        parts.push(`S${digits}`);
        i = next;
        continue;
      }
    }

    i += 1;
  }
  return parts;
}

/**
 * Spoken approach clearances → typed grammar for the VTF command path.
 * Targets JO 7110.65BB 5-9-4 patterns: miles from fix, turn/heading,
 * maintain until established, cleared ILS/VOR runway approach.
 */
export function extractApproachClearance(tokens: string[]): string[] {
  const parts: string[] = [];
  const joined = tokens.join(' ');

  // "four miles from the final approach fix" / "four miles from lima"
  const milesIdx = tokens.findIndex((t, i) => isNumberWord(t) && tokens[i + 1] === 'miles' && tokens[i + 2] === 'from');
  if (milesIdx >= 0) {
    const dig = spokenDigitsSequence([tokens[milesIdx]]) || spokenGroupNumber([tokens[milesIdx]]);
    let fixEnd = milesIdx + 3;
    while (fixEnd < tokens.length && !['turn', 'left', 'right', 'heading', 'maintain', 'cleared', 'climb', 'descend'].includes(tokens[fixEnd])) {
      fixEnd += 1;
    }
    const fixWords = tokens.slice(milesIdx + 3, fixEnd).join(' ').replace(/^the\s+/, '');
    if (dig) parts.push(`${dig} MILES FROM ${(fixWords || 'FINAL APPROACH FIX').toUpperCase()}`);
  }

  // reuse heading / turn extractors
  parts.push(...extractInstructions(tokens).filter((p) => p.startsWith('TL') || p.startsWith('TR') || p.startsWith('H') || p.startsWith('S')));

  // maintain <alt> until established
  const maintIdx = tokens.findIndex((t, i) => t === 'maintain' && tokens.slice(i, i + 8).includes('established'));
  if (maintIdx >= 0) {
    const { words } = collectWhile(tokens, maintIdx + 1, (w) => isNumberWord(w) || w === 'flight' || w === 'level');
    const alt = spokenAltitudeToHundreds(words);
    if (alt) parts.push(`MAINTAIN A${alt.padStart(3, '0')} UNTIL ESTABLISHED`);
  }

  // cleared ILS/VOR runway NN approach
  if (/\bcleared\b/.test(joined) && /\b(ils|vor)\b/.test(joined) && /\b(runway|rwy)\b/.test(joined)) {
    const kind = /\bils\b/.test(joined) ? 'ILS' : 'VOR';
    const rwyIdx = tokens.findIndex((t) => t === 'runway' || t === 'rwy');
    const { words } = collectWhile(tokens, rwyIdx + 1, (w) => isNumberWord(w) || w === 'left' || w === 'right' || w === 'center');
    const digits = spokenDigitsSequence(words.filter(isDigitWord)) || spokenGroupNumber(words.filter(isNumberWord));
    if (digits) parts.push(`CLEARED ${kind} RWY ${digits} APPROACH`);
  }

  // maintain NNN knots until <fix>
  const knotsUntil = joined.match(/maintain .+ knots until/);
  if (knotsUntil) {
    const speedParts = extractInstructions(tokens).filter((p) => p.startsWith('S'));
    parts.push(...speedParts);
  }

  return parts;
}

export function parseSpokenClearance(transcriptRaw: string, aircraft: Aircraft[]): SpeechParseResult {
  const transcript = normalizeTranscript(transcriptRaw);
  if (!transcript) {
    return { ok: false, transcript: '', reason: 'say_again', message: 'Say again', confidence: 0 };
  }

  const tokens = tokenize(transcript);
  const match = fuzzyMatchCallsign(transcript, aircraft);

  if (match.kind === 'ambiguous') {
    return {
      ok: false,
      transcript,
      reason: 'ambiguous_callsign',
      message: 'Say again callsign',
      confidence: 0.2,
    };
  }

  let instructionTokens = tokens;
  if (match.kind === 'match') {
    if (tokens[0] === 'november' || tokens[0] === 'n') {
      let j = 1;
      while (j < tokens.length && (isNumberWord(tokens[j]) || PHONETIC_LETTER[tokens[j]])) {
        if (['thousand', 'hundred'].includes(tokens[j])) break;
        if (['climb', 'descend', 'turn', 'heading', 'fly', 'speed', 'reduce', 'increase', 'maintain'].includes(tokens[j])) break;
        j += 1;
      }
      instructionTokens = tokens.slice(j);
    } else {
      for (let len = 1; len <= 3; len++) {
        const airline = tokens.slice(0, len).join(' ');
        if (!TELEPHONY_TO_ICAO[airline]) continue;
        const numWords = collectWhile(tokens, len, (w) => isNumberWord(w) && w !== 'thousand' && w !== 'hundred');
        // Use group parse boundary: stop before climb/descend/turn/heading/speed
        let j = len;
        while (j < tokens.length && isNumberWord(tokens[j]) && !['thousand', 'hundred'].includes(tokens[j])) j += 1;
        // if next is thousand, this was altitude not callsign number — don't strip
        if (tokens[j] === 'thousand') break;
        const cut = j > len ? j : (numWords.next || len);
        instructionTokens = tokens.slice(cut);
        break;
      }
    }
  }

  const approachParts = extractApproachClearance(instructionTokens.length ? instructionTokens : tokens);
  if (approachParts.some((p) => p.includes('CLEARED'))) {
    if (match.kind !== 'match') {
      return { ok: false, transcript, reason: 'station_calling', message: 'Station calling, say again', confidence: 0.3 };
    }
    return {
      ok: true,
      transcript,
      callsign: match.callsign,
      command: `${match.callsign} ${approachParts.join(' ')}`,
      confidence: match.confidence,
    };
  }

  const instructions = extractInstructions(instructionTokens.length ? instructionTokens : tokens);

  if (match.kind !== 'match') {
    if (instructions.length > 0) {
      return {
        ok: false,
        transcript,
        reason: 'station_calling',
        message: 'Station calling, say again',
        confidence: 0.3,
      };
    }
    return { ok: false, transcript, reason: 'say_again', message: 'Say again', confidence: 0.1 };
  }

  if (instructions.length === 0) {
    return {
      ok: false,
      transcript,
      callsign: match.callsign,
      reason: 'say_again',
      message: 'Say again',
      confidence: match.confidence * 0.4,
    };
  }

  if (!aircraft.some((ac) => ac.callsign === match.callsign)) {
    return {
      ok: false,
      transcript,
      callsign: match.callsign,
      reason: 'no_aircraft',
      message: 'Say again',
      confidence: 0.2,
    };
  }

  return {
    ok: true,
    transcript,
    callsign: match.callsign,
    command: `${match.callsign} ${instructions.join(' ')}`,
    confidence: match.confidence,
  };
}

/**
 * Rank Web Speech alternatives (maxAlternatives) against the ATC grammar and
 * return the best parse. Prefer alternatives that repair + parse cleanly.
 */
export function parseBestSpokenClearance(
  alternatives: SpeechAlternative[],
  aircraft: Aircraft[],
): SpeechParseResult {
  const alts = alternatives.length
    ? alternatives
    : [{ transcript: '', confidence: 0 }];

  let best: SpeechParseResult | null = null;
  let bestScore = -Infinity;

  for (let i = 0; i < alts.length; i++) {
    const alt = alts[i];
    const parsed = parseSpokenClearance(alt.transcript, aircraft);
    const grammar = scoreAtcTranscript(alt.transcript);
    const engine = typeof alt.confidence === 'number' ? alt.confidence : (i === 0 ? 0.55 : 0.35);
    const parseBoost = parsed.ok ? 2.5 : (parsed.reason === 'ambiguous_callsign' ? 0.4 : 0);
    const conf = (parsed.confidence ?? 0);
    const score = grammar * 1.2 + engine + parseBoost + conf + (i === 0 ? 0.15 : 0);
    const combined: SpeechParseResult = {
      ...parsed,
      confidence: Math.max(0, Math.min(1, (conf * 0.55) + (engine * 0.25) + (parsed.ok ? 0.2 : 0) + (grammar * 0.03))),
    };
    if (score > bestScore) {
      bestScore = score;
      best = combined;
    }
  }

  return best ?? { ok: false, transcript: '', reason: 'say_again', message: 'Say again', confidence: 0 };
}

export function buildTapApproachClearance(
  callsign: string,
  opts: {
    milesFrom: number;
    fixName: string;
    turn: 'LEFT' | 'RIGHT';
    heading: number;
    maintainHundreds: number;
    kind: 'ILS' | 'VOR';
    runway: string;
  },
): { command: string; phraseology: string } {
  const hdg = String(((Math.round(opts.heading) % 360) + 360) % 360 || 360).padStart(3, '0');
  const turnCode = opts.turn === 'LEFT' ? 'TL' : 'TR';
  const alt = String(opts.maintainHundreds).padStart(3, '0');
  const command = `${callsign} ${opts.milesFrom} MILES FROM ${opts.fixName.toUpperCase()} ${turnCode}${hdg} MAINTAIN A${alt} UNTIL ESTABLISHED CLEARED ${opts.kind} RWY ${opts.runway} APPROACH`;
  const phraseology = [
    speakCallsign(callsign),
    `${speakDigits(String(opts.milesFrom))} miles from ${opts.fixName.toLowerCase()}`,
    `turn ${opts.turn.toLowerCase()} heading ${speakHeading(opts.heading)}`,
    `maintain ${speakAltitudeHundreds(opts.maintainHundreds)} until established on the ${opts.kind === 'ILS' ? 'localizer' : 'final approach course'}`,
    `cleared ${opts.kind} runway ${speakDigits(opts.runway)} approach`,
  ].join(', ');
  return { command, phraseology };
}

/** @deprecated Prefer composeTapClearance from services/tapClearance — kept for callers that pass forced turn. */
export function buildTapClearance(
  callsign: string,
  opts: { turn?: 'LEFT' | 'RIGHT' | null; heading?: number; altitudeHundreds?: number; speed?: number },
): { command: string; phraseology: string } {
  const parts: string[] = [];
  const spoken: string[] = [];
  if (opts.heading !== undefined) {
    const hdg = ((Math.round(opts.heading) % 360) + 360) % 360;
    const shown = hdg === 0 ? 360 : hdg;
    const code = String(shown).padStart(3, '0');
    if (opts.turn === 'LEFT') {
      parts.push(`TL${code}`);
      spoken.push(`turn left heading ${speakHeading(shown)}`);
    } else if (opts.turn === 'RIGHT') {
      parts.push(`TR${code}`);
      spoken.push(`turn right heading ${speakHeading(shown)}`);
    } else {
      parts.push(`H${code}`);
      spoken.push(`heading ${speakHeading(shown)}`);
    }
  }
  if (opts.altitudeHundreds !== undefined) {
    const alt = String(opts.altitudeHundreds).padStart(3, '0');
    parts.push(`A${alt}`);
    spoken.push(`climb and maintain ${speakAltitudeHundreds(opts.altitudeHundreds)}`);
  }
  if (opts.speed !== undefined) {
    parts.push(`S${opts.speed}`);
    spoken.push(`reduce speed to ${speakKnots(opts.speed)} knots`);
  }
  const telephony = speakCallsign(callsign);
  return {
    command: `${callsign} ${parts.join(' ')}`.trim(),
    phraseology: parts.length ? `${telephony}, ${spoken.join(', ')}` : telephony,
  };
}
