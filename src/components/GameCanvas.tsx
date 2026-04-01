import { RefObject } from "react";

interface GameCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  onLeftClick: (clientX: number, clientY: number) => void;
  onRightClick: (clientX: number, clientY: number) => void;
  onWheelZoom: (deltaY: number) => void;
}

export function GameCanvas({ canvasRef, onLeftClick, onRightClick, onWheelZoom }: GameCanvasProps) {
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
      />
    </div>
  );
}
