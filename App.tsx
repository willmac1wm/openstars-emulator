
import React, { useState, useEffect, useRef, useCallback } from 'react';
import RadarScope from './components/RadarScope';
import ControlPanel from './components/ControlPanel';
import MainMenu from './components/MainMenu';
import SummaryScreen from './components/SummaryScreen';
import FlightStripBay from './components/FlightStripBay';
import ReferencePanel from './components/ReferencePanel';
import AttractMode from './components/AttractMode';
import ArcadeSummary from './components/ArcadeSummary';
import LeaderboardView from './components/LeaderboardView';
import InstructorView from './components/InstructorView';
import ExpoArcadeHUD from './components/ExpoArcadeHUD';
import GuidedTutorial, { TutorialActionSink, TutorialBridge } from './components/tutorial/GuidedTutorial';
import DesktopSettings from './components/DesktopSettings';
import { isDesktopApp } from './services/desktop';
import { initDesktopStt } from './services/desktopStt';
import VtfSetup from './components/vtf/VtfSetup';
import ApproachScope from './components/vtf/ApproachScope';
import VtfPanel from './components/vtf/VtfPanel';
import { Aircraft, SimulationState, AlertLevel, GameStats, CommMessage, CommSource, StartOptions } from './types';
import { buildTutorialScenario, TUTORIAL_SEED } from './services/tutorial/scenario';
import { hasCompletedTutorial, markTutorialCompleted } from './services/tutorial/storage';
import { useSimEngine } from './hooks/useSimEngine';
import type { ApproachKind, WindState } from './sim/types';
import { generateScenario } from './services/geminiService';
import { trackEvent, identifyUser } from './services/analytics';
import { issueControllerCommand } from './services/commandIssue';
import { ENABLE_VECTOR_TO_FINAL } from './services/features';
import {
  getDisplaySettings,
  parseDisplayCommand,
  subscribeDisplaySettings,
  updateDisplaySettings,
} from './services/displaySettings';
import { installVoiceDebugHooks, preloadPilotVoice, prewarmCallsigns, primePilotVoice, speakPilot, subscribeAudioNotice } from './services/pilotVoice';
import {
  playFailTone,
  playSuccessChime,
  setConflictAlertActive,
  unlockSoundEffects,
} from './services/soundEffects';
import { DEFAULT_SCENARIO_SEEDS } from './services/localScenario';
import { readSeedFromLocation, resolveSeedInput, writeSeedToUrl } from './services/scenarioSeed';
import {
  parseBestSpokenClearance,
  SPEECH_AUTO_ISSUE_CONFIDENCE,
} from './services/speechCommand';
import type { SpeechResultPayload } from './services/speechRecognition';
import type { SpokenCommandFill } from './components/ControlPanel';
import { evaluateExit } from './services/exitScoring';
import {
  ARCADE_DURATION_MS,
  ATTRACT_IDLE_MS,
  applyGoAround,
  arcadeWaveAircraft,
  buildArcadeRound,
  buildSixtySecondRound,
  curveballPilotPhrase,
  planToInitialScenario,
  perfectHandoffPilotLine,
  spawnCurveballAircraft,
} from './services/arcade';
import {
  loadProfile,
  loadProgress,
  recordSession,
  saveProgress,
  PlayerProfile,
  Progress,
} from './services/progression';
import { saveSessionRecord } from './services/sessionLog';
import { 
  MAP_SIZE, CENTER, INITIAL_INSTRUCTION, NM_TO_PX, DEFAULT_TIME_SCALE, 
  SIM_SPEED_OPTIONS, NM_3_PX, NM_4_PX,
  SCORE_PERFECT_EXIT, PENALTY_SEPARATION,
  GATE_RADIUS
} from './constants';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Capacitor } from '@capacitor/core';

const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);

