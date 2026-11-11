import React, { useEffect, useState } from 'react';
import { Play, Trophy, ChevronRight, Sparkles } from 'lucide-react';
import { ScenarioDifficulty, StartOptions } from '../types';
import { DEFAULT_SCENARIO_SEEDS, readSeedFromLocation, resolveSeedInput } from '../services/scenarioSeed';
import { getVoiceRuntime, subscribeVoiceRuntime, useBasicVoiceNow, VoiceRuntime } from '../services/pilotVoice';
import VoicePreloadBanner from './VoicePreloadBanner';

interface MainMenuProps {
  onStart: (options: StartOptions | string) => void;
  onOpenVtf?: () => void;
  highScore: number;
  activeSeed?: string | null;
}

const MODES: Array<{
  id: ScenarioDifficulty;
  label: string;
  desc: string;
  badge?: string;
}> = [
  { id: 'Expo', label: 'EXPO ARCADE', desc: '5 min · fast traffic · PTT voice · waves', badge: 'BOOTHS' },
  { id: 'Easy', label: 'TRAINEE', desc: '4 aircraft · classroom starter' },
  { id: 'Medium', label: 'CONTROLLER', desc: '8 aircraft · standard lesson' },
  { id: 'Hard', label: 'VETERAN', desc: '12 aircraft · heavy traffic' },
];

