import { useId } from "react";
import { moduleById } from "../game/data/modules";
import { EquippedLoadout, ModuleDefinition, ModuleSlot, ShipHullDefinition } from "../types/game";

type SilhouetteType = "dart" | "wing" | "heavy" | "needle" | "wedge" | "kite" | "box" | "claw";

// SVG viewBox: 0 0 360 260, ship center at (180, 125), scale 6× from canvas coords
const SHIP_PATHS: Record<SilhouetteType, string> = {
  // canvas: (18,0)→(-12,-9)→(-4,0)→(-12,9)
  dart:   "M 288 125 L 108 71 L 156 125 L 108 179 Z",
  // canvas: (26,0)→(-4,-4)→(-8,0)→(-4,4)
  needle: "M 336 125 L 156 101 L 132 125 L 156 149 Z",
  // canvas: (20,0)→(-10,-12)→(0,-2)→(-4,0)→(0,2)→(-10,12)
  wing:   "M 300 125 L 120 53 L 180 113 L 156 125 L 180 137 L 120 197 Z",
  // canvas: (20,0)→(2,-14)→(-14,0)→(2,14)
  kite:   "M 300 125 L 192 41 L 96 125 L 192 209 Z",
  // canvas: (19,0)→(5,-12)→(-14,-8)→(-18,0)→(-14,8)→(5,12)
  heavy:  "M 294 125 L 210 53 L 96 77 L 72 125 L 96 173 L 210 197 Z",
  // canvas: (16,0)→(-18,-16)→(-14,0)→(-18,16)
  wedge:  "M 276 125 L 72 29 L 96 125 L 72 221 Z",
  // canvas: (18,-10)→(18,10)→(-16,12)→(-20,0)→(-16,-12)
  box:    "M 288 65 L 288 185 L 84 197 L 60 125 L 84 53 Z",
  // canvas: (20,0)→(2,-8)→(-10,-16)→(-16,-6)→(-6,0)→(-16,6)→(-10,16)→(2,8)
  claw:   "M 300 125 L 192 77 L 120 29 L 84 89 L 144 125 L 84 161 L 120 221 L 192 173 Z",
};

// Accent lines to make each silhouette more distinctive
const SHIP_DETAIL_PATHS: Record<SilhouetteType, string[]> = {
  dart: [
    "M 288 125 L 156 125",
    "M 252 110 L 230 125 L 252 140",
  ],
  needle: [
    "M 336 125 L 132 125",
    "M 280 120 L 260 125 L 280 130",
  ],
  wing: [
    "M 300 125 L 156 125",
    "M 180 113 L 240 100",
    "M 180 137 L 240 150",
  ],
  kite: [
    "M 300 125 L 96 125",
    "M 240 83 L 192 41",
    "M 240 167 L 192 209",
  ],
  heavy: [
    "M 294 125 L 72 125",
    "M 210 53 L 180 85",
    "M 210 197 L 180 165",
    "M 250 107 L 222 125 L 250 143",
  ],
  wedge: [
    "M 276 125 L 96 125",
    "M 200 67 L 150 88",
    "M 200 183 L 150 162",
  ],
  box: [
    "M 288 125 L 60 125",
    "M 288 65 L 84 53",
    "M 288 185 L 84 197",
    "M 288 90 L 270 125 L 288 160",
  ],
  claw: [
    "M 300 125 L 144 125",
    "M 192 77 L 120 29",
    "M 192 173 L 120 221",
  ],
};

// Socket positions: x/y = socket center, ax/ay = hull anchor for connector line
type SocketPos = { x: number; y: number; ax: number; ay: number };

