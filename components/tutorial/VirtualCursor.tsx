import React, { useEffect, useRef, useState } from 'react';

interface Props {
  /** data-testid of the live DOM target. */
  targetTestId?: string;
  visible: boolean;
  /** Pulse when “clicking”. */
  clicking?: boolean;
}

/**
 * Animated virtual hand/cursor. Tracks the live getBoundingClientRect of the
 * highlighted control (and aircraft SVG) so resize / layout shifts stay accurate.
 */
const VirtualCursor: React.FC<Props> = ({ targetTestId, visible, clicking }) => {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!visible || !targetTestId) {
      setPos(null);
      posRef.current = null;
      return undefined;
    }

    const readTarget = (): { x: number; y: number } | null => {
      const el = document.querySelector(`[data-testid="${CSS.escape(targetTestId)}"]`) as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    const animateTo = (next: { x: number; y: number }) => {
      const from = posRef.current || next;
      const start = performance.now();
      const dur = 420;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const ease = 1 - (1 - t) ** 3;
        const cur = {
          x: from.x + (next.x - from.x) * ease,
          y: from.y + (next.y - from.y) * ease,
        };
        posRef.current = cur;
        setPos(cur);
        if (t < 1) animRef.current = requestAnimationFrame(tick);
        else animRef.current = null;
      };
      animRef.current = requestAnimationFrame(tick);
    };

    const snapOrFollow = () => {
      const next = readTarget();
      if (!next) return;
      if (!posRef.current) {
        posRef.current = next;
        setPos(next);
        return;
      }
      const dx = next.x - posRef.current.x;
      const dy = next.y - posRef.current.y;
      // Small drift (layout jitter): snap. Large move (new target): animate.
      if (dx * dx + dy * dy < 36) {
        posRef.current = next;
        setPos(next);
      } else if (!animRef.current) {
        animateTo(next);
      }
    };

    // First paint for a new target should animate from the previous cursor spot.
    const first = readTarget();
    if (first) {
      if (posRef.current) animateTo(first);
      else {
        posRef.current = first;
        setPos(first);
      }
    }

    const timer = window.setInterval(snapOrFollow, 100);
    window.addEventListener('resize', snapOrFollow);
    window.addEventListener('scroll', snapOrFollow, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', snapOrFollow);
      window.removeEventListener('scroll', snapOrFollow, true);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [visible, targetTestId]);

  if (!visible || !pos) return null;

  return (
    <div
      data-testid="tutorial-cursor"
      className="pointer-events-none fixed z-[80]"
      style={{
        left: 0,
        top: 0,
        transform: `translate(${pos.x}px, ${pos.y}px) translate(-20%, -10%) scale(${clicking ? 0.85 : 1})`,
        transition: clicking ? 'transform 120ms ease-out' : undefined,
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