const INITIAL_STATS: GameStats = {
    perfectExits: 0,
    sloppyExits: 0,
    wrongGate: 0,
    wrongAlt: 0,
    separationBusts: 0,
    incidents: [],
    startTime: 0
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<SimulationState>(SimulationState.MENU);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [messages, setMessages] = useState<CommMessage[]>([
    { id: 1, text: INITIAL_INSTRUCTION, source: 'system' },
  ]);
  const [score, setScore] = useState(0);
  const [stats, setStats] = useState<GameStats>(INITIAL_STATS);
  const [highScore, setHighScore] = useState(0);
  const [statusMessage, setStatusMessage] = useState('SYSTEM STANDBY');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeScale, setTimeScale] = useState(DEFAULT_TIME_SCALE);
  const [showPrimaryData, setShowPrimaryData] = useState(true);
  const [showJRings, setShowJRings] = useState(() => getDisplaySettings().jRings3Nm);
  const [scanAngle, setScanAngle] = useState(0);

  useEffect(() => subscribeDisplaySettings((s) => setShowJRings(s.jRings3Nm)), []);
  
  // UI States for Overlays
  const [isRateOpen, setIsRateOpen] = useState(false);
  const [isDataOpen, setIsDataOpen] = useState(true);
  const [playMode, setPlayMode] = useState<'expo' | 'standard'>('standard');
  const [currentDifficulty, setCurrentDifficulty] = useState<string>('Expo');
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialDoneFlag, setTutorialDoneFlag] = useState(() => hasCompletedTutorial());
  const [scoreFlash, setScoreFlash] = useState<string | null>(null);
  const [scenarioSeed, setScenarioSeed] = useState<string | null>(() => readSeedFromLocation());
  const [showAttract, setShowAttract] = useState(false);
  const tutorialActionsRef = useRef<TutorialActionSink>({});
  const tutorialActiveRef = useRef(false);
  tutorialActiveRef.current = tutorialActive;
  const [arcadeEndsAt, setArcadeEndsAt] = useState<number | null>(null);
  const [arcadeRemainingMs, setArcadeRemainingMs] = useState(ARCADE_DURATION_MS);
  const [arcadeBanner, setArcadeBanner] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [spokenFill, setSpokenFill] = useState<SpokenCommandFill | null>(null);
  const spokenFillTokenRef = useRef(0);
  const [showArcadeSummary, setShowArcadeSummary] = useState(false);
  const [conflictAlarm, setConflictAlarm] = useState(false);
  // Progression (local only): profile, cumulative progress, menu overlays.
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showInstructor, setShowInstructor] = useState(false);
  const [arcadeVariant, setArcadeVariant] = useState<'arcade' | 'sixty' | null>(null);
  const arcadeVariantRef = useRef<'arcade' | 'sixty' | null>(null);
  const isDailyRef = useRef(false);
  const recordedSessionRef = useRef<number | null>(null);
  const [desktopSettingsOpen, setDesktopSettingsOpen] = useState(false);
  const [showVtfSetup, setShowVtfSetup] = useState(false);
  const [vtfActive, setVtfActive] = useState(false);
  const [vtfTranscript, setVtfTranscript] = useState('');
  const { state: vtfState, dispatch: vtfDispatch } = useSimEngine(vtfActive);

  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const idleTimerRef = useRef<number | null>(null);
  const waveTimersRef = useRef<number[]>([]);
  const curveballTimerRef = useRef<number | null>(null);
  const arcadeActiveRef = useRef(false);
  
  const incidentCooldowns = useRef<Map<string, number>>(new Map());

  const logSeq = useRef(1);
  const addLog = useCallback((text: string, source: CommSource = 'system') => {
    logSeq.current += 1;
    const id = logSeq.current;
    setMessages(prev => [...prev.slice(-19), { id, text, source }]);
  }, []);

  // Load High Score
  useEffect(() => {
    const saved = localStorage.getItem('openstars_highscore');
    if (saved) setHighScore(parseInt(saved));
  }, []);

  // Desktop: warm Whisper STT (models bundled in the installer).
  useEffect(() => {
    if (!isDesktopApp()) return;
    void initDesktopStt().catch(() => undefined);
  }, []);

  // --- ORIENTATION LOGIC ---
  useEffect(() => {
    const handleOrientation = async () => {
        if (!Capacitor.isNativePlatform()) return;

        try {
            const width = window.screen.width;
            const height = window.screen.height;
            const smallestDim = Math.min(width, height);
            const isTablet = smallestDim >= 768;

            if (isTablet) {
                await ScreenOrientation.lock({ orientation: 'landscape' });
            } else {
                if (gameState === SimulationState.MENU || gameState === SimulationState.SUMMARY) {
                    await ScreenOrientation.lock({ orientation: 'portrait' });
                } else {
                    await ScreenOrientation.lock({ orientation: 'landscape' });
                }
            }
        } catch (err) {
            console.warn('Orientation lock failed', err);
        }
    };

    handleOrientation();
  }, [gameState]);

  // Toggle Timer
  useEffect(() => {
    const interval = setInterval(() => setShowPrimaryData(prev => !prev), 3000);
    return () => clearInterval(interval);
  }, []);

  // Handler for Soft Keyboard Arrow Keys
  const handleMoveDataBlock = (direction: number) => {
    if (!selectedId) return;
    setAircraft(prev => prev.map(ac => ac.id === selectedId ? { ...ac, dataBlockDir: direction } : ac));
  };

  const startGame = async (options: StartOptions | string) => {
    const difficulty = typeof options === 'string' ? options : options.difficulty;
    const requestedSeed = typeof options === 'string'
      ? readSeedFromLocation()
      : (options.seedLabel ?? readSeedFromLocation());
    isDailyRef.current = typeof options !== 'string' && Boolean(options.daily);
    recordedSessionRef.current = null;
    if (difficulty === 'Expo60' || difficulty === '60-Second') {
      startArcadeRound(
        typeof requestedSeed === 'string' ? requestedSeed : undefined,
        'sixty',
      );
      return;
    }
    const seed = resolveSeedInput(
      requestedSeed ?? DEFAULT_SCENARIO_SEEDS[difficulty as keyof typeof DEFAULT_SCENARIO_SEEDS],
      difficulty,
    );
    if (difficulty === 'Expo') {
      startArcadeRound(seed.display);
      return;
    }
    setCurrentDifficulty(difficulty);

    identifyUser('guest-' + Math.floor(Math.random() * 1000000));
    setPlayMode('standard');
    setScoreFlash(null);
    setScenarioSeed(seed.display);
    writeSeedToUrl(seed.display);
    setGameState(SimulationState.LOADING);
    setStatusMessage('INITIALIZING RADAR SCENARIO...');
    setTimeScale(DEFAULT_TIME_SCALE);

    trackEvent('Game Started', { difficulty, mode: 'Guest', seed: seed.display });

    try {
      const scenario = await generateScenario(difficulty, seed.display);
      const firstId = scenario.aircraft[0]?.id ?? null;
      setAircraft(scenario.aircraft.map((ac, index) => ({
        ...ac,
        alertLevel: AlertLevel.NONE,
        isSelected: index === 0,
      })));
      setSelectedId(firstId);
      setGameState(SimulationState.RUNNING);
      setStatusMessage(`RADAR CONTACT: ${scenario.name}`);
      addLog(`GATES OPEN. ${scenario.aircraft.length} AIRCRAFT INBOUND.`);
      if (scenario.seedLabel) {
        setScenarioSeed(scenario.seedLabel);
        addLog(`SCENARIO SEED ${scenario.seedLabel}`);
      }
      lastTimeRef.current = 0;
      setScore(0);
      setStats({...INITIAL_STATS, startTime: Date.now()});
      incidentCooldowns.current.clear();
    } catch (e) {
      setStatusMessage('ERROR LOADING SCENARIO');
      setGameState(SimulationState.MENU);
      trackEvent('Scenario Load Error', { error: String(e) });
    }
  };

  const togglePause = () => {
    if (gameState === SimulationState.RUNNING) {
      setGameState(SimulationState.PAUSED);
      setStatusMessage('SIMULATION PAUSED');
    } else if (gameState === SimulationState.PAUSED) {
      setGameState(SimulationState.RUNNING);
      setStatusMessage('SIMULATION RESUMED');
      lastTimeRef.current = 0;
    }
  };

  const clearArcadeTimers = useCallback(() => {
    waveTimersRef.current.forEach((id) => window.clearTimeout(id));
    waveTimersRef.current = [];
    if (curveballTimerRef.current) {
      window.clearTimeout(curveballTimerRef.current);
      curveballTimerRef.current = null;
    }
  }, []);

  const returnToMenu = (opts?: { attract?: boolean }) => {
    clearArcadeTimers();
    arcadeActiveRef.current = false;
    arcadeVariantRef.current = null;
    setArcadeVariant(null);
    isDailyRef.current = false;
    recordedSessionRef.current = null;
    setTutorialActive(false);
    setArcadeEndsAt(null);
    setArcadeBanner(null);
    setLiveTranscript('');
    setShowArcadeSummary(false);
    setConflictAlarm(false);
    setConflictAlertActive(false);
    setGameState(SimulationState.MENU);
    setAircraft([]);
    setMessages([{ id: 1, text: INITIAL_INSTRUCTION, source: 'system' }]);
    setScore(0);
    setSelectedId(null);
    setPlayMode('standard');
    setScoreFlash(null);
    setTimeScale(DEFAULT_TIME_SCALE);
    setShowAttract(!!opts?.attract);
  };

  const endGame = useCallback(() => {
    // Never terminate How to Play into a FAILED / summary screen.
    if (tutorialActiveRef.current) return;
    clearArcadeTimers();
    // Record the finished session once (progression + instructor log).
    // Guarded by startTime: endGame can be reached twice on the arcade path.
    if (recordedSessionRef.current !== stats.startTime && stats.startTime > 0) {
      recordedSessionRef.current = stats.startTime;
      const mode = arcadeActiveRef.current
        ? (arcadeVariantRef.current === 'sixty' ? '60-Second' : 'Expo')
        : currentDifficulty;
      const next = recordSession(loadProgress(), mode, score, stats.perfectExits);
      saveProgress(next);
      setProgress(next);
      saveSessionRecord({
        initials: loadProfile().initials,
        mode,
        score,
        cleanExits: stats.perfectExits,
        busts: stats.separationBusts,
        daily: isDailyRef.current,
        seed: scenarioSeed ?? undefined,
      });
    }
    if (arcadeActiveRef.current) {
      arcadeActiveRef.current = false;
      setGameState(SimulationState.SUMMARY);
      setShowArcadeSummary(true);
      setArcadeEndsAt(null);
      trackEvent('Arcade Completed', { score, separationBusts: stats.separationBusts });
      return;
    }
    setGameState(SimulationState.SUMMARY);
    if (score > highScore) {
        setHighScore(score);
        localStorage.setItem('openstars_highscore', score.toString());
        trackEvent('New High Score', { score });
    } else {
        trackEvent('Game Completed', { score, separationBusts: stats.separationBusts });
    }
  }, [score, highScore, stats.separationBusts, stats.startTime, stats.perfectExits, currentDifficulty, scenarioSeed, clearArcadeTimers]);

  const startTutorial = useCallback(() => {
    // User gesture: unlock AudioContext + prime Safari/Chrome speechSynthesis voices.
    primePilotVoice();
    clearArcadeTimers();
    arcadeActiveRef.current = false;
    setTutorialActive(true);
    setShowAttract(false);
    setShowArcadeSummary(false);
    setPlayMode('expo');
    setScenarioSeed(TUTORIAL_SEED);
    writeSeedToUrl(TUTORIAL_SEED);
    setScoreFlash(null);
    setArcadeBanner(null);
    setLiveTranscript('');
    setConflictAlarm(false);
    setConflictAlertActive(false);
    setArcadeEndsAt(null);
    setArcadeRemainingMs(ARCADE_DURATION_MS);
    // Freeze traffic until/unless a step needs motion — never race the trainee.
    setTimeScale(0);
    identifyUser('guest-tutorial');
    const scenario = buildTutorialScenario();
    const preferred = scenario.aircraft.find((ac) => ac.isSelected) || scenario.aircraft[0];
    setAircraft(scenario.aircraft.map((ac) => ({ ...ac, isSelected: ac.id === preferred?.id })));
    setSelectedId(preferred?.id ?? null);
    setGameState(SimulationState.RUNNING);
    setStatusMessage('TUTORIAL');
    setMessages([{ id: 1, text: 'GUIDED HOW TO PLAY — follow the instructor captions.', source: 'system' }]);
    setScore(0);
    setStats({ ...INITIAL_STATS, startTime: Date.now() });
    incidentCooldowns.current.clear();
    lastTimeRef.current = 0;
    trackEvent('Tutorial Started', { seed: TUTORIAL_SEED });
  }, [clearArcadeTimers]);

  const startArcadeRound = useCallback((seedLabel?: string, variant: 'arcade' | 'sixty' = 'arcade') => {
    clearArcadeTimers();
    const seed = resolveSeedInput(seedLabel || readSeedFromLocation() || 'arcade-1', 'Expo');
    const plan = variant === 'sixty' ? buildSixtySecondRound(seed.display) : buildArcadeRound(seed.display);
    const scenario = planToInitialScenario(plan);
    arcadeActiveRef.current = true;
    arcadeVariantRef.current = variant;
    setArcadeVariant(variant);
    isDailyRef.current = false;
    recordedSessionRef.current = null;
    setTutorialActive(false);
    setShowAttract(false);
    setShowArcadeSummary(false);
    setPlayMode('expo');
    setCurrentDifficulty('Expo');
    setScenarioSeed(seed.display);
    writeSeedToUrl(seed.display);
    setScoreFlash(null);
    setArcadeBanner(variant === 'sixty' ? '60-SECOND CHALLENGE — clear the gates, beat the clock.' : 'SHIFT OPEN — clear the gates. Hold PTT to talk.');
    setLiveTranscript('');
    setConflictAlarm(false);
    setConflictAlertActive(false);
    setTimeScale(6);
    identifyUser('guest-arcade');
    const firstId = scenario.aircraft[0]?.id ?? null;
    setAircraft(scenario.aircraft.map((ac, index) => ({ ...ac, isSelected: index === 0 })));
    setSelectedId(firstId);
    setGameState(SimulationState.RUNNING);
    setStatusMessage(`ARCADE: ${plan.name}`);
    setMessages([{ id: 1, text: variant === 'sixty' ? '60-SECOND CHALLENGE — 60 SECONDS. VOICE, TAP, OR TYPE.' : 'EXPO ARCADE SHIFT — 5 MINUTES. VOICE, TAP, OR TYPE.', source: 'system' }]);
    setScore(0);
    setStats({ ...INITIAL_STATS, startTime: Date.now() });
    incidentCooldowns.current.clear();
    lastTimeRef.current = 0;
    const endsAt = Date.now() + plan.durationMs;
    setArcadeEndsAt(endsAt);
    setArcadeRemainingMs(plan.durationMs);

    // Escalating / staggered waves (wave 0 already on scope; delays from plan.waveAtMs)
    plan.waves.slice(1).forEach((wave, index) => {
      const waveIndex = index + 1;
      const delay = plan.waveAtMs?.[waveIndex] ?? waveIndex * 50_000;
      const timer = window.setTimeout(() => {
        setAircraft((prev) => {
          const incoming = arcadeWaveAircraft(plan, waveIndex);
          return [...prev, ...incoming.map((ac) => ({ ...ac, isSelected: false }))];
        });
        const label = waveIndex === 1 ? 'TRAFFIC' : `WAVE ${waveIndex + 1}`;
        setArcadeBanner(`${label} INBOUND`);
        addLog(`${label}: ${wave.length} AIRCRAFT`, 'system');
      }, delay);
      waveTimersRef.current.push(timer);
    });

    curveballTimerRef.current = window.setTimeout(() => {
      setArcadeBanner(plan.curveball.banner);
      addLog(plan.curveball.banner, 'system');
      if (plan.curveball.kind === 'goaround') {
        setAircraft((prev) => applyGoAround(prev));
      } else {
        const spawned = spawnCurveballAircraft(plan);
        if (spawned) {
          // Spawn joins the scope UNSELECTED: auto-selecting it used to
          // discard a dialled-but-unissued clearance for another aircraft
          // (and the tap pad resets on selection change). The player taps
          // the NORDO target if they want it.
          setAircraft((prev) => [...prev, { ...spawned, isSelected: false }]);
        }
      }
      const line = curveballPilotPhrase(plan.curveball.kind);
      if (line) {
        addLog(line, 'pilot');
        speakPilot(line, plan.curveball.callsign || 'AAL421');
      }
    }, plan.curveball.atMs);

    trackEvent('Arcade Started', { seed: seed.display, curveball: plan.curveball.kind });
  }, [addLog, clearArcadeTimers]);

  /** Restart the current session in place (same mode + seed) — the in-session
   *  Restart button. Tutorial restarts the tutorial; arcade restarts the
   *  round; lesson modes restart the same difficulty/seed. */
  const restartCurrent = () => {
    if (tutorialActiveRef.current) {
      startTutorial();
      return;
    }
    if (arcadeActiveRef.current) {
      startArcadeRound(scenarioSeed ?? undefined, arcadeVariantRef.current ?? 'arcade');
      return;
    }
    void startGame({ difficulty: currentDifficulty, seedLabel: scenarioSeed ?? undefined });
  };

  // --- Command Parser ---
  const lastIssuedRef = useRef<{ cmd: string; at: number } | null>(null);
  /** When true, handleCommand/handleSelect skip tutorial sinks (demo-driven actions). */
  const tutorialDemoSilentRef = useRef(false);
  const handleCommand = (cmdRaw: string) => {
    const cmd = cmdRaw.trim().toUpperCase();
    if (!cmd) return;
    // Suppress Enter+Issue / double-submit of the same clearance (one command → one readback).
    const now = Date.now();
    const prev = lastIssuedRef.current;
    if (prev && prev.cmd === cmd && now - prev.at < 450) return;
    lastIssuedRef.current = { cmd, at: now };

    // Display toggles (JRING / 3NM / RING) — no aircraft callsign.
    const displayCmd = parseDisplayCommand(cmd);
    if (displayCmd?.kind === 'jrings') {
      const next =
        displayCmd.on !== undefined ? displayCmd.on : !getDisplaySettings().jRings3Nm;
      updateDisplaySettings({ jRings3Nm: next });
      addLog(next ? 'J-RINGS 3 NM ON' : 'J-RINGS 3 NM OFF', 'system');
      setStatusMessage(next ? 'J-RINGS 3 NM ON' : 'J-RINGS 3 NM OFF');
      return;
    }

    primePilotVoice();
    // State applies synchronously; speakPilot is fire-and-forget (never awaited).
    const result = issueControllerCommand(aircraft, selectedId, cmdRaw, {
      onLog: addLog,
      onSpeak: speakPilot,
      onTrack: (callsign, echo) => trackEvent('Command Issued', { callsign, command: echo }),
    });
    if (result.aircraft !== aircraft) setAircraft(result.aircraft);
    // Procedure errors used to be invisible: the AAR counted wrong-alt +
    // wrong-gate only, so an invalid typed command (e.g. "DAL456 XYZ")
    // showed up as an unexplained count. Record what it actually was.
    if (!tutorialActiveRef.current && !tutorialDemoSilentRef.current) {
      const procDetail =
        result.parsed.kind === 'not_found'
          ? `"${cmd}" — target ${result.parsed.callsign} not found: no such aircraft on scope.`
          : result.parsed.readback?.startsWith('Unable')
            ? `"${cmd}" — pilot replied unable (out-of-limits or unparseable clause); no clearance applied.`
            : null;
      if (procDetail) {
        setStats((s) => ({
          ...s,
          incidents: [...s.incidents, {
            time: new Date().toLocaleTimeString(),
            description: 'PROCEDURE ERROR',
            involved: [result.parsed.callsign || 'UNKNOWN'],
            detail: procDetail,
          }],
        }));
      }
    }
    if (!tutorialDemoSilentRef.current) {
      tutorialActionsRef.current.onCommand?.(cmdRaw);
    }
  };

  const toggleJRings = useCallback(() => {
    const next = !getDisplaySettings().jRings3Nm;
    updateDisplaySettings({ jRings3Nm: next });
    setStatusMessage(next ? 'J-RINGS 3 NM ON' : 'J-RINGS 3 NM OFF');
  }, []);

  const aircraftRef = useRef(aircraft);
  aircraftRef.current = aircraft;
  const handleCommandRef = useRef(handleCommand);
  handleCommandRef.current = handleCommand;

  const spokenCommittedRef = useRef<string | null>(null);
  /** One utterance → at most one command. Interim results only update the live transcript. */
  const handleSpokenTranscript = useCallback((payload: SpeechResultPayload) => {
    const text = payload.transcript;
    setLiveTranscript(text);
    if (!payload.isFinal) return;
    if (!text.trim()) return;

    const alts = payload.alternatives?.length
      ? payload.alternatives
      : [{ transcript: text, confidence: 0 }];
    const spoken = parseBestSpokenClearance(alts, aircraftRef.current);

    if (!spoken.ok || !spoken.command) {
      // Unparsed / ambiguous → say again once — never "unable".
      const line = spoken.message || 'Say again';
      addLog(line, 'pilot');
      speakPilot(line, spoken.callsign || 'PILOT');
      spokenCommittedRef.current = null;
      return;
    }

    const commitKey = spoken.command.toLowerCase();
    if (spokenCommittedRef.current === commitKey) return;
    spokenCommittedRef.current = commitKey;

    const confidence = spoken.confidence ?? 0;
    const pendingConfirm = confidence < SPEECH_AUTO_ISSUE_CONFIDENCE;
    spokenFillTokenRef.current += 1;
    const token = spokenFillTokenRef.current;
    setSpokenFill({
      command: spoken.command,
      confidence,
      pendingConfirm,
      token,
    });

    // High confidence: ControlPanel shows ~1s then auto-issues.
    // Low confidence: stays in the command line for Enter confirm.
    window.setTimeout(() => {
      if (spokenCommittedRef.current === commitKey) spokenCommittedRef.current = null;
    }, 900);
  }, [addLog]);

  const handleSpeechError = useCallback((message: string) => {
    addLog(message, 'system');
  }, [addLog]);

  const requestFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.().catch(() => undefined);
    } else {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  }, []);

  const bumpIdle = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    if (gameState !== SimulationState.MENU || showAttract) return;
    idleTimerRef.current = window.setTimeout(() => setShowAttract(true), ATTRACT_IDLE_MS);
  }, [gameState, showAttract]);

  useEffect(() => {
    bumpIdle();
    const onActivity = () => bumpIdle();
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [bumpIdle]);

  useEffect(() => {
    if (!arcadeEndsAt || gameState !== SimulationState.RUNNING || !arcadeActiveRef.current) return;
    const tick = () => {
      const remaining = arcadeEndsAt - Date.now();
      setArcadeRemainingMs(remaining);
      if (remaining <= 0) {
        endGame();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [arcadeEndsAt, gameState, endGame]);

  useEffect(() => {
    if (!arcadeBanner) return;
    const timer = window.setTimeout(() => setArcadeBanner(null), 5000);
    return () => window.clearTimeout(timer);
  }, [arcadeBanner]);

  const updatePhysics = useCallback((deltaSeconds: number) => {
    setAircraft(prev => {
      let activeCount = 0;
      // Tutorial freezes motion (and scoring side-effects) so planes never race off-scope.
      const simScale = tutorialActiveRef.current ? 0 : timeScale;
      
      const updated = prev.map(ac => {
        if (ac.status === 'HANDOFF') {
             const edgeBuffer = 10;
             if (ac.x <= edgeBuffer || ac.x >= MAP_SIZE - edgeBuffer || ac.y <= edgeBuffer || ac.y >= MAP_SIZE - edgeBuffer) {
                 return { ...ac, speed: 0 }; 
             }
        } else if (ac.status !== 'CRASH') {
            activeCount++;
        }

        if (tutorialActiveRef.current) {
          return { ...ac, alertLevel: AlertLevel.NONE };
        }

        let newHeading = ac.heading;
        let newAlt = ac.altitude;
        let newSpeed = ac.speed;

        if (ac.heading !== ac.targetHeading) {
           let diff = ac.targetHeading - ac.heading;
           while (diff <= -180) diff += 360;
           while (diff > 180) diff -= 360;
           const turnRatePerSec = 3.0; 
           const turnAmount = turnRatePerSec * deltaSeconds * simScale;
           let turnDir = 0; 
           if (ac.turnDirection === 'LEFT') turnDir = -1;
           else if (ac.turnDirection === 'RIGHT') turnDir = 1;
           else turnDir = diff > 0 ? 1 : -1;

           if (Math.abs(diff) < turnAmount && !ac.turnDirection) newHeading = ac.targetHeading;
           else newHeading += (turnDir * turnAmount);
           
           if (Math.abs(diff) < 5) ac.turnDirection = undefined;
           if (newHeading < 0) newHeading += 360;
           if (newHeading >= 360) newHeading -= 360;
        }

        if (ac.altitude !== ac.targetAltitude) {
            const climbRatePerSec = 0.25 * simScale; 
            if (Math.abs(ac.targetAltitude - ac.altitude) < climbRatePerSec * deltaSeconds) newAlt = ac.targetAltitude;
            else newAlt += (ac.targetAltitude > ac.altitude ? 1 : -1) * climbRatePerSec * deltaSeconds;
        }

        if (ac.speed !== ac.targetSpeed) {
            const accRatePerSec = 2.5 * simScale; 
            if (Math.abs(ac.targetSpeed - ac.speed) < accRatePerSec * deltaSeconds) newSpeed = ac.targetSpeed;
            else newSpeed += (ac.targetSpeed > ac.speed ? 1 : -1) * accRatePerSec * deltaSeconds;
        }

        const pxPerSec = (newSpeed * NM_TO_PX) / 3600; 
        const moveDist = pxPerSec * deltaSeconds * simScale;
        const newX = ac.x + Math.cos(toRad(newHeading)) * moveDist;
        const newY = ac.y + Math.sin(toRad(newHeading)) * moveDist;

        let newHistory = ac.history;
        if (Math.random() < (0.25 * deltaSeconds * simScale)) { 
             newHistory = [{x: ac.x, y: ac.y}, ...ac.history].slice(0, 6);
        }

        let status = ac.status;
        let handoffResult = ac.handoffResult;

        const distFromCenter = Math.sqrt(Math.pow(newX - CENTER, 2) + Math.pow(newY - CENTER, 2));
        
        if (status === 'INBOUND' && distFromCenter <= GATE_RADIUS) status = 'ACTIVE';

        if (status === 'ACTIVE' && distFromCenter > GATE_RADIUS) {
            const angleRad = Math.atan2(newY - CENTER, newX - CENTER);
            let angleDeg = angleRad * (180 / Math.PI) + 90;
            if (angleDeg < 0) angleDeg += 360;

            status = 'HANDOFF';

            // One evaluation per exit: a clean exit must meet ALL criteria
            // (right gate, centred, legal altitude). Wrong-alt exits earn
            // no clean/sloppy points — only the penalty — and every outcome
            // carries its reason into the comm log + AAR incident log.
            const perfectBonus = playMode === 'expo' ? Math.max(SCORE_PERFECT_EXIT, 1000) : SCORE_PERFECT_EXIT;
            const exit = evaluateExit(ac, angleDeg, perfectBonus);
            handoffResult = exit.handoffResult;
            setScore((s) => Math.max(0, s + exit.points));
            if (exit.kind === 'clean') {
              setStats((s) => ({ ...s, perfectExits: s.perfectExits + 1 }));
              playSuccessChime();
              if (playMode === 'expo') {
                addLog(`Perfect handoff +${exit.points}`, 'system');
                setScoreFlash(`Perfect handoff +${exit.points}`);
                speakPilot(perfectHandoffPilotLine(ac.callsign), ac.callsign);
              } else {
                addLog(`${ac.callsign} CLEAN EXIT ${exit.gateId}. +${exit.points}`);
                setScoreFlash(`${ac.callsign} CLEAN +${exit.points}`);
              }
            } else if (exit.kind === 'sloppy') {
              setStats((s) => ({ ...s, sloppyExits: s.sloppyExits + 1 }));
              playSuccessChime();
              addLog(`${ac.callsign} EXIT ${exit.gateId} (TOUCHED SIDES). +${exit.points} — ${exit.reason}`);
              setScoreFlash(`${ac.callsign} EXIT +${exit.points}`);
            } else {
              // wrong-alt / wrong-gate / off-course — penalty only, no exit points.
              if (exit.kind === 'wrong-alt') setStats((s) => ({ ...s, wrongAlt: s.wrongAlt + 1 }));
              if (exit.kind === 'wrong-gate') setStats((s) => ({ ...s, wrongGate: s.wrongGate + 1 }));
              playFailTone();
              addLog(`${exit.reason} ${exit.points}`);
              setScoreFlash(`${ac.callsign} ${exit.handoffResult} ${exit.points}`);
              setStats((s) => ({
                ...s,
                incidents: [...s.incidents, {
                  time: new Date().toLocaleTimeString(),
                  description: exit.handoffResult,
                  involved: [ac.callsign],
                  detail: exit.reason,
                }],
              }));
            }
        }

        return { ...ac, x: newX, y: newY, heading: newHeading, altitude: newAlt, speed: newSpeed, history: newHistory, status, turnDirection: ac.turnDirection, alertLevel: AlertLevel.NONE, handoffResult };
      });
      
      if (prev.length > 0 && activeCount === 0 && !tutorialActiveRef.current) {
          setTimeout(endGame, 4000);
      }

      return tutorialActiveRef.current ? updated : checkSeparation(updated);
    });
  }, [addLog, timeScale, endGame, playMode]);

  const checkSeparation = (aircraftList: Aircraft[]): Aircraft[] => {
    const newAircraft = [...aircraftList];
    let separationBust = false;
    
    for(let i=0; i<newAircraft.length; i++) {
        for(let j=i+1; j<newAircraft.length; j++) {
            const a = newAircraft[i];
            const b = newAircraft[j];
            if (a.status !== 'ACTIVE' || b.status !== 'ACTIVE') continue;

            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const distPx = Math.sqrt(dx * dx + dy * dy);
            const altDiff = Math.abs(a.altitude - b.altitude);

            if (altDiff < 10) {
                const ax = Math.cos(toRad(a.heading)) * a.speed;
                const ay = Math.sin(toRad(a.heading)) * a.speed;
                const bx = Math.cos(toRad(b.heading)) * b.speed;
                const by = Math.sin(toRad(b.heading)) * b.speed;
                const isMovingApart = ((b.x - a.x) * (bx - ax) + (b.y - a.y) * (by - ay)) > 0;
                let angleDiff = Math.abs(a.heading - b.heading);
                if (angleDiff > 180) angleDiff = 360 - angleDiff;
                
                if (distPx < NM_3_PX) {
                    if (!isMovingApart || angleDiff < 15) {
                        newAircraft[i].alertLevel = Math.max(newAircraft[i].alertLevel, AlertLevel.CRITICAL);
                        newAircraft[j].alertLevel = Math.max(newAircraft[j].alertLevel, AlertLevel.CRITICAL);
                        separationBust = true;
                        
                        const pairKey = [a.callsign, b.callsign].sort().join('-');
                        const now = Date.now();
                        const lastReport = incidentCooldowns.current.get(pairKey) || 0;
                        
                        if (now - lastReport > 5000) {
                            incidentCooldowns.current.set(pairKey, now);
                            trackEvent('Separation Incident', { pair: pairKey, distance: distPx });
                            setStats(s => ({
                                ...s,
                                separationBusts: s.separationBusts + 1,
                                incidents: [...s.incidents, {
                                    time: new Date().toLocaleTimeString(),
                                    description: 'LOSS OF SEPARATION',
                                    involved: [a.callsign, b.callsign],
                                    detail: `${a.callsign} / ${b.callsign} inside 3 NM ` +
                                      `(${(distPx / NM_TO_PX).toFixed(1)} NM apart) at the same altitude ` +
                                      `(${Math.abs(a.altitude - b.altitude) * 100} ft apart) and converging.`,
                                }]
                            }));
                            // In-play alert in EVERY mode, not just Expo and not
                            // just the AAR: comm-log line + centre flash, on top
                            // of the existing red CONFLICT scope overlay.
                            addLog(`LOSS OF SEPARATION ${a.callsign} / ${b.callsign} — CONFLICT ALERT`, 'system');
                            setScoreFlash('LOSS OF SEPARATION');
                            window.setTimeout(() => setScoreFlash(null), 1800);
                        }
                    } else {
                         newAircraft[i].alertLevel = Math.max(newAircraft[i].alertLevel, AlertLevel.WARNING);
                         newAircraft[j].alertLevel = Math.max(newAircraft[j].alertLevel, AlertLevel.WARNING);
                    }
                } else if (distPx < NM_4_PX) {
                    newAircraft[i].alertLevel = Math.max(newAircraft[i].alertLevel, AlertLevel.WARNING);
                    newAircraft[j].alertLevel = Math.max(newAircraft[j].alertLevel, AlertLevel.WARNING);
                }
            }
        }
    }

    if (separationBust) setScore(s => Math.max(0, s - PENALTY_SEPARATION));

    // Drive STARS CA aural + scope border from live CRITICAL state (any conflict).
    const hasCritical = newAircraft.some(
      (ac) => ac.status === 'ACTIVE' && ac.alertLevel === AlertLevel.CRITICAL,
    );
    setConflictAlarm(hasCritical);
    setConflictAlertActive(hasCritical);

    return newAircraft;
  };

  const animate = (time: number) => {
    if (lastTimeRef.current === 0) { lastTimeRef.current = time; requestRef.current = requestAnimationFrame(animate); return; }
    const delta = time - lastTimeRef.current;
    const deltaSeconds = delta / 1000; 
    if (gameState === SimulationState.RUNNING) {
        setScanAngle(prev => (prev + (deltaSeconds * 90)) % 360); 
        if (delta > 0) updatePhysics(deltaSeconds);
        lastTimeRef.current = time;
    } else { lastTimeRef.current = time; }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => { requestRef.current = requestAnimationFrame(animate); return () => cancelAnimationFrame(requestRef.current!); }, [gameState, updatePhysics]);

  // Preload Kokoro during menu idle — do not block first paint.
  useEffect(() => {
    installVoiceDebugHooks();
    preloadPilotVoice();
  }, []);

  // TTS failures used to vanish silently (speakPilot is fire-and-forget).
  // Surface them in COMM 1 so a dead voice is visible, not just quiet.
  useEffect(() => subscribeAudioNotice((message) => addLog(message, 'system')), [addLog]);

  // Pre-synthesize callsigns for active aircraft so the tail chunk of every readback is cached.
  useEffect(() => {
    const active = [
      ...aircraft.map((ac) => ac.callsign),
      ...vtfState.aircraft.map((ac) => ac.callsign),
    ].filter(Boolean);
    if (active.length > 0) {
      prewarmCallsigns(active);
    }
  }, [aircraft.length, vtfState.aircraft.length]);

  useEffect(() => {
    const unlock = () => {
      unlockSoundEffects();
      primePilotVoice();
    };
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (!scoreFlash) return;
    const timer = setTimeout(() => setScoreFlash(null), 2200);
    return () => clearTimeout(timer);
  }, [scoreFlash]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const picked =
      aircraftRef.current.find((ac) => ac.id === id) ||
      null;
    setAircraft((prev) => prev.map((ac) => ({ ...ac, isSelected: ac.id === id })));
    // Notify tutorial synchronously so demoSilentRef still applies for bridge selects.
    if (picked && !tutorialDemoSilentRef.current) {
      tutorialActionsRef.current.onSelect?.(picked.callsign);
    }
  };

  const tutorialBridge: TutorialBridge = {
    selectAircraft: (callsign: string) => {
      const match = aircraftRef.current.find((ac) => ac.callsign === callsign);
      if (!match) return;
      tutorialDemoSilentRef.current = true;
      try {
        handleSelect(match.id);
      } finally {
        tutorialDemoSilentRef.current = false;
      }
    },
    issueCommand: (raw: string) => {
      tutorialDemoSilentRef.current = true;
      try {
        handleCommandRef.current(raw);
      } finally {
        tutorialDemoSilentRef.current = false;
      }
    },
    findAircraftTestId: (callsign: string) => `aircraft-${callsign}`,
  };

  const finishTutorial = useCallback((opts: { playExpo: boolean }) => {
    setTutorialActive(false);
    if (opts.playExpo) {
      markTutorialCompleted();
      setTutorialDoneFlag(true);
      startArcadeRound();
      return;
    }
    returnToMenu({ attract: false });
  }, [returnToMenu, startArcadeRound]);

  const selectedAircraft = aircraft.find(ac => ac.id === selectedId) || null;

  const finishArcadeSummary = () => {
    returnToMenu({ attract: false });
  };

  const startVtf = (opts: { seedLabel: string; approachKind: ApproachKind; wind: WindState }) => {
    setShowVtfSetup(false);
    setShowAttract(false);
    setVtfActive(true);
    setVtfTranscript('');
    setGameState(SimulationState.RUNNING);
    writeSeedToUrl(opts.seedLabel);
    setScenarioSeed(opts.seedLabel);
    vtfDispatch({
      type: 'START',
      mode: 'vector_to_final',
      seedLabel: opts.seedLabel,
      approachKind: opts.approachKind,
      wind: opts.wind,
    });
    trackEvent('VTF Started', { seed: opts.seedLabel, kind: opts.approachKind });
  };

  const exitVtf = () => {
    setVtfActive(false);
    setShowVtfSetup(false);
    returnToMenu();
  };

  const handleVtfCommand = (cmd: string) => {
    primePilotVoice();
    const before = vtfState.events.length;
    vtfDispatch({ type: 'COMMAND', raw: cmd });
    // Speak latest pilot line after dispatch on next tick via effect below
    void before;
  };

  const vtfEventsSeenRef = useRef(0);
  useEffect(() => {
    if (!vtfActive) {
      vtfEventsSeenRef.current = 0;
      return;
    }
    const pilots = vtfState.events.filter((e) => e.kind === 'pilot');
    const last = pilots[pilots.length - 1];
    if (last && last.detail) speakPilot(last.detail, last.callsign || 'PILOT');

    const fresh = vtfState.events.slice(vtfEventsSeenRef.current);
    vtfEventsSeenRef.current = vtfState.events.length;
    for (const event of fresh) {
      if (event.kind === 'established' || event.kind === 'landing') playSuccessChime();
      if (
        event.kind === 'overshoot'
        || event.kind === 'wake'
        || event.kind === 'handoff_bust'
        || event.kind === 'altitude_direction'
      ) {
        playFailTone();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to new sim score events
  }, [vtfActive, vtfState.events.length]);

  const vtfSpokenCommittedRef = useRef<string | null>(null);
  const handleVtfSpoken = useCallback((payload: SpeechResultPayload) => {
    const text = payload.transcript;
    setVtfTranscript(text);
    if (!payload.isFinal) return;
    if (!text.trim()) return;
    const legacy = vtfState.aircraft.map((ac) => ({
      id: ac.id,
      callsign: ac.callsign,
      type: ac.type,
      x: ac.x,
      y: ac.y,
      altitude: ac.altitude,
      targetAltitude: ac.targetAltitude,
      speed: ac.ias,
      targetSpeed: ac.targetIas,
      heading: ac.heading,
      targetHeading: ac.targetHeading,
      history: ac.history,
      status: 'ACTIVE' as const,
      alertLevel: ac.alertLevel,
      cleared: ac.approachCleared,
      messages: [] as string[],
      isSelected: ac.isSelected,
      destination: 'SOU',
      dataBlockDir: 45,
    }));
    const alts = payload.alternatives?.length
      ? payload.alternatives
      : [{ transcript: text, confidence: 0 }];
    const spoken = parseBestSpokenClearance(alts, legacy);
    if (!spoken.ok || !spoken.command) {
      speakPilot(spoken.message || 'Say again', spoken.callsign || 'PILOT');
      vtfSpokenCommittedRef.current = null;
      return;
    }
    const commitKey = spoken.command.toLowerCase();
    if (vtfSpokenCommittedRef.current === commitKey) return;
    vtfSpokenCommittedRef.current = commitKey;
    vtfDispatch({ type: 'COMMAND', raw: spoken.command });
    window.setTimeout(() => {
      if (vtfSpokenCommittedRef.current === commitKey) vtfSpokenCommittedRef.current = null;
    }, 800);
  }, [vtfState.aircraft, vtfDispatch]);

  return (
    <div
      className={`app-root flex flex-col landscape:flex-row h-[100dvh] w-screen bg-black text-white relative pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] ${
        gameState === SimulationState.MENU && !showAttract
          ? 'overflow-hidden'
          : 'overflow-hidden touch-none'
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      
      {gameState === SimulationState.MENU && !showAttract && !(ENABLE_VECTOR_TO_FINAL && showVtfSetup) && (
        <MainMenu
          onStart={startGame}
          onTutorial={startTutorial}
          onOpenVtf={ENABLE_VECTOR_TO_FINAL ? () => setShowVtfSetup(true) : undefined}
          highScore={highScore}
          activeSeed={scenarioSeed}
          tutorialDone={tutorialDoneFlag}
          profile={profile}
          onProfileChange={(next) => setProfile(next)}
          progress={progress}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
          onOpenInstructor={() => setShowInstructor(true)}
        />
      )}
      {showLeaderboard && <LeaderboardView onBack={() => setShowLeaderboard(false)} />}
      {showInstructor && <InstructorView onBack={() => setShowInstructor(false)} />}
      {ENABLE_VECTOR_TO_FINAL && showVtfSetup && (
        <VtfSetup
          defaultSeed={scenarioSeed || 'vtf-1'}
          onCancel={() => setShowVtfSetup(false)}
          onStart={startVtf}
        />
      )}
      {ENABLE_VECTOR_TO_FINAL && vtfActive && vtfState.approach && (
        <div className="absolute inset-0 z-[55] flex flex-col landscape:flex-row bg-black" data-testid="vtf-game">
          <div className="flex-1 min-h-0 relative">
            <ApproachScope
              aircraft={vtfState.aircraft}
              approach={vtfState.approach}
              wind={vtfState.wind}
              selectedId={vtfState.selectedId}
              onSelect={(id) => vtfDispatch({ type: 'SELECT', aircraftId: id })}
            />
          </div>
          <VtfPanel
            state={vtfState}
            selected={vtfState.aircraft.find((a) => a.id === vtfState.selectedId) || null}
            liveTranscript={vtfTranscript}
            onCommand={handleVtfCommand}
            onTranscript={handleVtfSpoken}
            onSpeechError={(m) => addLog(m, 'system')}
            onExit={exitVtf}
          />
        </div>
      )}
      {showAttract && gameState === SimulationState.MENU && (
        <AttractMode onStart={() => startArcadeRound()} onTutorial={startTutorial} onOpenLeaderboard={() => setShowLeaderboard(true)} />
      )}
      {gameState === SimulationState.SUMMARY && showArcadeSummary && (
        <ArcadeSummary score={score} stats={stats} onDone={finishArcadeSummary} variant={arcadeVariant ?? 'arcade'} profileInitials={profile.initials} />
      )}
      {gameState === SimulationState.SUMMARY && !showArcadeSummary && (
        <SummaryScreen score={score} stats={stats} onReset={returnToMenu} progress={progress} isDaily={isDailyRef.current} />
      )}

      {/* PRO DASHBOARD LAYOUT */}
      <div className="pro-dashboard flex-1 flex min-h-0 min-w-0 bg-[#050505]">
          
          {/* LEFT SIDEBAR: Flight Strips (Visible on LG/Laptop+) */}
          <div className="hidden lg:block h-full">
              <FlightStripBay aircraft={aircraft} onSelect={handleSelect} selectedId={selectedId} />
          </div>

          {/* CENTER: Radar Scope — keep a usable min height during How to Play on portrait phones */}
          <div
            className={`flex-1 relative overflow-hidden flex items-center justify-center min-h-0 ${
              tutorialActive ? 'min-h-[40dvh] landscape:min-h-0' : ''
            }`}
          >
            <div className={`relative h-full aspect-square max-w-full shadow-2xl bg-black border-2 rounded-sm box-border ${conflictAlarm ? 'border-red-500 animate-pulse' : 'border-gray-700'}`}>
                <RadarScope
                  aircraft={aircraft}
                  onSelectAircraft={handleSelect}
                  scanAngle={scanAngle}
                  showPrimaryData={showPrimaryData}
                  showJRings={showJRings}
                  highlightGateId={selectedAircraft?.destination ?? null}
                />

                {/* Seed is shown in the ControlPanel header instead of as an
                    overlay pill — the pill covered the 360/350 bearing labels. */}

                <GuidedTutorial
                  active={tutorialActive && gameState === SimulationState.RUNNING}
                  bridge={tutorialBridge}
                  actionRef={tutorialActionsRef}
                  onFinished={finishTutorial}
                />

                {conflictAlarm && (
                  <div className="absolute inset-0 z-40 pointer-events-none bg-red-600/25 flex items-center justify-center">
                    <div className="text-3xl md:text-5xl font-bold text-red-400 drop-shadow-[0_0_20px_rgba(239,68,68,0.9)]">
                      CONFLICT
                    </div>
                  </div>
                )}

                {scoreFlash && !conflictAlarm && (
                  <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
                    <div className={`text-3xl md:text-5xl font-bold drop-shadow-[0_0_20px_rgba(20,241,149,0.8)] animate-in zoom-in ${scoreFlash.includes('LOSS') ? 'text-red-400' : 'text-green-400'}`}>
                      {scoreFlash}
                    </div>
                  </div>
                )}
                
                {/* Overlays (Visible when sidebar is hidden) */}
                <div className="lg:hidden absolute top-2 left-2 z-30">
                     <button 
                        onClick={() => setIsDataOpen(!isDataOpen)}
                        className="bg-gray-900/50 hover:bg-gray-800/70 text-green-500/80 border border-gray-800/50 px-2 py-1 rounded shadow backdrop-blur-sm text-[10px] font-bold mb-1 flex items-center gap-1"
                     >
                        {isDataOpen ? 'DATA' : 'DATA'} {isDataOpen ? <ChevronLeft size={10}/> : <ChevronRight size={10}/>}
                     </button>
                     {isDataOpen && (
                        <div className="flex gap-2 text-[10px] font-mono text-green-500/70 bg-gray-900/50 px-2 py-1 rounded border border-gray-800/50 shadow backdrop-blur-sm">
                             <span>RNG 40</span> <span>ALT 29.92</span>
                        </div>
                     )}
                </div>

                <div className="absolute top-2 right-2 z-30 flex items-start gap-1">
                     <button
                        type="button"
                        data-testid="jring-toggle"
                        aria-pressed={showJRings}
                        title="Toggle 3 NM J-rings around each target (typed: JRING)"
                        onClick={toggleJRings}
                        className={`text-[10px] font-bold px-2 py-1 rounded border backdrop-blur-sm transition-all h-[26px] ${
                          showJRings
                            ? 'bg-green-900/50 border-green-600 text-green-200'
                            : 'bg-gray-900/50 border-gray-800/50 text-gray-500 hover:text-gray-300'
                        }`}
                     >
                        J-RINGS 3 NM
                     </button>
                     <div className="2xl:hidden flex items-start gap-1">
                       {isRateOpen && (
                          <div className="flex gap-1 bg-gray-900/50 p-1 rounded border border-gray-800/50 shadow backdrop-blur-sm animate-in slide-in-from-right-2 fade-in duration-200">
                              {SIM_SPEED_OPTIONS.map(s => (
                                  <button key={s} onClick={() => setTimeScale(s)} className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all min-w-[24px] ${timeScale === s ? 'bg-green-900/80 border-green-500 text-white' : 'text-gray-500'}`}>
                                      {s}x
                                  </button>
                              ))}
                          </div>
                       )}
                       <button 
                          onClick={() => setIsRateOpen(!isRateOpen)}
                          className={`text-[10px] font-bold px-2 py-1 rounded border backdrop-blur-sm transition-all flex items-center gap-1 h-[26px] ${isRateOpen ? 'bg-green-900/50 border-green-600 text-white' : 'bg-gray-900/50 border-gray-800/50 text-gray-500'}`}
                       >
                          RATE
                       </button>
                     </div>
                </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR: Reference Panel (Visible only on 2XL screens) */}
          <div className="hidden 2xl:block h-full">
               <ReferencePanel
                 timeScale={timeScale}
                 setTimeScale={setTimeScale}
                 showJRings={showJRings}
                 onToggleJRings={toggleJRings}
               />
          </div>

      </div>

      <ControlPanel 
        selectedAircraft={selectedAircraft} 
        onCommand={handleCommand}
        messages={messages}
        score={score}
        scenarioSeed={scenarioSeed}
        gameActive={gameState === SimulationState.RUNNING}
        gameState={gameState}
        onStart={() => startGame({ difficulty: 'Expo' })} 
        onPause={togglePause}
        onReset={returnToMenu}
        onRestart={restartCurrent}
        statusMessage={statusMessage}
        onMoveLabel={handleMoveDataBlock}
        expoMode={playMode === 'expo'}
        tutorial={tutorialActive}
        spokenFill={spokenFill}
        onSpokenFillConsumed={(token) => {
          setSpokenFill((prev) => (prev && prev.token === token ? null : prev));
        }}
        onTranscript={handleSpokenTranscript}
        onSpeechError={handleSpeechError}
        activeCallsigns={aircraft.filter((a) => a.status === 'ACTIVE').map((a) => a.callsign)}
        arcadeHud={playMode === 'expo' && (gameState === SimulationState.RUNNING || gameState === SimulationState.PAUSED) ? (
          <ExpoArcadeHUD
            remainingMs={arcadeRemainingMs}
            banner={arcadeBanner}
            liveTranscript={liveTranscript}
            selected={selectedAircraft}
            onTranscript={handleSpokenTranscript}
            onSpeechError={handleSpeechError}
            onIssue={handleCommand}
            onFullscreen={requestFullscreen}
            onExit={returnToMenu}
            tutorial={tutorialActive}
            activeCallsigns={aircraft.filter((a) => a.status === 'ACTIVE').map((a) => a.callsign)}
          />
        ) : null}
      />

      {isDesktopApp() && (
        <>
          <button
            type="button"
            data-testid="desktop-settings-open"
            onClick={() => setDesktopSettingsOpen(true)}
            className="absolute bottom-2 left-2 z-40 text-[10px] uppercase tracking-wider border border-gray-700 bg-black/70 text-gray-300 px-2 py-1 rounded hover:text-white"
          >
            Desktop settings
          </button>
          <DesktopSettings open={desktopSettingsOpen} onClose={() => setDesktopSettingsOpen(false)} />
        </>
      )}
    </div>
  );
};

export default App;
