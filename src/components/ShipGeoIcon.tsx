import { useId } from "react";

type Silhouette = "dart" | "wing" | "heavy" | "needle" | "wedge" | "kite" | "box" | "claw";

interface ShapeData {
  path: string;
  details: string[];
}

// Per-ship Geometry Wars style shapes.
// All fit within viewBox "-24 -16 48 32" (x: -24..24, y: -16..16).
const SHIP_SHAPES: Record<string, ShapeData> = {
  // ── DART CLASS ──────────────────────────────────────────────────────────────

  // Basic chevron fighter
  "rookie-sparrow": {
    path: "M 18 0 L -12 -9 L -4 0 L -12 9 Z",
    details: ["M -4 0 L 18 0"],
  },

  // Ultra-elongated lance — thin needle with notched tail
  "aurora-lance": {
    path: "M 22 0 L -10 -4 L -6 0 L -10 4 Z",
    details: ["M -6 0 L 22 0", "M -10 -4 L -10 4"],
  },

  // Double-barbed dart — barbs swept forward mid-body
  "cinder-needle": {
    path: "M 20 0 L 4 -6 L -12 -10 L -8 0 L -12 10 L 4 6 Z",
    details: ["M -8 0 L 20 0", "M 4 -6 L 4 6"],
  },

  // ── WING CLASS ──────────────────────────────────────────────────────────────

  // Delta wing with swept notch — fast attack
  "bastion-wren": {
    path: "M 20 0 L -8 -14 L -2 -2 L -6 0 L -2 2 L -8 14 Z",
    details: ["M -6 0 L 20 0", "M -2 -2 L -2 2"],
  },

  // Boomerang — forward-curving crescent, fast kiter
  "veil-runner": {
    path: "M 18 -8 L 4 -14 L -12 -10 L -14 0 L -12 10 L 4 14 L 18 8 L 8 0 Z",
    details: ["M 8 0 L -14 0"],
  },

  // Diamond kite — symmetric with crossed spars
  "ghost-kite": {
    path: "M 20 0 L 2 -13 L -14 0 L 2 13 Z",
    details: ["M -14 0 L 20 0", "M 2 -13 L 2 13"],
  },

  // Wide fan — spread rake form, three-lobed
  "dusk-rake": {
    path: "M 18 0 L 6 -10 L -14 -14 L -12 0 L -14 14 L 6 10 Z",
    details: ["M -12 0 L 18 0", "M 6 -10 L 6 10"],
  },

  // Bat wings — low profile, swept rearward
  "veil-specter": {
    path: "M 6 -2 L 0 -10 L -16 -14 L -12 0 L -16 14 L 0 10 L 6 2 Z",
    details: ["M -12 0 L 6 0"],
  },

  // Crescent — forward-open moon arc
  "noctis-lattice": {
    path: "M 16 -8 L 4 -14 L -12 -10 L -16 0 L -12 10 L 4 14 L 16 8 L 6 0 Z",
    details: ["M 6 0 L -16 0", "M 4 -14 L 4 14"],
  },

  // ── HEAVY CLASS ─────────────────────────────────────────────────────────────

  // Hexagon — balanced brawler
  "ember-jack": {
    path: "M 14 0 L 7 -12 L -7 -12 L -14 0 L -7 12 L 7 12 Z",
    details: ["M -14 0 L 14 0"],
  },

  // Broad wedge — swept gunship hull
  "helios-spine": {
    path: "M 20 0 L 6 -12 L -18 -8 L -18 8 L 6 12 Z",
    details: ["M -18 0 L 20 0", "M 6 -12 L 6 12"],
  },

  // Cross-spine — radial arm cruiser
  "breach-heron": {
    path: "M 20 0 L 4 -4 L 2 -12 L -2 -4 L -14 -8 L -10 0 L -14 8 L -2 4 L 2 12 L 4 4 Z",
    details: ["M -10 0 L 20 0", "M 2 -12 L 2 12"],
  },

  // Angular block — serpentine rear taper
  "slag-viper": {
    path: "M 18 -6 L 18 6 L -12 10 L -18 4 L -18 -4 L -12 -10 Z",
    details: ["M -18 0 L 18 0", "M -12 -10 L -12 10"],
  },

  // Axe head — asymmetric hatchet with swept blade
  "marrow-ax": {
    path: "M 16 -4 L 16 4 L 2 8 L -10 14 L -14 6 L -4 0 L -14 -6 L -10 -14 L 2 -8 Z",
    details: ["M -4 0 L 16 0"],
  },

  // Fortress — near-octagon with flat cardinal faces
  "asterion-ward": {
    path: "M 14 -8 L 8 -14 L -8 -14 L -14 -8 L -16 0 L -14 8 L -8 14 L 8 14 L 14 8 L 16 0 Z",
    details: ["M -16 0 L 16 0", "M 0 -14 L 0 14"],
  },

  // Halberd — long spear shaft with perpendicular crossguard blade
  "prism-halberd": {
    path: "M 22 0 L 6 -4 L 4 -12 L -2 -4 L -18 -6 L -16 0 L -18 6 L -2 4 L 4 12 L 6 4 Z",
    details: ["M -16 0 L 22 0", "M 4 -12 L 4 12"],
  },

  // Bulwark — wide 7-sided fortress prow
  "cinder-bulwark": {
    path: "M 16 -8 L 16 8 L 4 14 L -14 10 L -18 0 L -14 -10 L 4 -14 Z",
    details: ["M -18 0 L 16 0", "M 4 -14 L 4 14"],
  },

  // Hammer — T-hammer head with heavy crossbar
  "iron-castigator": {
    path: "M 20 -6 L 20 6 L 8 6 L 4 12 L -14 12 L -14 -12 L 4 -12 L 8 -6 Z",
    details: ["M -14 0 L 20 0", "M 8 -6 L 8 6"],
  },

  // ── INDUSTRIAL ──────────────────────────────────────────────────────────────

  // Wide cargo hull — rectangular with tapered stern
  "span-hauler": {
    path: "M 16 -8 L 16 8 L -18 12 L -20 0 L -18 -12 Z",
    details: ["M -20 0 L 16 0", "M 2 -10 L 2 10", "M -10 -11 L -10 11"],
  },

  // Chunky miner — wide octagonal body with fore drill ridge
  "ore-moth": {
    path: "M 20 -4 L 20 4 L 8 8 L -14 10 L -20 4 L -20 -4 L -14 -10 L 8 -8 Z",
    details: ["M -20 0 L 20 0", "M 8 -8 L 8 8", "M -14 -10 L -14 10"],
  },

  // ── ENEMIES ─────────────────────────────────────────────────────────────────

  // Tiny sliver — small fast scout
  "scrap-drone": {
    path: "M 22 0 L -12 -3 L -10 0 L -12 3 Z",
    details: ["M -10 0 L 22 0"],
  },

  // Javelin — wider sliver, raider dart
  "dust-raider": {
    path: "M 20 0 L -14 -7 L -10 0 L -14 7 Z",
    details: ["M -10 0 L 20 0"],
  },

  // Pike — spear with crossguard flanges
  "cinder-pike": {
    path: "M 22 0 L 8 -3 L 6 -10 L 2 -3 L -14 -6 L -12 0 L -14 6 L 2 3 L 6 10 L 8 3 Z",
    details: ["M -12 0 L 22 0"],
  },

  // Stalker — flat predatory swept wing
  "veil-stalker": {
    path: "M 18 0 L 4 -12 L -8 -14 L -14 -4 L -14 4 L -8 14 L 4 12 Z",
    details: ["M -14 0 L 18 0", "M 4 -12 L 4 12"],
  },

  // Reaver — wide aggressive wedge with protruding gun points
  "reaver-gunship": {
    path: "M 20 0 L 8 -8 L 14 -14 L 0 -8 L -14 -12 L -10 0 L -14 12 L 0 8 L 14 14 L 8 8 Z",
    details: ["M -10 0 L 20 0"],
  },
};

