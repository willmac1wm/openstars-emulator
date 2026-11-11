import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  TutorialState,
  currentStep,
  idleHintMs,
  initialTutorialState,
  reduceTutorial,
} from '../../services/tutorial/machine';
import { speakInstructor, stopInstructorSpeech } from '../../services/tutorial/narrate';
import { TUTORIAL_STEPS, TutorialDemo, TutorialHighlight } from '../../services/tutorial/steps';
import { playSuccessChime } from '../../services/soundEffects';
import TutorialOverlay from './TutorialOverlay';
import VirtualCursor from './VirtualCursor';

export interface TutorialBridge {
  selectAircraft: (callsign: string) => void;
  issueCommand: (raw: string) => void;
  findAircraftTestId: (callsign: string) => string;
}

export interface TutorialActionSink {
  onSelect?: (callsign: string) => void;
  onCommand?: (raw: string) => void;
}

interface Props {
  active: boolean;
  bridge: TutorialBridge;
  onFinished: (opts: { playExpo: boolean }) => void;
  actionRef: React.MutableRefObject<TutorialActionSink>;
}

function highlightToTestId(h: TutorialHighlight | undefined, bridge: TutorialBridge): string | undefined {
  if (!h) return undefined;
  if (h.kind === 'aircraft') return bridge.findAircraftTestId(h.callsign);
  if (h.kind === 'control') return h.id;
  if (h.kind === 'region') return `tutorial-region-${h.id}`;
  return undefined;
}

const wait = (ms: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, ms);
});

