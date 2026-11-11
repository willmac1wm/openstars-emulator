/**
 * Permissive ATC-focused grapheme-to-phoneme for desktop Kokoro.
 *
 * WHY THIS EXISTS: kokoro-js's default `phonemizer` embeds eSpeak NG (GPL-3.0).
 * Shipping eSpeak inside a distributed desktop binary would force GPL obligations
 * on the installer. This lexicon covers JO 7110.65-style readback vocabulary
 * (digits, airlines, verbs) under Apache-2.0 (this file) so the desktop build
 * does not need eSpeak.
 *
 * Unknown tokens fall back to a conservative letter/digit expansion — good enough
 * for rare words; the on-screen readback remains authoritative.
 */

const DIGITS: Record<string, string> = {
  '0': 'zˈiɹoʊ',
  '1': 'wˈʌn',
  '2': 'tˈuː',
  '3': 'θɹˈiː',
  '4': 'fˈoːɹ',
  '5': 'fˈaɪv',
  '6': 'sˈɪks',
  '7': 'sˈɛvən',
  '8': 'ˈeɪt',
  '9': 'nˈaɪn',
};

const WORDS: Record<string, string> = {
  turn: 'tˈɝn',
  left: 'lˈɛft',
  right: 'ɹˈaɪt',
  heading: 'hˈɛdɪŋ',
  climb: 'klˈaɪm',
  and: 'ænd',
  maintain: 'meɪntˈeɪn',
  descend: 'dɪsˈɛnd',
  reduce: 'ɹɪdˈuːs',
  increase: 'ɪnkɹˈiːs',
  speed: 'spˈiːd',
  to: 'tˈuː',
  knots: 'nˈɑːts',
  flight: 'flˈaɪt',
  level: 'lˈɛvəl',
  thousand: 'θˈaʊzənd',
  hundred: 'hˈʌndɹəd',
  feet: 'fˈiːt',
  unable: 'ʌnˈeɪbəl',
  say: 'sˈeɪ',
  again: 'əɡˈɛn',
  station: 'stˈeɪʃən',
  calling: 'kˈɔlɪŋ',
  american: 'əmˈɛɹɪkən',
  united: 'junˈaɪtəd',
  delta: 'dˈɛltə',
  southwest: 'sˈaʊθwˌɛst',
  jetblue: 'dʒˈɛtbluː',
  alaska: 'əlˈæskə',
  spirit: 'spˈɪɹɪt',
  frontier: 'fɹʌntˈɪɹ',
  november: 'noʊvˈɛmbɚ',
  niner: 'nˈaɪnɚ',
  zero: 'zˈiɹoʊ',
  one: 'wˈʌn',
  two: 'tˈuː',
  three: 'θɹˈiː',
  four: 'fˈoːɹ',
  five: 'fˈaɪv',
  six: 'sˈɪks',
  seven: 'sˈɛvən',
  eight: 'ˈeɪt',
  nine: 'nˈaɪn',
  ten: 'tˈɛn',
  eleven: 'ɪlˈɛvən',
  twelve: 'twˈɛlv',
  twenty: 'twˈɛnti',
  thirty: 'θˈɝdi',
  forty: 'fˈɔɹti',
  fifty: 'fˈɪfti',
  sixty: 'sˈɪksti',
  seventy: 'sˈɛvənti',
  eighty: 'ˈeɪti',
  ninety: 'nˈaɪnti',
  fly: 'flˈaɪ',
  until: 'ʌntˈɪl',
  established: 'ɪstˈæblɪʃt',
  cleared: 'klˈɪɹd',
  ils: 'ˈaɪɛlˈɛs',
  vor: 'vˈiːoʊˈɑːɹ',
  runway: 'ɹˈʌnweɪ',
  approach: 'əpɹˈoʊtʃ',
  miles: 'mˈaɪəlz',
  from: 'fɹˈʌm',
  the: 'ðə',
  good: 'ɡˈʊd',
  day: 'dˈeɪ',
  contact: 'kˈɑntækt',
  tower: 'tˈaʊɚ',
  hello: 'həlˈoʊ',
  instructor: 'ɪnstɹˈʌktɚ',
};

function expandToken(token: string): string {
  const lower = token.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!lower) return '';
  if (WORDS[lower]) return WORDS[lower];
  if (/^\d+$/.test(lower)) {
    return [...lower].map((d) => DIGITS[d] || d).join(' ');
  }
  // Spell unknown words letter-by-letter (rare in our templates).
  return [...lower].map((ch) => {
    if (DIGITS[ch]) return DIGITS[ch];
    return ch;
  }).join(' ');
}

/** Convert ATC / readback English to a space-separated phoneme string. */
export function atcTextToPhonemes(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[—–]/g, ' ')
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .map(expandToken)
    .filter(Boolean)
    .join(' ');
}

export const ATC_G2P_LICENSE = 'Apache-2.0 (OpenSTARS lexicon; no eSpeak NG)';
