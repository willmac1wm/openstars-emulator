/**
 * Deterministic FAA phraseology for pilot readbacks.
 * Patterns follow JO 7110.65 / AIM radiotelephony: individual digits for
 * headings and speeds, "niner" for the digit 9, altitudes in thousands and
 * hundreds, and airline telephony plus group-form flight numbers.
 */

const DIGIT = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'] as const;
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'] as const;

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const;
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'] as const;

const PHONETIC: Record<string, string> = {
  A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot',
  G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliet', K: 'Kilo', L: 'Lima',
  M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo',
  S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray',
  Y: 'Yankee', Z: 'Zulu',
};

/** ICAO telephony designators used by the built-in traffic. */
export const AIRLINE_TELEPHONY: Record<string, string> = {
  AAL: 'American',
  UAL: 'United',
  DAL: 'Delta',
  SWA: 'Southwest',
  SKW: 'SkyWest',
  ASH: 'Air Shuttle',
  JBU: 'JetBlue',
  ASA: 'Alaska',
  FFT: 'Frontier',
  NKS: 'Spirit',
  ENY: 'Envoy',
  RPA: 'Brickyard',
  EDV: 'Endeavor',
  QXE: 'Horizon',
  JIA: 'Blue Streak',
  GJS: 'Lindbergh',
  PDT: 'Piedmont',
  AWI: 'Wisconsin',
  HAL: 'Hawaiian',
  SCX: 'Sun Country',
  AAY: 'Allegiant',
  WJA: 'WestJet',
  ACA: 'Air Canada',
  BAW: 'Speedbird',
};

/** One neural voice per slot. Assigned from the callsign so each aircraft keeps its voice. */
export const PILOT_VOICES = [
  'am_michael',
  'am_fenrir',
  'am_puck',
  'af_bella',
  'af_nicole',
  'af_sarah',
  'am_echo',
  'af_sky',
] as const;

export type PilotVoice = (typeof PILOT_VOICES)[number];

