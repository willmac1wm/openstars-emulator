
import React, { useState, useEffect, useRef } from 'react';
import { Aircraft, SimulationState } from '../types';
import { Send, Radio, Plane, Play, Pause, RotateCcw, Power, Share2, Check, Keyboard as KeyboardIcon } from 'lucide-react';
import SoftKeyboard from './SoftKeyboard';

interface ControlPanelProps {
  selectedAircraft: Aircraft | null;
  onCommand: (cmd: string) => void;
  messages: string[];
  score: number;
  gameActive: boolean; // True if RUNNING
  gameState: SimulationState;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  statusMessage: string;
  onMoveLabel?: (dir: number) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ 
  selectedAircraft, 
  onCommand, 
  messages,
  score,
  gameActive,
  gameState,
  onStart,
  onPause,
  onReset,
  statusMessage,
  onMoveLabel
}) => {
  const [inputValue, setInputValue] = useState('');
  const [copied, setCopied] = useState(false);
  const [showSoftKeyboard, setShowSoftKeyboard] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Detect mobile on mount
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    setShowSoftKeyboard(isMobile);
  }, []);

  // Auto-focus logic
  useEffect(() => {
    if (selectedAircraft && inputRef.current) {
      const currentVal = inputValue;
      const trimmed = currentVal.trim();
      const callsignMatch = trimmed.match(/^([A-Z]+[0-9]+)/);
      
      if (currentVal === '') {
        setInputValue(`${selectedAircraft.callsign} `);
      } else if (callsignMatch) {
        const existingCallsign = callsignMatch[1];
        if (existingCallsign !== selectedAircraft.callsign) {
             const restOfCommand = currentVal.substring(existingCallsign.length);
             setInputValue(`${selectedAircraft.callsign}${restOfCommand}`);
        }
      }
      inputRef.current.focus();
    }
  }, [selectedAircraft, showSoftKeyboard]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;
    onCommand(inputValue.toUpperCase());
    setInputValue('');
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleSoftKey = (key: string) => setInputValue(prev => prev + key);
  const handleSoftDelete = () => setInputValue(prev => prev.slice(0, -1));

  const isRunning = gameState === SimulationState.RUNNING;
  const isPaused = gameState === SimulationState.PAUSED;
  const isOver = gameState === SimulationState.SUMMARY;
  const isIdle = gameState === SimulationState.MENU;

  return (
    <div className="flex flex-col lg:h-full w-full lg:w-80 xl:w-96 bg-gray-900 border-t lg:border-t-0 lg:border-l border-gray-800 text-green-400 font-mono shadow-2xl z-20 overflow-hidden transition-all duration-300">
      
      {/* 1. TOP BAR: Status & Score */}
      <div className="flex justify-between items-center p-2 border-b border-gray-800 bg-gray-900 shrink-0">
         <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-white tracking-widest">OPEN<span className="text-green-500">STARS</span></h1>
            <div className="text-xs flex items-center gap-1">
                <Radio size={10} className={isRunning ? "animate-pulse text-red-500" : "text-gray-500"} />
                <span className={isPaused ? "text-yellow-500 blink" : "text-gray-400"}>
                    {isPaused ? 'PAUSED' : isRunning ? 'LIVE' : 'OFF'}
                </span>
            </div>
         </div>
         <div className="flex items-center gap-2">
            <span className="text-white text-sm font-bold">SCORE: {score}</span>
            <button onClick={handleShare} className="text-[10px] flex items-center gap-1 bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded border border-gray-700 text-gray-300">
                {copied ? <Check size={10} className="text-green-500" /> : <Share2 size={10} />}
            </button>
         </div>
      </div>

      {/* 2. CONTROLS & TARGET INFO (Compact) */}
      <div className="p-2 bg-black/50 border-b border-gray-800 shrink-0 flex flex-col gap-1">
        {/* Target Info */}
        <div className="flex justify-between items-center bg-black p-1 rounded border border-gray-800/50">
            {selectedAircraft ? (
            <>
                <div className="text-white font-bold text-sm flex items-center gap-1">
                <Plane size={12} className="text-green-500" /> {selectedAircraft.callsign}
                </div>
                <div className="flex gap-2 text-[10px] text-gray-400">
                    <span>ALT:{Math.floor(selectedAircraft.altitude * 100)}</span>
                    <span>SPD:{Math.floor(selectedAircraft.speed)}</span>
                    <span>HDG:{selectedAircraft.heading.toFixed(0)}°</span>
                </div>
            </>
            ) : (
            <div className="text-gray-600 italic text-[10px] w-full text-center">NO TARGET SELECTED</div>
            )}
        </div>
        
        {/* Buttons */}
        <div className="flex gap-1">
            {(isIdle || isOver) ? (
                <button onClick={onStart} className="flex-1 bg-green-700 hover:bg-green-600 text-white py-1 px-2 rounded flex items-center justify-center gap-2 text-xs">
                    <Power size={12} /> INITIALIZE
                </button>
            ) : (
                <>
                    <button onClick={onPause} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-1 px-2 rounded flex items-center justify-center gap-2 text-xs border border-gray-600">
                        {isPaused ? <Play size={12}/> : <Pause size={12}/>} {isPaused ? "RESUME" : "PAUSE"}
                    </button>
                    <button onClick={onReset} className="bg-red-900/50 hover:bg-red-800 text-red-200 py-1 px-2 rounded border border-red-900">
                        <RotateCcw size={12} />
                    </button>
                </>
            )}
        </div>
      </div>

      {/* 3. INPUT BAR (Middle) */}
      <form onSubmit={handleSubmit} className="p-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex gap-1">
             <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                    <span className="text-green-600 font-bold text-xs">{'>'}</span>
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    inputMode={showSoftKeyboard ? 'none' : 'text'}
                    className="block w-full pl-5 pr-8 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-600 focus:outline-none focus:border-green-500 font-mono uppercase tracking-wider text-base"
                    placeholder="COMMAND"
                    disabled={!isRunning}
                    autoComplete="off"
                />
             </div>
             <button
                type="button"
                onClick={() => setShowSoftKeyboard(!showSoftKeyboard)}
                className={`px-2 rounded border ${showSoftKeyboard ? 'bg-green-700 border-green-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}
             >
                <KeyboardIcon size={18} />
             </button>
        </div>
      </form>

      {/* 4. BOTTOM SPLIT SECTION (Mobile Portrait) vs STACK (Desktop) */}
      <div className="flex-1 min-h-0 flex flex-row lg:flex-col overflow-hidden">
          
          {/* COMM LOG (Left on Mobile, Top on Desktop) */}
          <div className={`flex-1 bg-black border-r lg:border-r-0 lg:border-b border-gray-800 flex flex-col relative min-w-0 ${showSoftKeyboard ? 'w-1/2 lg:w-full' : 'w-full'}`}>
            <div className="absolute top-0 left-0 right-0 bg-gray-800 text-[9px] px-1 text-gray-500 z-10 flex justify-between">
                <span>COMM 1</span><span>124.500</span>
            </div>
            <div className="flex-1 overflow-y-auto p-1 pt-4 space-y-1 font-mono text-[10px] lg:text-xs leading-tight">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex items-start ${msg.startsWith('>') ? 'text-cyan-500' : 'text-green-400'}`}>
                    <div className="whitespace-pre-wrap break-words flex-1">
                        {msg.startsWith('>') ? msg.substring(2) : msg.trim()}
                    </div>
                    </div>
                ))}
                <div ref={logsEndRef} />
            </div>
          </div>

          {/* KEYBOARD (Right on Mobile, Bottom on Desktop) - Only if enabled */}
          {showSoftKeyboard && (
            <div className="w-1/2 lg:w-full lg:flex-none h-full lg:h-auto border-t border-gray-800 bg-black">
                <SoftKeyboard 
                    onKeyPress={handleSoftKey} 
                    onDelete={handleSoftDelete} 
                    onSubmit={() => handleSubmit()} 
                    onMoveLabel={onMoveLabel}
                />
            </div>
          )}
      </div>
    </div>
  );
};

export default ControlPanel;