const SLOT_SOCKETS: Record<SilhouetteType, Record<ModuleSlot, SocketPos[]>> = {
  needle: {
    weapon: [
      { x: 290, y: 95,  ax: 280, ay: 113 },
      { x: 290, y: 155, ax: 280, ay: 137 },
      { x: 250, y: 93,  ax: 244, ay: 110 },
      { x: 250, y: 157, ax: 244, ay: 140 },
      { x: 344, y: 125, ax: 336, ay: 125 },
    ],
    utility: [
      { x: 216, y: 93,  ax: 214, ay: 111 },
      { x: 216, y: 157, ax: 214, ay: 139 },
      { x: 188, y: 96,  ax: 186, ay: 112 },
      { x: 188, y: 154, ax: 186, ay: 138 },
    ],
    defense: [
      { x: 158, y: 88,  ax: 156, ay: 104 },
      { x: 158, y: 162, ax: 156, ay: 146 },
      { x: 136, y: 108, ax: 134, ay: 120 },
      { x: 136, y: 142, ax: 134, ay: 130 },
    ],
  },
  wedge: {
    weapon: [
      { x: 282, y: 95,  ax: 270, ay: 108 },
      { x: 282, y: 155, ax: 270, ay: 142 },
      { x: 196, y: 42,  ax: 180, ay: 64  },
      { x: 196, y: 208, ax: 180, ay: 186 },
      { x: 290, y: 125, ax: 276, ay: 125 },
    ],
    utility: [
      { x: 178, y: 86,  ax: 173, ay: 99  },
      { x: 178, y: 164, ax: 173, ay: 151 },
      { x: 148, y: 96,  ax: 144, ay: 108 },
      { x: 148, y: 154, ax: 144, ay: 142 },
    ],
    defense: [
      { x: 90,  y: 38,  ax: 80,  ay: 58  },
      { x: 90,  y: 212, ax: 80,  ay: 192 },
      { x: 60,  y: 80,  ax: 74,  ay: 88  },
      { x: 60,  y: 170, ax: 74,  ay: 162 },
    ],
  },
  kite: {
    weapon: [
      { x: 308, y: 96,  ax: 296, ay: 108 },
      { x: 308, y: 154, ax: 296, ay: 142 },
      { x: 258, y: 64,  ax: 246, ay: 78  },
      { x: 258, y: 186, ax: 246, ay: 172 },
      { x: 318, y: 125, ax: 300, ay: 125 },
    ],
    utility: [
      { x: 192, y: 24,  ax: 192, ay: 47  },
      { x: 192, y: 226, ax: 192, ay: 203 },
      { x: 160, y: 90,  ax: 162, ay: 105 },
      { x: 160, y: 160, ax: 162, ay: 145 },
    ],
    defense: [
      { x: 100, y: 82,  ax: 110, ay: 99  },
      { x: 100, y: 168, ax: 110, ay: 151 },
      { x: 72,  y: 110, ax: 96,  ay: 116 },
      { x: 72,  y: 140, ax: 96,  ay: 134 },
    ],
  },
  box: {
    weapon: [
      { x: 300, y: 78,  ax: 288, ay: 80  },
      { x: 300, y: 172, ax: 288, ay: 170 },
      { x: 296, y: 50,  ax: 288, ay: 65  },
      { x: 296, y: 200, ax: 288, ay: 185 },
      { x: 310, y: 125, ax: 288, ay: 125 },
    ],
    utility: [
      { x: 190, y: 38,  ax: 188, ay: 57  },
      { x: 190, y: 212, ax: 188, ay: 193 },
      { x: 148, y: 40,  ax: 147, ay: 57  },
      { x: 148, y: 210, ax: 147, ay: 191 },
    ],
    defense: [
      { x: 70,  y: 46,  ax: 84,  ay: 58  },
      { x: 70,  y: 204, ax: 84,  ay: 192 },
      { x: 42,  y: 106, ax: 60,  ay: 113 },
      { x: 42,  y: 144, ax: 60,  ay: 137 },
    ],
  },
  claw: {
    weapon: [
      { x: 308, y: 100, ax: 294, ay: 110 },
      { x: 308, y: 150, ax: 294, ay: 140 },
      { x: 118, y: 14,  ax: 120, ay: 35  },
      { x: 118, y: 236, ax: 120, ay: 215 },
      { x: 316, y: 125, ax: 300, ay: 125 },
    ],
    utility: [
      { x: 194, y: 58,  ax: 190, ay: 76  },
      { x: 194, y: 192, ax: 190, ay: 174 },
      { x: 158, y: 106, ax: 150, ay: 115 },
      { x: 158, y: 144, ax: 150, ay: 135 },
    ],
    defense: [
      { x: 74,  y: 74,  ax: 84,  ay: 90  },
      { x: 74,  y: 176, ax: 84,  ay: 160 },
      { x: 54,  y: 86,  ax: 70,  ay: 91  },
      { x: 54,  y: 164, ax: 70,  ay: 159 },
    ],
  },
  dart: {
    weapon: [
      { x: 252, y: 80,  ax: 240, ay: 109 },  // upper forward
      { x: 252, y: 170, ax: 240, ay: 141 },  // lower forward
      { x: 220, y: 60,  ax: 218, ay: 100 },  // upper mid
      { x: 220, y: 190, ax: 218, ay: 150 },  // lower mid
      { x: 310, y: 125, ax: 288, ay: 125 },  // nose tip
    ],
    utility: [
      { x: 182, y: 70,  ax: 182, ay: 92  },  // upper spine
      { x: 182, y: 180, ax: 182, ay: 158 },  // lower spine
      { x: 158, y: 82,  ax: 158, ay: 103 },  // upper aft-spine
      { x: 158, y: 168, ax: 158, ay: 147 },  // lower aft-spine
    ],
    defense: [
      { x: 86,  y: 44,  ax: 108, ay: 71  },  // upper aft corner
      { x: 86,  y: 206, ax: 108, ay: 179 },  // lower aft corner
      { x: 64,  y: 87,  ax: 106, ay: 100 },  // far upper aft
      { x: 64,  y: 163, ax: 106, ay: 150 },  // far lower aft
    ],
  },
  wing: {
    weapon: [
      { x: 106, y: 20,  ax: 120, ay: 53  },  // upper wing tip
      { x: 106, y: 230, ax: 120, ay: 197 },  // lower wing tip
      { x: 274, y: 82,  ax: 260, ay: 110 },  // upper bow
      { x: 274, y: 168, ax: 260, ay: 140 },  // lower bow
      { x: 318, y: 125, ax: 300, ay: 125 },  // nose
    ],
    utility: [
      { x: 180, y: 80,  ax: 180, ay: 105 },  // upper fuselage
      { x: 180, y: 170, ax: 180, ay: 145 },  // lower fuselage
      { x: 156, y: 90,  ax: 156, ay: 110 },  // upper back
      { x: 156, y: 160, ax: 156, ay: 140 },  // lower back
    ],
    defense: [
      { x: 98,  y: 34,  ax: 120, ay: 53  },  // upper wing root
      { x: 98,  y: 216, ax: 120, ay: 197 },  // lower wing root
      { x: 78,  y: 84,  ax: 107, ay: 94  },  // upper aft
      { x: 78,  y: 166, ax: 107, ay: 156 },  // lower aft
    ],
  },
  heavy: {
    weapon: [
      { x: 260, y: 68,  ax: 248, ay: 96  },  // upper bow
      { x: 260, y: 182, ax: 248, ay: 154 },  // lower bow
      { x: 216, y: 28,  ax: 210, ay: 53  },  // upper shoulder
      { x: 216, y: 222, ax: 210, ay: 197 },  // lower shoulder
      { x: 310, y: 125, ax: 294, ay: 125 },  // bow tip
    ],
    utility: [
      { x: 200, y: 54,  ax: 197, ay: 76  },  // upper spine fwd
      { x: 200, y: 196, ax: 197, ay: 174 },  // lower spine fwd
      { x: 168, y: 64,  ax: 165, ay: 82  },  // upper spine mid
      { x: 168, y: 186, ax: 165, ay: 168 },  // lower spine mid
    ],
    defense: [
      { x: 72,  y: 48,  ax: 96,  ay: 77  },  // upper flank
      { x: 72,  y: 202, ax: 96,  ay: 173 },  // lower flank
      { x: 46,  y: 94,  ax: 72,  ay: 107 },  // upper stern
      { x: 46,  y: 156, ax: 72,  ay: 143 },  // lower stern
    ],
  },
};

