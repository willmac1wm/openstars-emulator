/**
 * Plain-language voice error messages.
 *
 * The voice stack used to swallow most failures (Web Speech `no-speech` /
 * `aborted`, Whisper transcribe timeouts, Kokoro load failures) so the user
 * got silence and no explanation. Every message here names what failed and
 * what to do next — tap/type always works as the fallback.
 *
 * Pure functions, no browser APIs, so they are unit-testable.
 */

/** Web Speech API `SpeechRecognitionErrorEvent.error` values. */
export function mapSpeechRecognitionError(error: string): string | null {
  switch (error) {
    case 'aborted':
      // Expected: user released PTT, or we restarted listening mid-hold.
      // Silence is correct — do not log a scary message for a normal release.
      return null;
    case 'no-speech':
      return "Didn't hear anything — hold PTT and speak clearly, or use tap/type.";
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission denied — allow the microphone in your browser, or use tap/type.';
    case 'audio-capture':
      return 'No microphone found — check the mic is plugged in and selected, or use tap/type.';
    case 'network':
      return 'Speech service unreachable (network) — check the connection, or use tap/type.';
    case 'language-not-supported':
      return 'Speech recognition does not support this language here — use tap/type.';
    default:
      return `Mic error: ${error} — try again, or use tap/type.`;
  }
}

/** `getUserMedia` / PCM capture failures (Whisper + desktop paths). */
export function mapMicError(err: unknown): string | null {
  if (!err) return 'Mic error — try again, or use tap/type.';
  const name = err instanceof Error ? err.name : '';
  const message = err instanceof Error ? err.message : String(err);
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone permission denied — allow the microphone in your browser, or use tap/type.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone found — check the mic is plugged in and selected, or use tap/type.';
    case 'NotReadableError':
      return 'Microphone is in use by another app — close it and try again, or use tap/type.';
    case 'AbortError':
      return null;
    default:
      return message ? `Mic error: ${message}` : 'Mic error — try again, or use tap/type.';
  }
}

/** Whisper (web or desktop) transcribe returned nothing usable. */
export const WHISPER_TRANSCRIBE_FAILED =
  "Accurate speech couldn't transcribe that — hold PTT and try again, or use tap/type.";

/** Whisper capture produced no audio at all. */
export const WHISPER_HEARD_NOTHING =
  "Didn't hear anything — hold PTT a little longer and speak clearly, or use tap/type.";

/** PTT pressed while a previous Whisper/desktop transcribe is still running. */
export const STT_STILL_TRANSCRIBING =
  'Still transcribing the last press — wait a second, then hold PTT again.';

/** Natural (Kokoro) voice failed to load; Fast voice is in use instead. */
export const NATURAL_VOICE_FAILED = 'Natural voices failed to load — using Fast voice.';

/** Natural voice was too slow for this readback; Fast voice spoke instead. */
export const NATURAL_SLOW_FALLBACK = 'Natural voice was too slow — using Fast voice for this readback.';

/** No usable speech-synthesis voice exists on this device. */
export const NO_SPEECH_VOICE =
  'No spoken voice found on this device — readbacks will show as text only.';

/** A readback's audio failed after retry; the text readback is still shown. */
export const READBACK_AUDIO_FAILED =
  'Readback audio failed — showing text only. Try VOX off and on, or reload.';
