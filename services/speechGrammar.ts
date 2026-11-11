/**
 * ATC SpeechRecognition grammars + vocabulary hints for Web Speech.
 * SpeechGrammarList / JSGF is best-effort (Chromium); vocab also drives Whisper prompts.
 */

/** Core ATC phraseology words for grammar + Whisper initial_prompt. */
export const ATC_VOCAB: readonly string[] = [
  'united', 'american', 'delta', 'southwest', 'jetblue', 'alaska', 'spirit', 'frontier', 'november',
  'turn', 'left', 'right', 'heading', 'fly',
  'climb', 'descend', 'maintain',
  'reduce', 'increase', 'speed', 'knots',
  'thousand', 'hundred', 'flight', 'level',
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'niner',
  'ten', 'eleven', 'twelve', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
];

/** Spoken forms of a callsign for grammar (UAL123 → "united one two three", etc.). */
export function callsignGrammarPhrases(callsign: string): string[] {
  const cs = callsign.toUpperCase().trim();
  if (!cs) return [];
  const phrases = new Set<string>([cs.toLowerCase()]);
  const airline: Record<string, string> = {
    UAL: 'united',
    AAL: 'american',
    DAL: 'delta',
    SWA: 'southwest',
    JBU: 'jetblue',
    ASA: 'alaska',
    NKS: 'spirit',
    FFT: 'frontier',
  };
  const digitWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'];
  const m = cs.match(/^([A-Z]{2,3})(\d{1,4}[A-Z]?)$/);
  if (m) {
    const tel = airline[m[1]];
    const nums = m[2].replace(/[A-Z]/g, '');
    const spokenNums = nums.split('').map((d) => digitWords[Number(d)] || d).join(' ');
    if (tel && spokenNums) {
      phrases.add(`${tel} ${spokenNums}`);
      // Compact forms Web Speech often emits
      if (nums.length <= 3) phrases.add(`${tel} ${nums}`);
    }
  } else if (cs.startsWith('N') && cs.length >= 2) {
    phrases.add(`november ${cs.slice(1).toLowerCase().split('').join(' ')}`);
  }
  return [...phrases];
}

/**
 * Build a JSGF grammar string biasing toward active callsigns + ATC verbs.
 * Keep it small — huge grammars are ignored or hurt recognition.
 */
export function buildAtcJsgf(callsigns: string[]): string {
  const callParts = new Set<string>();
  for (const cs of callsigns.slice(0, 12)) {
    for (const p of callsignGrammarPhrases(cs)) {
      // JSGF tokens: quote multi-word, escape
      const safe = p.replace(/[;"\\]/g, ' ').trim();
      if (!safe) continue;
      if (safe.includes(' ')) callParts.add(`(${safe})`);
      else callParts.add(safe);
    }
  }
  const callAlt = callParts.size ? [...callParts].join(' | ') : 'united | american | delta';
  const actions =
    '(turn left heading | turn right heading | fly heading | climb and maintain | descend and maintain | '
    + 'reduce speed | increase speed) (zero | one | two | three | four | five | six | seven | eight | niner | '
    + 'ten | twenty | thirty | forty | fifty | sixty | seventy | eighty | ninety | thousand)*';

  return [
    '#JSGF V1.0;',
    'grammar openstars_atc;',
    `public <utterance> = <callsign> <action>;`,
    `public <callsign> = ${callAlt};`,
    `public <action> = ${actions};`,
  ].join('\n');
}

export function buildAtcSpeechGrammarList(callsigns: string[]): SpeechGrammarList | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechGrammarList?: new () => SpeechGrammarList;
    webkitSpeechGrammarList?: new () => SpeechGrammarList;
  };
  const Ctor = w.SpeechGrammarList || w.webkitSpeechGrammarList;
  if (!Ctor) return null;
  try {
    const list = new Ctor();
    const jsgf = buildAtcJsgf(callsigns);
    // Weight > 1 biases toward the grammar (Chromium treats this as a hint).
    list.addFromString(jsgf, 1.4);
    return list;
  } catch {
    return null;
  }
}