const MainMenu: React.FC<MainMenuProps> = ({ onStart, onOpenVtf, highScore, activeSeed = null }) => {
  const [difficulty, setDifficulty] = useState<ScenarioDifficulty>('Expo');
  const urlSeed = readSeedFromLocation();
  const [seedInput, setSeedInput] = useState(urlSeed || activeSeed || DEFAULT_SCENARIO_SEEDS.Expo);
  const [voice, setVoice] = useState<VoiceRuntime>(getVoiceRuntime);
  const [startHint, setStartHint] = useState<string | null>(null);

  useEffect(() => {
    if (urlSeed) setSeedInput(urlSeed);
  }, [urlSeed]);

  useEffect(() => subscribeVoiceRuntime(() => setVoice(getVoiceRuntime())), []);

  const voicesLoading = voice.phase === 'loading';

  const handleStart = (level: ScenarioDifficulty = difficulty) => {
    if (voicesLoading) {
      setStartHint('Voices still loading — start anyway? Readbacks use basic voice until neural is ready.');
    } else {
      setStartHint(null);
    }
    const resolved = resolveSeedInput(seedInput || DEFAULT_SCENARIO_SEEDS[level], level);
    onStart({ difficulty: level, seedLabel: resolved.display });
  };

  const startWithBasic = (level: ScenarioDifficulty = difficulty) => {
    useBasicVoiceNow();
    setStartHint(null);
    handleStart(level);
  };

  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center text-green-500 font-mono p-3 md:p-6 select-none overflow-y-auto">
      <div className="w-full max-w-5xl grid gap-4 lg:grid-cols-[1.1fr_0.9fr] items-start">
        <div className="space-y-4">
          <div className="text-center lg:text-left space-y-2">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white drop-shadow-[0_0_10px_rgba(20,241,149,0.8)]">
              OPEN<span className="text-green-500">STARS</span>
            </h1>
            <div className="text-gray-400 tracking-widest text-sm md:text-base">ATC RADAR GAME</div>
            <div className="text-gray-500 text-xs md:text-sm">
              Classrooms · STEM expos · no account · no API key
            </div>
          </div>

          <VoicePreloadBanner />

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              data-testid="expo-start"
              onClick={() => handleStart('Expo')}
              className="w-full bg-green-500 hover:bg-green-400 text-black font-bold text-xl md:text-2xl py-5 px-3 rounded shadow-[0_0_30px_rgba(20,241,149,0.45)] transition-all flex flex-col items-center justify-center gap-1"
            >
              <span className="flex items-center gap-2"><Play fill="black" size={24} /> TRY THE SCOPE</span>
              <span className="text-xs font-normal tracking-wide opacity-80">
                {voicesLoading
                  ? 'Voices still loading — start anyway?'
                  : '5-min arcade · fast jets · voice'}
              </span>
            </button>

            {onOpenVtf && (
              <button
                type="button"
                data-testid="vtf-menu"
                onClick={onOpenVtf}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xl md:text-2xl py-5 px-3 rounded shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all flex flex-col items-center justify-center gap-1"
              >
                <span className="flex items-center gap-2"><Play fill="black" size={24} /> VECTOR TO FINAL</span>
                <span className="text-xs font-normal tracking-wide opacity-80">
                  ILS &amp; VOR intercept · localizer · wake
                </span>
              </button>
            )}
          </div>
          {voicesLoading && (
            <button
              type="button"
              data-testid="expo-start-basic"
              onClick={() => startWithBasic('Expo')}
              className="w-full border border-amber-700/60 text-amber-200 hover:bg-amber-950/40 font-bold py-3 rounded text-sm"
            >
              Start Expo with basic voice
            </button>
          )}
          {startHint && (
            <div data-testid="voice-start-hint" className="text-xs text-amber-200/90 bg-amber-950/30 border border-amber-800/40 rounded px-3 py-2">
              {startHint}
            </div>
          )}

          <div className="flex flex-wrap gap-3 items-center justify-between bg-gray-950 border border-gray-800 rounded p-3">
            <div className="flex items-center gap-2 text-sm">
              <Trophy size={16} className="text-yellow-500" />
              <span className="text-gray-400">BEST</span>
              <span className="text-white font-bold text-lg">{highScore}</span>
            </div>
            <label className="flex items-center gap-2 text-xs md:text-sm text-gray-400">
              <span className="uppercase tracking-wider">Seed</span>
              <input
                data-testid="seed-input"
                value={seedInput}
                onChange={(event) => setSeedInput(event.target.value)}
                className="w-36 md:w-44 bg-black border border-gray-700 rounded px-2 py-2 text-green-300 font-mono text-sm focus:border-green-500 focus:outline-none"
                placeholder="1234"
                aria-label="Scenario seed"
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-gray-500 uppercase tracking-wider ml-1">Pick a session</div>
            {MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                data-testid={`mode-${mode.id}`}
                onClick={() => {
                  setDifficulty(mode.id);
                  if (!urlSeed && (!seedInput || Object.values(DEFAULT_SCENARIO_SEEDS).includes(seedInput))) {
                    setSeedInput(DEFAULT_SCENARIO_SEEDS[mode.id]);
                  }
                }}
                className={`w-full flex items-center justify-between p-4 md:p-5 rounded border transition-all text-left ${
                  difficulty === mode.id
                    ? 'bg-green-900/30 border-green-500 text-white shadow-[0_0_15px_rgba(20,241,149,0.1)]'
                    : 'bg-black border-gray-800 text-gray-500 hover:border-gray-600'
                }`}
              >
                <div>
                  <div className={`font-bold text-lg md:text-xl flex items-center gap-2 ${difficulty === mode.id ? 'text-green-400' : 'text-gray-400'}`}>
                    {mode.label}
                    {mode.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-600 text-amber-300">{mode.badge}</span>
                    )}
                  </div>
                  <div className="text-xs md:text-sm opacity-70">{mode.desc}</div>
                </div>
                {difficulty === mode.id && <ChevronRight className="text-green-500" />}
              </button>
            ))}
            {onOpenVtf && (
              <button
                type="button"
                data-testid="mode-vtf"
                onClick={onOpenVtf}
                className="w-full flex items-center justify-between p-4 md:p-5 rounded border transition-all text-left bg-cyan-950/30 border-cyan-600/80 text-white hover:bg-cyan-900/40 shadow-[0_0_15px_rgba(6,182,212,0.12)]"
              >
                <div>
                  <div className="font-bold text-lg md:text-xl flex items-center gap-2 text-cyan-300">
                    VECTOR TO FINAL
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-cyan-500 text-cyan-200">ILS / VOR</span>
                  </div>
                  <div className="text-xs md:text-sm text-cyan-100/70">Final approach course intercept · FAF · wake separation</div>
                </div>
                <ChevronRight className="text-cyan-400" />
              </button>
            )}
          </div>

          <button
            type="button"
            data-testid="start-selected"
            onClick={() => handleStart()}
            className="w-full bg-green-700 hover:bg-green-600 text-white font-bold text-xl rounded transition-all flex flex-col items-center justify-center gap-1 py-4"
          >
            <span className="flex items-center gap-2"><Play size={18} /> START {difficulty.toUpperCase()}</span>
            {voicesLoading && (
              <span className="text-[11px] font-normal text-green-100/80">Voices still loading — start anyway?</span>
            )}
          </button>
          {voicesLoading && (
            <button
              type="button"
              data-testid="start-selected-basic"
              onClick={() => startWithBasic()}
              className="w-full border border-amber-700/60 text-amber-200 hover:bg-amber-950/40 font-bold py-3 rounded text-sm"
            >
              Start with basic voice
            </button>
          )}
        </div>

        <aside className="bg-gray-950 border border-gray-800 rounded p-4 md:p-5 space-y-4 text-gray-300">
          <div className="flex items-center gap-2 text-green-400 font-bold text-lg">
            <Sparkles size={18} /> HOW TO PLAY
          </div>
          <ol className="space-y-3 text-sm md:text-base leading-relaxed list-decimal list-inside">
            <li>Select an aircraft on the scope.</li>
            <li>Turn and climb or descend it toward its exit gate.</li>
            <li>Keep planes 3 miles / 1,000 ft apart.</li>
            <li>Hit the gate at a legal altitude to score.</li>
          </ol>

          <div>
            <div className="text-green-400 font-bold text-sm uppercase tracking-wider mb-2">Command examples</div>
            <div className="space-y-2 font-mono text-xs md:text-sm bg-black/60 border border-gray-800 rounded p-3">
              <div><span className="text-cyan-400">AAL421 TL270</span> <span className="text-gray-500">turn left heading 270</span></div>
              <div><span className="text-cyan-400">UAL123 A060</span> <span className="text-gray-500">descend/climb to 6,000</span></div>
              <div><span className="text-cyan-400">DAL456 A100</span> <span className="text-gray-500">10,000 ft</span></div>
              <div><span className="text-cyan-400">SWA890 S210</span> <span className="text-gray-500">speed 210</span></div>
              <div><span className="text-cyan-400">AAL404 TL270 A060 S210</span> <span className="text-gray-500">combo</span></div>
            </div>
          </div>

          <div className="text-xs md:text-sm text-gray-500 space-y-1">
            <div>N/E exits: <span className="text-white">A070 or A090</span></div>
            <div>S/W exits: <span className="text-white">A060 or A080</span></div>
            <div>
              Replay a period with the same traffic:
              {' '}<span className="text-green-300">?seed=1234</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MainMenu;