const SOCKET_COLORS: Record<
  ModuleSlot,
  { stroke: string; hoveredStroke: string; filledFill: string; emptyFill: string; dimStroke: string }
> = {
  weapon: {
    stroke:       "#ffaa55",
    hoveredStroke:"#ffffff",
    filledFill:   "rgba(255,160,60,0.18)",
    emptyFill:    "rgba(40,16,0,0.72)",
    dimStroke:    "rgba(255,140,50,0.32)",
  },
  utility: {
    stroke:       "#55aaff",
    hoveredStroke:"#ffffff",
    filledFill:   "rgba(70,160,255,0.18)",
    emptyFill:    "rgba(0,20,44,0.72)",
    dimStroke:    "rgba(60,130,255,0.32)",
  },
  defense: {
    stroke:       "#44dd88",
    hoveredStroke:"#ffffff",
    filledFill:   "rgba(60,210,120,0.18)",
    emptyFill:    "rgba(0,26,12,0.72)",
    dimStroke:    "rgba(50,200,100,0.32)",
  },
};

const SLOT_ICONS: Record<ModuleSlot, string> = {
  weapon:  "⊕",
  utility: "◈",
  defense: "⬒",
};

const MODULE_KIND_ICONS: Record<string, string> = {
  laser:              "◈",
  railgun:            "▣",
  missile:            "✦",
  cannon:             "▥",
  mining_laser:       "⛏",
  afterburner:        "➤",
  webifier:           "⟲",
  warp_disruptor:     "⌖",
  target_painter:     "◍",
  tracking_disruptor: "≋",
  sensor_dampener:    "◌",
  energy_neutralizer: "ϟ",
  shield_booster:     "⬡",
  armor_repairer:     "◼",
  hardener:           "◆",
  passive:            "•",
  salvager:           "◇",
};

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function moduleLabelText(name: string) {
  return truncate(name, 16);
}

