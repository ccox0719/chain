import { RefObject, useRef } from "react";

interface GameCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  onLeftClick: (clientX: number, clientY: number) => void;
  onRightClick: (clientX: number, clientY: number) => void;
  onWheelZoom: (deltaY: number) => void;
}

export function GameCanvas({ canvasRef, onLeftClick, onRightClick, onWheelZoom }: GameCanvasProps) {
  const touchTimerRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);

  function clearTouchTimer() {
    if (touchTimerRef.current !== null) {
      window.clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }

  return (
    <div className="viewport-frame">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        onClick={(event) => onLeftClick(event.clientX, event.clientY)}
        onWheel={(event) => {
          event.preventDefault();
          onWheelZoom(event.deltaY);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onRightClick(event.clientX, event.clientY);
        }}
        onTouchStart={(event) => {
          if (event.touches.length !== 1) {
            clearTouchTimer();
            touchStartRef.current = null;
            longPressTriggeredRef.current = false;
            return;
          }
          const touch = event.touches[0];
          touchStartRef.current = { x: touch.clientX, y: touch.clientY };
          longPressTriggeredRef.current = false;
          clearTouchTimer();
          touchTimerRef.current = window.setTimeout(() => {
            if (!touchStartRef.current) return;
            longPressTriggeredRef.current = true;
            onRightClick(touchStartRef.current.x, touchStartRef.current.y);
          }, 380);
        }}
        onTouchMove={(event) => {
          if (!touchStartRef.current || event.touches.length !== 1) {
            clearTouchTimer();
            return;
          }
          const touch = event.touches[0];
          const dx = touch.clientX - touchStartRef.current.x;
          const dy = touch.clientY - touchStartRef.current.y;
          if (Math.hypot(dx, dy) > 14) {
            clearTouchTimer();
          }
        }}
        onTouchEnd={(event) => {
          event.preventDefault();
          const start = touchStartRef.current;
          const wasLongPress = longPressTriggeredRef.current;
          clearTouchTimer();
          touchStartRef.current = null;
          longPressTriggeredRef.current = false;
          if (!start || wasLongPress) return;
          onLeftClick(start.x, start.y);
        }}
        onTouchCancel={() => {
          clearTouchTimer();
          touchStartRef.current = null;
          longPressTriggeredRef.current = false;
        }}
      />
    </div>
  );
}
