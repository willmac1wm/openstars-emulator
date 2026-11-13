import { describe, expect, it } from 'vitest';
import {
  mapMicError,
  mapSpeechRecognitionError,
  NATURAL_VOICE_FAILED,
  NO_SPEECH_VOICE,
  READBACK_AUDIO_FAILED,
  STT_STILL_TRANSCRIBING,
  WHISPER_HEARD_NOTHING,
  WHISPER_TRANSCRIBE_FAILED,
} from './voiceErrors';

describe('mapSpeechRecognitionError', () => {
  it('stays silent for aborted (normal PTT release / mid-hold restart)', () => {
    expect(mapSpeechRecognitionError('aborted')).toBeNull();
  });

  it('names no-speech instead of swallowing it', () => {
    const msg = mapSpeechRecognitionError('no-speech');
    expect(msg).toContain("Didn't hear anything");
    expect(msg).toContain('tap/type');
  });

  it('gives a plain-language fix for denied mic permission', () => {
    const msg = mapSpeechRecognitionError('not-allowed');
    expect(msg).toContain('Microphone permission denied');
    expect(msg).toContain('allow the microphone');
  });

  it('names no-microphone and network failures', () => {
    expect(mapSpeechRecognitionError('audio-capture')).toContain('No microphone found');
    expect(mapSpeechRecognitionError('network')).toContain('unreachable');
  });

  it('falls back to a named message for unknown errors', () => {
    expect(mapSpeechRecognitionError('weird')).toContain('Mic error: weird');
  });
});

describe('mapMicError', () => {
  it('maps getUserMedia DOMExceptions to plain language', () => {
    const denied = new DOMException('Permission denied', 'NotAllowedError');
    expect(mapMicError(denied)).toContain('Microphone permission denied');
    const missing = new DOMException('No device', 'NotFoundError');
    expect(mapMicError(missing)).toContain('No microphone found');
    const busy = new DOMException('In use', 'NotReadableError');
    expect(mapMicError(busy)).toContain('in use by another app');
  });

  it('stays silent for AbortError and names generic errors', () => {
    expect(mapMicError(new DOMException('aborted', 'AbortError'))).toBeNull();
    expect(mapMicError(new Error('boom'))).toContain('boom');
  });
});

describe('voice failure copy', () => {
  it('every notice names the failure and the tap/type fallback (or Fast voice)', () => {
    expect(WHISPER_TRANSCRIBE_FAILED).toContain('tap/type');
    expect(WHISPER_HEARD_NOTHING).toContain("Didn't hear anything");
    expect(STT_STILL_TRANSCRIBING).toContain('Still transcribing');
    expect(NATURAL_VOICE_FAILED).toContain('Fast voice');
    expect(NO_SPEECH_VOICE).toContain('text only');
    expect(READBACK_AUDIO_FAILED).toContain('text only');
  });
});
