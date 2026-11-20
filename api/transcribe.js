/**
 * Vercel Serverless Function: /api/transcribe
 *
 * Fast (~200–400 ms) ATC speech-to-text for OpenSTARS Push-to-Talk.
 * Automatically uses whichever API key is configured in Vercel Environment Variables:
 *   1. GROQ_API_KEY      → Groq whisper-large-v3-turbo (fastest, ~200 ms, generous free tier)
 *   2. DEEPGRAM_API_KEY  → Deepgram Nova-2 (~250 ms, $200 free credit)
 *   3. GEMINI_API_KEY    → Gemini 2.5 Flash audio (~500 ms)
 *
 * GET  /api/transcribe → { available, provider }
 * POST /api/transcribe → { audioBase64, mimeType, callsigns } → { transcript, provider, latencyMs }
 */

const AIRLINE_NAMES = {
  AAL: 'American',
  UAL: 'United',
  DAL: 'Delta',
  SWA: 'Southwest',
  JBU: 'JetBlue',
  ASA: 'Alaska',
  SKW: 'SkyWest',
  FFT: 'Frontier',
  NKS: 'Spirit',
  ENY: 'Envoy',
  RPA: 'Brickyard',
  EDV: 'Endeavor',
  QXE: 'Horizon',
  JIA: 'Blue Streak',
  ASH: 'Air Shuttle',
  FDX: 'FedEx',
  UPS: 'UPS',
};

function expandCallsign(cs) {
  const m = String(cs || '').toUpperCase().match(/^([A-Z]{2,3})(\d{1,4})$/);
  if (!m) return cs;
  const name = AIRLINE_NAMES[m[1]];
  return name ? `${name} ${m[2]}` : cs;
}

function buildAtcPrompt(callsigns) {
  const list = Array.isArray(callsigns) ? callsigns.slice(0, 12).map(expandCallsign).join(', ') : '';
  return [
    'Air traffic control radar clearance.',
    list ? `Active aircraft: ${list}.` : '',
    'Phraseology: fly heading, turn left heading, turn right heading, climb and maintain, descend and maintain, reduce speed, increase speed, knots, thousand.',
  ].filter(Boolean).join(' ');
}

function detectProvider() {
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.DEEPGRAM_API_KEY) return 'deepgram';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return null;
}

async function transcribeWithGroq(buffer, mimeType, callsigns) {
  const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : 'webm';
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), `ptt.${ext}`);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'en');
  form.append('temperature', '0');
  form.append('prompt', buildAtcPrompt(callsigns));

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${errText.slice(0, 160)}`);
  }
  const data = await res.json();
  return String(data?.text || '').trim();
}

async function transcribeWithDeepgram(buffer, mimeType, callsigns) {
  const params = new URLSearchParams({
    model: 'nova-2',
    language: 'en-US',
    smart_format: 'true',
    punctuate: 'false',
  });
  const list = Array.isArray(callsigns) ? callsigns.slice(0, 10) : [];
  for (const cs of list) {
    const expanded = expandCallsign(cs);
    if (expanded) params.append('keywords', `${expanded}:2`);
  }
  const res = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': mimeType || 'audio/webm',
    },
    body: buffer,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Deepgram ${res.status}: ${errText.slice(0, 160)}`);
  }
  const data = await res.json();
  return String(data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '').trim();
}

async function transcribeWithGemini(audioBase64, mimeType, callsigns) {
  const prompt = `${buildAtcPrompt(callsigns)} Transcribe ONLY the exact spoken words as plain text with no quotes or commentary. If silent, return empty string.`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType || 'audio/webm', data: audioBase64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 64 },
      }),
    },
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 160)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(' ') || '';
  return text.trim();
}

export default async function handler(req, res) {
  const provider = detectProvider();

  if (req.method === 'GET') {
    res.status(200).json({ available: Boolean(provider), provider });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!provider) {
    res.status(503).json({
      error: 'Cloud speech not configured. Add GROQ_API_KEY, DEEPGRAM_API_KEY, or GEMINI_API_KEY in Vercel.',
    });
    return;
  }

  const { audioBase64, mimeType = 'audio/webm', callsigns = [] } = req.body || {};
  if (!audioBase64 || typeof audioBase64 !== 'string') {
    res.status(400).json({ error: 'Missing audioBase64' });
    return;
  }

  const cleanMime = String(mimeType).split(';')[0] || 'audio/webm';
  const buffer = Buffer.from(audioBase64, 'base64');
  if (buffer.length < 400) {
    res.status(200).json({ transcript: '', provider, latencyMs: 0 });
    return;
  }

  const t0 = Date.now();
  try {
    let transcript = '';
    if (provider === 'groq') {
      transcript = await transcribeWithGroq(buffer, cleanMime, callsigns);
    } else if (provider === 'deepgram') {
      transcript = await transcribeWithDeepgram(buffer, cleanMime, callsigns);
    } else {
      transcript = await transcribeWithGemini(audioBase64, cleanMime, callsigns);
    }
    res.status(200).json({
      transcript,
      provider,
      latencyMs: Date.now() - t0,
    });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Transcription failed',
      provider,
      latencyMs: Date.now() - t0,
    });
  }
}