function moduleLabelFontSize(label: string) {
  if (label.length <= 10) return 6.5;
  if (label.length <= 13) return 6;
  return 5.4;
}

interface ShipFittingDiagramProps {
  hull: ShipHullDefinition;
  equipped: EquippedLoadout;
  draggedModuleId: string | null;
  hoveredSlotKey: string | null;
  selectedModuleId?: string | null;
  activeSlotKey?: string | null;
  onSlotHover: (key: string | null) => void;
  onSlotDrop: (slotType: ModuleSlot, slotIndex: number) => void;
  onSlotTap?: (slotType: ModuleSlot, slotIndex: number) => void;
  onClearSlot: (slotType: ModuleSlot, slotIndex: number) => void;
}

export function ShipFittingDiagram({
  hull,
  equipped,
  draggedModuleId,
  hoveredSlotKey,
  selectedModuleId = null,
  activeSlotKey = null,
  onSlotHover,
  onSlotDrop,
  onSlotTap,
  onClearSlot,
}: ShipFittingDiagramProps) {
  const uid = useId().replace(/:/g, "");
  const silhouette = hull.silhouette;
  const glowId = `sfx-glow-${hull.id}-${uid}`;
  const blurId = `sfx-blur-${hull.id}-${uid}`;
  const hullGradientId = `sfx-hull-gradient-${hull.id}-${uid}`;
  const hullClipId = `sfx-hull-clip-${hull.id}-${uid}`;
  const edgeMaskId = `sfx-edge-mask-${hull.id}-${uid}`;
  const edgeLightId = `sfx-edge-light-${hull.id}-${uid}`;
  const shadowId = `sfx-shadow-${hull.id}-${uid}`;
  const specularId = `sfx-specular-${hull.id}-${uid}`;
  const detailPaths = SHIP_DETAIL_PATHS[silhouette];

  const sockets = (["weapon", "utility", "defense"] as ModuleSlot[]).flatMap((slotType) =>
    equipped[slotType]
      .map((moduleId, index) => {
        const key = `${slotType}-${index}`;
        const pos = SLOT_SOCKETS[silhouette][slotType][index];
        if (!pos) return null;
        const module = moduleId ? (moduleById[moduleId] ?? null) : null;
        const canAccept = Boolean(draggedModuleId && moduleById[draggedModuleId]?.slot === slotType);
        const canAcceptSelected = Boolean(selectedModuleId && moduleById[selectedModuleId]?.slot === slotType);
        const isHovered = hoveredSlotKey === key && canAccept;
        const isFocused = activeSlotKey === key;
        const isTapReady = canAcceptSelected && !draggedModuleId;
        return { key, slotType, index, pos, moduleId, module, canAccept, canAcceptSelected, isHovered, isTapReady, isFocused };
      })
      .filter(Boolean) as Array<{
        key: string;
        slotType: ModuleSlot;
        index: number;
        pos: SocketPos;
        moduleId: string | null;
        module: ModuleDefinition | null;
        canAccept: boolean;
        canAcceptSelected: boolean;
        isHovered: boolean;
        isTapReady: boolean;
        isFocused: boolean;
      }>
  );

  return (
    <svg
      viewBox="0 0 360 260"
      className="ship-fitting-svg"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`${hull.name} fitting diagram`}
    >
      <defs>
        <radialGradient id={glowId} cx="55%" cy="50%" r="48%">
          <stop offset="0%"   stopColor={hull.color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={hull.color} stopOpacity="0"    />
        </radialGradient>
        <radialGradient id={hullGradientId} cx="38%" cy="34%" r="82%">
          <stop offset="0%" stopColor="#dbeeff" stopOpacity="0.22" />
          <stop offset="18%" stopColor={hull.color} stopOpacity="0.24" />
          <stop offset="58%" stopColor={hull.color} stopOpacity="0.13" />
          <stop offset="100%" stopColor="#06101f" stopOpacity="0.88" />
        </radialGradient>
        <radialGradient id={specularId} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="60%" stopColor="#dff0ff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#dff0ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={edgeMaskId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="42%" stopColor="white" stopOpacity="0.7" />
          <stop offset="72%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={edgeLightId} x1="12%" y1="8%" x2="84%" y2="90%">
          <stop offset="0%" stopColor="#f6fbff" stopOpacity="0.7" />
          <stop offset="45%" stopColor="#b9ddff" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#b9ddff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={hullClipId}>
          <path d={SHIP_PATHS[silhouette]} />
        </clipPath>
        <mask id={`${edgeMaskId}-mask`}>
          <rect x="0" y="0" width="360" height="260" fill={`url(#${edgeMaskId})`} />
        </mask>
        <filter id={blurId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
        </filter>
        <filter id={shadowId} x="-30%" y="-30%" width="180%" height="180%">
          <feDropShadow dx="2" dy="2" stdDeviation="6" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>

      <path
        d={SHIP_PATHS[silhouette]}
        fill="rgba(0,0,0,0.28)"
        stroke="none"
        filter={`url(#${shadowId})`}
      />

      {/* Ambient hull glow */}
      <ellipse
        cx="195" cy="125" rx="110" ry="62"
        fill={hull.color}
        fillOpacity="0.09"
        filter={`url(#${blurId})`}
      />

      {/* Ship glow halo */}
      <path
        d={SHIP_PATHS[silhouette]}
        fill={hull.color}
        fillOpacity="0.07"
        stroke={hull.color}
        strokeWidth="8"
        strokeOpacity="0.14"
        filter={`url(#${blurId})`}
      />

      {/* Ship hull fill */}
      <path
        d={SHIP_PATHS[silhouette]}
        fill={`url(#${hullGradientId})`}
        stroke={hull.color}
        strokeWidth="1.6"
        strokeOpacity="0.72"
        strokeLinejoin="round"
      />

      {/* Top-left edge lighting */}
      <path
        d={SHIP_PATHS[silhouette]}
        fill="none"
        stroke={`url(#${edgeLightId})`}
        strokeWidth="1.8"
        strokeOpacity="0.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        clipPath={`url(#${hullClipId})`}
        mask={`url(#${edgeMaskId}-mask)`}
      />

      {/* Specular catch on the lit upper-left hull face */}
      <g clipPath={`url(#${hullClipId})`}>
        <ellipse
          cx="156"
          cy="92"
          rx="52"
          ry="24"
          fill={`url(#${specularId})`}
          transform="rotate(-14 156 92)"
        />
      </g>

      {/* Hull detail / panel lines */}
      {detailPaths.map((d, i) => (
        <g key={i}>
          <path
            d={d}
            fill="none"
            stroke="#f2f8ff"
            strokeWidth="0.7"
            strokeOpacity={i < 3 ? 0.14 : 0.08}
            strokeLinecap="round"
            transform="translate(-2.4,-2.4)"
            clipPath={`url(#${hullClipId})`}
          />
          <path
            d={d}
            fill="none"
            stroke={hull.color}
            strokeWidth="0.7"
            strokeOpacity="0.28"
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* Connector lines — drawn below socket circles */}
      {sockets.map(({ key, slotType, pos, module, isHovered, isTapReady, isFocused }) => {
        const c = SOCKET_COLORS[slotType];
        const active = isHovered || isTapReady || isFocused;
        const stroke = active ? c.hoveredStroke : module ? c.stroke : c.dimStroke;
        return (
          <line
            key={`ln-${key}`}
            x1={pos.x}  y1={pos.y}
            x2={pos.ax} y2={pos.ay}
            stroke={stroke}
            strokeWidth={active ? 1.4 : 0.75}
            strokeOpacity={0.55}
            strokeDasharray={module ? undefined : "3 2"}
          />
        );
      })}

      {/* Slot sockets */}
      {sockets.map(({ key, slotType, index, pos, module, canAccept, isHovered, isTapReady, isFocused }) => {
        const c       = SOCKET_COLORS[slotType];
        const filled  = module !== null;
        const active  = isHovered || isTapReady || isFocused;
        const stroke  = active ? c.hoveredStroke : filled ? c.stroke : c.dimStroke;
        const bgFill  = active
          ? `${c.stroke}55`
          : filled ? c.filledFill : c.emptyFill;
        const icon    = filled
          ? (MODULE_KIND_ICONS[module!.kind] ?? SLOT_ICONS[slotType])
          : SLOT_ICONS[slotType];
        const nameLabel  = filled ? moduleLabelText(module!.name) : "";
        const nameFontSize = moduleLabelFontSize(nameLabel);
        const slotLabel  = `${slotType.slice(0, 3).toUpperCase()} ${index + 1}`;
        const interactive = canAccept || isTapReady;

        return (
          <g
            key={key}
            onDragOver={(e) => {
              if (!canAccept) return;
              e.preventDefault();
              onSlotHover(key);
            }}
            onDragEnter={() => { if (canAccept) onSlotHover(key); }}
            onDragLeave={() => { if (hoveredSlotKey === key) onSlotHover(null); }}
            onDrop={(e) => {
              e.preventDefault();
              onSlotDrop(slotType, index);
            }}
            onClick={() => {
              if (onSlotTap) onSlotTap(slotType, index);
            }}
            style={{ cursor: interactive ? "pointer" : "default" }}
          >
            <circle
              cx={pos.x}
              cy={pos.y}
              r={24}
              fill="rgba(255,255,255,0.001)"
              stroke="none"
            />

            {/* Tap-ready outer ring pulse */}
            {(isTapReady || canAccept) && (
              <circle
                cx={pos.x} cy={pos.y} r={active ? 21 : 19}
                fill="none"
                stroke={active ? c.hoveredStroke : c.stroke}
                strokeWidth={active ? 1.6 : 1}
                strokeOpacity={active ? 0.55 : 0.28}
                strokeDasharray={filled ? undefined : "3 3"}
              />
            )}

            {/* Socket background */}
            <circle
              cx={pos.x} cy={pos.y} r={13.5}
              fill={bgFill}
              stroke={stroke}
              strokeWidth={active ? 2 : filled ? 1.3 : 1}
              strokeDasharray={filled ? undefined : "4 3"}
            />

            {/* Icon inside socket */}
            <text
              x={pos.x} y={pos.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fill={stroke}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {icon}
            </text>

            {/* Slot label — always shown below socket */}
            <text
              x={pos.x} y={pos.y + 21}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={6.5}
              fill={stroke}
              fillOpacity={filled ? 0.5 : 0.45}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {slotLabel}
            </text>

            {/* Module name — shown below slot label when equipped */}
            {filled && nameLabel && (
              <text
                x={pos.x} y={pos.y + 30}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={nameFontSize}
                fill={stroke}
                fillOpacity={0.8}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {nameLabel}
              </text>
            )}

            {/* Clear button — × in top-right of socket, only when filled */}
            {filled && (
              <g
                onClick={(e) => {
                  e.stopPropagation();
                  onClearSlot(slotType, index);
                }}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={pos.x + 13} cy={pos.y - 13} r={8}
                  fill="rgba(8,12,20,0.92)"
                  stroke={c.stroke}
                  strokeWidth={1}
                  strokeOpacity={0.55}
                />
                <text
                  x={pos.x + 13} y={pos.y - 12}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={9}
                  fill={c.stroke}
                  fillOpacity={0.75}
                  style={{ userSelect: "none" }}
                >
                  ×
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
