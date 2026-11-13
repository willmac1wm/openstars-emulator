import React, { useMemo, useState } from 'react';
import { HighScoreEntry, loadHighScores } from '../services/highScores';
import { loadSessionLog } from '../services/sessionLog';

type Filter = 'all' | 'expo' | 'sixty' | 'daily';

/**
 * Full-screen leaderboard with large type, for a booth display or a
 * classroom projector. Reads the local top-10 arcade board; the Daily tab
 * reads today's daily-challenge entries from the local session log.
 */
const LeaderboardView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const board = useMemo(() => loadHighScores(), []);
  const daily = useMemo(
    () => loadSessionLog().filter((row) => row.daily).sort((a, b) => b.score - a.score).slice(0, 10),
    [],
  );

  const rows: Array<{ initials: string; score: number; mode?: string; at: number }> =
    filter === 'daily'
      ? daily
      : board.filter((row: HighScoreEntry) => {
          if (filter === 'all') return true;
          if (filter === 'expo') return !row.mode || row.mode === 'Expo';
          if (filter === 'sixty') return row.mode === '60-Second';
          return true;
        });

  const tabs: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'ALL' },
    { id: 'expo', label: 'EXPO' },
    { id: 'sixty', label: '60-SECOND' },
    { id: 'daily', label: "TODAY'S CHALLENGE" },
  ];

  return (
    <div
      data-testid="leaderboard-view"
      className="absolute inset-0 z-[80] bg-black text-white font-mono overflow-y-auto p-4 md:p-8"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter">
            LEADER<span className="text-green-500">BOARD</span>
          </h2>
          <button
            type="button"
            data-testid="leaderboard-back"
            onClick={onBack}
            className="border border-gray-600 text-gray-200 px-4 py-2 rounded font-bold hover:bg-gray-900"
          >
            BACK
          </button>
        </div>
        <div className="text-gray-400 text-sm">Top scores on this device · no account · local only</div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Leaderboard filter">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-testid={`leaderboard-filter-${tab.id}`}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded font-bold border ${
                filter === tab.id ? 'bg-green-600 text-black border-green-600' : 'border-gray-700 text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <ol className="space-y-2">
          {rows.length === 0 && (
            <li className="text-gray-500 text-xl py-8 text-center">No scores yet — be the first.</li>
          )}
          {rows.map((row, index) => (
            <li
              key={`${row.initials}-${row.at}-${index}`}
              className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 md:py-4 ${
                index === 0 ? 'border-yellow-500 bg-yellow-950/30' : 'border-gray-800 bg-gray-950'
              }`}
            >
              <span className="flex items-center gap-4 min-w-0">
                <span className={`text-3xl md:text-4xl font-black w-12 ${index === 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {index + 1}
                </span>
                <span className="text-2xl md:text-3xl font-bold tracking-widest">{row.initials}</span>
                {row.mode && <span className="text-xs text-gray-400 border border-gray-700 rounded px-2 py-1">{row.mode}</span>}
              </span>
              <span className="text-right">
                <span className="block text-3xl md:text-4xl font-black text-green-400">{row.score}</span>
                <span className="block text-xs text-gray-500">{new Date(row.at).toLocaleDateString()}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export default LeaderboardView;
