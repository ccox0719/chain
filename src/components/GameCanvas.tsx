import { RefObject, useRef } from "react";

interface GameCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  onLeftClick: (clientX: number, clientY: number) => void;
  onRightClick: (clientX: number, clientY: number) => void;
  onWheelZoom: (deltaY: number) => void;
  onPanBy: (deltaX: number, deltaY: number) => void;
}

export function GameCanvas({ canvasRef, onLeftClick, onRightClick, onWheelZoom, onPanBy }: GameCanvasProps) {
  const touchTimerRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchLastRef = useRef<{ x: number; y: number } | null>(null);
  const touchMovedRef = useRef(false);
  const pinchDistanceRef = useRef(0);
  const longPressTriggeredRef = useRef(false);
  const mouseDragRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);

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
        onWheel={(event) => {
          onWheelZoom(event.deltaY);
        }}
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          mouseDragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            lastX: event.clientX,
            lastY: event.clientY,
            moved: false
          };
        }}
        onMouseMove={(event) => {
          const drag = mouseDragRef.current;
          if (!drag) return;
          const dx = event.clientX - drag.lastX;
          const dy = event.clientY - drag.lastY;
          const totalDx = event.clientX - drag.startX;
          const totalDy = event.clientY - drag.startY;
          if (!drag.moved && Math.hypot(totalDx, totalDy) > 7) {
            drag.moved = true;
          }
          if (!drag.moved) return;
          onPanBy(dx, dy);
          drag.lastX = event.clientX;
          drag.lastY = event.clientY;
        }}
        onMouseUp={(event) => {
          const drag = mouseDragRef.current;
          mouseDragRef.current = null;
          if (!drag) return;
          if (!drag.moved && event.button === 0) {
            onLeftClick(drag.startX, drag.startY);
          }
        }}
        onMouseLeave={() => {
          mouseDragRef.current = null;
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onRightClick(event.clientX, event.clientY);
        }}
        onTouchStart={(event) => {
          if (event.touches.length === 2) {
            clearTouchTimer();
            touchStartRef.current = null;
            touchLastRef.current = null;
            touchMovedRef.current = false;
            pinchDistanceRef.current = 0;
            longPressTriggeredRef.current = false;
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            pinchDistanceRef.current = Math.hypot(dx, dy);
            return;
          }
          if (event.touches.length !== 1) {
            clearTouchTimer();
            touchStartRef.current = null;
            touchLastRef.current = null;
            touchMovedRef.current = false;
            pinchDistanceRef.current = 0;
            longPressTriggeredRef.current = false;
            return;
          }
          const touch = event.touches[0];
          touchStartRef.current = { x: touch.clientX, y: touch.clientY };
          touchLastRef.current = { x: touch.clientX, y: touch.clientY };
          touchMovedRef.current = false;
          longPressTriggeredRef.current = false;
          clearTouchTimer();
          touchTimerRef.current = window.setTimeout(() => {
            if (!touchStartRef.current) return;
            longPressTriggeredRef.current = true;
            onRightClick(touchStartRef.current.x, touchStartRef.current.y);
          }, 380);
        }}
        onTouchMove={(event) => {
          if (event.touches.length === 2) {
            clearTouchTimer();
            touchStartRef.current = null;
            touchLastRef.current = null;
            touchMovedRef.current = false;
            longPressTriggeredRef.current = false;
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            if (pinchDistanceRef.current > 0) {
              onWheelZoom(pinchDistanceRef.current - dist);
            }
            pinchDistanceRef.current = dist;
            return;
          }
          if (!touchStartRef.current || event.touches.length !== 1) {
            clearTouchTimer();
            touchLastRef.current = null;
            pinchDistanceRef.current = 0;
            return;
          }
          const touch = event.touches[0];
          const last = touchLastRef.current ?? touchStartRef.current;
          const dx = touch.clientX - touchStartRef.current.x;
          const dy = touch.clientY - touchStartRef.current.y;
          if (Math.hypot(dx, dy) > 10) {
            clearTouchTimer();
          }
          if (Math.hypot(dx, dy) > 8) {
            touchMovedRef.current = true;
          }
          if (touchMovedRef.current) {
            onPanBy(touch.clientX - last.x, touch.clientY - last.y);
          }
          touchLastRef.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          event.preventDefault();
          const start = touchStartRef.current;
          const wasLongPress = longPressTriggeredRef.current;
          const moved = touchMovedRef.current;
          clearTouchTimer();
          touchStartRef.current = null;
          touchLastRef.current = null;
          touchMovedRef.current = false;
          pinchDistanceRef.current = 0;
          longPressTriggeredRef.current = false;
          if (!start || wasLongPress || moved) return;
          onLeftClick(start.x, start.y);
        }}
        onTouchCancel={() => {
          clearTouchTimer();
          touchStartRef.current = null;
          touchLastRef.current = null;
          touchMovedRef.current = false;
          pinchDistanceRef.current = 0;
          longPressTriggeredRef.current = false;
        }}
      />
    </div>
  );
}
