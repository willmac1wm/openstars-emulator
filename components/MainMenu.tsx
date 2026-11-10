import React, { useEffect, useState } from 'react';
import { Play, Trophy, Info, ChevronRight, BookOpen, Target, Command, Map, Sparkles } from 'lucide-react';
import { ScenarioDifficulty, StartOptions } from '../types';

interface MainMenuProps {
  onStart: (options: StartOptions | string) => void;
  highScore: number;
}

const MODES: Array<{
  id: ScenarioDifficulty;
  label: string;
  desc: string;
  badge?: string;
}> = [
  { id: 'Expo', label: 'EXPO HOT SEAT', desc: '90-second booth demo. Three planes. Big buttons. Voice on.', badge: 'WALK-UP' },
  { id: 'Easy', label: 'TRAINEE', desc: 'Four aircraft. Classroom starter.' },
  { id: 'Medium', label: 'CONTROLLER', desc: 'Eight aircraft. Standard lesson.' },
  { id: 'Hard', label: 'VETERAN', desc: 'Twelve aircraft. Heavy traffic.' },
];

const ATTRACT_LINES = [
  'Pilots get flight sims. You get the radar.',
  'Click a plane. Turn it. Climb it. Send it through the gate.',
  'Hear the pilots talk back. No headset required.',
  'Keep them apart. Hit the right altitude. Score big.',
];

const MainMenu: React.FC<MainMenuProps> = ({ onStart, highScore }) => {
  const [difficulty, setDifficulty] = useState<ScenarioDifficulty>('Expo');
  const [showRules, setShowRules] = useState(false);
  const [attractIndex, setAttractIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setAttractIndex((index) => (index + 1) % ATTRACT_LINES.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const handleStart = (level: ScenarioDifficulty = difficulty) => {
    onStart({ difficulty: level });
  };

  if (showRules) {
    return (
      <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center text-green-500 font-mono p-4 select-none">
        <div className="bg-gray-900 border border-green-500 rounded max-w-3xl w-full max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(20,241,149,0.2)] overflow-hidden">
          <div className="bg-gray-900 p-6 border-b border-green-900 shrink-0">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-green-500">
              <BookOpen /> HOW OPENSTARS WORKS
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-8 text-gray-300 text-sm">
            <section className="space-y-2">
              <h3 className="text-green-400 font-bold text-lg flex items-center gap-2">
                <Sparkles size={18} /> FOR BOOTHS AND KIDS
              </h3>
              <p>
                Start with <strong className="text-white">Expo Hot Seat</strong>. Three aircraft, short run, glowing exit
                gates, and big command chips so a walk-up guest can play without learning the full keyboard language.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-green-400 font-bold text-lg flex items-center gap-2">
                <Map size={18} /> THE MISSION
              </h3>
              <p>
                You are the controller. Aircraft enter your sector. Guide each one to its assigned
                <strong className="text-white"> EXIT GATE</strong> at a legal altitude, and keep them separated.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-green-400 font-bold text-lg flex items-center gap-2">
                <Target size={18} /> READING THE SCOPE
              </h3>
              <p>The three-letter code on the data block is the exit: NOR, SOU, EAS, or WES.</p>
            </section>
            <section className="space-y-2">
              <h3 className="text-green-400 font-bold text-lg flex items-center gap-2">
                <Command size={18} /> COMMANDS
              </h3>
              <p>
                Type <span className="text-white">AAL421 TL270 A060</span>, or tap the quick chips after selecting a plane.
                The pilot reads it back on the speaker and in the log.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-green-400 font-bold text-lg">ALTITUDE RULES</h3>
              <ul className="text-xs space-y-1 mt-2">
                <li className="flex justify-between border-b border-gray-800 pb-1">
                  <span>NORTH / EAST</span>
                  <span className="font-bold text-white">A070 or A090</span>
                </li>
                <li className="flex justify-between pt-1">
                  <span>SOUTH / WEST</span>
                  <span className="font-bold text-white">A060 or A080</span>
                </li>
              </ul>
            </section>
          </div>
          <div className="bg-gray-900 p-4 border-t border-gray-800 shrink-0">
            <button
              onClick={() => setShowRules(false)}
              className="w-full bg-green-700 hover:bg-green-600 text-white py-3 rounded font-bold uppercase tracking-widest shadow-lg transition-all"
            >
              Back to menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center text-green-500 font-mono p-4 select-none">
      <div className="w-full max-w-md space-y-6 animate-in zoom-in">
        <div className="text-center space-y-2">
          <h1 className="text-6xl font-bold tracking-tighter text-white drop-shadow-[0_0_10px_rgba(20,241,149,0.8)]">
            OPEN<span className="text-green-500">STARS</span>
          </h1>
          <div className="text-gray-400 tracking-widest text-sm">ATC RADAR GAME</div>
          <div className="text-gray-500 text-xs min-h-[2.5rem] px-2" aria-live="polite">
            {ATTRACT_LINES[attractIndex]}
          </div>
        </div>

        <button
          data-testid="expo-start"
          onClick={() => handleStart('Expo')}
          className="w-full bg-green-500 hover:bg-green-400 text-black font-bold text-xl py-5 rounded shadow-[0_0_30px_rgba(20,241,149,0.45)] transition-all flex flex-col items-center gap-1"
        >
          <span className="flex items-center gap-2"><Play fill="black" /> TRY THE SCOPE</span>
          <span className="text-[11px] font-normal tracking-wide opacity-80">Expo hot seat · no account · ~90 seconds</span>
        </button>

        <div className="flex justify-center text-sm">
          <div className="bg-gray-900 px-4 py-2 rounded border border-gray-800 flex items-center gap-2">
            <Trophy size={14} className="text-yellow-500" />
            <span className="text-gray-400">BEST SCORE:</span>
            <span className="text-white font-bold">{highScore}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 ml-1">Or pick a longer session</div>
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setDifficulty(mode.id)}
              className={`w-full flex items-center justify-between p-4 rounded border transition-all ${
                difficulty === mode.id
                  ? 'bg-green-900/30 border-green-500 text-white shadow-[0_0_15px_rgba(20,241,149,0.1)]'
                  : 'bg-black border-gray-800 text-gray-500 hover:border-gray-600'
              }`}
            >
              <div className="text-left">
                <div className={`font-bold flex items-center gap-2 ${difficulty === mode.id ? 'text-green-400' : 'text-gray-400'}`}>
                  {mode.label}
                  {mode.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-amber-600 text-amber-300">{mode.badge}</span>
                  )}
                </div>
                <div className="text-xs opacity-70">{mode.desc}</div>
              </div>
              {difficulty === mode.id && <ChevronRight className="text-green-500" />}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleStart()}
            className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-3 rounded transition-all flex items-center justify-center gap-2"
          >
            <Play size={16} /> START {difficulty.toUpperCase()}
          </button>
          <button
            onClick={() => setShowRules(true)}
            className="w-full bg-transparent hover:bg-gray-900 text-gray-400 hover:text-white py-3 rounded border border-gray-800 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Info size={16} /> HOW TO PLAY
          </button>
        </div>

        <div className="text-center text-[10px] text-gray-600 space-y-1">
          <div>No login. No API key. Built for classrooms and expositions.</div>
          <div>v2.2.0 · OpenSTARS</div>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
