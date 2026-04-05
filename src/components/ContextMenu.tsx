import { SelectableRef } from "../types/game";

function getWarpBands(target: SelectableRef) {
  switch (target.type) {
    case "station":
    case "gate":
    case "belt":
    case "anomaly":
    case "beacon":
    case "outpost":
      return [0, 10, 20, 30];
    default:
      return [0];
  }
}

interface ContextMenuProps {
  x: number;
  y: number;
  target: SelectableRef;
  onCommand: (
    command:
      | { type: "approach"; target: SelectableRef; range?: number }
      | { type: "keep_range"; target: SelectableRef; range: number }
      | { type: "orbit"; target: SelectableRef; range: number }
      | { type: "attack"; target: SelectableRef }
      | { type: "align"; target: SelectableRef }
      | { type: "warp"; target: SelectableRef; range?: number }
      | { type: "dock"; target: SelectableRef }
      | { type: "jump"; target: SelectableRef }
      | { type: "lock"; target: SelectableRef }
      | { type: "mine"; target: SelectableRef }
      | { type: "salvage"; target: SelectableRef }
      | { type: "stop" }
  ) => void;
}

export function ContextMenu({ x, y, target, onCommand }: ContextMenuProps) {
  const warpItems = getWarpBands(target).map((range) => ({
    label: `Warp ${range}`,
    command: { type: "warp", target, range } as const
  }));
  const common = [
    { label: "Approach", command: { type: "approach", target } as const },
    { label: "Stop Ship", command: { type: "stop" } as const }
  ];

  const items =
    target.type === "enemy"
      ? [
          ...common,
          { label: "Orbit 120 m", command: { type: "orbit", target, range: 120 } as const },
          { label: "Orbit 220 m", command: { type: "orbit", target, range: 220 } as const },
          { label: "Keep 260 m", command: { type: "keep_range", target, range: 260 } as const },
          { label: "Keep 420 m", command: { type: "keep_range", target, range: 420 } as const },
          { label: "Attack", command: { type: "attack", target } as const }
        ]
      : target.type === "station"
        ? [
            ...common,
            ...warpItems,
            { label: "Dock", command: { type: "dock", target } as const }
          ]
        : target.type === "gate"
          ? [
              ...common,
              ...warpItems,
              { label: "Jump", command: { type: "jump", target } as const }
            ]
          : target.type === "asteroid"
            ? [
                ...common,
                { label: "Orbit 100 m", command: { type: "orbit", target, range: 100 } as const },
                { label: "Mine", command: { type: "mine", target } as const }
              ]
            : target.type === "loot"
              ? [
                  ...common,
                  { label: "Approach", command: { type: "approach", target } as const }
                ]
            : target.type === "wreck"
              ? [
                  ...common,
                  { label: "Approach", command: { type: "approach", target } as const },
                  { label: "Salvage", command: { type: "salvage", target } as const }
                ]
            : target.type === "anomaly" || target.type === "outpost"
              ? [
                  ...common,
                  ...warpItems,
                  { label: "Approach", command: { type: "approach", target } as const }
                ]
            : target.type === "belt"
              ? [
                  ...common,
                  ...warpItems
                ]
              : [
                  ...common,
                  ...warpItems
                ];

  function commandKey(
    command:
      | { type: "approach"; target: SelectableRef; range?: number }
      | { type: "keep_range"; target: SelectableRef; range: number }
      | { type: "orbit"; target: SelectableRef; range: number }
      | { type: "attack"; target: SelectableRef }
      | { type: "align"; target: SelectableRef }
      | { type: "warp"; target: SelectableRef; range?: number }
      | { type: "dock"; target: SelectableRef }
      | { type: "jump"; target: SelectableRef }
      | { type: "lock"; target: SelectableRef }
      | { type: "mine"; target: SelectableRef }
      | { type: "salvage"; target: SelectableRef }
      | { type: "stop" }
  ) {
    const targetPart = "target" in command ? `${command.target.type}-${command.target.id}` : "ship";
    const rangePart = "range" in command && command.range !== undefined ? `-${command.range}` : "";
    return `${command.type}-${targetPart}${rangePart}`;
  }

  return (
    <div className="context-menu" style={{ left: x, top: y }} onClick={(event) => event.stopPropagation()}>
      {items.map((item, index) => (
        <button key={`${commandKey(item.command)}-${index}`} type="button" onClick={() => onCommand(item.command)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
