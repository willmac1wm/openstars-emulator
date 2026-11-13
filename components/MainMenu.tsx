import React, { useEffect, useState } from 'react';
import { Play, Lock, Sparkles, Timer } from 'lucide-react';
import { ScenarioDifficulty, StartOptions } from '../types';
import { DEFAULT_SCENARIO_SEEDS, readSeedFromLocation, resolveSeedInput } from '../services/scenarioSeed';
import DesktopDownload from './DesktopDownload';
import { ENABLE_VECTOR_TO_FINAL } from '../services/features';
import { isDesktopApp } from '../services/desktop';
import {
  dailyLabelForDate,
  dailySeedToday,
  isModeUnlocked,
  nextRank,
  nextUnlock,
  rankFor,
  saveProfile,
  unlockRequirement,
  PlayerProfile,
  Progress,
} from '../services/progression';
import { sanitizeInitials } from '../services/highScores';

interface MainMenuProps {
  onStart: (options: StartOptions | string) => void;
  onTutorial?: () => void;
  onOpenVtf?: () => void;
  highScore: number;
  activeSeed?: string | null;
  /** Reserved for callers; sessions never force the tutorial. */
  tutorialDone?: boolean;
  profile?: PlayerProfile;
  onProfileChange?: (profile: PlayerProfile) => void;
  progress?: Progress | null;
  onOpenLeaderboard?: () => void;
  onOpenInstructor?: () => void;
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

/**
 * Simplified menu (Nov 2026, William's call): title + five session cards +
 * How to Play + one footer line. Everything else moved, not deleted:
 * - Voice loading lives nowhere on the menu — natural voices load silently
 *   in the background, Fast voice is the default (see pilotVoice).
 * - Quick Tips / command examples live in the guided tutorial.
 * - Gate altitudes live on the scope, next to each gate (RadarScope).
 * - The seed field hides behind the footer's "replay" link.
 * - Profile / rank / unlocks collapse to the footer line; tapping the rank
 *   reveals the initials editor, Class Scores stays one tap away.
 */
const MainMenu: React.FC<MainMenuProps> = ({
  onStart,
  onTutorial,
  onOpenVtf,
  highScore,
  activeSeed = null,
  profile,
  onProfileChange,
  progress,
  onOpenLeaderboard,
  onOpenInstructor,
}) => {
  const urlSeed = readSeedFromLocation();
  const [seedInput, setSeedInput] = useState(urlSeed || activeSeed || DEFAULT_SCENARIO_SEEDS.Expo);
  const [seedOpen, setSeedOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [initialsInput, setInitialsInput] = useState(profile?.initials ?? 'ATC');
  const [lockedHint, setLockedHint] = useState<string | null>(null);
  const dailySeed = dailySeedToday();
  const rank = progress ? rankFor(progress) : null;
  const rankNext = progress ? nextRank(progress) : null;
  const unlockNext = progress ? nextUnlock(progress) : null;
  // Keep VTF off production until Will green-lights it (code remains for the polish PR).
  const showVtf = ENABLE_VECTOR_TO_FINAL && Boolean(onOpenVtf);

  useEffect(() => {
    if (urlSeed) setSeedInput(urlSeed);
  }, [urlSeed]);

  const handleStart = (level: ScenarioDifficulty) => {
    const seed =
      !urlSeed && (!seedInput || Object.values(DEFAULT_SCENARIO_SEEDS).includes(seedInput))
        ? DEFAULT_SCENARIO_SEEDS[level]
        : seedInput || DEFAULT_SCENARIO_SEEDS[level];
    const resolved = resolveSeedInput(seed, level);
    onStart({ difficulty: level, seedLabel: resolved.display });
  };

  const startMode = (mode: (typeof MODES)[number]) => {
    if (progress && !isModeUnlocked(progress, mode.id)) {
      setLockedHint(unlockRequirement(mode.id));
      return;
    }
    setLockedHint(null);
    handleStart(mode.id);
  };

  const sixtySecondCard = (
    <button
      type="button"
      data-testid="mode-Expo60"
      onClick={() => onStart({ difficulty: 'Expo60', seedLabel: 'sixty-1' })}
      className="w-full flex items-center justify-between p-4 md:p-5 rounded border transition-all text-left bg-black border-gray-800 text-gray-500 hover:border-green-500 hover:text-white"
    >
      <div>
        <div className="font-bold text-lg md:text-xl flex items-center gap-2 text-gray-200">
          <Timer size={16} className="text-cyan-400" />
          60-SECOND CHALLENGE
        </div>
        <div className="text-xs md:text-sm opacity-70">Beat the clock · waves at 0 / 12 / 24s</div>
      </div>
      <span className="text-green-500 text-xl" aria-hidden>›</span>
    </button>
  );

  return (
    // Scroll from the true top at every viewport height. Do NOT use justify-center on the
    // overflow container — that clips the logo above the fold on short windows.
    <div
      data-testid="main-menu"
      className="absolute inset-0 z-50 bg-black text-green-500 font-mono select-none overflow-y-auto overscroll-contain touch-pan-y"
    >
      <div className="w-full min-h-full flex flex-col items-center justify-start p-3 md:p-6 py-6 md:py-8">
        <div className="w-full max-w-xl space-y-4">
          <div className="text-center space-y-2">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white drop-shadow-[0_0_10px_rgba(20,241,149,0.8)]">
              OPEN<span className="text-green-500">STARS</span>
            </h1>
            <div className="text-gray-400 tracking-widest text-sm md:text-base">ATC RADAR GAME</div>
            <div className="text-gray-500 text-xs md:text-sm">
              Classrooms · STEM expos · no account · no API key
            </div>
          </div>

          {onTutorial && (
            <button
              type="button"
              data-testid="how-to-play"
              onClick={onTutorial}
              className="w-full bg-cyan-900/50 hover:bg-cyan-800/60 border border-cyan-600/70 text-cyan-100 font-bold text-xl md:text-2xl py-4 px-3 rounded transition-all flex flex-col items-center justify-center gap-1"
            >
              <span className="flex items-center gap-2"><Sparkles size={22} /> HOW TO PLAY</span>
              <span className="text-xs font-normal tracking-wide opacity-80">
                Narrated tutorial · dial · type · Issue
              </span>
            </button>
          )}

          {showVtf && (
            <button
              type="button"
              data-testid="vtf-menu"
              onClick={onOpenVtf}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xl md:text-2xl py-4 px-3 rounded shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all flex flex-col items-center justify-center gap-1"
            >
              <span className="flex items-center gap-2"><Play fill="black" size={24} /> VECTOR TO FINAL</span>
              <span className="text-xs font-normal tracking-wide opacity-80">
                ILS &amp; VOR intercept · localizer · wake
              </span>
            </button>
          )}

          <div className="space-y-2">
            <div className="text-xs text-gray-500 uppercase tracking-wider ml-1">Pick a session</div>
            {lockedHint && (
              <div data-testid="locked-hint" className="text-xs text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded px-3 py-2">
                {lockedHint} Expo Arcade and the 60-Second Challenge are always open.
              </div>
            )}
            {MODES.map((mode) => {
              const locked = Boolean(progress && !isModeUnlocked(progress, mode.id));
              const requirement = unlockRequirement(mode.id);
              const card = (
                <button
                  key={mode.id}
                  type="button"
                  data-testid={`mode-${mode.id}`}
                  disabled={locked}
                  onClick={() => startMode(mode)}
                  className={`w-full flex items-center justify-between p-4 md:p-5 rounded border transition-all text-left ${
                    locked
                      ? 'bg-black border-gray-900 text-gray-600 cursor-not-allowed'
                      : 'bg-black border-gray-800 text-gray-500 hover:border-green-500 hover:text-white'
                  }`}
                >
                  <div>
                    <div className="font-bold text-lg md:text-xl flex items-center gap-2 text-gray-200">
                      {locked && <Lock size={16} className="text-gray-600" />}
                      {mode.label}
                      {mode.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-600 text-amber-300">{mode.badge}</span>
                      )}
                    </div>
                    <div className="text-xs md:text-sm opacity-70">{locked && requirement ? requirement : mode.desc}</div>
                  </div>
                  <span className="text-green-500 text-xl" aria-hidden>›</span>
                </button>
              );
              // Session order: Expo, 60-Second, Trainee, Controller, Veteran.
              return mode.id === 'Expo' ? [card, sixtySecondCard] : card;
            })}
          </div>

          {/* Keep expo-start as alias for Expo session start (tests / attract). Never forces tutorial. */}
          <button
            type="button"
            data-testid="expo-start"
            onClick={() => handleStart('Expo')}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          >
            Start Expo
          </button>

          <div className="text-center space-y-2 pt-1">
            <div className="text-sm text-gray-400">
              <span className="text-gray-500">BEST</span>{' '}
              <span className="text-white font-bold">{highScore}</span>
              {' · '}
              <button
                type="button"
                data-testid="profile-open"
                onClick={() => setProfileOpen((open) => !open)}
                className="text-green-400 font-bold hover:underline"
                aria-expanded={profileOpen}
              >
                RANK: {rank ? rank.name : 'TRAINEE'}
              </button>
              {progress && (
                <span className="text-gray-500">
                  {' · '}{progress.totalCleanExits} clean exits · {progress.totalSessions} sessions
                </span>
              )}
            </div>
            {profileOpen && (
              <div data-testid="profile-editor" className="flex flex-wrap items-center justify-center gap-2 text-xs md:text-sm text-gray-400">
                <label className="flex items-center gap-2">
                  <span className="uppercase tracking-wider">Your initials</span>
                  <input
                    data-testid="profile-initials-input"
                    value={initialsInput}
                    maxLength={3}
                    onChange={(event) => {
                      const next = sanitizeInitials(event.target.value);
                      setInitialsInput(next);
                      if (next.length === 3) onProfileChange?.(saveProfile({ initials: next }));
                    }}
                    onBlur={() => onProfileChange?.(saveProfile({ initials: initialsInput }))}
                    className="w-20 bg-black border border-gray-700 rounded px-2 py-2 text-center text-green-300 font-mono text-sm uppercase tracking-[0.3em] focus:border-green-500 focus:outline-none"
                    aria-label="Your initials"
                  />
                </label>
                <span className="text-[11px] text-gray-500">Saved on this device only — no account</span>
                {rankNext && (
                  <span className="text-[11px] text-gray-500">
                    {rankNext.have}/{rankNext.need} clean exits to {rankNext.rank.name}
                  </span>
                )}
                {unlockNext && (
                  <span data-testid="next-unlock" className="text-[11px] text-amber-300">
                    Next unlock: {unlockNext.label} — {unlockNext.have}/{unlockNext.need} clean exits in {unlockNext.mode === 'Medium' ? 'TRAINEE' : 'CONTROLLER'}
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs md:text-sm">
              <button
                type="button"
                data-testid="daily-challenge"
                onClick={() => onStart({ difficulty: 'Easy', seedLabel: dailySeed, daily: true })}
                className="text-amber-300 hover:underline"
              >
                TODAY&apos;S CHALLENGE · {dailyLabelForDate(new Date())}
              </button>
              {onOpenLeaderboard && (
                <button
                  type="button"
                  data-testid="leaderboard-open"
                  onClick={onOpenLeaderboard}
                  className="text-yellow-300 hover:underline"
                >
                  LEADERBOARD
                </button>
              )}
              {onOpenInstructor && (
                <button
                  type="button"
                  data-testid="instructor-open"
                  onClick={onOpenInstructor}
                  className="text-gray-200 hover:underline"
                >
                  CLASS SCORES
                </button>
              )}
              <button
                type="button"
                data-testid="replay-seed-toggle"
                onClick={() => setSeedOpen((open) => !open)}
                className="text-gray-500 hover:underline"
                aria-expanded={seedOpen}
              >
                replay
              </button>
            </div>
            {seedOpen && (
              <label className="flex items-center justify-center gap-2 text-xs md:text-sm text-gray-400">
                <span className="uppercase tracking-wider">Seed</span>
                <input
                  data-testid="seed-input"
                  value={seedInput}
                  onChange={(event) => setSeedInput(event.target.value)}
                  className="w-36 md:w-44 bg-black border border-gray-700 rounded px-2 py-2 text-green-300 font-mono text-sm focus:border-green-500 focus:outline-none"
                  placeholder="1234"
                  aria-label="Scenario seed"
                />
                <span className="text-gray-500">Replay a period with the same traffic: ?seed=1234</span>
              </label>
            )}
          </div>
        </div>
        {!isDesktopApp() && <DesktopDownload />}
      </div>
    </div>
  );
};

export default MainMenu;