// Fallback shapes by silhouette for any ship not in the map
const SILHOUETTE_SHAPES: Record<Silhouette, ShapeData> = {
  dart: {
    path: "M 18 0 L -12 -9 L -4 0 L -12 9 Z",
    details: ["M -4 0 L 18 0"],
  },
  needle: {
    path: "M 26 0 L -4 -4 L -8 0 L -4 4 Z",
    details: ["M -8 0 L 26 0", "M 16 -2 L 10 0 L 16 2"],
  },
  wing: {
    path: "M 20 0 L -10 -12 L 0 -2 L -4 0 L 0 2 L -10 12 Z",
    details: ["M -4 0 L 0 -2", "M -4 0 L 0 2"],
  },
  kite: {
    path: "M 20 0 L 2 -14 L -14 0 L 2 14 Z",
    details: ["M -14 0 L 20 0", "M 2 -14 L 2 14"],
  },
  heavy: {
    path: "M 19 0 L 5 -12 L -14 -8 L -18 0 L -14 8 L 5 12 Z",
    details: ["M -18 0 L 19 0", "M -14 -8 L 5 -12", "M -14 8 L 5 12"],
  },
  wedge: {
    path: "M 16 0 L -18 -16 L -14 0 L -18 16 Z",
    details: ["M -14 0 L 16 0", "M -2 -8 L 8 0 L -2 8"],
  },
  box: {
    path: "M 18 -10 L 18 10 L -16 12 L -20 0 L -16 -12 Z",
    details: ["M -20 0 L 18 0", "M 18 -10 L -16 -12", "M 18 10 L -16 12"],
  },
  claw: {
    path: "M 20 0 L 2 -8 L -10 -16 L -16 -6 L -6 0 L -16 6 L -10 16 L 2 8 Z",
    details: ["M -6 0 L 20 0", "M 2 -8 L -10 -16", "M 2 8 L -10 16"],
  },
};

interface Props {
  shipId?: string;
  silhouette: Silhouette;
  color: string;
  size?: number;
}

export function ShipGeoIcon({ shipId, silhouette, color, size = 56 }: Props) {
  void shipId;
  const uid = useId().replace(/:/g, "");
  const filterId = `gw-glow-${uid}`;
  // Keep every ship icon on the same silhouette language as the fitting view.
  const shape: ShapeData = SILHOUETTE_SHAPES[silhouette];
  const height = Math.round(size * 0.6);

  return (
    <svg
      width={size}
      height={height}
      viewBox="-24 -16 48 32"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <filter id={filterId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow */}
      <path
        d={shape.path}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinejoin="round"
        opacity="0.25"
        filter={`url(#${filterId})`}
      />

      {/* Translucent fill */}
      <path
        d={shape.path}
        fill={color}
        fillOpacity="0.08"
        stroke="none"
      />

      {/* Main crisp stroke */}
      <path
        d={shape.path}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinejoin="round"
        filter={`url(#${filterId})`}
      />

      {/* Detail / panel lines */}
      {shape.details.map((d: string, i: number) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="0.6"
          opacity="0.5"
        />
      ))}
    </svg>
  );
}