export function hashCallsign(callsign: string): number {
  let h = 2166136261;
  for (let i = 0; i < callsign.length; i++) {
    h ^= callsign.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function voiceForCallsign(callsign: string): PilotVoice {
  return PILOT_VOICES[hashCallsign(callsign) % PILOT_VOICES.length];
}

export function speakDigits(value: string): string {
  return value.split('').map((d) => DIGIT[Number(d)] ?? d).join(' ');
}

/** Headings are three digits. 000 and 360 are both "three six zero". */
export function speakHeading(heading: number): string {
  const wrapped = ((Math.round(heading) % 360) + 360) % 360;
  const shown = wrapped === 0 ? 360 : wrapped;
  return speakDigits(String(shown).padStart(3, '0'));
}

/** Speeds are individual digits, the way a speed instruction is read back. */
export function speakKnots(speed: number): string {
  return speakDigits(String(Math.round(speed)));
}

/**
 * Altitude stored as hundreds of feet (070 = 7,000).
 * Below 18,000: thousands and hundreds. 10,000 and above use separate digits
 * ("one zero thousand"). At or above 18,000: flight level digits.
 */
export function speakAltitudeHundreds(hundreds: number): string {
  const feet = Math.round(hundreds) * 100;
  if (feet >= 18000) {
    return `flight level ${speakDigits(String(Math.round(hundreds)).padStart(3, '0'))}`;
  }
  const thousands = Math.floor(feet / 1000);
  const hundredsRem = Math.round((feet % 1000) / 100);
  let thou: string;
  if (thousands < 10) {
    thou = DIGIT[thousands] ?? String(thousands);
  } else {
    thou = `${DIGIT[Math.floor(thousands / 10)]} ${DIGIT[thousands % 10]}`;
  }
  if (hundredsRem === 0) return `${thou} thousand`;
  return `${thou} thousand ${DIGIT[hundredsRem]} hundred`;
}

function twoDigitGroup(n: number): string {
  if (n < 10) return n === 9 ? 'niner' : ONES[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (o === 0) return TENS[t];
  return `${TENS[t]}-${o === 9 ? 'nine' : ONES[o]}`;
}

/** Airline flight numbers in group form: 421 → "four twenty-one", 100 → "one hundred". */
export function speakFlightNumber(num: string): string {
  if (!/^\d+$/.test(num)) return num;
  if (num.length === 1) return num === '9' ? 'niner' : ONES[Number(num)];
  if (num.length === 2) {
    if (num[0] === '0') return `zero ${num[1] === '9' ? 'niner' : ONES[Number(num[1])]}`;
    return twoDigitGroup(Number(num));
  }
  if (num.length === 3) {
    const head = DIGIT[Number(num[0])];
    if (num.slice(1) === '00') return `${head} hundred`;
    if (num[1] === '0') return `${head} zero ${DIGIT[Number(num[2])]}`;
    return `${head} ${twoDigitGroup(Number(num.slice(1)))}`;
  }
  if (num.length === 4) {
    const left = num[0] === '0'
      ? `zero ${twoDigitGroup(Number(num[1]))}`
      : twoDigitGroup(Number(num.slice(0, 2)));
    if (num.slice(2) === '00') return `${left} hundred`;
    if (num[2] === '0') return `${left} zero ${DIGIT[Number(num[3])]}`;
    return `${left} ${twoDigitGroup(Number(num.slice(2)))}`;
  }
  return speakDigits(num);
}

function spellLetters(letters: string): string {
  return letters.split('').map((ch) => PHONETIC[ch] ?? ch).join(' ');
}

export function speakCallsign(callsign: string): string {
  const airline = callsign.match(/^([A-Z]{2,3})(\d{1,4})$/);
  if (airline) {
    const telephony = AIRLINE_TELEPHONY[airline[1]];
    const flight = speakFlightNumber(airline[2]);
    return telephony ? `${telephony} ${flight}` : `${spellLetters(airline[1])} ${flight}`;
  }
  const nNumber = callsign.match(/^N(\d+)([A-Z]*)$/);
  if (nNumber) {
    const tail = nNumber[2] ? ` ${spellLetters(nNumber[2])}` : '';
    return `November ${speakDigits(nNumber[1])}${tail}`;
  }
  return callsign.split('').map((ch) => {
    if (/[A-Z]/.test(ch)) return PHONETIC[ch] ?? ch;
    if (/[0-9]/.test(ch)) return DIGIT[Number(ch)];
    return ch;
  }).join(' ').replace(/\s+/g, ' ').trim();
}

export function readbackHeading(heading: number, direction: 'LEFT' | 'RIGHT' | null): string {
  const spoken = speakHeading(heading === 0 ? 360 : heading);
  if (direction === 'LEFT') return `turn left heading ${spoken}`;
  if (direction === 'RIGHT') return `turn right heading ${spoken}`;
  return `heading ${spoken}`;
}

export function readbackAltitude(hundreds: number, relation: 'climb' | 'descend' | 'maintain'): string {
  const spoken = speakAltitudeHundreds(hundreds);
  if (relation === 'climb') return `climb and maintain ${spoken}`;
  if (relation === 'descend') return `descend and maintain ${spoken}`;
  return `maintain ${spoken}`;
}

export function readbackSpeed(knots: number, relation: 'increase' | 'reduce' | 'maintain'): string {
  const spoken = speakKnots(knots);
  if (relation === 'increase') return `increase speed to ${spoken} knots`;
  if (relation === 'reduce') return `reduce speed to ${spoken} knots`;
  return `maintain ${spoken} knots`;
}

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function finishReadback(clauses: string[], callsign: string): string {
  const body = clauses.filter(Boolean).join(', ');
  return `${capitalize(body)}, ${speakCallsign(callsign)}`;
}

export function sayAgain(callsign: string): string {
  return `Say again, ${speakCallsign(callsign)}`;
}

export function unable(callsign: string): string {
  return `Unable, ${speakCallsign(callsign)}`;
}
