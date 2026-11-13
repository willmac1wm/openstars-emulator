import React, { useMemo, useState } from 'react';
import { clearSessionLog, loadSessionLog, sessionLogToText, SessionRecord } from '../services/sessionLog';
import { clearHighScores } from '../services/highScores';

/**
 * Instructor / class-scores view for a shared classroom or booth device.
 * Lists every finished session stored on this device — player, mode, score,
 * clean exits, busts, date — filterable by mode. Clearing asks first and
 * wipes both the session log and the arcade board.
 */
const InstructorView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [rows, setRows] = useState<SessionRecord[]>(() => loadSessionLog());
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const [copied, setCopied] = useState(false);

  const modes = useMemo(() => ['all', ...Array.from(new Set(rows.map((row) => row.mode)))], [rows]);
  const visible = rows.filter((row) => modeFilter === 'all' || row.mode === modeFilter);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sessionLogToText(visible));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const clear = () => {
    clearSessionLog();
    clearHighScores();
    setRows([]);
    setConfirmClear(false);
  };

  return (
    <div
      data-testid="instructor-view"
      className="absolute inset-0 z-[80] bg-black text-white font-mono overflow-y-auto p-4 md:p-8"
    >
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter">
            CLASS <span className="text-green-500">SCORES</span>
          </h2>
          <button
            type="button"
            data-testid="instructor-back"
            onClick={onBack}
            className="border border-gray-600 text-gray-200 px-4 py-2 rounded font-bold hover:bg-gray-900"
          >
            BACK
          </button>
        </div>
        <div className="text-gray-400 text-sm">
          Every finished session on this device · {rows.length} total · saved on this device only — nothing leaves the browser.
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-sm text-gray-400">
            Mode{' '}
            <select
              data-testid="instructor-mode-filter"
              value={modeFilter}
              onChange={(event) => setModeFilter(event.target.value)}
              className="bg-black border border-gray-700 rounded px-2 py-2 text-white"
            >
              {modes.map((mode) => (
                <option key={mode} value={mode}>{mode === 'all' ? 'All modes' : mode}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-testid="instructor-copy"
            onClick={copy}
            className="border border-gray-600 px-3 py-2 rounded font-bold text-sm hover:bg-gray-900"
          >
            {copied ? 'Copied!' : 'Copy table'}
          </button>
          {!confirmClear ? (
            <button
              type="button"
              data-testid="instructor-clear"
              onClick={() => setConfirmClear(true)}
              className="border border-red-700 text-red-300 px-3 py-2 rounded font-bold text-sm hover:bg-red-950/40"
            >
              Clear board
            </button>
          ) : (
            <span className="flex gap-2 items-center text-sm">
              <span className="text-red-300">Clear all scores on this device?</span>
              <button
                type="button"
                data-testid="instructor-clear-confirm"
                onClick={clear}
                className="bg-red-600 text-white px-3 py-2 rounded font-bold"
              >
                Yes, clear
              </button>
              <button
                type="button"
                data-testid="instructor-clear-cancel"
                onClick={() => setConfirmClear(false)}
                className="border border-gray-600 px-3 py-2 rounded font-bold"
              >
                Cancel
              </button>
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm md:text-base">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="py-2 pr-2">Player</th>
                <th className="py-2 pr-2">Mode</th>
                <th className="py-2 pr-2 text-right">Score</th>
                <th className="py-2 pr-2 text-right">Clean</th>
                <th className="py-2 pr-2 text-right">Busts</th>
                <th className="py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-gray-500">No sessions yet.</td></tr>
              )}
              {visible.map((row) => (
                <tr key={`${row.initials}-${row.at}`} className="border-b border-gray-900">
                  <td className="py-2 pr-2 font-bold text-green-300">{row.initials}</td>
                  <td className="py-2 pr-2">{row.mode}{row.daily ? ' (daily)' : ''}</td>
                  <td className="py-2 pr-2 text-right font-bold">{row.score}</td>
                  <td className="py-2 pr-2 text-right text-green-400">{row.cleanExits}</td>
                  <td className="py-2 pr-2 text-right text-red-400">{row.busts}</td>
                  <td className="py-2 text-gray-400">{new Date(row.at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InstructorView;
