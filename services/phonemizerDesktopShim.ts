/**
 * Vite alias target for `phonemizer` in desktop builds.
 * Matches the phonemizer package API that kokoro-js expects, but uses the
 * OpenSTARS ATC G2P lexicon instead of embedding eSpeak NG (GPL-3.0).
 */
import { atcTextToPhonemes } from './atcG2p';

/** Same shape as phonemizer.phonemize — returns phoneme strings to join. */
export async function phonemize(text: string, _language?: string): Promise<string[]> {
  const phones = atcTextToPhonemes(text);
  return phones ? [phones] : [];
}

export async function list_voices(_language?: string): Promise<
  { name: string; language: string; identifier: string }[]
> {
  return [{ name: 'OpenSTARS ATC G2P', language: 'en-us', identifier: 'atc-g2p' }];
}

export default { phonemize, list_voices };