const GuidedTutorial: React.FC<Props> = ({ active, bridge, onFinished, actionRef }) => {
  const [state, setState] = useState<TutorialState>(initialTutorialState);
  const [cursorTarget, setCursorTarget] = useState<string | undefined>();
  const [clicking, setClicking] = useState(false);
  const demoCancel = useRef(false);
  const idleTimer = useRef<number | null>(null);
  const stepKeyRef = useRef('');
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;

  const clearIdle = () => {
    if (idleTimer.current) {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  };

  const armIdle = useCallback((phase: TutorialState['phase']) => {
    clearIdle();
    if (phase !== 'waiting' && phase !== 'hint') return;
    idleTimer.current = window.setTimeout(() => {
      setState((s) => reduceTutorial(s, { type: 'IDLE_TIMEOUT' }));
    }, idleHintMs());
  }, []);

  const runDemo = useCallback(async (demos: TutorialDemo[]) => {
    const b = bridgeRef.current;
    demoCancel.current = false;
    for (const demo of demos) {
      if (demoCancel.current) return;
      if (demo.kind === 'point') {
        setCursorTarget(highlightToTestId(demo.target, b));
        setClicking(false);
        await wait(demo.ms ?? 800);
      } else if (demo.kind === 'select') {
        setCursorTarget(b.findAircraftTestId(demo.callsign));
        setClicking(true);
        await wait(280);
        b.selectAircraft(demo.callsign);
        setClicking(false);
        await wait(400);
      } else if (demo.kind === 'command') {
        setCursorTarget('tap-issue');
        setClicking(true);
        await wait(250);
        b.issueCommand(demo.text);
        setClicking(false);
        await wait(900);
      } else if (demo.kind === 'chime') {
        playSuccessChime();
      } else if (demo.kind === 'wait') {
        await wait(demo.ms);
      }
    }
    setCursorTarget(undefined);
    if (!demoCancel.current) {
      setState((s) => {
        const next = reduceTutorial(s, { type: 'DEMO_DONE' });
        armIdle(next.phase);
        return next;
      });
    }
  }, [armIdle]);

  // Start / stop
  useEffect(() => {
    if (!active) {
      stopInstructorSpeech();
      demoCancel.current = true;
      clearIdle();
      setState(initialTutorialState());
      stepKeyRef.current = '';
      setCursorTarget(undefined);
      return;
    }
    const started = reduceTutorial(initialTutorialState(), { type: 'START' });
    setState(started);
    stepKeyRef.current = '';
  }, [active]);

  // Drive narration / demos / highlights when step+phase changes
  useEffect(() => {
    if (!active || state.completed) return;
    const step = currentStep(state);
    if (!step) return;
    const key = `${state.index}:${state.phase}`;
    if (key === stepKeyRef.current) return;
    stepKeyRef.current = key;

    const b = bridgeRef.current;
    setCursorTarget(highlightToTestId(step.highlight, b));

    if (state.phase === 'demo' && step.demo?.length) {
      speakInstructor(step.narration);
      void runDemo(step.demo);
      return;
    }

    if (state.phase === 'narrating') {
      stopInstructorSpeech();
      speakInstructor(step.narration);
      if (step.dwellMs && step.dwellMs > 0) {
        const t = window.setTimeout(() => {
          setState((s) => {
            const next = reduceTutorial(s, { type: 'NARRATION_DONE' });
            armIdle(next.phase);
            return next;
          });
        }, step.dwellMs);
        return () => window.clearTimeout(t);
      }
      return;
    }

    if (state.phase === 'waiting' || state.phase === 'hint') {
      armIdle(state.phase);
    }
  }, [active, state, runDemo, armIdle]);

  // Student action sinks
  useEffect(() => {
    actionRef.current.onSelect = (callsign: string) => {
      setState((s) => {
        const next = reduceTutorial(s, { type: 'SELECT', callsign });
        if (next.index !== s.index) stepKeyRef.current = '';
        armIdle(next.phase);
        return next;
      });
    };
    actionRef.current.onCommand = (raw: string) => {
      setState((s) => {
        const next = reduceTutorial(s, { type: 'COMMAND', raw });
        if (next.index !== s.index) stepKeyRef.current = '';
        armIdle(next.phase);
        return next;
      });
    };
    return () => {
      actionRef.current.onSelect = undefined;
      actionRef.current.onCommand = undefined;
    };
  }, [actionRef, armIdle]);

  if (!active) return null;

  const step = currentStep(state);
  const regionId = step?.highlight?.kind === 'region' ? step.highlight.id : null;

  return (
    <>
      <div
        data-testid="tutorial-dim"
        className="absolute inset-0 z-[65] pointer-events-none"
        style={{
          background:
            regionId === 'scope' || regionId === 'compass' || regionId === 'gate'
              ? 'radial-gradient(circle at 38% 42%, transparent 26%, rgba(0,0,0,0.55) 60%)'
              : 'rgba(0,0,0,0.32)',
        }}
      />
      <div data-testid="tutorial-region-scope" className="absolute inset-0 pointer-events-none" />
      <div data-testid="tutorial-region-compass" className="absolute top-0 left-0 right-0 h-10 pointer-events-none" />
      <div data-testid="tutorial-region-datablock" className="absolute top-[32%] left-[52%] w-2 h-2 pointer-events-none" />
      <div data-testid="tutorial-region-gate" className="absolute bottom-[28%] left-1/2 w-2 h-2 pointer-events-none" />
      <div data-testid="tutorial-region-ptt" className="absolute bottom-28 right-6 w-2 h-2 pointer-events-none" />
      <div data-testid="tutorial-region-dial" className="absolute bottom-40 right-10 w-2 h-2 pointer-events-none" />
      <div data-testid="tutorial-region-conflict" className="absolute inset-0 pointer-events-none" />
      <div data-testid="tutorial-region-sfx" className="absolute top-3 right-3 w-2 h-2 pointer-events-none" />

      <VirtualCursor
        visible={Boolean(cursorTarget) && !state.completed}
        targetTestId={cursorTarget}
        clicking={clicking}
      />
      <TutorialOverlay
        state={state}
        onNext={() => {
          stopInstructorSpeech();
          demoCancel.current = true;
          stepKeyRef.current = '';
          setState((s) => {
            const next = reduceTutorial(s, { type: 'NEXT' });
            armIdle(next.phase);
            return next;
          });
        }}
        onReplay={() => {
          stopInstructorSpeech();
          demoCancel.current = true;
          stepKeyRef.current = '';
          setState((s) => {
            const stepNow = TUTORIAL_STEPS[s.index];
            if (stepNow?.demo?.length) {
              return { ...s, phase: 'demo', hintVisible: false };
            }
            return { ...s, phase: 'narrating', hintVisible: false };
          });
        }}
        onSkip={() => {
          stopInstructorSpeech();
          demoCancel.current = true;
          setState((s) => reduceTutorial(s, { type: 'SKIP' }));
        }}
        onPlayExpo={() => {
          stopInstructorSpeech();
          onFinished({ playExpo: true });
        }}
        onMenu={() => {
          stopInstructorSpeech();
          demoCancel.current = true;
          onFinished({ playExpo: false });
        }}
      />
    </>
  );
};

export default GuidedTutorial;
