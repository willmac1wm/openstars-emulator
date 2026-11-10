import React, { useMemo, useState } from 'react';
import { Aircraft } from '../types';
import { ALTS_NORTH_EAST, ALTS_SOUTH_WEST } from '../constants';
import { buildTapClearance } from '../services/speechCommand';

interface TapCommandPadProps {
  aircraft: Aircraft | null;
  onIssue: (command: string) => void;
}

const TapCommandPad: React.FC<TapCommandPadProps> = ({ aircraft, onIssue }) => {
  const [heading, setHeading] = useState(270);
  const [turn, setTurn] = useState<'LEFT' | 'RIGHT' | null>('LEFT');
  const legalAlts = aircraft
    ? (aircraft.destination === 'NOR' || aircraft.destination === 'EAS' ? ALTS_NORTH_EAST : ALTS_SOUTH_WEST)
    : ALTS_SOUTH_WEST;
  const [altitude, setAltitude] = useState(legalAlts[0]);
  const [speed, setSpeed] = useState(210);

  const preview = useMemo(() => {
    if (!aircraft) return { command: '', phraseology: 'Select an aircraft' };
    return buildTapClearance(aircraft.callsign, {
      turn,
      heading,
      altitudeHundreds: altitude,
      speed,
    });
  }, [aircraft, turn, heading, altitude, speed]);

  if (!aircraft) {
    return (
      <div className="border border-gray-700 rounded p-3 text-xs text-gray-500 text-center">
        Tap a plane on the scope, then build a clearance.
      </div>
    );
  }

  return (
    <div className="border border-amber-700/50 bg-amber-950/20 rounded p-2 space-y-2" data-testid="tap-command-pad">
      <div className="text-[10px] uppercase tracking-wider text-amber-300">Tap clearance · teaches phraseology</div>
      <div className="grid grid-cols-2 gap-1">
        <button type="button" className={`py-2 rounded border text-xs font-bold ${turn === 'LEFT' ? 'bg-green-800 border-green-500 text-white' : 'border-gray-700 text-gray-400'}`} onClick={() => setTurn('LEFT')}>LEFT</button>
        <button type="button" className={`py-2 rounded border text-xs font-bold ${turn === 'RIGHT' ? 'bg-green-800 border-green-500 text-white' : 'border-gray-700 text-gray-400'}`} onClick={() => setTurn('RIGHT')}>RIGHT</button>
      </div>
      <label className="block text-[10px] text-gray-400">
        Heading {String(heading).padStart(3, '0')}
        <input
          type="range"
          min={0}
          max={350}
          step={10}
          value={heading === 360 ? 0 : heading}
          onChange={(event) => setHeading(Number(event.target.value) === 0 ? 360 : Number(event.target.value))}
          className="w-full accent-green-500"
        />
      </label>
      <div className="flex flex-wrap gap-1">
        {legalAlts.map((alt) => (
          <button
            key={alt}
            type="button"
            onClick={() => setAltitude(alt)}
            className={`px-2 py-1 rounded border text-xs font-mono ${altitude === alt ? 'bg-green-800 border-green-500 text-white' : 'border-gray-700 text-gray-400'}`}
          >
            A{String(alt).padStart(3, '0')}
          </button>
        ))}
        {[180, 210, 250].map((spd) => (
          <button
            key={spd}
            type="button"
            onClick={() => setSpeed(spd)}
            className={`px-2 py-1 rounded border text-xs font-mono ${speed === spd ? 'bg-green-800 border-green-500 text-white' : 'border-gray-700 text-gray-400'}`}
          >
            S{spd}
          </button>
        ))}
      </div>
      <div className="bg-black/70 border border-gray-800 rounded p-2 text-[11px] text-amber-100 min-h-[3rem]" data-testid="tap-phraseology">
        {preview.phraseology}
      </div>
      <button
        type="button"
        data-testid="tap-issue"
        onClick={() => onIssue(preview.command)}
        className="w-full bg-green-600 hover:bg-green-500 text-black font-bold py-3 rounded text-sm"
      >
        ISSUE CLEARANCE
      </button>
    </div>
  );
};

export default TapCommandPad;
