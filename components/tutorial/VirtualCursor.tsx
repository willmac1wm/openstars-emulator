import React, { useEffect, useState } from 'react';

interface Props {
  /** CSS selector or data-testid target inside the app. */
  targetTestId?: string;
  visible: boolean;
  /** Pulse when “clicking”. */
  clicking?: boolean;
}

/**
 * Animated virtual hand/cursor that follows a highlighted control for demos.
 */
const VirtualCursor: React.FC<Props> = ({ targetTestId, visible, clicking }) => {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!visible || !targetTestId) {
      setPos(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(`[data-testid="${targetTestId}"]`) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    };
    update();
    const timer = window.setInterval(update, 120);
    window.addEventListener('resize', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', update);
    };
  }, [visible, targetTestId]);

  if (!visible || !pos) return null;

  return (
    <div
      data-testid="tutorial-cursor"
      className="pointer-events-none fixed z-[80] transition-transform duration-500 ease-out"
      style={{
        left: 0,
        top: 0,
        transform: `translate(${pos.x}px, ${pos.y}px) translate(-20%, -10%) scale(${clicking ? 0.85 : 1})`,
      }}
      aria-hidden
    >
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <path
          d="M10 6 L10 30 L16 24 L22 36 L26 34 L20 22 L28 22 Z"
          fill="#fef08a"
          stroke="#111"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};

export default VirtualCursor;
