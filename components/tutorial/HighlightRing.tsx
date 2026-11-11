import React, { useEffect, useState } from 'react';

interface Props {
  targetTestId?: string;
  active: boolean;
}

/** Pulsing ring around the live DOM target; dims nothing itself (parent dims). */
const HighlightRing: React.FC<Props> = ({ targetTestId, active }) => {
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!active || !targetTestId) {
      setBox(null);
      return undefined;
    }
    const update = () => {
      const el = document.querySelector(`[data-testid="${CSS.escape(targetTestId)}"]`) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pad = 8;
      setBox({
        left: r.left - pad,
        top: r.top - pad,
        width: Math.max(24, r.width + pad * 2),
        height: Math.max(24, r.height + pad * 2),
      });
    };
    update();
    const timer = window.setInterval(update, 100);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [active, targetTestId]);

  if (!active || !box) return null;

  return (
    <div
      data-testid="tutorial-highlight-ring"
      className="pointer-events-none fixed z-[66] rounded-lg border-2 border-amber-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] animate-pulse"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      }}
      aria-hidden
    />
  );
};

export default HighlightRing;
