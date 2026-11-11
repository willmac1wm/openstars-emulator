/**
 * ATC-aware repair of Web Speech transcripts before the clearance grammar runs.
 * Handles common booth misrecognitions (unit→united, maintenance→maintain, $8000→feet).
 */

const REPAIRS: Array<[RegExp, string]> = [
  // Airlines / telephony
  [/\byou\s+knighted\b/g, 'united'],
  [/\byouknighted\b/g, 'united'],
  [/\bunited\s+airlines?\b/g, 'united'],
  // "unit 123" / "unit one…" before a flight number — not "unit" as a generic word
  [/\bunit(?=\s+(?:\d|(?:one|two|three|four|five|six|seven|eight|nine|zero|niner|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b))/g, 'united'],
  [/\bmerican\b/g, 'american'],
  [/\bamerica\b/g, 'american'],
  [/\bamercian\b/g, 'american'],
  [/\bdella\b/g, 'delta'],
  [/\bsouth\s+west\b/g, 'southwest'],
  [/\bjet\s+blue\b/g, 'jetblue'],

  // Altitude verbs — "send and maintenance" → "descend and maintain"
  [/\bthe\s+send\b/g, 'descend'],
  [/\bascend\b/g, 'climb'],
  [/\bdescent\b/g, 'descend'],
  [/\bsend(?=\s+and\s+(?:maintain|maintenance|maintaining|main\s+tain))\b/g, 'descend'],
  [/\bmaintenance\b/g, 'maintain'],
  [/\bmaintaining\b/g, 'maintain'],
  [/\bmain\s+tain\b/g, 'maintain'],
  [/\bmaintainence\b/g, 'maintain'],
  [/\bmaintenence\b/g, 'maintain'],

  // Speed phrasing
  [/\breduce\s+speed\s+to\b/g, 'reduce speed'],
  [/\bincrease\s+speed\s+to\b/g, 'increase speed'],

  // Money / punctuation artifacts for altitudes
  [/\$(\d[\d,]*)/g, '$1'],
  [/\b(\d),(\d{3})\b/g, '$1$2'],
  [/\b(\d+)\s*feet?\b/g, '$1'],
  [/\beight\s+thou\b/g, 'eight thousand'],
];

/** Apply ATC misrecognition repairs; returns lowercase cleaned text. */
export function repairAtcTranscript(raw: string): string {
  let t = raw.toLowerCase();
  t = t.replace(/-/g, ' ');
  for (const [re, rep] of REPAIRS) {
    t = t.replace(re, rep);
  }
  t = t.replace(/[^a-z0-9\s]/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/**
 * Score how well a repaired transcript aligns with ATC clearance keywords.
 * Used to rank SpeechRecognition alternatives.
 */
export function scoreAtcTranscript(text: string): number {
  const t = repairAtcTranscript(text);
  if (!t) return 0;
  let score = 0;
  const hits = [
    /\b(united|american|delta|southwest|jetblue|alaska|spirit|frontier|november)\b/,
    /\b(turn|heading|fly)\b/,
    /\b(climb|descend|maintain)\b/,
    /\b(speed|knots)\b/,
    /\b(thousand|hundred|flight\s+level)\b/,
    /\b(left|right)\b/,
    /\b\d{3,5}\b/,
  ];
  for (const re of hits) {
    if (re.test(t)) score += 1;
  }
  // Penalize unrepaired booth noise
  if (/\b(unit|maintenance)\b/.test(t) && !/\bunited\b/.test(t)) score -= 1;
  if (/\bsend\b/.test(t) && !/\bdescend\b/.test(t)) score -= 1;
  return score;
}
