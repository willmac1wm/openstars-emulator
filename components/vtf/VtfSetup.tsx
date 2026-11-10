import React, { useState } from 'react';
import type { ApproachKind, WindState } from '../../sim/types';

interface Props {
  onStart: (opts: { seedLabel: string; approachKind: ApproachKind; wind: WindState }) => void;
  onCancel: () => void;
  defaultSeed?: string;
}

const VtfSetup: React.FC<Props> = ({ onStart, onCancel, defaultSeed = 'vtf-1' }) => {
  const [seed, setSeed] = useState(defaultSeed);
  const [kind, setKind] = useState<ApproachKind>('ILS');
  const [calm, setCalm] = useState(true);
  const [fromDeg, setFromDeg] = useState(270);
  const [speedKt, setSpeedKt] = useState(15);

  return (
    <div className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center p-4" data-testid="vtf-setup">
      <div className="w-full max-w-lg bg-gray-950 border border-green-800 rounded-xl p-6 space-y-4 text-green-300 font-mono">
        <h2 className="text-2xl text-white font-bold">Vector to Final</h2>
        <p className="text-sm text-gray-400">
          Practice ILS/VOR intercepts, wake spacing, and 7110.65 approach clearances. Key-free and offline.
        </p>

        <label className="block text-xs uppercase tracking-wider text-gray-500">
          Seed
          <input
            data-testid="vtf-seed"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            className="mt-1 w-full bg-black border border-gray-700 rounded px-3 py-2 text-green-300"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          {(['ILS', 'VOR'] as ApproachKind[]).map((k) => (
            <button
              key={k}
              type="button"
              data-testid={`vtf-kind-${k}`}
              onClick={() => setKind(k)}
              className={`py-3 rounded border font-bold ${kind === k ? 'bg-green-800 border-green-500 text-white' : 'border-gray-700 text-gray-400'}`}
            >
              {k} RWY 28
            </button>
          ))}
        </div>
        {kind === 'VOR' && (
          <div className="text-xs text-cyan-400">VOR final is offset +5° from runway centerline for a different intercept.</div>
        )}

        <div className="space-y-2 border border-gray-800 rounded p-3">
          <div className="text-xs uppercase text-gray-500">Wind</div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={calm} onChange={(e) => setCalm(e.target.checked)} />
            Calm
          </label>
          {!calm && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                From °
                <input type="number" min={0} max={360} value={fromDeg} onChange={(e) => setFromDeg(Number(e.target.value))} className="w-full bg-black border border-gray-700 rounded px-2 py-1" />
              </label>
              <label className="text-xs">
                Speed kt
                <input type="number" min={0} max={50} value={speedKt} onChange={(e) => setSpeedKt(Number(e.target.value))} className="w-full bg-black border border-gray-700 rounded px-2 py-1" />
              </label>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 border border-gray-700 py-3 rounded text-gray-300">
            Cancel
          </button>
          <button
            type="button"
            data-testid="vtf-start"
            className="flex-1 bg-green-600 hover:bg-green-500 text-black font-bold py-3 rounded"
            onClick={() =>
              onStart({
                seedLabel: seed || 'vtf-1',
                approachKind: kind,
                wind: calm ? { calm: true, fromDeg: 0, speedKt: 0 } : { calm: false, fromDeg, speedKt },
              })
            }
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
};

export default VtfSetup;
