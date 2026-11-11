import React from 'react';
import { Check } from 'lucide-react';
import { TutorialState, currentStep } from '../../services/tutorial/machine';
import { TUTORIAL_STEPS } from '../../services/tutorial/steps';

interface Props {
  state: TutorialState;
  voiceEngine?: 'kokoro' | 'webspeech';
  justSucceeded?: boolean;
  onNext: () => void;
  onReplay: () => void;
  onSkip: () => void;
  /** Finished successfully — invite Expo arcade. */
  onPlayExpo: () => void;
  /** Exit to menu (skip or decline arcade). */
  onMenu: () => void;
}

const TutorialOverlay: React.FC<Props> = ({
  state,
  voiceEngine = 'webspeech',
  justSucceeded = false,
  onNext,
  onReplay,
  onSkip,
  onPlayExpo,
  onMenu,
}) => {
  const step = currentStep(state);
  const progress = Math.min(100, Math.round(((state.index + (state.completed ? 1 : 0)) / TUTORIAL_STEPS.length) * 100));
  const expectHint =
    step?.expect && step.expect.kind === 'command'
      ? step.expect.hint
      : step?.expect && step.expect.kind === 'select'
        ? `Click the plane labeled ${step.expect.callsign}.`
        : null;

  if (state.completed) {
    return (
      <div
        data-testid="tutorial-overlay"
        className="absolute inset-x-0 bottom-0 z-[70] p-3 md:p-4 pointer-events-auto"
      >
        <div className="mx-auto max-w-3xl rounded-xl border border-green-600/70 bg-black/90 p-4 md:p-5 text-green-100 shadow-[0_0_30px_rgba(20,241,149,0.25)]">
          <div className="font-mono text-sm md:text-base leading-relaxed mb-3">
            {state.skipped
              ? 'Tutorial skipped. You can replay How to play anytime from the menu.'
              : 'Nice work! You finished the tutorial. Ready for the Expo arcade?'}
          </div>
          <div className="flex flex-wrap gap-2">
            {!state.skipped && (
              <button
                type="button"
                data-testid="tutorial-finish"
                onClick={onPlayExpo}
                className="px-4 py-2 rounded bg-green-500 text-black font-bold"
              >
                Play Expo arcade
              </button>
            )}
            <button
              type="button"
              data-testid="tutorial-skip-done"
              onClick={onMenu}
              className="px-4 py-2 rounded border border-gray-600 text-gray-300"
            >
              Back to menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!step) return null;

  const waiting = state.phase === 'waiting' || state.phase === 'hint';

  return (
    <div
      data-testid="tutorial-overlay"
      className="absolute inset-x-0 bottom-0 z-[70] p-3 md:p-4 pointer-events-auto"
    >
      <div className="mx-auto max-w-3xl rounded-xl border border-cyan-700/60 bg-black/92 backdrop-blur-sm p-3 md:p-4 text-cyan-50 shadow-lg space-y-3">
        <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-cyan-400/80 font-mono">
          <span>Instructor</span>
          <span className="flex items-center gap-2">
            <span
              data-testid="tutorial-voice-engine"
              className={voiceEngine === 'kokoro' ? 'text-violet-300' : 'text-gray-500'}
            >
              {voiceEngine === 'kokoro' ? 'Natural voice' : 'Basic voice'}
            </span>
            <span data-testid="tutorial-progress">{progress}%</span>
          </span>
        </div>
        <div
          data-testid="tutorial-caption"
          className="font-mono text-sm md:text-base leading-relaxed text-white min-h-[2.5rem]"
          aria-live="polite"
        >
          {step.narration}
        </div>
        {step.actionPrompt && waiting && (
          <div
            data-testid="tutorial-action-prompt"
            className="flex items-start gap-2 text-amber-100 text-sm md:text-base font-bold bg-amber-950/50 border border-amber-600/60 rounded px-3 py-2"
          >
            {justSucceeded ? (
              <span data-testid="tutorial-success-check" className="inline-flex items-center gap-1 text-green-300">
                <Check size={18} /> Done
              </span>
            ) : (
              <span>Your turn: {step.actionPrompt}</span>
            )}
          </div>
        )}
        {state.hintVisible && expectHint && (
          <div data-testid="tutorial-hint" className="text-amber-300/90 text-xs md:text-sm bg-amber-950/40 border border-amber-800/50 rounded px-3 py-2">
            Hint: {expectHint}
          </div>
        )}
        <div className="h-1.5 w-full bg-gray-900 rounded overflow-hidden">
          <div className="h-full bg-cyan-400 transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="tutorial-next"
            onClick={onNext}
            className="px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-sm"
          >
            Next
          </button>
          <button
            type="button"
            data-testid="tutorial-replay"
            onClick={onReplay}
            className="px-3 py-2 rounded border border-cyan-800 text-cyan-200 text-sm"
          >
            Replay
          </button>
          <button
            type="button"
            data-testid="tutorial-skip"
            onClick={onSkip}
            className="px-3 py-2 rounded border border-gray-700 text-gray-400 text-sm ml-auto"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
