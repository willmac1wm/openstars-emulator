
import React, { useEffect, useState } from 'react';
import { Delete, CornerDownLeft, MoveUp, MoveDown, MoveLeft, MoveRight, Layers, MoveUpLeft, MoveUpRight, MoveDownLeft, MoveDownRight } from 'lucide-react';

interface SoftKeyboardProps {
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  onMoveLabel?: (dir: number) => void;
}

const SoftKeyboard: React.FC<SoftKeyboardProps> = ({ onKeyPress, onDelete, onSubmit, onMoveLabel }) => {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [isFuncActive, setIsFuncActive] = useState(false);

  // Map physical keys to our virtual key IDs AND trigger actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      const code = e.code;
      let keyId = '';

      // Mapping logic
      if (!isNaN(parseInt(e.key))) keyId = e.key; // 0-9
      else if (k === 'H') keyId = 'H';
      else if (k === 'A') keyId = 'A';
      else if (k === 'S') keyId = 'S';
      else if (k === 'BACKSPACE' || k === 'DELETE') keyId = 'DEL';
      else if (k === 'ENTER') keyId = 'ENTER';
      // Map physical arrow keys
      else if (code === 'ArrowUp' || code === 'Numpad8') keyId = '8';
      else if (code === 'ArrowDown' || code === 'Numpad2') keyId = '2';
      else if (code === 'ArrowLeft' || code === 'Numpad4') keyId = '4';
      else if (code === 'ArrowRight' || code === 'Numpad6') keyId = '6';
      // Map Numpad diagonals
      else if (code === 'Numpad7') keyId = '7';
      else if (code === 'Numpad9') keyId = '9';
      else if (code === 'Numpad1') keyId = '1';
      else if (code === 'Numpad3') keyId = '3';

      if (keyId) {
        // PREVENT DEFAULT: This stops the browser from double-typing or ignoring input 
        // when the input box is in "none" mode. We handle it manually.
        e.preventDefault();
        e.stopPropagation();

        setActiveKeys(prev => {
            const newSet = new Set(prev);
            newSet.add(keyId);
            return newSet;
        });

        if (keyId === 'DEL') onDelete();
        else if (keyId === 'ENTER') onSubmit();
        else if (['H','A','S'].includes(keyId)) onKeyPress(keyId + ' ');
        else if (keyId === 'TL') onKeyPress('TL ');
        else if (keyId === 'TR') onKeyPress('TR ');
        else if (!isNaN(parseInt(keyId))) {
            // Arrow Key Functionality
            if (isFuncActive && onMoveLabel) {
                if (keyId === '8') { onMoveLabel(270); setIsFuncActive(false); }
                else if (keyId === '2') { onMoveLabel(90); setIsFuncActive(false); }
                else if (keyId === '4') { onMoveLabel(180); setIsFuncActive(false); }
                else if (keyId === '6') { onMoveLabel(0); setIsFuncActive(false); }
                // Diagonals
                else if (keyId === '7') { onMoveLabel(315); setIsFuncActive(false); } // NW
                else if (keyId === '9') { onMoveLabel(45); setIsFuncActive(false); }  // NE
                else if (keyId === '1') { onMoveLabel(225); setIsFuncActive(false); } // SW
                else if (keyId === '3') { onMoveLabel(135); setIsFuncActive(false); } // SE
                else onKeyPress(keyId);
            } else {
                onKeyPress(keyId);
            }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Visual cleanup only
      let keyId = '';
      const k = e.key.toUpperCase();
      if (!isNaN(parseInt(e.key))) keyId = e.key;
      else if (k === 'H' || k === 'A' || k === 'S') keyId = k;
      else if (k === 'BACKSPACE') keyId = 'DEL';
      else if (k === 'ENTER') keyId = 'ENTER';
      
      if (keyId) {
        setActiveKeys(prev => {
            const newSet = new Set(prev);
            newSet.delete(keyId);
            return newSet;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isFuncActive, onKeyPress, onDelete, onSubmit, onMoveLabel]);

  const handleSmartKey = (val: string, dir: number) => {
      if (isFuncActive && onMoveLabel) {
          onMoveLabel(dir);
          setIsFuncActive(false);
      } else {
          onKeyPress(val);
      }
  };

  const getBtnClass = (id: string, baseClass: string, activeClass: string) => {
    const isActive = activeKeys.has(id);
    return `${baseClass} ${isActive ? activeClass : ''} transition-all duration-75`;
  };

  const btnBase = "bg-gray-800 hover:bg-gray-700 text-white font-mono font-bold text-xl rounded shadow border border-gray-700 touch-manipulation active:scale-95 flex items-center justify-center h-10 lg:h-12 relative overflow-hidden";
  const btnActive = "bg-gray-600 scale-95 border-gray-500";
  const cmdBase = "bg-gray-900 hover:bg-gray-800 text-green-400 font-mono font-bold text-sm rounded shadow border border-green-900/50 touch-manipulation active:scale-95 flex items-center justify-center h-10 lg:h-12";
  const cmdActive = "bg-green-900 text-white border-green-400";
  const funcBase = "bg-green-900/40 hover:bg-green-900/60 text-green-400 font-mono font-bold text-xs rounded shadow border border-green-800 touch-manipulation active:scale-95 flex flex-col items-center justify-center h-10 lg:h-12";
  const funcActiveState = "bg-green-600 text-white border-green-400 shadow-[0_0_10px_rgba(20,241,149,0.4)]";
  const enterBase = "bg-green-800 hover:bg-green-700 text-white font-bold rounded shadow border border-green-600 flex items-center justify-center active:scale-95 h-full";
  const enterActive = "bg-green-600 border-green-300";

  const renderNumKey = (num: string, dirVal?: number, Icon?: React.ElementType) => {
      const isSpecial = isFuncActive && dirVal !== undefined;
      return (
        <button 
            onPointerDown={() => dirVal !== undefined ? handleSmartKey(num, dirVal) : onKeyPress(num)} 
            className={getBtnClass(num, btnBase, btnActive)}
        >
            {isSpecial && Icon ? (<Icon size={24} className="text-cyan-400" />) : (
                <>{num}{Icon && <Icon size={10} className="absolute top-1 right-1 text-gray-600" />}</>
            )}
        </button>
      );
  };

  return (
    <div className="grid grid-cols-5 gap-1.5 p-1.5 bg-black border-t lg:border-t-0 border-gray-800 select-none h-full content-stretch">
      <button onPointerDown={() => onKeyPress('H ')} className={getBtnClass('H', cmdBase, cmdActive)}>H</button>
      <button onPointerDown={() => onKeyPress('A ')} className={getBtnClass('A', cmdBase, cmdActive)}>A</button>
      <button onPointerDown={() => onKeyPress('S ')} className={getBtnClass('S', cmdBase, cmdActive)}>S</button>
      <button onPointerDown={() => onKeyPress('TL ')} className={getBtnClass('TL', cmdBase, cmdActive)}>TL</button>
      <button onPointerDown={() => onKeyPress('TR ')} className={getBtnClass('TR', cmdBase, cmdActive)}>TR</button>

      {renderNumKey('7', 315, MoveUpLeft)}
      {renderNumKey('8', 270, MoveUp)}
      {renderNumKey('9', 45, MoveUpRight)}
      <button onPointerDown={onDelete} className={`col-span-2 ${getBtnClass('DEL', `${btnBase} bg-red-900/20 text-red-400 border-red-900`, "bg-red-800 text-white")}`}><Delete size={20} /></button>

      {renderNumKey('4', 180, MoveLeft)}
      {renderNumKey('5')}
      {renderNumKey('6', 0, MoveRight)}
      <button onPointerDown={onSubmit} className={`col-span-2 row-span-2 ${getBtnClass('ENTER', enterBase, enterActive)}`}><CornerDownLeft size={32} /></button>

      {renderNumKey('1', 225, MoveDownLeft)}
      {renderNumKey('2', 90, MoveDown)}
      {renderNumKey('3', 135, MoveDownRight)}
      
      <button onPointerDown={() => onKeyPress('0')} className={`col-span-3 ${getBtnClass('0', btnBase, btnActive)}`}>0</button>
      <button onPointerDown={() => setIsFuncActive(!isFuncActive)} className={`col-span-2 ${funcBase} ${isFuncActive ? funcActiveState : ''}`}><div className="flex items-center gap-1"><Layers size={16} /><span>MULTI FUNC</span></div></button>
    </div>
  );
};

export default SoftKeyboard;
