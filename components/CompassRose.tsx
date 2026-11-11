import React, { useMemo } from 'react';
import { COLOR_SECONDARY, MAP_SIZE } from '../constants';

interface Props {
  /** Square extent (defaults to MAP_SIZE). */
  size?: number;
  originX?: number;
  originY?: number;
}

/**
 * STARS-like square-edge compass ticks shared by gates RadarScope and VTF ApproachScope.
 */
const CompassRose: React.FC<Props> = ({ size = MAP_SIZE, originX = 0, originY = 0 }) => {
  const ticks = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    const centerX = originX + size / 2;
    const centerY = originY + size / 2;
    const maxX = originX + size;
    const maxY = originY + size;

    for (let deg = 0; deg < 360; deg += 10) {
      const dx = Math.sin(deg * (Math.PI / 180));
      const dy = -Math.cos(deg * (Math.PI / 180));

      let t = Infinity;
      if (dx > 0) {
        const tR = (maxX - centerX) / dx;
        if (tR < t) t = tR;
      }
      if (dx < 0) {
        const tL = (originX - centerX) / dx;
        if (tL < t) t = tL;
      }
      if (dy > 0) {
        const tB = (maxY - centerY) / dy;
        if (tB < t) t = tB;
      }
      if (dy < 0) {
        const tT = (originY - centerY) / dy;
        if (tT < t) t = tT;
      }

      const xEdge = centerX + dx * t;
      const yEdge = centerY + dy * t;
      const tickLen = Math.max(10, size * 0.02);
      let x1 = xEdge;
      let y1 = yEdge;
      let x2 = xEdge;
      let y2 = yEdge;

      const isRight = Math.abs(xEdge - maxX) < 1;
      const isLeft = Math.abs(xEdge - originX) < 1;
      const isBottom = Math.abs(yEdge - maxY) < 1;
      const isTop = Math.abs(yEdge - originY) < 1;

      if (isRight) x2 = xEdge - tickLen;
      else if (isLeft) x2 = xEdge + tickLen;
      if (isBottom) y2 = yEdge - tickLen;
      else if (isTop) y2 = yEdge + tickLen;

      if (!isRight && !isLeft && !isBottom && !isTop) {
        x2 = centerX + dx * (t - tickLen);
        y2 = centerY + dy * (t - tickLen);
      }

      nodes.push(
        <line
          key={`tick-${deg}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={COLOR_SECONDARY}
          strokeWidth="2"
        />,
      );

      const textOffset = Math.max(22, size * 0.045);
      let tx = xEdge;
      let ty = yEdge;
      if (isRight) tx -= textOffset;
      else if (isLeft) tx += textOffset;
      if (isBottom) ty -= textOffset;
      else if (isTop) ty += textOffset;

      const label = deg === 0 ? '360' : deg.toString().padStart(3, '0');
      nodes.push(
        <text
          key={`lbl-${deg}`}
          x={tx}
          y={ty}
          fill={COLOR_SECONDARY}
          fontSize={Math.max(11, size * 0.023)}
          fontWeight="bold"
          fontFamily="monospace"
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          {label}
        </text>,
      );
    }
    return nodes;
  }, [size, originX, originY]);

  return <g data-testid="compass-rose">{ticks}</g>;
};

export default CompassRose;
