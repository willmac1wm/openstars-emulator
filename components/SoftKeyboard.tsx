import React, { useEffect, useState } from 'react';
import { Delete, CornerDownLeft, Eraser } from 'lucide-react';

interface SoftKeyboardProps {
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  onClear?: () => void;
  /** Compact layout for Expo / 1024×640 with the tap pad still visible. */
  compact?: boolean;
}

/** Airline / ATC letters most often typed into the command line. */
const LETTER_ROWS = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  ['K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U'],
  ['V', 'W', 'X', 'Y', 'Z'],
];

const SoftKeyboard: React.FC<SoftKeyboardProps> = ({
  onKeyPress,
  onDelete,
  onSubmit,
  onClear,
  compact = false,
}) => {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never steal keys while the trainee is typing in a real text field.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement | null)?.isContentEditable) return;

      const k = e.key.toUpperCase();
      let keyId = '';
      if (!Number.isNaN(Number.parseInt(e.key, 10)) && e.key.length === 1) keyId = e.key;
      else if (k === 'H' || k === 'A' || k === 'S') keyId = k;
      else if (k === 'BACKSPACE' || k === 'DELETE') keyId = 'DEL';
      else if (k === 'ENTER') keyId = 'ENTER';
      else if (k === 'ESCAPE') keyId = 'CLR';
      else if (/^[A-Z]$/.test(k)) keyId = k;

      if (!keyId) return;
      e.preventDefault();
      e.stopPropagation();
      setActiveKeys((prev) => new Set(prev).add(keyId));

      if (keyId === 'DEL') onDelete();
      else if (keyId === 'ENTER') onSubmit();
      else if (keyId === 'CLR') onClear?.();
      else if (keyId === 'H' || keyId === 'A' || keyId === 'S') onKeyPress(`${keyId} `);
      else onKeyPress(keyId);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      let keyId = '';
      if (!Number.isNaN(Number.parseInt(e.key, 10)) && e.key.length === 1) keyId = e.key;
      else if (k === 'H' || k === 'A' || k === 'S' || /^[A-Z]$/.test(k)) keyId = k;
      else if (k === 'BACKSPACE') keyId = 'DEL';
      else if (k === 'ENTER') keyId = 'ENTER';
      else if (k === 'ESCAPE') keyId = 'CLR';
      if (!keyId) return;
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.delete(keyId);
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onKeyPress, onDelete, onSubmit, onClear]);

  const getBtnClass = (id: string, baseClass: string, activeClass: string) => {
    const isActive = activeKeys.has(id);
    return `${baseClass} ${isActive ? activeClass : ''} transition-all duration-75`;
  };

  const h = compact ? 'h-8' : 'h-10 lg:h-12';
  const btnBase = `bg-gray-800 hover:bg-gray-700 text-white font-mono font-bold ${compact ? 'text-sm' : 'text-xl'} rounded shadow border border-gray-700 touch-manipulation active:scale-95 flex items-center justify-center ${h}`;
  const btnActive = 'bg-gray-600 scale-95 border-gray-500';
  const cmdBase = `bg-gray-900 hover:bg-gray-800 text-green-400 font-mono font-bold ${compact ? 'text-[11px]' : 'text-sm'} rounded shadow border border-green-900/50 touch-manipulation active:scale-95 flex items-center justify-center ${h}`;
  const cmdActive = 'bg-green-900 text-white border-green-400';
  const letterBase = `bg-gray-800 hover:bg-gray-700 text-gray-100 font-mono font-bold ${compact ? 'text-[10px] h-7' : 'text-xs h-8'} rounded border border-gray-700 touch-manipulation active:scale-95 flex items-center justify-center`;
  const enterBase = `bg-green-800 hover:bg-green-700 text-white font-bold rounded shadow border border-green-600 flex items-center justify-center active:scale-95 ${h}`;
  const enterActive = 'bg-green-600 border-green-300';

  return (
    <div
      data-testid="soft-keyboard"
      className={`select-none bg-black border-t border-gray-800 ${compact ? 'p-1 space-y-1' : 'p-1.5 space-y-1.5'} h-full`}
    >
      <div className={`grid grid-cols-5 gap-1 ${compact ? 'gap-1' : 'gap-1.5'}`}>
        <button type="button" onPointerDown={() => onKeyPress('H ')} className={getBtnClass('H', cmdBase, cmdActive)}>H</button>
        <button type="button" onPointerDown={() => onKeyPress('A ')} className={getBtnClass('A', cmdBase, cmdActive)}>A</button>
        <button type="button" onPointerDown={() => onKeyPress('S ')} className={getBtnClass('S', cmdBase, cmdActive)}>S</button>
        <button type="button" onPointerDown={() => onKeyPress('TL ')} className={getBtnClass('TL', cmdBase, cmdActive)}>TL</button>
        <button type="button" onPointerDown={() => onKeyPress('TR ')} className={getBtnClass('TR', cmdBase, cmdActive)}>TR</button>

        {['7', '8', '9'].map((n) => (
          <button key={n} type="button" onPointerDown={() => onKeyPress(n)} className={getBtnClass(n, btnBase, btnActive)}>{n}</button>
        ))}
        <button
          type="button"
          data-testid="soft-key-del"
          onPointerDown={onDelete}
          className={`col-span-2 ${getBtnClass('DEL', `${btnBase} bg-red-900/20 text-red-400 border-red-900`, 'bg-red-800 text-white')}`}
        >
          <Delete size={compact ? 16 : 20} />
        </button>

        {['4', '5', '6'].map((n) => (
          <button key={n} type="button" onPointerDown={() => onKeyPress(n)} className={getBtnClass(n, btnBase, btnActive)}>{n}</button>
        ))}
        <button
          type="button"
          data-testid="soft-key-enter"
          onPointerDown={onSubmit}
          className={`col-span-2 row-span-2 ${getBtnClass('ENTER', enterBase, enterActive)}`}
        >
          <CornerDownLeft size={compact ? 22 : 32} />
        </button>

        {['1', '2', '3'].map((n) => (
          <button key={n} type="button" onPointerDown={() => onKeyPress(n)} className={getBtnClass(n, btnBase, btnActive)}>{n}</button>
        ))}

        <button type="button" onPointerDown={() => onKeyPress('0')} className={`col-span-2 ${getBtnClass('0', btnBase, btnActive)}`}>0</button>
        <button
          type="button"
          data-testid="soft-key-clear"
          onPointerDown={() => onClear?.()}
          className={`col-span-3 ${getBtnClass('CLR', `${btnBase} bg-amber-950/40 text-amber-200 border-amber-800 text-xs gap-1`, 'bg-amber-700 text-black')}`}
        >
          <Eraser size={14} /> Clear
        </button>
      </div>

      <div className={`space-y-0.5 ${compact ? '' : 'pt-0.5'}`}>
        {LETTER_ROWS.map((row) => (
          <div key={row.join('')} className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
            {row.map((letter) => (
              <button
                key={letter}
                type="button"
                data-testid={`soft-key-${letter}`}
                onPointerDown={() => onKeyPress(letter)}
                className={getBtnClass(letter, letterBase, 'bg-gray-600 border-gray-400')}
              >
                {letter}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SoftKeyboard;
