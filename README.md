# OpenSTARS

OpenSTARS is a free, browser-based STARS-style ATC radar game. A controller vectors aircraft to exit gates, keeps them separated, and hears each aircraft read the clearance back.

The free web version is meant for classrooms **and** walk-up expositions. It runs with **no API key, no account, and no analytics**. Scenarios are built in the browser. Pilot voices are synthesized on the device.

## Which site this repo deploys to

Production for this repository is **[https://openstars-emulator.vercel.app](https://openstars-emulator.vercel.app)**.

That is the GitHub repository homepage, and it is the Vercel project (`openstars-emulator`) updated by this repo. The page title and HTML match this project. These other live demos are different builds and are not updated by this branch:

- https://macomber-openstars.vercel.app
- https://stars-gate.vercel.app

Do not treat a pull request as a production deploy. Vercel may publish a preview URL for the PR; production stays on the link above until someone promotes a deployment.

## Classroom and exposition demo

1. Open the site (or `npm run dev` locally). No login.
2. For a booth or first-time kid, press **Try the scope** (Expo Arcade): a **3-minute** shift with escalating waves, one curveball (medevac / NORDO / go-around), push-to-talk voice, tap-to-command, and a local high-score board.
3. After ~60s idle on the menu, **attract mode** auto-plays the “Press to be an Air Traffic Controller” banner; any key or tap starts a round. After the score screen the booth returns to attract.
4. For a longer lesson, pick **Trainee** (4), **Controller** (8), or **Veteran** (12). Replay the same traffic with a seed: open `?seed=1234`, or type a seed on the menu. Defaults are `expo-booth`, `trainee-1`, `controller-1`, and `veteran-1`. The active seed is shown on the scope while you play.
5. **Voice (PTT):** hold the big **HOLD TO TALK** button or **Spacebar**, speak a clearance (`American four twenty-one, turn left heading two seven zero`). Live transcript appears on screen; the pilot reads back with the existing TTS. Uses the free **Web Speech API** in Chrome/Edge. If the mic is missing or denied, tap or type still work. (In-browser Whisper was evaluated and deferred — see below.)
6. **Tap-to-command:** select a plane, then use the heading wheel / altitude chips / speed chips. The pad shows JO 7110.65-style phraseology before you issue.
7. Use **VOX**, volume, **RADIO**, and speech rate. Voice defaults to on. Browsers only start audio after a click or keypress, so the Kokoro model download begins on the first tap.
8. Score by exiting the assigned gate at a legal altitude. Arcade flashes **Perfect handoff +1000** (pilot “good day”) and a red **CONFLICT** alarm on loss of separation. End-of-round card includes a short FAA careers pointer (`faa.gov/jobs`).

No Gemini key is required. If `VITE_GEMINI_API_KEY` is set, longer modes may ask Gemini for a scenario and fall back to the seeded offline traffic when that request fails. Expo always stays offline and seeded (localStorage high scores only — no accounts, no network beyond optional model files).

### Voice recognition notes

| Engine | Status | Notes |
| --- | --- | --- |
| Web Speech API (`SpeechRecognition`) | **Primary** | Free, low latency, Chrome/Edge. Needs mic permission. Safari limited; Firefox usually unavailable. |
| Whisper via transformers.js (`whisper-tiny` / `base.en`) | **Deferred** | Another ~40–150MB on top of Kokoro (~92MB) plus WASM warm-up is too heavy for a walk-up booth laptop. Tap + type remain the offline fallback. |

Recognition accuracy depends on the browser cloud STT behind Web Speech: speak slowly, use telephony callsigns and digit groups (`niner`, `two seven zero`, `six thousand`). Fuzzy matching maps spoken airlines to aircraft on scope; unknown callers hear **station calling, say again**.

### Why ATC needs a different entertainment shape than pilot sims

Pilot sims sell embodiment: stick, view, landing. ATC is delayed feedback and attention splitting, so a pure procedure trainer feels slow on a booth. OpenSTARS leans into **radar theater**:

- Short arcade shifts instead of hour-long sectors
- Spectacle: PTT voice, pilot voices, pulsing target gates, big score flashes, conflict alarm
- Progressive control: voice → tap phraseology → typed command line
- One clear job per aircraft: get *this* plane through *that* glowing gate

Classroom mode keeps the fuller traffic count and typing. Expo arcade is the attract / walk-up path.

## Vector to Final (new)

Selectable from the main menu. Uses a deterministic fixed-timestep sim engine (`sim/`) with serializable actions (multiplayer/handoff foundation — networking not built yet).

- ILS RWY 28 final on centerline, or VOR RWY 28 with FAC offset +5°
- FAF, approach gate, extended centerline, range marks, wind (calm or from/speed)
- Intercept legality and approach clearance phraseology per JO 7110.65BB Chg 3 (¶5-9-1, ¶5-9-2/TBL 5-9-1, ¶5-9-4, ¶4-8-1); speed limits ¶5-7-1; wake Categories A–I ¶5-5-4; citations in `sim/citations.ts`
- PTT / typed / tap approach clearances; pilot readbacks via existing TTS
- Seeded, key-free, offline

## Pilot voices

Typed clearances are parsed with the same command grammar the scope already used. Each supported instruction has a fixed readback template. Nothing is sent to a language model to invent phraseology, so the words stay stable offline.

Speech uses **[Kokoro-82M](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX)** through **[kokoro-js](https://github.com/hexgrad/kokoro)** (Transformers.js / ONNX, WASM). It was chosen because one small model carries many distinct English voices, the weights are Apache-2.0, and the whole synthesis runs in the browser. There is no paid TTS API and no server to host.

- Quantized weights: `onnx/model_quantized.onnx` (Kokoro dtype `q8`), **92,361,116 bytes**, downloaded from Hugging Face the first time voice is used and stored in the browser HTTP cache.
- Each pilot voice file is **522,240 bytes** (`voices/<id>.bin`), downloaded on first use of that voice and stored in the Cache API (`kokoro-voices`).
- The ONNX runtime is **21,596,019 bytes**, served from this same site, and loads only after VOX is on and the user has clicked or typed. The page itself stays a normal Vite bundle. A headless Chromium run of the production build spoke the first readback about **24 seconds** after opening the page, which included that weight download and the first synthesis. Later visits use the cache. Blocking the model host falls back to the browser voice and the on-screen readback still appears.
- Eight voices are assigned from the callsign, so the same aircraft always sounds the same: `am_michael`, `am_fenrir`, `am_puck`, `af_bella`, `af_nicole`, `af_sarah`, `am_echo`, `af_sky`.
- If the model cannot be fetched, WASM fails, or the first synthesis takes longer than about 8 seconds, the app switches to the browser **Web Speech API** (`speechSynthesis`) and labels the control **BROWSER**. Readback text still appears either way.
- The radio toggle runs the neural audio through a high-pass / low-pass pair, a little presence, mild saturation, and quiet filtered noise. The browser speech fallback cannot use that effect.

### Licenses (code and weights)

Free for a public school demo:

| Piece | License |
| --- | --- |
| `kokoro-js` | Apache-2.0 |
| Kokoro-82M weights and the voice style files in `onnx-community/Kokoro-82M-v1.0-ONNX` (upstream [hexgrad/kokoro](https://github.com/hexgrad/kokoro)) | Apache-2.0 |
| `@huggingface/transformers`, `onnxruntime-web` | Apache-2.0 |
| `phonemizer`, which Kokoro uses for grapheme-to-phoneme | Apache-2.0 package. It embeds **eSpeak NG**, which is **GPL-3.0**. The pronunciation engine is the GPL part of the voice stack. |
| Web Speech API fallback | Built into the browser. No extra download and no extra license fee. |

The iOS wrapper is still the existing Capacitor project (`webDir: dist`). Neural TTS is loaded only in the web view; if WASM is unavailable there, readbacks use `speechSynthesis` and the on-screen log.

## Command reference and example readbacks

Callsign, then instructions. Spaces between the letter and the number are optional. Headings are three digits (`090`, not `90`). Altitude is hundreds of feet (`070` = 7,000). Several instructions may share one line.

Numbers follow JO 7110.65 / AIM radiotelephony: headings and speeds are individual digits, the digit 9 is "niner", altitudes are thousands and hundreds (`one zero thousand`, `niner thousand`), and airline callsigns use telephony plus group form (`American four twenty-one`). The pilot says **say again** when nothing in the line is a known instruction, and **unable** when a number is outside what this scope accepts (heading above 360, altitude outside 1,000–17,000 feet, speed outside 100–350 knots). An unknown callsign is a scope message, not a pilot.

Examples below assume the aircraft is not already on that heading, altitude, or speed. `H` / `HDG` / `T` turn the short way. `TL` / `TR` force a direction.

| Typed | Pilot readback |
| --- | --- |
| `AAL421 H270` (from heading 090) | Turn right heading two seven zero, American four twenty-one |
| `AAL421 TL270` | Turn left heading two seven zero, American four twenty-one |
| `UAL123 TR090` | Turn right heading zero niner zero, United one twenty-three |
| `UAL123 HDG180` (already heading 180) | Heading one eight zero, United one twenty-three |
| `UAL123 A100` (from 7,000) | Climb and maintain one zero thousand, United one twenty-three |
| `AAL421 A060` (from above 6,000) | Descend and maintain six thousand, American four twenty-one |
| `UAL123 A070` (already at 7,000) | Maintain seven thousand, United one twenty-three |
| `UAL123 C110` | Climb and maintain one one thousand, United one twenty-three |
| `UAL123 ALT 095` (from 10,000) | Descend and maintain niner thousand five hundred, United one twenty-three |
| `SWA890 S250` (from slower) | Increase speed to two five zero knots, Southwest eight ninety |
| `SKW221 S180` (from faster) | Reduce speed to one eight zero knots, SkyWest two twenty-one |
| `ASH310 SPD210` (already 210) | Maintain two one zero knots, Air Shuttle three ten |
| `AAL404 TL270 S210 A060` | Turn left heading two seven zero, descend and maintain six thousand, reduce speed to two one zero knots, American four zero four |
| `AAL421 H360` (from heading 090) | Turn left heading three six zero, American four twenty-one |
| `UAL123 CLIMB NOW` | Say again, United one twenty-three |
| `UAL123 H999` | Unable, United one twenty-three |
| `ZZZ999 H090` | Scope: `TARGET ZZZ999 NOT FOUND` |

Accepted aliases: `HDG` and `T` for a shortest-turn heading, `TLH` / `TRH` for a forced turn, `ALT` and `C` for altitude, `SPD` for speed.

## Run locally

```bash
npm install
npm test
npm run dev
npm run build
```

`npm test` checks phraseology, the command parser, and the offline scenario. The dev server is http://localhost:8080.

Optional environment variables (none are required):

- `VITE_GEMINI_API_KEY` — optional scenario text from Gemini. Omit it for the classroom build.
- `VITE_POSTHOG_KEY` — optional analytics. **Unset by default.** The app does not load PostHog and does not record sessions unless this is set. There is no key in the source.

## Rules and procedures

Guide aircraft from their entry points to their assigned exit gates. Keep separation, and cross the gate at a legal altitude.

### Objectives

- **Guide aircraft to exit gates.** The data block shows a 3-letter exit: `NOR`, `SOU`, `EAS`, `WES`.
- **Maintain separation.**
- **Verify altitudes** at the exit.

### Scoring

- **Perfect exit (+1000):** through the center of the correct gate, at the correct altitude, without touching the corridor lines.
- **Sloppy exit (+500):** correct gate, but overlapping the boundary lines.
- **Wrong altitude (−250):** correct gate, illegal altitude.
- **Wrong gate (−500).**
- **Off course (−200):** leaves through a wall instead of a gate.
- **Separation bust (−50 per tick)** while two aircraft are in a red loss-of-separation state.

The score does not go below zero.

### Altitude rules

| Exit gate | Valid altitudes | Rule |
| --- | --- | --- |
| NORTH (NOR) | 7,000 and 9,000 | Odd |
| EAST (EAS) | 7,000 and 9,000 | Odd |
| SOUTH (SOU) | 6,000 and 8,000 | Even |
| WEST (WES) | 6,000 and 8,000 | Even |

### Separation

- Lateral: 3 nautical miles.
- Vertical: 1,000 feet.
- If aircraft are diverging by 15 degrees or more, lateral separation is not required.

Red means less than 3 NM and converging. Yellow means less than 4 NM, or diverging inside 3 NM.

### Data blocks and sim speed

Click a target or type the callsign. Move the data-block label with the numpad or arrow keys. While the command box is focused, hold Shift. Sim speed is 1x, 2x, 4x, or 10x.

## iOS

`capacitor.config.ts` is unchanged (`appId` `com.openstars.emulator`, `webDir` `dist`). Build the web app with `npm run build`, then use the existing Capacitor iOS project. Pilot voices do not add a native plugin.
