
import React, { useState, useEffect, useRef, useCallback } from 'react';
import RadarScope from './components/RadarScope';
import ControlPanel from './components/ControlPanel';
import MainMenu from './components/MainMenu';
import SummaryScreen from './components/SummaryScreen';
import FlightStripBay from './components/FlightStripBay';
import ReferencePanel from './components/ReferencePanel';
import { Aircraft, SimulationState, AlertLevel, GameStats } from './types';
import { generateScenario, getPilotResponse } from './services/geminiService';
import { trackEvent, identifyUser } from './services/analytics';
import { 
  MAP_SIZE, CENTER, INITIAL_INSTRUCTION, NM_TO_PX, DEFAULT_TIME_SCALE, 
  SIM_SPEED_OPTIONS, GATES, NM_3_PX, NM_4_PX,
  SCORE_PERFECT_EXIT, SCORE_SLOPPY_EXIT, PENALTY_WRONG_ALT, 
  PENALTY_WRONG_GATE, PENALTY_OFF_COURSE, PENALTY_SEPARATION,
  ALTS_NORTH_EAST, ALTS_SOUTH_WEST, GATE_RADIUS
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
  const [messages, setMessages] = useState<string[]>([INITIAL_INSTRUCTION]);
  const [score, setScore] = useState(0);
  const [stats, setStats] = useState<GameStats>(INITIAL_STATS);
  const [highScore, setHighScore] = useState(0);
  const [statusMessage, setStatusMessage] = useState('SYSTEM STANDBY');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeScale, setTimeScale] = useState(DEFAULT_TIME_SCALE);
  const [showPrimaryData, setShowPrimaryData] = useState(true);
  const [scanAngle, setScanAngle] = useState(0);
  
  // UI States for Overlays
  const [isRateOpen, setIsRateOpen] = useState(false);
  const [isDataOpen, setIsDataOpen] = useState(true);

  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  
  const incidentCooldowns = useRef<Map<string, number>>(new Map());

  const addLog = useCallback((msg: string) => {
    setMessages(prev => [...prev.slice(-19), msg]); 
  }, []);

  // Load High Score
  useEffect(() => {
    const saved = localStorage.getItem('openstars_highscore');
    if (saved) setHighScore(parseInt(saved));
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

  const startGame = async (difficulty: string, email?: string) => {
    
    // 1. Identify User
    if (email) {
        identifyUser(email);
    } else {
        identifyUser('guest-' + Math.floor(Math.random() * 1000000));
    }

    // 2. Start Game Logic
    setGameState(SimulationState.LOADING);
    setStatusMessage('INITIALIZING RADAR SCENARIO...');
    
    trackEvent('Game Started', { difficulty, mode: email ? 'Identified' : 'Guest' });

    try {
      const scenario = await generateScenario(difficulty);
      setAircraft(scenario.aircraft.map(ac => ({
        ...ac,
        alertLevel: AlertLevel.NONE
      })));
      setGameState(SimulationState.RUNNING);
      setStatusMessage(`RADAR CONTACT: ${scenario.name}`);
      addLog(`GATES OPEN. ${scenario.aircraft.length} AIRCRAFT INBOUND.`);
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

  const returnToMenu = () => {
    setGameState(SimulationState.MENU);
    setAircraft([]);
    setMessages([INITIAL_INSTRUCTION]);
    setScore(0);
    setSelectedId(null);
  };

  const endGame = useCallback(() => {
    setGameState(SimulationState.SUMMARY);
    if (score > highScore) {
        setHighScore(score);
        localStorage.setItem('openstars_highscore', score.toString());
        trackEvent('New High Score', { score });
    } else {
        trackEvent('Game Completed', { score, separationBusts: stats.separationBusts });
    }
  }, [score, highScore, stats.separationBusts]);

  // --- Command Parser ---
  const handleCommand = (cmdRaw: string) => {
    const raw = cmdRaw.trim().toUpperCase();
    const parts = raw.split(/\s+/);
    const callsign = parts[0];

    setAircraft(prev => {
      const matches = prev.filter(ac => ac.callsign === callsign);
      let targetAc = matches.length === 1 ? matches[0] : (matches.find(ac => ac.id === selectedId) || matches[0]);
      
      if (targetAc) {
        // Only prioritize selection if the target matches the typed callsign
      } else {
        addLog(`> TARGET ${callsign} NOT FOUND`);
        return prev;
      }

      const targetIndex = prev.findIndex(ac => ac.id === targetAc.id);
      const newAircraft = [...prev];
      const ac = { ...newAircraft[targetIndex] };
      const instructions: string[] = [];

      const cmdBody = raw.substring(callsign.length).trim();
      const hdgRegex = /(H|HDG|TLH|TRH|TL|TR|T)\s*(\d{3})/gi;
      const altRegex = /(A|ALT|C)\s*(\d{1,3})/gi;
      const spdRegex = /(S|SPD)\s*(\d{2,3})/gi;

      let match;
      while ((match = hdgRegex.exec(cmdBody)) !== null) {
        const type = match[1];
        const val = parseInt(match[2], 10);
        const normalizedHeading = val % 360;
        ac.targetHeading = normalizedHeading;
        
        let directionStr = "";
        if (type === 'TL' || type === 'TLH') { ac.turnDirection = 'LEFT'; directionStr = "LEFT"; }
        else if (type === 'TR' || type === 'TRH') { ac.turnDirection = 'RIGHT'; directionStr = "RIGHT"; }
        else {
             ac.turnDirection = undefined;
             let diff = normalizedHeading - ac.heading;
             while (diff < -180) diff += 360;
             while (diff > 180) diff -= 360;
             directionStr = diff > 0 ? "RIGHT" : "LEFT";
        }
        instructions.push(`TURN ${directionStr} HEADING ${val.toString().padStart(3, '0')}`);
      }

      while ((match = altRegex.exec(cmdBody)) !== null) {
        const val = parseInt(match[2], 10);
        if (val > ac.altitude) instructions.push(`CLIMB AND MAINTAIN ${val}00`);
        else if (val < ac.altitude) instructions.push(`DESCEND AND MAINTAIN ${val}00`);
        else instructions.push(`MAINTAIN ${val}00`);
        ac.targetAltitude = val;
      }

      while ((match = spdRegex.exec(cmdBody)) !== null) {
        const val = parseInt(match[2], 10);
        if (val > ac.speed) instructions.push(`INCREASE SPEED TO ${val}`);
        else if (val < ac.speed) instructions.push(`REDUCE SPEED TO ${val}`);
        else instructions.push(`MAINTAIN ${val} KNOTS`);
        ac.targetSpeed = val;
      }

      if (instructions.length === 0) {
          addLog(`> UNRECOGNIZED COMMAND: ${cmdBody}`);
          return prev;
      }

      newAircraft[targetIndex] = ac;
      const fullMsg = instructions.join(', ');
      addLog(`> ${callsign}, ${fullMsg}`);
      
      trackEvent('Command Issued', { callsign, command: cmdBody });

      setTimeout(async () => {
        const pilotMsg = await getPilotResponse(callsign, fullMsg);
        addLog(pilotMsg);
      }, 1500 + Math.random() * 1000);

      return newAircraft;
    });
  };

  const updatePhysics = useCallback((deltaSeconds: number) => {
    setAircraft(prev => {
      let activeCount = 0;
      
      const updated = prev.map(ac => {
        if (ac.status === 'HANDOFF') {
             const edgeBuffer = 10;
             if (ac.x <= edgeBuffer || ac.x >= MAP_SIZE - edgeBuffer || ac.y <= edgeBuffer || ac.y >= MAP_SIZE - edgeBuffer) {
                 return { ...ac, speed: 0 }; 
             }
        } else if (ac.status !== 'CRASH') {
            activeCount++;
        }

        let newHeading = ac.heading;
        let newAlt = ac.altitude;
        let newSpeed = ac.speed;

        if (ac.heading !== ac.targetHeading) {
           let diff = ac.targetHeading - ac.heading;
           while (diff <= -180) diff += 360;
           while (diff > 180) diff -= 360;
           const turnRatePerSec = 3.0; 
           const turnAmount = turnRatePerSec * deltaSeconds * timeScale;
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
            const climbRatePerSec = 0.25 * timeScale; 
            if (Math.abs(ac.targetAltitude - ac.altitude) < climbRatePerSec * deltaSeconds) newAlt = ac.targetAltitude;
            else newAlt += (ac.targetAltitude > ac.altitude ? 1 : -1) * climbRatePerSec * deltaSeconds;
        }

        if (ac.speed !== ac.targetSpeed) {
            const accRatePerSec = 2.5 * timeScale; 
            if (Math.abs(ac.targetSpeed - ac.speed) < accRatePerSec * deltaSeconds) newSpeed = ac.targetSpeed;
            else newSpeed += (ac.targetSpeed > ac.speed ? 1 : -1) * accRatePerSec * deltaSeconds;
        }

        const pxPerSec = (newSpeed * NM_TO_PX) / 3600; 
        const moveDist = pxPerSec * deltaSeconds * timeScale;
        const newX = ac.x + Math.cos(toRad(newHeading)) * moveDist;
        const newY = ac.y + Math.sin(toRad(newHeading)) * moveDist;

        let newHistory = ac.history;
        if (Math.random() < (0.25 * deltaSeconds * timeScale)) { 
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
            const enteredGate = GATES.find(g => angleDeg >= g.startAngle && angleDeg <= g.endAngle);
            
            status = 'HANDOFF';
            
            if (enteredGate) {
                if (enteredGate.id === ac.destination) {
                    const finalAlt = Math.round(ac.altitude);
                    const validAlts = (enteredGate.id === 'NOR' || enteredGate.id === 'EAS') ? ALTS_NORTH_EAST : ALTS_SOUTH_WEST;
                    const hasValidAlt = validAlts.includes(finalAlt);
                    
                    const semiWidth = (enteredGate.endAngle - enteredGate.startAngle) / 2;
                    const gateMid = (enteredGate.startAngle + enteredGate.endAngle) / 2;
                    const isClean = Math.abs(angleDeg - gateMid) < (semiWidth * 0.8);

                    let pts = 0;
                    if (isClean) {
                        pts += SCORE_PERFECT_EXIT;
                        setStats(s => ({...s, perfectExits: s.perfectExits + 1}));
                        addLog(`${ac.callsign} CLEAN EXIT ${enteredGate.label}. +${SCORE_PERFECT_EXIT}`);
                        handoffResult = "CLEAN EXIT";
                    } else {
                        pts += SCORE_SLOPPY_EXIT;
                        setStats(s => ({...s, sloppyExits: s.sloppyExits + 1}));
                        addLog(`${ac.callsign} EXIT ${enteredGate.label} (TOUCHED SIDES). +${SCORE_SLOPPY_EXIT}`);
                        handoffResult = "SLOPPY EXIT";
                    }

                    if (!hasValidAlt) {
                        pts -= PENALTY_WRONG_ALT;
                        setStats(s => ({...s, wrongAlt: s.wrongAlt + 1}));
                        addLog(`${ac.callsign} WRONG ALT (${finalAlt}). -${PENALTY_WRONG_ALT}`);
                        handoffResult = "WRONG ALT";
                    }
                    setScore(s => s + pts);
                } else {
                    setScore(s => Math.max(0, s - PENALTY_WRONG_GATE));
                    setStats(s => ({...s, wrongGate: s.wrongGate + 1}));
                    addLog(`${ac.callsign} WRONG GATE (${enteredGate.label}). -${PENALTY_WRONG_GATE}`);
                    handoffResult = "WRONG GATE";
                }
            } else {
                addLog(`${ac.callsign} OFF COURSE. -${PENALTY_OFF_COURSE}`);
                setScore(s => Math.max(0, s - PENALTY_OFF_COURSE));
                handoffResult = "OFF COURSE";
            }
        }

        return { ...ac, x: newX, y: newY, heading: newHeading, altitude: newAlt, speed: newSpeed, history: newHistory, status, turnDirection: ac.turnDirection, alertLevel: AlertLevel.NONE, handoffResult };
      });
      
      if (prev.length > 0 && activeCount === 0) {
          setTimeout(endGame, 4000);
      }

      return checkSeparation(updated);
    });
  }, [addLog, timeScale, endGame]);

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
                                    involved: [a.callsign, b.callsign]
                                }]
                            }));
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

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setAircraft(prev => prev.map(ac => ({ ...ac, isSelected: ac.id === id })));
  };

  const selectedAircraft = aircraft.find(ac => ac.id === selectedId) || null;

  return (
    <div className="flex flex-col landscape:flex-row h-[100dvh] w-screen bg-black text-white overflow-hidden touch-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] relative" onContextMenu={(e) => e.preventDefault()}>
      
      {gameState === SimulationState.MENU && <MainMenu onStart={startGame} highScore={highScore} />}
      {gameState === SimulationState.SUMMARY && <SummaryScreen score={score} stats={stats} onReset={returnToMenu} />}

      {/* PRO DASHBOARD LAYOUT */}
      <div className="flex-1 flex min-h-0 min-w-0 bg-[#050505]">
          
          {/* LEFT SIDEBAR: Flight Strips (Visible on LG/Laptop+) */}
          <div className="hidden lg:block h-full">
              <FlightStripBay aircraft={aircraft} onSelect={handleSelect} selectedId={selectedId} />
          </div>

          {/* CENTER: Radar Scope */}
          <div className="flex-1 relative overflow-hidden flex items-center justify-center">
            <div className="relative h-full aspect-square max-w-full shadow-2xl bg-black border-2 border-gray-700 rounded-sm box-border">
                <RadarScope aircraft={aircraft} onSelectAircraft={handleSelect} scanAngle={scanAngle} showPrimaryData={showPrimaryData}/>
                
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

                <div className="2xl:hidden absolute top-2 right-2 z-30 flex items-start gap-1">
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

          {/* RIGHT SIDEBAR: Reference Panel (Visible only on 2XL screens) */}
          <div className="hidden 2xl:block h-full">
               <ReferencePanel timeScale={timeScale} setTimeScale={setTimeScale} />
          </div>

      </div>

      <ControlPanel 
        selectedAircraft={selectedAircraft} 
        onCommand={handleCommand}
        messages={messages}
        score={score}
        gameActive={gameState === SimulationState.RUNNING}
        gameState={gameState}
        onStart={() => startGame("Medium")} 
        onPause={togglePause}
        onReset={returnToMenu}
        statusMessage={statusMessage}
        onMoveLabel={handleMoveDataBlock}
      />
    </div>
  );
};

export default App;
