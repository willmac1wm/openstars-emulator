import React, { useState } from 'react';
import { Play, Trophy, Info, ChevronRight, BookOpen, Target, Command, Map, Mail, User } from 'lucide-react';

interface MainMenuProps {
  onStart: (difficulty: string, email?: string) => void;
  highScore: number;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStart, highScore }) => {
  const [step, setStep] = useState<'LOGIN' | 'DIFFICULTY'>('LOGIN');
  const [email, setEmail] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [showRules, setShowRules] = useState(false);

  const difficulties = [
    { id: 'Easy', label: 'TRAINEE', desc: 'Low Traffic (3-4 Aircraft)' },
    { id: 'Medium', label: 'CONTROLLER', desc: 'Standard (8-12 Aircraft)' },
    { id: 'Hard', label: 'VETERAN', desc: 'Heavy Traffic (12-15 Aircraft)' },
  ];

  const handleLogin = (isGuest: boolean) => {
      if (isGuest) {
          setStep('DIFFICULTY');
      } else {
          if (email.includes('@')) {
              setStep('DIFFICULTY');
          } else {
              alert("Please enter a valid email or play as guest.");
          }
      }
  };

  const handleStartGame = () => {
      onStart(difficulty, email || undefined);
  };

  if (showRules) {
      return (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center text-green-500 font-mono p-4 select-none">
            <div className="bg-gray-900 border border-green-500 rounded max-w-3xl w-full max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(20,241,149,0.2)] overflow-hidden">
                <div className="bg-gray-900 p-6 border-b border-green-900 shrink-0">
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-green-500">
                        <BookOpen /> OPERATING PROCEDURES
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-8 text-gray-300 text-sm">
                    <section className="space-y-2">
                        <h3 className="text-green-400 font-bold text-lg flex items-center gap-2">
                            <Map size={18}/> 1. THE MISSION
                        </h3>
                        <p>
                            You are an Air Traffic Controller. Aircraft are entering your sector from all sides. 
                            Your job is to guide them safely to their assigned <strong className="text-white">EXIT GATE</strong>.
                        </p>
                    </section>
                    <section className="space-y-2">
                        <h3 className="text-green-400 font-bold text-lg flex items-center gap-2">
                            <Target size={18}/> 2. READING THE SCOPE
                        </h3>
                        <p>Look at the Data Block (text) attached to each aircraft. The 3-letter code tells you where it needs to go.</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                            <div className="bg-black border border-gray-700 p-2 rounded text-center">
                                <div className="text-white font-bold">NOR</div>
                                <div className="text-xs text-gray-500">NORTH GATE</div>
                            </div>
                            <div className="bg-black border border-gray-700 p-2 rounded text-center">
                                <div className="text-white font-bold">SOU</div>
                                <div className="text-xs text-gray-500">SOUTH GATE</div>
                            </div>
                            <div className="bg-black border border-gray-700 p-2 rounded text-center">
                                <div className="text-white font-bold">EAS</div>
                                <div className="text-xs text-gray-500">EAST GATE</div>
                            </div>
                            <div className="bg-black border border-gray-700 p-2 rounded text-center">
                                <div className="text-white font-bold">WES</div>
                                <div className="text-xs text-gray-500">WEST GATE</div>
                            </div>
                        </div>
                    </section>
                    <section className="space-y-2">
                        <h3 className="text-green-400 font-bold text-lg">3. CRITICAL RULES</h3>
                        <div className="border border-red-900/50 bg-red-900/10 p-3 rounded">
                            <strong className="text-red-400">SEPARATION:</strong> Keep aircraft 3 miles apart (laterally) and 1000ft apart (vertically).
                        </div>
                        <ul className="text-xs space-y-1 mt-2">
                            <li className="flex justify-between border-b border-gray-800 pb-1">
                                <span>Exiting <span className="text-green-300">NORTH / EAST</span></span>
                                <span className="font-bold text-white">FL 070, 090</span>
                            </li>
                            <li className="flex justify-between pt-1">
                                <span>Exiting <span className="text-green-300">SOUTH / WEST</span></span>
                                <span className="font-bold text-white">FL 060, 080</span>
                            </li>
                        </ul>
                    </section>
                </div>
                <div className="bg-gray-900 p-4 border-t border-gray-800 shrink-0">
                    <button 
                        onClick={() => setShowRules(false)}
                        className="w-full bg-green-700 hover:bg-green-600 text-white py-3 rounded font-bold uppercase tracking-widest shadow-lg transition-all"
                    >
                        I Understand - Close
                    </button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center text-green-500 font-mono p-4 select-none">
        <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
            
            {/* Title Block */}
            <div className="text-center space-y-2">
                <h1 className="text-6xl font-bold tracking-tighter text-white drop-shadow-[0_0_10px_rgba(20,241,149,0.8)]">
                    OPEN<span className="text-green-500">STARS</span>
                </h1>
                <div className="text-gray-400 tracking-widest text-sm">RADAR TERMINAL EMULATOR</div>
            </div>

            {step === 'LOGIN' ? (
                <div className="bg-gray-900 p-6 rounded border border-gray-800 space-y-4 shadow-xl">
                    <div className="text-center space-y-2">
                        <div className="text-white font-bold text-lg">Controller Identification</div>
                        <p className="text-xs text-gray-500">Enter email to track your career stats and receive updates.</p>
                    </div>
                    
                    <div className="space-y-2">
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 text-gray-500" size={16} />
                            <input 
                                type="email" 
                                placeholder="name@example.com" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-black border border-gray-700 rounded py-2 pl-10 pr-4 text-white focus:border-green-500 focus:outline-none"
                            />
                        </div>
                        <button 
                            onClick={() => handleLogin(false)}
                            className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-3 rounded transition-all"
                        >
                            CONTINUE
                        </button>
                    </div>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-800"></div>
                        <span className="flex-shrink mx-4 text-gray-600 text-xs">OR</span>
                        <div className="flex-grow border-t border-gray-800"></div>
                    </div>

                    <button 
                        onClick={() => handleLogin(true)}
                        className="w-full bg-transparent hover:bg-gray-800 text-gray-400 py-2 rounded border border-gray-700 text-sm flex items-center justify-center gap-2"
                    >
                        <User size={14} /> PLAY AS GUEST
                    </button>
                </div>
            ) : (
                <>
                    {/* Stats */}
                    <div className="flex justify-center gap-4 text-sm">
                        <div className="bg-gray-900 px-4 py-2 rounded border border-gray-800 flex items-center gap-2">
                            <Trophy size={14} className="text-yellow-500"/>
                            <span className="text-gray-400">BEST SCORE:</span>
                            <span className="text-white font-bold">{highScore}</span>
                        </div>
                    </div>

                    {/* Difficulty Selector */}
                    <div className="space-y-2">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 ml-1">Select Difficulty</div>
                        {difficulties.map(d => (
                            <button
                                key={d.id}
                                onClick={() => setDifficulty(d.id)}
                                className={`w-full flex items-center justify-between p-4 rounded border transition-all ${
                                    difficulty === d.id 
                                    ? 'bg-green-900/30 border-green-500 text-white shadow-[0_0_15px_rgba(20,241,149,0.1)]' 
                                    : 'bg-black border-gray-800 text-gray-500 hover:border-gray-600'
                                }`}
                            >
                                <div className="text-left">
                                    <div className={`font-bold ${difficulty === d.id ? 'text-green-400' : 'text-gray-400'}`}>{d.label}</div>
                                    <div className="text-xs opacity-70">{d.desc}</div>
                                </div>
                                {difficulty === d.id && <ChevronRight className="text-green-500"/>}
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <button 
                            onClick={handleStartGame}
                            className="w-full bg-green-600 hover:bg-green-500 text-black font-bold text-xl py-4 rounded shadow-[0_0_20px_rgba(20,241,149,0.4)] hover:shadow-[0_0_30px_rgba(20,241,149,0.6)] transition-all flex items-center justify-center gap-2"
                        >
                            <Play fill="black" /> INITIALIZE RADAR
                        </button>
                        
                        <button 
                            onClick={() => setShowRules(true)}
                            className="w-full bg-transparent hover:bg-gray-900 text-gray-400 hover:text-white py-3 rounded border border-gray-800 transition-all flex items-center justify-center gap-2 text-sm"
                        >
                            <Info size={16} /> HOW TO PLAY
                        </button>
                    </div>
                </>
            )}

            <div className="text-center text-[10px] text-gray-700">
                v2.1.0 • OpenSTARS
            </div>
        </div>
    </div>
  );
};

export default MainMenu;