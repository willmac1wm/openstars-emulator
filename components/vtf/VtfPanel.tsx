import React, { useMemo, useState } from 'react';
import type { ApproachProcedure, SimAircraft, SimState } from '../../sim/types';
import { buildTapApproachClearance } from '../../services/speechCommand';
import PushToTalk from '../PushToTalk';
import { Mic } from 'lucide-react';

interface Props {
  state: SimState;
  selected: SimAircraft | null;
  liveTranscript: string;
  onCommand: (cmd: string) => void;
  onTranscript: (text: string, isFinal: boolean) => void;
  onSpeechError: (msg: string) => void;
  onExit: () => void;
}

const VtfPanel: React.FC<Props> = ({
  state,
  selected,
  liveTranscript,
  onCommand,
  onTranscript,
  onSpeechError,
  onExit,
}) => {
  const proc = state.approach as ApproachProcedure;
  const [heading, setHeading] = useState(310);
  const [turn, setTurn] = useState<'LEFT' | 'RIGHT'>('LEFT');
  const [miles, setMiles] = useState(4);
  const [input, setInput] = useState('');

  const preview = useMemo(() => {
    if (!selected || !proc) return null;
    return buildTapApproachClearance(selected.callsign, {
      milesFrom: miles,
      fixName: proc.fafName,
      turn,
      heading,
      maintainHundreds: Math.round(proc.gsInterceptAltFt / 100),
      kind: proc.kind,
      runway: proc.runway,
    });
  }, [selected, proc, miles, turn, heading]);

  const logs = state.events.filter((e) => e.kind === 'controller' || e.kind === 'pilot' || e.kind === 'unable').slice(-12);

  return (
    <div className="w-full lg:w-96 bg-gray-950 border-l border-gray-800 flex flex-col text-green-400 font-mono h-full overflow-hidden" data-testid="vtf-panel">
      <div className="p-2 border-b border-gray-800 flex justify-between items-center">
        <div>
          <div className="text-white font-bold">VECTOR TO FINAL</div>
          <div className="text-[10px] text-gray-500">SCORE {state.score} · SEED {state.seedLabel}</div>
        </div>
        <button type="button" onClick={onExit} className="text-xs border border-gray-700 px-2 py-1 rounded text-gray-300">
          EXIT
        </button>
      </div>

      <div className="p-2 space-y-2 border-b border-gray-800">
        <PushToTalk onTranscript={onTranscript} onError={onSpeechError} />
        <div data-testid="vtf-transcript" className="min-h-[2.5rem] bg-black border border-cyan-900 rounded px-2 py-1 text-cyan-200 text-xs">
          {liveTranscript || 'Hold PTT — approach clearance…'}
        </div>
      </div>

      <div className="p-2 space-y-2 border-b border-gray-800 overflow-y-auto">
        <div className="text-[10px] uppercase text-amber-300 flex items-center gap-1">
          <Mic size={10} /> Tap approach clearance
        </div>
        {!selected && <div className="text-xs text-gray-500">Select an aircraft on the scope.</div>}
        {selected && preview && (
          <>
            <div className="text-xs text-white">{selected.callsign} · wake {selected.wake} · {selected.type}</div>
            <div className="grid grid-cols-2 gap-1">
              <button type="button" className={`py-2 rounded border text-xs ${turn === 'LEFT' ? 'bg-green-800 border-green-500' : 'border-gray-700'}`} onClick={() => setTurn('LEFT')}>LEFT</button>
              <button type="button" className={`py-2 rounded border text-xs ${turn === 'RIGHT' ? 'bg-green-800 border-green-500' : 'border-gray-700'}`} onClick={() => setTurn('RIGHT')}>RIGHT</button>
            </div>
            <label className="block text-[10px] text-gray-400">
              Heading {String(heading).padStart(3, '0')}
              <input type="range" min={0} max={350} step={10} value={heading % 360} onChange={(e) => setHeading(Number(e.target.value) || 360)} className="w-full accent-green-500" />
            </label>
            <label className="block text-[10px] text-gray-400">
              Miles from FAF {miles}
              <input type="range" min={3} max={10} value={miles} onChange={(e) => setMiles(Number(e.target.value))} className="w-full accent-green-500" />
            </label>
            <div data-testid="vtf-phraseology" className="bg-black border border-amber-900/50 rounded p-2 text-[11px] text-amber-100 min-h-[4rem]">
              {preview.phraseology}
            </div>
            <button
              type="button"
              data-testid="vtf-issue"
              className="w-full bg-green-600 hover:bg-green-500 text-black font-bold py-3 rounded text-sm"
              onClick={() => onCommand(preview.command)}
            >
              ISSUE APPROACH CLEARANCE
            </button>
          </>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            onCommand(input.toUpperCase());
            setInput('');
          }}
          className="flex gap-1"
        >
          <input
            data-testid="vtf-command-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-2 text-white text-sm uppercase"
            placeholder="TYPED CLEARANCE"
          />
          <button type="submit" className="bg-gray-800 border border-gray-600 px-3 rounded text-xs">SEND</button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 text-[11px]" data-testid="vtf-comm-log">
        {logs.map((e, i) => (
          <div key={`${e.atSimTime}-${i}`} className={e.kind === 'pilot' ? 'text-amber-200' : e.kind === 'unable' ? 'text-red-400' : 'text-cyan-400'}>
            {e.detail}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VtfPanel;
