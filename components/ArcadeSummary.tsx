import React, { useEffect, useState } from 'react';
import { GameStats } from '../types';
import { ATC_CAREER_CARD } from '../services/atcFacts';
import { HighScoreEntry, loadHighScores, qualifiesForBoard, saveHighScore, sanitizeInitials } from '../services/highScores';
import TakeHomeQr from './TakeHomeQr';

interface ArcadeSummaryProps {
  score: number;
  stats: GameStats;
  onDone: () => void;
  /** 'arcade' (5 min), 'sixty' (60-Second Challenge), or 'saturation' (Sector Saturation). */
  variant?: 'arcade' | 'sixty' | 'saturation';
  profileInitials?: string;
  saturationReason?: 'relief' | 'separation' | null;
  peakAircraft?: number;
  elapsedMs?: number;
}

const ArcadeSummary: React.FC<ArcadeSummaryProps> = ({
  score,
  stats,
  onDone,
  variant = 'arcade',
  profileInitials,
  saturationReason = null,
  peakAircraft = 0,
  elapsedMs = 0,
}) => {
  const [initials, setInitials] = useState(profileInitials || 'ATC');
  const [board, setBoard] = useState<HighScoreEntry[]>(() => loadHighScores());
  const [saved, setSaved] = useState(false);
  const canEnter = qualifiesForBoard(score) && !saved;

  useEffect(() => {
    const timer = setTimeout(onDone, 45000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="absolute inset-0 z-[70] bg-black/95 flex items-center justify-center p-4" data-testid="arcade-summary">
      <div className="w-full max-w-4xl grid gap-4 lg:grid-cols-2">
        <div className="bg-gray-950 border border-green-700 rounded-xl p-6 space-y-4">
          <div className="text-gray-400 text-xs tracking-widest uppercase">
            {variant === 'saturation'
              ? saturationReason === 'relief'
                ? 'Relief on position — sector handed off'
                : 'Sector overloaded — loss of separation'
              : 'Shift complete'}
          </div>
          <div className="text-5xl font-bold text-white">{score}</div>
          {variant === 'sixty' && (
            <div data-testid="sixty-summary-label" className="text-cyan-300 text-sm font-bold">3-MINUTE SPRINT</div>
          )}
          {variant === 'saturation' && (
            <div data-testid="saturation-summary-label" className="text-red-300 text-sm font-bold">
              SECTOR SATURATION · {Math.floor(elapsedMs / 60000)}:{String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0')} SURVIVED · PEAK {peakAircraft} A/C
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-black border border-gray-800 rounded p-3">Clean exits <div className="text-2xl text-green-400">{stats.perfectExits}</div></div>
            <div className="bg-black border border-gray-800 rounded p-3">Conflicts <div className="text-2xl text-red-400">{stats.separationBusts}</div></div>
          </div>

          {canEnter ? (
            <div className="space-y-2">
              <div className="text-amber-300 text-sm font-bold">New high score — enter 3 initials</div>
              <div className="flex gap-2">
                <input
                  data-testid="initials-input"
                  value={initials}
                  maxLength={3}
                  onChange={(event) => setInitials(sanitizeInitials(event.target.value))}
                  className="w-28 bg-black border border-gray-600 rounded px-3 py-3 text-center text-2xl tracking-[0.3em] text-green-300 uppercase"
                />
                <button
                  type="button"
                  className="flex-1 bg-green-600 hover:bg-green-500 text-black font-bold rounded"
                  onClick={() => {
                    const modeLabel =
                      variant === 'sixty'
                        ? '60-Second'
                        : variant === 'saturation'
                          ? 'Saturation'
                          : 'Expo';
                    setBoard(saveHighScore(initials, score, { mode: modeLabel, cleanExits: stats.perfectExits }));
                    setSaved(true);
                  }}
                >
                  SAVE
                </button>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">{saved ? 'Saved to local board.' : 'Play again to climb the board.'}</div>
          )}

          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Local high scores</div>
            <div className="bg-black border border-gray-800 rounded p-2 space-y-1 text-sm font-mono">
              {board.length === 0 && <div className="text-gray-600">No scores yet</div>}
              {board.map((row, index) => (
                <div key={`${row.initials}-${row.at}`} className="flex justify-between text-green-300">
                  <span>{index + 1}. {row.initials}{row.mode ? ` · ${row.mode}` : ''}</span>
                  <span>{row.score}</span>
                </div>
              ))}
            </div>
          </div>

          <TakeHomeQr />

          <button type="button" onClick={onDone} className="w-full border border-gray-700 text-gray-300 py-3 rounded hover:bg-gray-900">
            Back to attract mode
          </button>
        </div>

        <aside className="bg-gray-950 border border-gray-700 rounded-xl p-6 space-y-3 text-gray-300">
          <div className="text-green-400 font-bold text-lg">{ATC_CAREER_CARD.title}</div>
          <ul className="space-y-2 text-sm list-disc list-inside">
            {ATC_CAREER_CARD.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          <a
            href={ATC_CAREER_CARD.careersUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 text-cyan-400 underline text-sm"
          >
            faa.gov/jobs
          </a>
          <div className="text-[10px] text-gray-600">{ATC_CAREER_CARD.sourceNote}</div>
        </aside>
      </div>
    </div>
  );
};

export default ArcadeSummary;
