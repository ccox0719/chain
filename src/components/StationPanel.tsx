import { useMemo, useState } from "react";
import { ShipFittingDiagram } from "./ShipFittingDiagram";
import { ShipGeoIcon } from "./ShipGeoIcon";
import { WeaponDetailsCard } from "./WeaponDetailsCard";
import { factionData, factionDamageLabel, factionResistLabel } from "../game/data/factions";
import { missionCatalog } from "../game/data/missions";
import { CollapsibleSection } from "./CollapsibleSection";
import { moduleById, moduleCatalog } from "../game/data/modules";
import {
  CAPACITOR_BALANCE,
  COMBAT_BALANCE,
  ECONOMY_BALANCE,
  MISSION_BALANCE,
  MOVEMENT_BALANCE,
  PROGRESSION_BALANCE,
  SPAWN_BALANCE,
  clearBalanceOverrides,
  setBalanceOverride
} from "../game/config/balance";
import type { BalanceRootKey } from "../game/config/balance/overrides";
import { getStationCommodityStock } from "../game/economy/commodityAvailability";
import { isModuleAvailableAtStation } from "../game/economy/moduleAvailability";
import { playerShipById, playerShips } from "../game/data/ships";
import { commodityCatalog } from "../game/economy/data/commodities";
import { getBestSellLocationForCommodity } from "../game/economy/market";
import {
  formatStationTradeTag,
  getStationIdentityMeta,
  getStationMarketProfile,
  getStationTradeTags
} from "../game/economy/stationIntel";
import {
  getPilotLicenseProgressPercent,
  getPilotLicenseProgressRange,
  getRequiredPilotLicenseLevel,
  hasPilotLicenseForModule
} from "../game/utils/pilotLicense";
import { getMiningModuleTier } from "../game/utils/mining";
import { transportMissionCatalog } from "../game/missions/data/transportMissions";
import { contractProgressFraction } from "../game/procgen/runtime";
import { estimateRouteRisk, planRoute } from "../game/universe/routePlanning";
import { regionById, sectorById } from "../game/data/sectors";
import { getFactionStandingLabel, getStandingRequirementForAccessTier } from "../game/utils/factionStanding";
import { getCachedDerivedStats, getCargoUsed, getRepairCost } from "../game/utils/stats";
import { findComparableEquippedWeapon, getWeaponSummaryStats } from "../game/utils/weaponStats";
import { CommodityId, GameSnapshot, ModuleSlot, ResourceId, TransportMissionDefinition, TransportMissionState, TransportRisk } from "../types/game";

type StationTab = "services" | "ships" | "market" | "modules" | "fitting" | "missions";
type MarketSortKey = "name" | "category" | "volume" | "owned" | "buyPrice" | "sellPrice" | "profit";

const TAB_LABELS: Record<StationTab, string> = {
  services: "Overview",
  ships:    "Shipyard",
  market:   "Market",
  modules:  "Builds",
  fitting:  "Fitting",
  missions: "Missions",
};

const TAB_ICONS: Record<StationTab, string> = {
  services: "◉",
  ships:    "◈",
  market:   "⊞",
  modules:  "⬡",
  fitting:  "⊕",
  missions: "✦",
};

const TAB_COLORS: Record<StationTab, string> = {
  services: "#7fc0ff",
  ships:    "#7fc0ff",
  market:   "#ffbc7c",
  modules:  "#8de0ae",
  fitting:  "#ff9471",
  missions: "#c4a3ff",
};

const CATEGORY_ICONS: Record<string, string> = {
  essentials: "◉",
  industrial: "⬡",
  energy:     "⚡",
  medical:    "✚",
  technology: "◈",
  military:   "⊕",
  materials:  "⬒",
  frontier:   "◌",
  luxury:     "✦",
  salvage:    "◇",
};

const MODULE_KIND_ICONS: Record<string, string> = {
  laser:               "◈",
  railgun:             "▣",
  missile:             "✦",
  mining_laser:        "⛏",
  afterburner:         "➤",
  webifier:            "⟲",
  warp_disruptor:      "⌖",
  target_painter:      "◍",
  tracking_disruptor:  "≋",
  sensor_dampener:     "◌",
  energy_neutralizer:  "ϟ",
  salvager:            "◇",
  shield_booster:      "⬡",
  armor_repairer:      "◼",
  hardener:            "◆",
  passive:             "•",
};

const CATEGORY_LABELS: Record<string, string> = {
  essentials: "Essentials",
  industrial: "Industrial",
  energy:     "Energy",
  medical:    "Medical",
  technology: "Technology",
  military:   "Military",
  materials:  "Materials",
  frontier:   "Frontier",
  luxury:     "Luxury",
  salvage:    "Salvage",
};

const RISK_LEVEL: Record<TransportRisk, number> = { low: 1, medium: 2, high: 3, extreme: 4 };
const MISSION_TYPE_LABELS: Record<string, string> = {
  bounty: "Bounty",
  mining: "Mining",
  deliver: "Delivery",
  travel: "Survey"
};

const isDevBuild = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

const BALANCE_ROOTS = {
  combat: COMBAT_BALANCE,
  capacitor: CAPACITOR_BALANCE,
  economy: ECONOMY_BALANCE,
  missions: MISSION_BALANCE,
  movement: MOVEMENT_BALANCE,
  progression: PROGRESSION_BALANCE,
  spawns: SPAWN_BALANCE
} as const;

type BalanceSpec = {
  root: BalanceRootKey;
  path: string[];
  label: string;
  min: number;
  max: number;
  step: number;
  helper: string;
};

type BalanceGroup = {
  title: string;
  note: string;
  controls: BalanceSpec[];
};

type BalanceSnapshot = Record<string, number>;

const BALANCE_GROUPS: BalanceGroup[] = [
  {
    title: "Combat",
    note: "One dial that makes combat safer or harsher in a way you can feel immediately.",
    controls: [
      {
        root: "combat",
        path: ["pressure", "dial"],
        label: "Combat pressure",
        min: 0.6,
        max: 1.4,
        step: 0.01,
        helper: "Lower makes you hit harder, take less, and get engaged later. Higher does the reverse."
      }
    ]
  },
  {
    title: "Capacitor",
    note: "Controls sustain and how much time slow-time buys.",
    controls: [
      {
        root: "capacitor",
        path: ["playerRegenMultiplier"],
        label: "Player regen multiplier",
        min: 0.1,
        max: 1,
        step: 0.01,
        helper: "Lower values make active modules and long fights matter more."
      },
      {
        root: "capacitor",
        path: ["tacticalSlow", "timeScale"],
        label: "Tactical slow time scale",
        min: 0.1,
        max: 0.8,
        step: 0.01,
        helper: "Lower values make slow-time more dramatic."
      }
    ]
  },
  {
    title: "Movement",
    note: "Tightens or loosens the battlefield edges and terrain spacing.",
    controls: [
      {
        root: "movement",
        path: ["boundary", "warningDistance"],
        label: "Boundary warning distance",
        min: 120,
        max: 420,
        step: 5,
        helper: "How early the edge-of-space warning starts."
      },
      {
        root: "movement",
        path: ["terrain", "asteroidRepelPadding"],
        label: "Asteroid repel padding",
        min: 40,
        max: 220,
        step: 5,
        helper: "How much room ships keep from rocks before pushing away."
      }
    ]
  },
  {
    title: "Spawns",
    note: "Main lever for how often extra enemies show up.",
    controls: [
      {
        root: "spawns",
        path: ["pressure", "localReinforcementThreshold"],
        label: "Reinforcement threshold",
        min: 2,
        max: 12,
        step: 0.5,
        helper: "Higher values make follow-up spawns rarer."
      },
      {
        root: "spawns",
        path: ["maxTriggeredHostilesNearPlayer"],
        label: "Max triggered hostiles",
        min: 0,
        max: 8,
        step: 1,
        helper: "Caps how many triggered enemies can stack near the player."
      }
    ]
  },
  {
    title: "Missions",
    note: "Changes how much breathing room objective fights get.",
    controls: [
      {
        root: "missions",
        path: ["survive", "defaultReinforcementIntervalSec"],
        label: "Survive wave interval",
        min: 15,
        max: 90,
        step: 1,
        helper: "Longer intervals mean fewer waves and less pressure."
      },
      {
        root: "missions",
        path: ["clear", "defaultReinforcementIntervalSec"],
        label: "Clear wave interval",
        min: 15,
        max: 90,
        step: 1,
        helper: "Higher values give more time before reinforcement waves."
      }
    ]
  },
  {
    title: "Economy",
    note: "Useful when you want the frontier to pay out more or less aggressively.",
    controls: [
      {
        root: "economy",
        path: ["securityPriceScale", "frontier"],
        label: "Frontier price scale",
        min: 0.7,
        max: 1.5,
        step: 0.01,
        helper: "Raises or lowers frontier station pricing."
      }
    ]
  },
  {
    title: "Progression",
    note: "Soft progression tuning for ship power and license pacing.",
    controls: [
      {
        root: "progression",
        path: ["shipPowerTierByClass", "cruiser"],
        label: "Cruiser power tier",
        min: 1,
        max: 8,
        step: 1,
        helper: "Lets cruisers enter the stronger or weaker end of the ladder."
      },
      {
        root: "progression",
        path: ["pilotLicense", "awardMultiplier"],
        label: "Pilot license award multiplier",
        min: 0.5,
        max: 2,
        step: 0.01,
        helper: "Controls how quickly licenses advance."
      }
    ]
  }
];

function balanceKey(spec: BalanceSpec) {
  return `${spec.root}:${spec.path.join(".")}`;
}

function getBalanceValue(root: BalanceRootKey, path: string[]) {
  let current: unknown = BALANCE_ROOTS[root];
  for (const key of path) {
    if (typeof current !== "object" || current === null) return 0;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "number" ? current : 0;
}

function captureBalanceSnapshot() {
  const snapshot: BalanceSnapshot = {};
  BALANCE_GROUPS.forEach((group) => {
    group.controls.forEach((spec) => {
      snapshot[balanceKey(spec)] = getBalanceValue(spec.root, spec.path);
    });
  });
  return snapshot;
}

function decimalsForStep(step: number) {
  const raw = String(step);
  if (!raw.includes(".")) return 0;
  return raw.length - raw.indexOf(".") - 1;
}

function formatBalanceNumber(value: number, step: number) {
  const decimals = Math.min(3, decimalsForStep(step));
  if (decimals === 0) return Math.round(value).toLocaleString();
  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.?0+$/, "");
}

function balancePercent(value: number, spec: BalanceSpec) {
  const range = spec.max - spec.min;
  if (range <= 0) return 0;
  return Math.max(0, Math.min(100, ((value - spec.min) / range) * 100));
}

function BalanceSlider({
  spec,
  value,
  baseline,
  onChange
}: {
  spec: BalanceSpec;
  value: number;
  baseline: number;
  onChange: (nextValue: number) => void;
}) {
  const currentPct = balancePercent(value, spec);
  const baselinePct = balancePercent(baseline, spec);
  const delta = value - baseline;
  const currentLabel = formatBalanceNumber(value, spec.step);
  const baselineLabel = formatBalanceNumber(baseline, spec.step);
  const modeLabel =
    spec.root === "combat" && spec.path.join(".") === "pressure.dial"
      ? value < 0.9
        ? "Safer"
        : value > 1.1
          ? "Deadlier"
          : "Balanced"
      : null;
  return (
    <div
      className="panel-lite"
      title={`${spec.label}: ${spec.helper}`}
      style={{ display: "grid", gap: "0.45rem", padding: "0.75rem 0.8rem" }}
    >
      <div className="mission-card-header" style={{ marginBottom: 0, alignItems: "flex-start" }}>
        <strong>{spec.label}</strong>
        <span
          className={`status-chip${Math.abs(delta) < 0.0001 ? "" : delta > 0 ? " active" : " warning"}`}
          title={`Current value: ${currentLabel}. Baseline when the modal opened: ${baselineLabel}.${modeLabel ? ` ${modeLabel}.` : ""}`}
        >
          Now {currentLabel} · Was {baselineLabel}
        </span>
      </div>
      <input
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={spec.label}
        title={`${spec.label}: ${spec.helper}`}
      />
      <div style={{ position: "relative", height: "0.7rem", borderRadius: "999px", background: "rgba(255, 255, 255, 0.08)", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${currentPct}%`,
            background: "linear-gradient(90deg, rgba(127, 220, 255, 0.85), rgba(127, 220, 255, 0.35))"
          }}
        />
        <div
          title={`Last value: ${baselineLabel}`}
          style={{
            position: "absolute",
            top: "-0.2rem",
            bottom: "-0.2rem",
            left: `${baselinePct}%`,
            width: "2px",
            transform: "translateX(-1px)",
            background: "rgba(255, 255, 255, 0.8)",
            boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.35)"
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-dim)" }}>
        <span>{formatBalanceNumber(spec.min, spec.step)}</span>
        <span title={spec.helper}>{spec.helper}</span>
        <span>{formatBalanceNumber(spec.max, spec.step)}</span>
      </div>
    </div>
  );
}

const SHIP_ARCHETYPE_LABELS: Record<string, string> = {
  skirmisher: "Skirmisher",
  brawler: "Brawler",
  sniper: "Sniper",
  kiter: "Kiter",
  support: "Support",
  hauler: "Hauler",
  miner: "Miner"
};

const SHIP_ACCESS_TIER_LABELS: Record<string, string> = {
  native: "Native stock",
  allied: "Allied stock",
  neutral: "Neutral stock",
  export: "Export stock",
  black: "Black market"
};

const LEGAL_STATUS_LABELS: Record<string, string> = {
  lawful: "Lawful",
  licensed: "Licensed",
  gray: "Gray market",
  black: "Black market"
};

const FLEET_SUPPORT_LABELS: Record<string, string> = {
  rear: "Rear support",
  staging: "Staging point",
  frontline: "Frontline support",
  black: "Black market"
};

// Fixed max values for ship stat bars (covers full ship catalog range)
const MAX_SHIP_SPEED = Math.max(...playerShips.map(s => s.maxSpeed));
const MAX_SHIP_CARGO = Math.max(...playerShips.map(s => s.cargoCapacity));
const MAX_SHIP_TANK  = Math.max(...playerShips.map(s => s.baseShield + s.baseArmor + s.baseHull));
const MAX_SHIP_CAP   = Math.max(...playerShips.map(s => s.baseCapacitor));

function RiskPips({ risk }: { risk: TransportRisk }) {
  const level = RISK_LEVEL[risk] ?? 0;
  return (
    <span className="risk-pips">
      {[1, 2, 3, 4].map(pip => (
        <span key={pip} className={`risk-pip${pip <= level ? ` filled risk-${risk}` : ""}`} />
      ))}
      <span className="risk-text">{risk}</span>
    </span>
  );
}

function StatBar({ value, max, fillClass }: { value: number; max: number; fillClass: string }) {
  return (
    <div className="ship-stat-bar">
      <div className={`ship-stat-fill ${fillClass}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

function ResistBlock({
  label,
  current,
  preview
}: {
  label: string;
  current: { em: number; thermal: number; kinetic: number; explosive: number };
  preview: { em: number; thermal: number; kinetic: number; explosive: number };
}) {
  const entries: Array<{ key: keyof typeof preview; short: string; className: string }> = [
    { key: "em", short: "EM", className: "em" },
    { key: "thermal", short: "TH", className: "thermal" },
    { key: "kinetic", short: "KI", className: "kinetic" },
    { key: "explosive", short: "EX", className: "explosive" }
  ];
  return (
    <div className="resist-chip-row">
      <span className="resist-layer-label">{label}</span>
      <div className="resist-chips">
        {entries.map((entry) => {
          const currentValue = current[entry.key];
          const previewValue = preview[entry.key];
          const delta = previewValue - currentValue;
          return (
            <span
              key={entry.key}
              className={`resist-chip resist-${entry.className}${delta > 0.004 ? " good" : delta < -0.004 ? " bad" : ""}`}
              title={`${label} ${entry.short} ${Math.round(previewValue * 100)}%`}
            >
              <span className="resist-chip-type">{entry.short}</span>
              <span className="resist-chip-val">{Math.round(previewValue * 100)}%</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function missionTypeLabel(type: string) {
  return MISSION_TYPE_LABELS[type] ?? type;
}

interface StationPanelProps {
  snapshot: GameSnapshot;
  onUndock: () => void;
  onRepair: () => void;
  onSellCargo: () => void;
  onBuyModule: (moduleId: string) => void;
  onSellModule: (moduleId: string) => void;
  onBuyCommodity: (commodityId: CommodityId, quantity: number) => void;
  onSellCommodity: (commodityId: CommodityId, quantity: number) => void;
  onEquip: (slotType: ModuleSlot, slotIndex: number, moduleId: string | null) => void;
  onAcceptMission: (missionId: string) => void;
  onTurnInMission: (missionId: string) => void;
  onBuyShip: (shipId: string) => void;
  onSellShip: (shipId: string) => void;
  onSwitchShip: (shipId: string) => void;
  onSaveBuild: (buildId: "build-1" | "build-2" | "build-3") => void;
  onLoadBuild: (buildId: "build-1" | "build-2" | "build-3") => void;
}

export function StationPanel({
  snapshot,
  onUndock,
  onRepair,
  onSellCargo,
  onBuyModule,
  onSellModule,
  onBuyCommodity,
  onSellCommodity,
  onEquip,
  onAcceptMission,
  onTurnInMission,
  onBuyShip,
  onSellShip,
  onSwitchShip,
  onSaveBuild,
  onLoadBuild
}: StationPanelProps) {
  const { world, currentStation, selectedInfo } = snapshot;
  const [tab, setTab] = useState<StationTab>("services");
  const [shipPreviewId, setShipPreviewId] = useState(world.player.hullId);
  const [tradeQuantityById, setTradeQuantityById] = useState<Record<string, number>>({});
  const [marketSort, setMarketSort] = useState<{ key: MarketSortKey; direction: "asc" | "desc" }>({
    key: "name",
    direction: "asc"
  });
  const [moduleSort, setModuleSort] = useState<{ key: "name" | "dps" | "range" | "price" | "size"; direction: "asc" | "desc" }>({ key: "name", direction: "asc" });
  const [moduleSlotView, setModuleSlotView] = useState<ModuleSlot>("weapon");
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [focusedSlot, setFocusedSlot] = useState<{ slotType: ModuleSlot; index: number } | null>(null);
  const [hoveredSlotKey, setHoveredSlotKey] = useState<string | null>(null);
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [balanceBaseline, setBalanceBaseline] = useState<BalanceSnapshot>(() => captureBalanceSnapshot());
  const [, setBalanceRefresh] = useState(0);
  const stationTags = currentStation?.tags ?? [];
  const stationProfile = getStationMarketProfile(currentStation);
  const stationIdentity = getStationIdentityMeta(currentStation);
  const stationTrade = useMemo(() => getStationTradeTags(currentStation), [currentStation?.id, stationTags.join("|")]);
  const stationTradeTagSet = useMemo(() => new Set(stationTrade.all), [stationTrade]);
  const security = snapshot.sector.security;
  const systemFaction = factionData[snapshot.sector.controllingFaction];
  const regionFaction = factionData[snapshot.currentRegion.dominantFaction];
  const stationFactionId = stationProfile?.factionControl ?? snapshot.sector.controllingFaction;
  const stationFaction = factionData[stationFactionId];
  const stationStanding = world.player.factionStandings[stationFactionId] ?? 0;
  const stationStandingLabel = getFactionStandingLabel(stationStanding);
  const alliedFactionSet = useMemo<Set<string>>(
    () =>
      new Set([
        ...(stationFaction.allies ?? []),
        ...(snapshot.currentRegion.secondaryFactions ?? []),
        snapshot.currentRegion.dominantFaction
      ]),
    [snapshot.currentRegion.dominantFaction, snapshot.currentRegion.secondaryFactions, stationFaction.allies]
  );
  function applyBalanceValue(root: BalanceRootKey, path: string[], nextValue: number) {
    if (Number.isNaN(nextValue)) return;
    setBalanceOverride(root, path, nextValue);
    setBalanceBaseline(captureBalanceSnapshot());
    setBalanceRefresh((value) => value + 1);
  }

  function resetBalanceValues() {
    clearBalanceOverrides();
    setBalanceBaseline(captureBalanceSnapshot());
    setBalanceRefresh((value) => value + 1);
  }

  const devBalanceModal = isDevBuild && balanceModalOpen ? (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Developer balance dials"
      onClick={() => setBalanceModalOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(0, 0, 0, 0.55)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "5.5rem 1rem 1rem"
      }}
    >
      <article
        className="panel-lite"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(44rem, 100%)",
          maxHeight: "min(82vh, 52rem)",
          display: "flex",
          flexDirection: "column",
          borderColor: "rgba(127, 220, 255, 0.28)",
          boxShadow: "0 28px 80px rgba(0, 0, 0, 0.45)"
        }}
      >
        <div className="mission-card-header" style={{ marginBottom: "0.5rem" }}>
          <strong>Developer Balance</strong>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" className="ghost-button mini" onClick={resetBalanceValues}>
              Reset
            </button>
            <button type="button" className="ghost-button mini" onClick={() => setBalanceModalOpen(false)}>
              Close
            </button>
          </div>
        </div>
        <div
          className="dev-balance-grid"
          style={{
            display: "grid",
            gap: "0.75rem",
            overflowY: "auto",
            paddingRight: "0.25rem",
            flex: "1 1 auto"
          }}
        >
          {BALANCE_GROUPS.map((group) => (
            <section key={group.title} className="panel-lite" style={{ display: "grid", gap: "0.55rem", padding: "0.7rem 0.8rem" }}>
              <div className="mission-card-header" style={{ marginBottom: 0, alignItems: "flex-start" }}>
                <strong>{group.title}</strong>
                <span className="status-chip">{group.note}</span>
              </div>
              <div style={{ display: "grid", gap: "0.7rem" }}>
                {group.controls.map((spec) => (
                  <BalanceSlider
                    key={balanceKey(spec)}
                    spec={spec}
                    value={getBalanceValue(spec.root, spec.path)}
                    baseline={balanceBaseline[balanceKey(spec)] ?? getBalanceValue(spec.root, spec.path)}
                    onChange={(nextValue) => applyBalanceValue(spec.root, spec.path, nextValue)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  ) : null;

  function inventoryAllows(tags: string[]) {
    if (tags.includes("common")) return true;
    if (security === "high") {
      return tags.some((tag) => stationTradeTagSet.has(tag)) && !tags.includes("frontier") && !tags.includes("high-tech");
    }
    if (security === "medium") {
      return (
        tags.some((tag) => stationTradeTagSet.has(tag)) ||
        tags.includes("military") ||
        tags.includes("industrial") ||
        tags.includes("research")
      ) && !tags.includes("frontier");
    }
    return (
      tags.some((tag) => stationTradeTagSet.has(tag)) ||
      tags.includes("military") ||
      tags.includes("industrial") ||
      tags.includes("high-tech") ||
      tags.includes("frontier")
    );
  }

  function shipFactionAccess(shipFaction: string) {
    if (shipFaction === stationFactionId) return true;
    if (alliedFactionSet.has(shipFaction)) return true;
    return false;
  }

  function shipVisibleAtStation(ship: (typeof playerShips)[number]) {
    if (ship.id === world.player.hullId) return true;
    if (ship.availabilityTags.includes("common")) return true;

    const baseAllowed = inventoryAllows(ship.availabilityTags);
    const factionAligned = shipFactionAccess(ship.faction);
    const accessTier = stationProfile?.shipAccessTier ?? "neutral";
    const shipStanding = world.player.factionStandings[ship.faction] ?? 0;
    const standingRequirement = getStandingRequirementForAccessTier(accessTier, ship.faction, stationProfile);

    if (accessTier === "native") return (factionAligned && baseAllowed) || (shipStanding >= standingRequirement && baseAllowed);
    if (accessTier === "allied") return (factionAligned && baseAllowed) || ((ship.faction === stationFactionId || shipStanding >= standingRequirement) && baseAllowed);
    if (accessTier === "export") return factionAligned && (baseAllowed || ship.availabilityTags.includes("frontier") || ship.availabilityTags.includes("military"));
    if (accessTier === "black") {
      return (
        stationProfile?.blackMarketAllowed === true &&
        (baseAllowed ||
          factionAligned ||
          shipStanding >= 0.5 ||
          ship.availabilityTags.includes("frontier") ||
          ship.availabilityTags.includes("salvage") ||
          ship.availabilityTags.includes("military"))
      );
    }
    return baseAllowed && (factionAligned || ship.faction === stationFactionId || shipStanding >= standingRequirement);
  }

  const availableShips = useMemo(
    () => playerShips.filter((ship) => shipVisibleAtStation(ship)),
    [
      world.player.hullId,
      stationProfile?.shipAccessTier,
      stationProfile?.blackMarketAllowed,
      stationFactionId,
      alliedFactionSet,
      security,
      stationTradeTagSet,
      snapshot.currentRegion.dominantFaction,
      snapshot.currentRegion.secondaryFactions,
      stationProfile?.factionControl
    ]
  );
  const availableModules = useMemo(
    () => moduleCatalog.filter((module) => isModuleAvailableAtStation(module, security, currentStation)),
    [security, currentStation?.id]
  );
  const currentHull = playerShipById[world.player.hullId];
  const previewHull = playerShipById[shipPreviewId] ?? currentHull;
  const currentStats = getCachedDerivedStats(world.player);
  const currentBonuses = currentHull.bonuses ?? null;
  const roundedShieldMax = Math.round(currentStats.maxShield);
  const roundedArmorMax = Math.round(currentStats.maxArmor);
  const roundedHullMax = Math.round(currentStats.maxHull);
  const roundedCargoCapacity = Math.round(currentStats.cargoCapacity);
  const freeCargo = Math.max(0, currentStats.cargoCapacity - getCargoUsed(world.player));
  const roundedFreeCargo = Math.round(freeCargo);
  const missionCargoUsed = world.player.missionCargo.reduce((total, entry) => total + entry.volume, 0);
  const previewBonuses = previewHull.bonuses ?? null;
  const pilotLicense = world.player.pilotLicense;
  const pilotLicenseProgress = getPilotLicenseProgressPercent(pilotLicense);
  const pilotLicenseRange = getPilotLicenseProgressRange(pilotLicense.level);
  const pilotLicenseNextTarget =
    pilotLicense.level >= 3 ? "Maxed" : `${pilotLicense.progress - pilotLicenseRange.start} / ${pilotLicenseRange.end - pilotLicenseRange.start}`;

  const stockedCommodities = useMemo(
    () => getStationCommodityStock(commodityCatalog, security, currentStation, snapshot.sector.id, world),
    [currentStation?.id, security, snapshot.sector.id, world]
  );

  // Max buy price for bar normalization
  const maxMarketPrice = useMemo(() => {
    return Math.max(...commodityCatalog.map(c => snapshot.economy.commodityBuyPrices[c.id] ?? c.basePrice), 1);
  }, [snapshot.economy.commodityBuyPrices]);

  const sortedMarketRows = useMemo(() => {
    const rows = stockedCommodities.map((commodity) => {
      const buyPrice = snapshot.economy.commodityBuyPrices[commodity.id];
      const sellPrice = snapshot.economy.commoditySellPrices[commodity.id];
      const owned = world.player.commodities[commodity.id] ?? 0;
      const hint = getBestSellLocationForCommodity(commodity.id, currentStats.commoditySellMultiplier);
      const profitPerUnit = hint ? hint.value - buyPrice : 0;
      return { commodity, buyPrice, sellPrice, owned, hint, profitPerUnit };
    });

    rows.sort((a, b) => {
      const direction = marketSort.direction === "asc" ? 1 : -1;
      let value = 0;
      switch (marketSort.key) {
        case "name":
          value = a.commodity.name.localeCompare(b.commodity.name);
          break;
        case "category":
          value = (CATEGORY_LABELS[a.commodity.category] ?? a.commodity.category).localeCompare(
            CATEGORY_LABELS[b.commodity.category] ?? b.commodity.category
          );
          break;
        case "volume":
          value = a.commodity.volume - b.commodity.volume;
          break;
        case "owned":
          value = a.owned - b.owned;
          break;
        case "buyPrice":
          value = a.buyPrice - b.buyPrice;
          break;
        case "sellPrice":
          value = a.sellPrice - b.sellPrice;
          break;
        case "profit":
          value = a.profitPerUnit - b.profitPerUnit;
          break;
      }
      return value === 0 ? a.commodity.name.localeCompare(b.commodity.name) * direction : value * direction;
    });

    return rows;
  }, [
    stockedCommodities,
    snapshot.economy.commodityBuyPrices,
    snapshot.economy.commoditySellPrices,
    world.player.commodities,
    currentStats.commoditySellMultiplier,
    marketSort
  ]);
  const stationSupplyLabels = useMemo(
    () => stationTrade.supply.slice(0, 4).map((tag) => formatStationTradeTag(tag)),
    [stationTrade]
  );
  const stationDemandLabels = useMemo(
    () => stationTrade.demand.slice(0, 4).map((tag) => formatStationTradeTag(tag)),
    [stationTrade]
  );
  const exportOpportunityRows = useMemo(
    () =>
      sortedMarketRows
        .filter((row) => row.profitPerUnit > 0 && row.hint && row.hint.stationId !== currentStation?.id)
        .slice(0, 3),
    [sortedMarketRows, currentStation?.id]
  );
  const importDemandRows = useMemo(() => {
    const demandTags = new Set(stationTrade.demand);
    return commodityCatalog
      .map((commodity) => {
        const sellPrice = snapshot.economy.commoditySellPrices[commodity.id] ?? commodity.basePrice;
        const matches = commodity.tags.some((tag) => demandTags.has(tag));
        const premium = sellPrice - commodity.basePrice;
        return { commodity, sellPrice, premium, matches };
      })
      .filter((row) => row.matches)
      .sort((left, right) => {
        if (right.premium !== left.premium) return right.premium - left.premium;
        return right.sellPrice - left.sellPrice;
      })
      .slice(0, 3);
  }, [stationTrade, snapshot.economy.commoditySellPrices]);
  const bestResourceSales = useMemo(
    () =>
      (Object.entries(snapshot.economy.resourceSellPrices) as Array<[ResourceId, number]>)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3),
    [snapshot.economy.resourceSellPrices]
  );

  // Group available modules by slot
  const modulesBySlot = useMemo(() => {
    const groups: Record<ModuleSlot, typeof moduleCatalog> = { weapon: [], utility: [], defense: [] };
    availableModules.forEach(m => { groups[m.slot].push(m); });
    return groups;
  }, [availableModules]);
  const ownedModuleEntries = Object.entries(world.player.inventory.modules)
    .filter(([, count]) => Number(count) > 0)
    .map(([moduleId, count]) => ({
      moduleId,
      count: Number(count),
      module: moduleById[moduleId] ?? null
    }));
  const inventoryModulesBySlot: Record<ModuleSlot, Array<{ moduleId: string; count: number; module: NonNullable<typeof ownedModuleEntries[number]["module"]> }>> = {
    weapon: [],
    utility: [],
    defense: []
  };
  ownedModuleEntries.forEach((entry) => {
    if (!entry.module) return;
    inventoryModulesBySlot[entry.module.slot].push({
      moduleId: entry.moduleId,
      count: entry.count,
      module: entry.module
    });
  });
  (["weapon", "utility", "defense"] as ModuleSlot[]).forEach((slotType) => {
    inventoryModulesBySlot[slotType].sort((left, right) => left.module.name.localeCompare(right.module.name));
  });
  const equippedWeaponIds = world.player.equipped.weapon;
  const equippedWeaponDps = world.player.equipped.weapon
    .filter((id): id is string => id !== null)
    .reduce((sum, id) => {
      const m = moduleById[id];
      if (!m || !m.damage || !m.cycleTime) return sum;
      return sum + getWeaponSummaryStats(m).dps;
    }, 0);
  const unknownOwnedModules = ownedModuleEntries.filter((entry) => !entry.module);
  const selectedModule = selectedModuleId ? moduleById[selectedModuleId] ?? null : null;
  const focusedSlotKey = focusedSlot ? `${focusedSlot.slotType}-${focusedSlot.index}` : null;
  const focusedEquippedModuleId = focusedSlot ? world.player.equipped[focusedSlot.slotType][focusedSlot.index] ?? null : null;
  const focusedEquippedModule = focusedEquippedModuleId ? moduleById[focusedEquippedModuleId] ?? null : null;
  const focusedSlotModules = focusedSlot ? inventoryModulesBySlot[focusedSlot.slotType] : [];

  if (!currentStation) return null;

  function moduleMiningSummary(module: (typeof moduleCatalog)[number]) {
    if (module.kind !== "mining_laser") return null;
    const miningTier = getMiningModuleTier(module);
    const yieldAmount = Math.max(1, Math.round((module.miningAmount ?? 0) * (module.miningYieldMultiplier ?? 1)));
    if (module.minesAllInRange) {
      return `Tier ${miningTier} sweeper. Sweeps all asteroids in range for ${yieldAmount} ore/cycle${miningTier > 1 ? " with better yield on lower-grade ore." : "."}`;
    }
    const targets = module.miningTargets?.length ? module.miningTargets.join(", ") : "any ore";
    return `Tier ${miningTier} extractor. Mines ${targets} for ${yieldAmount} ore/cycle${miningTier > 1 ? " with better yield on lower-grade ore" : ""}${module.autoMine ? " and auto-locks nearby ore." : "."}`;
  }

  function handleSlotDrop(slotType: ModuleSlot, index: number) {
    setFocusedSlot({ slotType, index });
    if (!draggedModuleId) return;
    const module = moduleById[draggedModuleId];
    if (!module || module.slot !== slotType) return;
    onEquip(slotType, index, draggedModuleId);
    setDraggedModuleId(null);
    setSelectedModuleId(null);
    setHoveredSlotKey(null);
  }

  function handleSlotTap(slotType: ModuleSlot, index: number) {
    setFocusedSlot({ slotType, index });
    if (!selectedModuleId) return;
    const module = moduleById[selectedModuleId];
    if (!module || module.slot !== slotType) return;
    onEquip(slotType, index, selectedModuleId);
    setSelectedModuleId(null);
    setHoveredSlotKey(null);
  }

  function renderFocusedSlotModuleCard(moduleId: string, count: number, module: NonNullable<typeof ownedModuleEntries[number]["module"]>) {
    const licenseLocked = !hasPilotLicenseForModule(pilotLicense, module);
    const requiredLicenseLevel = getRequiredPilotLicenseLevel(module);
    const compareTo = focusedEquippedModule ?? findComparableEquippedWeapon(module, equippedWeaponIds);
    const isEquipped = focusedEquippedModuleId === moduleId;
    const canFit = !licenseLocked && Boolean(focusedSlot) && !isEquipped;

    function equipFocusedSlotModule() {
      if (!focusedSlot || licenseLocked || isEquipped) return;
      setSelectedModuleId(moduleId);
      onEquip(focusedSlot.slotType, focusedSlot.index, moduleId);
      setSelectedModuleId(null);
      setHoveredSlotKey(null);
    }

    return (
      <div
        key={`slot-pick-${focusedSlotKey}-${moduleId}`}
        className={`module-drag-card fitting-slot-picker-card${draggedModuleId === moduleId ? " dragging" : ""}${licenseLocked ? " locked" : ""}${isEquipped ? " selected" : ""}${canFit ? " actionable" : ""}`}
        draggable={!licenseLocked}
        onClick={() => {
          equipFocusedSlotModule();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          equipFocusedSlotModule();
        }}
        onDragStart={() => {
          if (licenseLocked) return;
          setDraggedModuleId(moduleId);
          setSelectedModuleId(moduleId);
        }}
        onDragEnd={() => {
          setDraggedModuleId(null);
          setHoveredSlotKey(null);
        }}
        role={canFit ? "button" : undefined}
        tabIndex={canFit ? 0 : undefined}
      >
        <div className="module-drag-copy">
          {licenseLocked && <span className="status-chip license-lock-chip">Pilot L{requiredLicenseLevel}</span>}
          <WeaponDetailsCard
            module={module}
            compareTo={compareTo}
            contextLabel={isEquipped ? "Equipped Here" : "Socket Fit"}
            compactMode="minimal"
          />
        </div>
        <div className="module-drag-meta">
          <span className="status-chip">x{count}</span>
          <span>{module.price} cr</span>
          <span className={`status-chip${isEquipped ? " active" : ""}`}>{isEquipped ? "Equipped" : "Tap To Fit"}</span>
          <button
            type="button"
            className="ghost-button mini"
            onClick={(event) => {
              event.stopPropagation();
              onSellModule(module.id);
            }}
            disabled={count <= 0}
            title={`Sell one ${module.name}`}
          >
            Sell 1
          </button>
        </div>
      </div>
    );
  }

  function transportRouteMetrics(mission: TransportMissionDefinition) {
    const toPickup =
      world.currentSectorId === mission.pickupSystemId
        ? 0
        : planRoute(world, world.currentSectorId, mission.pickupSystemId, mission.routePreference, false)?.steps.length ?? 0;
    const pickupToDestination =
      planRoute(world, mission.pickupSystemId, mission.destinationSystemId, mission.routePreference, false)?.steps ?? [];
    const cargoReimbursement = Math.max(0, Math.round(mission.cargoVolume * (mission.cargoUnitValue ?? 0)));
    return {
      toPickup,
      deliveryJumps: pickupToDestination.length,
      risk: estimateRouteRisk(pickupToDestination),
      cargoReimbursement,
      rewardEstimate: mission.baseReward + cargoReimbursement + (mission.bonusReward ?? 0)
    };
  }

  function transportStatusLabel(state: TransportMissionState) {
    if (state.status === "active") return state.pickedUp ? "active · delivering" : "active · pickup";
    return state.status;
  }

  function getRegionNameForSystem(systemId: string) {
    const s = sectorById[systemId];
    if (!s) return "Unknown";
    return regionById[s.regionId]?.name ?? "Unknown";
  }

  function quantityFor(commodityId: CommodityId) {
    return Math.max(1, tradeQuantityById[commodityId] ?? 1);
  }

  function setQuantity(commodityId: CommodityId, quantity: number) {
    setTradeQuantityById((current) => ({ ...current, [commodityId]: Math.max(1, Math.min(300, quantity)) }));
  }

  function toggleMarketSort(key: MarketSortKey) {
    setMarketSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "name" || key === "category" ? "asc" : "desc" }
    );
  }

  function marketSortLabel(key: MarketSortKey) {
    if (marketSort.key !== key) return "";
    return marketSort.direction === "asc" ? " ↑" : " ↓";
  }

  const cargoUsed = getCargoUsed(world.player);
  const cargoPct = Math.min(100, (cargoUsed / currentStats.cargoCapacity) * 100);

  return (
    <div className="station-overlay">
      {/* Sticky header */}
      <div className="station-header">
        <div className="station-header-info">
          <span className="station-name">⬡ {currentStation.name}</span>
          <span className="station-system-label">
            {snapshot.sector.name} · {snapshot.currentRegion.name} ·{" "}
            <span className={`sec-tag sec-${snapshot.sector.security}`}>{snapshot.sector.security.toUpperCase()}</span>
          </span>
        </div>
        <div className="station-header-actions">
          <div className="station-header-topline">
            <span className="credit-badge">✦ {world.player.credits.toLocaleString()} cr</span>
            <button
              type="button"
              onClick={onRepair}
              disabled={getRepairCost(world.player) <= 0}
              title={getRepairCost(world.player) <= 0 ? "Ship already fully repaired" : `Repair ship for ${getRepairCost(world.player)} credits`}
            >
              Repair ({getRepairCost(world.player)} cr)
            </button>
            <button
              type="button"
              onClick={onSellCargo}
              disabled={cargoUsed <= 0}
              title={cargoUsed <= 0 ? "No cargo to sell" : `Sell all cargo (${cargoUsed}u)`}
            >
              Sell Cargo
            </button>
            {isDevBuild && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setBalanceBaseline(captureBalanceSnapshot());
                  setBalanceModalOpen(true);
                }}
              >
                Balance
              </button>
            )}
          </div>
        </div>
      </div>
      {devBalanceModal}
      {/* Tab navigation */}
      <div className="station-tabs">
        {(Object.keys(TAB_LABELS) as StationTab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`station-tab${tab === t ? " active" : ""}`}
            style={{ "--tab-color": TAB_COLORS[t] } as React.CSSProperties}
            onClick={() => setTab(t)}
          >
            <span className="station-tab-icon">{TAB_ICONS[t]}</span>
            <span className="station-tab-label">{TAB_LABELS[t]}</span>
          </button>
        ))}
        <button type="button" className="station-tab station-tab--undock" onClick={onUndock}>
          <span className="station-tab-icon">➤</span>
          <span className="station-tab-label">Undock</span>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="station-content">

        {/* ── SERVICES TAB ── */}
        {tab === "services" && (
          <>
            <div className="station-services-overview-grid">
              <div className="panel-lite station-command-banner" style={{ margin: 0 }}>
                <div className="station-command-copy">
                  <div className="mission-card-header" style={{ marginBottom: "0.4rem" }}>
                    <strong>{stationIdentity.icon} {stationIdentity.label}</strong>
                    <span className="status-chip">{snapshot.currentRegion.name}</span>
                    <span className="status-chip">{snapshot.sector.name}</span>
                  </div>
                  <p style={{ margin: 0 }}>{stationProfile?.headline ?? currentStation.description}</p>
                  <p className="station-command-note">{stationProfile?.planningNote ?? stationIdentity.summary}</p>
                </div>
                <div className="station-command-tags">
                  <div>
                    <span className="station-command-label">Stocks well</span>
                    <div className="map-meta-grid">
                      {stationSupplyLabels.length > 0 ? stationSupplyLabels.map((label) => (
                        <span key={label} className="status-chip">{label}</span>
                      )) : <span className="status-chip">General service stock</span>}
                    </div>
                  </div>
                  <div>
                    <span className="station-command-label">Pays for</span>
                    <div className="map-meta-grid">
                      {stationDemandLabels.length > 0 ? stationDemandLabels.map((label) => (
                        <span key={label} className="status-chip">{label}</span>
                      )) : <span className="status-chip">Routine local demand</span>}
                    </div>
                  </div>
                </div>
                <div className="map-meta-grid" style={{ marginTop: "0.65rem" }}>
                  <span className="status-chip">
                    Access {SHIP_ACCESS_TIER_LABELS[stationProfile?.shipAccessTier ?? "neutral"] ?? stationProfile?.shipAccessTier ?? "Neutral"}
                  </span>
                  <span className="status-chip">
                    Law {LEGAL_STATUS_LABELS[stationProfile?.legalStatus ?? "licensed"] ?? stationProfile?.legalStatus ?? "Licensed"}
                  </span>
                  <span className="status-chip">
                    Control {stationFaction.icon} {stationFaction.name}
                  </span>
                  <span className="status-chip">
                    Standing {stationStanding.toFixed(2)} · {stationStandingLabel}
                  </span>
                  <span className="status-chip">
                    {FLEET_SUPPORT_LABELS[stationProfile?.fleetSupportLevel ?? "rear"] ?? stationProfile?.fleetSupportLevel ?? "Rear support"}
                  </span>
                  {stationProfile?.recruitmentNode ? (
                    <span className="status-chip">
                      Recruit {stationProfile.recruitmentBranch ?? "Faction Office"}
                    </span>
                  ) : null}
                </div>
                {stationProfile?.shipFamilyBias?.length ? (
                  <div className="tag-row" style={{ marginTop: "0.5rem" }}>
                    {stationProfile.shipFamilyBias.map((family) => (
                      <span key={family} className="status-chip">{family}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="panel-lite faction-intel-banner" style={{ margin: 0, borderColor: systemFaction.color }}>
                <div className="mission-card-header" style={{ marginBottom: "0.35rem" }}>
                  <strong>Faction Intel</strong>
                  <span className="status-chip" style={{ borderColor: systemFaction.color, color: systemFaction.color }}>
                    {systemFaction.icon} {systemFaction.name}
                  </span>
                  <span className="status-chip" style={{ borderColor: regionFaction.color, color: regionFaction.color }}>
                    Region · {regionFaction.icon} {regionFaction.name}
                  </span>
                  <span className="status-chip">Theater {snapshot.sector.theaterTag ?? snapshot.currentRegion.wartimeRole ?? "rear"}</span>
                </div>
                <div className="map-meta-grid">
                  <span className="status-chip">Damage {factionDamageLabel(systemFaction.id)}</span>
                  <span className="status-chip">Defense {systemFaction.tankStyle}</span>
                  <span className="status-chip">Resists {factionResistLabel(systemFaction.id)}</span>
                  <span className="status-chip">{snapshot.sector.identityLabel}</span>
                  <span className="status-chip">Threat {snapshot.sector.threatSummary ?? systemFaction.threatSummary}</span>
                </div>
                <p style={{ margin: "0.5rem 0 0", color: "var(--text-dim)" }}>
                  {systemFaction.doctrineSummary}
                </p>
                <div className="tag-row" style={{ marginTop: "0.45rem" }}>
                  {systemFaction.enemyArchetypePreferences.map((entry) => (
                    <span key={entry} className="status-chip">{entry}</span>
                  ))}
                  {snapshot.currentRegion.localShipFamilies?.map((entry) => (
                    <span key={entry} className="status-chip">{entry}</span>
                  ))}
                </div>
              </div>
              {snapshot.regionalEvent && (
                <div className="panel-lite station-services-callout">
                  <div className="mission-card-header" style={{ marginBottom: "0.35rem" }}>
                    <strong>{snapshot.regionalEvent.name}</strong>
                    <span className="status-chip">{snapshot.currentRegion.name}</span>
                  </div>
                  <p style={{ margin: 0 }}>{snapshot.regionalEvent.description}</p>
                  {snapshot.regionalEvent.serviceOffer && (
                    <p style={{ margin: "0.35rem 0 0", color: "var(--text-dim)", fontSize: "0.78rem" }}>{snapshot.regionalEvent.serviceOffer}</p>
                  )}
                </div>
              )}
              {snapshot.currentHotspot && (
                <div className="panel-lite station-services-callout">
                  <div className="mission-card-header" style={{ marginBottom: "0.35rem" }}>
                    <strong>{snapshot.currentHotspot.title}</strong>
                    <span className="status-chip">Hotspot</span>
                  </div>
                  <p style={{ margin: 0 }}>{snapshot.currentHotspot.description}</p>
                </div>
              )}
            </div>
            <div className="station-grid">
              <article className="panel-lite">
              <h3>Ship Status — {playerShipById[world.player.hullId]?.name}</h3>
              <div className="svc-ship-header">
                <div className="svc-ship-icon">
                  <ShipGeoIcon
                    shipId={currentHull.id}
                    silhouette={currentHull.silhouette}
                    color={currentHull.color}
                    size={78}
                  />
                </div>
                <div className="svc-ship-copy">
                  <strong>{currentHull.name}</strong>
                  <div className="svc-ship-tags">
                    <span className="status-chip">{currentHull.shipClass}</span>
                    <span className="status-chip">{SHIP_ARCHETYPE_LABELS[currentHull.archetype] ?? currentHull.archetype}</span>
                  </div>
                  <p>{currentHull.role}</p>
                </div>
              </div>
              <div className="svc-integrity-grid">
                <div className="svc-bar-row">
                  <span>⬡ Shield</span>
                  <div className="meter"><span className="shield-fill" style={{ width: `${Math.min(100, (world.player.shield / currentStats.maxShield) * 100)}%` }} /></div>
                  <span>{Math.round(world.player.shield)} / {roundedShieldMax}</span>
                </div>
                <div className="svc-bar-row">
                  <span>◼ Armor</span>
                  <div className="meter"><span className="armor-fill" style={{ width: `${Math.min(100, (world.player.armor / currentStats.maxArmor) * 100)}%` }} /></div>
                  <span>{Math.round(world.player.armor)} / {roundedArmorMax}</span>
                </div>
                <div className="svc-bar-row">
                  <span>▲ Hull</span>
                  <div className="meter"><span className="hull-fill" style={{ width: `${Math.min(100, (world.player.hull / currentStats.maxHull) * 100)}%` }} /></div>
                  <span>{Math.round(world.player.hull)} / {roundedHullMax}</span>
                </div>
              </div>
              <div className="svc-cargo-summary">
                <div className="svc-cargo-labels">
                  <span>⬒ Cargo Hold</span>
                  <span>{cargoUsed} / {roundedCargoCapacity}u · {roundedFreeCargo} free</span>
                </div>
                <div className="svc-cargo-bar">
                  <div className="svc-cargo-fill" style={{ width: `${cargoPct}%` }} />
                </div>
              </div>
              <div className="license-summary">
                <div className="license-summary-head">
                  <span>◈ Pilot License</span>
                  <span>L{pilotLicense.level} {pilotLicense.level >= 3 ? "· Max" : `· ${pilotLicenseNextTarget}`}</span>
                </div>
                <div className="license-progress-bar">
                  <div className="license-progress-fill" style={{ width: `${pilotLicenseProgress}%` }} />
                </div>
              </div>
              <div className="ship-resist-section">
                <h4>Hull Specs &amp; Resistances</h4>
                {currentBonuses && (
                  <p className="ship-bonus-summary">
                    {[
                      currentBonuses.cargoCapacity !== undefined ? `cargo +${currentBonuses.cargoCapacity}` : null,
                      currentBonuses.cargoCapacityMultiplier !== undefined ? `cargo x${currentBonuses.cargoCapacityMultiplier.toFixed(2)}` : null,
                      currentBonuses.miningYieldMultiplier !== undefined ? `mining x${currentBonuses.miningYieldMultiplier.toFixed(2)}` : null,
                      currentBonuses.commodityBuyMultiplier !== undefined ? `trade buy x${currentBonuses.commodityBuyMultiplier.toFixed(2)}` : null,
                      currentBonuses.commoditySellMultiplier !== undefined ? `trade sell x${currentBonuses.commoditySellMultiplier.toFixed(2)}` : null,
                      currentBonuses.resourceSellMultiplier !== undefined ? `ore sell x${currentBonuses.resourceSellMultiplier.toFixed(2)}` : null,
                      currentBonuses.moduleKinds?.laser ? "laser bonus" : null,
                      currentBonuses.moduleKinds?.railgun ? "rail bonus" : null,
                      currentBonuses.moduleKinds?.missile ? "missile bonus" : null,
                      currentBonuses.moduleKinds?.mining_laser ? "mining laser bonus" : null,
                      currentBonuses.moduleKinds?.shield_booster ? "shield booster bonus" : null,
                      currentBonuses.moduleKinds?.armor_repairer ? "armor repair bonus" : null
                    ].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div className="stat-chip-grid">
                  <div className="stat-chip speed-chip">
                    <span className="stat-chip-icon">➤</span>
                    <span className="stat-chip-label">Speed</span>
                    <span className="stat-chip-value">{currentHull.maxSpeed}</span>
                  </div>
                  <div className="stat-chip cargo-chip">
                    <span className="stat-chip-icon">⬒</span>
                    <span className="stat-chip-label">Cargo</span>
                    <span className="stat-chip-value">{currentHull.cargoCapacity}</span>
                  </div>
                  <div className="stat-chip shield-chip">
                    <span className="stat-chip-icon">⬡</span>
                    <span className="stat-chip-label">Shield</span>
                    <span className="stat-chip-value">{currentHull.baseShield}</span>
                  </div>
                  <div className="stat-chip armor-chip">
                    <span className="stat-chip-icon">◼</span>
                    <span className="stat-chip-label">Armor</span>
                    <span className="stat-chip-value">{currentHull.baseArmor}</span>
                  </div>
                  <div className="stat-chip hull-chip">
                    <span className="stat-chip-icon">▲</span>
                    <span className="stat-chip-label">Hull</span>
                    <span className="stat-chip-value">{currentHull.baseHull}</span>
                  </div>
                  <div className="stat-chip cap-chip">
                    <span className="stat-chip-icon">⚡</span>
                    <span className="stat-chip-label">Cap</span>
                    <span className="stat-chip-value">{currentHull.baseCapacitor}</span>
                  </div>
                </div>
                <div className="ship-slot-row">
                  <span className="ship-slot-label">Weapon</span>
                  <span className="ship-slot-val">{currentHull.slots.weapon}</span>
                  <span className="ship-slot-label">Utility</span>
                  <span className="ship-slot-val">{currentHull.slots.utility}</span>
                  <span className="ship-slot-label">Defense</span>
                  <span className="ship-slot-val">{currentHull.slots.defense}</span>
                  <span className="ship-slot-label">Lock</span>
                  <span className="ship-slot-val">{currentHull.lockRange}m</span>
                </div>
                <div className="ship-resist-grid">
                  <ResistBlock label="Shield" current={currentHull.shieldResists} preview={currentStats.shieldResists} />
                  <ResistBlock label="Armor" current={currentHull.armorResists} preview={currentStats.armorResists} />
                  <ResistBlock label="Hull" current={currentHull.hullResists} preview={currentStats.hullResists} />
                </div>
              </div>
              </article>
            </div>
          </>
        )}

        {/* ── SHIPS TAB ── */}
        {tab === "ships" && (
          <div className="station-grid">
            <article className="panel-lite">
              <h3>Ship Market</h3>
              <div className="stack-list">
                {availableShips.map((ship) => {
                  const owned = world.player.ownedShips.includes(ship.id);
                  const active = world.player.hullId === ship.id;
                  const sellPrice = snapshot.economy.shipSellPrices[ship.id] ?? Math.max(1, Math.floor(ship.price * 0.56));
                  const canSell = owned && world.player.ownedShips.length > 1;
                  return (
                    <div key={ship.id} className="market-item">
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <ShipGeoIcon shipId={ship.id} silhouette={ship.silhouette} color={ship.color} />
                        <div>
                          <strong>{ship.name}</strong>
                          <span className="status-chip">
                            {ship.shipClass} · {SHIP_ARCHETYPE_LABELS[ship.archetype] ?? ship.archetype}
                          </span>
                          <p>{ship.description}</p>
                        </div>
                      </div>
                      <div className="market-actions">
                        <button type="button" onClick={() => setShipPreviewId(ship.id)}>
                          Preview
                        </button>
                        {!owned ? (
                          <button type="button" onClick={() => onBuyShip(ship.id)}>
                            Buy {snapshot.economy.shipBuyPrices[ship.id] ?? ship.price} cr
                          </button>
                        ) : (
                          <>
                            <button type="button" onClick={() => onSwitchShip(ship.id)} disabled={active}>
                              {active ? "Active" : "Activate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => onSellShip(ship.id)}
                              disabled={!canSell}
                              title={
                                !canSell
                                  ? "Keep at least one ship"
                                  : active
                                    ? "Sell the active ship by switching to another owned hull first"
                                    : `Sell ${ship.name}`
                              }
                            >
                              Sell {sellPrice} cr
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="panel-lite">
              <h3>Ship Stats — {previewHull.name}</h3>
              <div style={{ marginBottom: "0.65rem" }}>
                <span className="status-chip">{previewHull.shipClass} · {SHIP_ARCHETYPE_LABELS[previewHull.archetype] ?? previewHull.archetype}</span>
                <p style={{ marginTop: "0.4rem", fontSize: "0.78rem" }}>{previewHull.role}</p>
                {previewBonuses && (
                  <p className="ship-bonus-summary">
                    {[
                      previewBonuses.cargoCapacity !== undefined ? `cargo +${previewBonuses.cargoCapacity}` : null,
                      previewBonuses.cargoCapacityMultiplier !== undefined ? `cargo x${previewBonuses.cargoCapacityMultiplier.toFixed(2)}` : null,
                      previewBonuses.miningYieldMultiplier !== undefined ? `mining x${previewBonuses.miningYieldMultiplier.toFixed(2)}` : null,
                      previewBonuses.commodityBuyMultiplier !== undefined ? `trade buy x${previewBonuses.commodityBuyMultiplier.toFixed(2)}` : null,
                      previewBonuses.commoditySellMultiplier !== undefined ? `trade sell x${previewBonuses.commoditySellMultiplier.toFixed(2)}` : null,
                      previewBonuses.resourceSellMultiplier !== undefined ? `ore sell x${previewBonuses.resourceSellMultiplier.toFixed(2)}` : null,
                      previewBonuses.moduleKinds?.laser ? "laser bonus" : null,
                      previewBonuses.moduleKinds?.railgun ? "rail bonus" : null,
                      previewBonuses.moduleKinds?.missile ? "missile bonus" : null,
                      previewBonuses.moduleKinds?.mining_laser ? "mining laser bonus" : null,
                      previewBonuses.moduleKinds?.shield_booster ? "shield booster bonus" : null,
                      previewBonuses.moduleKinds?.armor_repairer ? "armor repair bonus" : null
                    ].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>

              <div className="ship-stat-list">
                {/* Speed */}
                <div className="ship-stat-item">
                  <span>Speed</span>
                  <StatBar value={previewHull.maxSpeed} max={MAX_SHIP_SPEED} fillClass="speed-fill" />
                  <strong>{previewHull.maxSpeed}</strong>
                  <span className={`stat-delta${previewHull.maxSpeed > currentHull.maxSpeed ? " good" : previewHull.maxSpeed < currentHull.maxSpeed ? " bad" : ""}`}>
                    {previewHull.maxSpeed === currentHull.maxSpeed ? "—" : (previewHull.maxSpeed > currentHull.maxSpeed ? "+" : "") + (previewHull.maxSpeed - currentHull.maxSpeed)}
                  </span>
                </div>
                {/* Cargo */}
                <div className="ship-stat-item">
                  <span>Cargo</span>
                  <StatBar value={previewHull.cargoCapacity} max={MAX_SHIP_CARGO} fillClass="cargo-fill-stat" />
                  <strong>{previewHull.cargoCapacity}</strong>
                  <span className={`stat-delta${previewHull.cargoCapacity > currentHull.cargoCapacity ? " good" : previewHull.cargoCapacity < currentHull.cargoCapacity ? " bad" : ""}`}>
                    {previewHull.cargoCapacity === currentHull.cargoCapacity ? "—" : (previewHull.cargoCapacity > currentHull.cargoCapacity ? "+" : "") + (previewHull.cargoCapacity - currentHull.cargoCapacity)}
                  </span>
                </div>
                {/* Shield */}
                <div className="ship-stat-item">
                  <span>Shield</span>
                  <StatBar value={previewHull.baseShield} max={MAX_SHIP_TANK / 3} fillClass="shield-fill" />
                  <strong>{previewHull.baseShield}</strong>
                  <span className={`stat-delta${previewHull.baseShield > currentHull.baseShield ? " good" : previewHull.baseShield < currentHull.baseShield ? " bad" : ""}`}>
                    {previewHull.baseShield === currentHull.baseShield ? "—" : (previewHull.baseShield > currentHull.baseShield ? "+" : "") + (previewHull.baseShield - currentHull.baseShield)}
                  </span>
                </div>
                {/* Armor */}
                <div className="ship-stat-item">
                  <span>Armor</span>
                  <StatBar value={previewHull.baseArmor} max={MAX_SHIP_TANK / 3} fillClass="armor-fill" />
                  <strong>{previewHull.baseArmor}</strong>
                  <span className={`stat-delta${previewHull.baseArmor > currentHull.baseArmor ? " good" : previewHull.baseArmor < currentHull.baseArmor ? " bad" : ""}`}>
                    {previewHull.baseArmor === currentHull.baseArmor ? "—" : (previewHull.baseArmor > currentHull.baseArmor ? "+" : "") + (previewHull.baseArmor - currentHull.baseArmor)}
                  </span>
                </div>
                {/* Hull */}
                <div className="ship-stat-item">
                  <span>Hull</span>
                  <StatBar value={previewHull.baseHull} max={MAX_SHIP_TANK / 3} fillClass="hull-fill" />
                  <strong>{previewHull.baseHull}</strong>
                  <span className={`stat-delta${previewHull.baseHull > currentHull.baseHull ? " good" : previewHull.baseHull < currentHull.baseHull ? " bad" : ""}`}>
                    {previewHull.baseHull === currentHull.baseHull ? "—" : (previewHull.baseHull > currentHull.baseHull ? "+" : "") + (previewHull.baseHull - currentHull.baseHull)}
                  </span>
                </div>
                {/* Capacitor */}
                <div className="ship-stat-item">
                  <span>Capacitor</span>
                  <StatBar value={previewHull.baseCapacitor} max={MAX_SHIP_CAP} fillClass="cap-fill" />
                  <strong>{previewHull.baseCapacitor}</strong>
                  <span className={`stat-delta${previewHull.baseCapacitor > currentHull.baseCapacitor ? " good" : previewHull.baseCapacitor < currentHull.baseCapacitor ? " bad" : ""}`}>
                    {previewHull.baseCapacitor === currentHull.baseCapacitor ? "—" : (previewHull.baseCapacitor > currentHull.baseCapacitor ? "+" : "") + (previewHull.baseCapacitor - currentHull.baseCapacitor)}
                  </span>
                </div>
              </div>

              <div className="ship-slot-row">
                <span className="ship-slot-label">Weapon</span>
                <span className="ship-slot-val">{previewHull.slots.weapon}</span>
                <span className="ship-slot-label">Utility</span>
                <span className="ship-slot-val">{previewHull.slots.utility}</span>
                <span className="ship-slot-label">Defense</span>
                <span className="ship-slot-val">{previewHull.slots.defense}</span>
                <span className="ship-slot-label">Lock</span>
                <span className="ship-slot-val">{previewHull.lockRange}m</span>
              </div>

              <div className="ship-resist-section">
                <h4>Resistance Profile</h4>
                <div className="ship-resist-grid">
                  <ResistBlock label="Shield" current={currentHull.shieldResists} preview={previewHull.shieldResists} />
                  <ResistBlock label="Armor" current={currentHull.armorResists} preview={previewHull.armorResists} />
                  <ResistBlock label="Hull" current={currentHull.hullResists} preview={previewHull.hullResists} />
                </div>
              </div>
              </article>
            </div>
        )}

        {/* ── MARKET TAB ── */}
        {tab === "market" && (
          <div className="mkt-container">
            <div className="station-grid station-grid-compact">
              <article className="panel-lite station-service-card">
                <div className="mission-card-header">
                  <strong>Local Supply</strong>
                  <span className="status-chip">{stationIdentity.label}</span>
                </div>
                <p>This dock regularly turns over these cargo lines and service priorities.</p>
                <div className="station-service-pills">
                  {stationSupplyLabels.length > 0 ? stationSupplyLabels.map((label) => (
                    <span key={label} className="status-chip">{label}</span>
                  )) : <span className="status-chip">General stock</span>}
                </div>
                <div className="station-brief-list">
                  <div>
                    <strong>Region role</strong>
                    <span>{snapshot.currentRegion.gameplayRole}</span>
                  </div>
                </div>
              </article>

              <article className="panel-lite station-service-card">
                <div className="mission-card-header">
                  <strong>Outbound Trades</strong>
                  <span className="status-chip">{exportOpportunityRows.length} leads</span>
                </div>
                {exportOpportunityRows.length > 0 ? exportOpportunityRows.map((row) => (
                  <div key={row.commodity.id} className="station-brief-list">
                    <div>
                      <strong>{row.commodity.name}</strong>
                      <span>Buy here {row.buyPrice} cr · best sale +{row.profitPerUnit} cr/unit</span>
                    </div>
                    <small>{row.hint?.stationName} · {row.hint?.systemName}</small>
                  </div>
                )) : (
                  <p style={{ margin: 0, color: "var(--text-dim)" }}>No standout export lane from this dock at the moment.</p>
                )}
              </article>

              <article className="panel-lite station-service-card">
                <div className="mission-card-header">
                  <strong>Inbound Demand</strong>
                  <span className="status-chip">{stationDemandLabels[0] ?? "Local demand"}</span>
                </div>
                {importDemandRows.length > 0 ? importDemandRows.map((row) => (
                  <div key={row.commodity.id} className="station-brief-list">
                    <div>
                      <strong>{row.commodity.name}</strong>
                      <span>Sells here for {row.sellPrice} cr · {row.premium >= 0 ? "+" : ""}{row.premium} vs base</span>
                    </div>
                    <small>{row.commodity.tags.map((tag) => formatStationTradeTag(tag)).slice(0, 2).join(" · ")}</small>
                  </div>
                )) : (
                  <p style={{ margin: 0, color: "var(--text-dim)" }}>This dock is not signaling any standout import premium right now.</p>
                )}
              </article>

              <article className="panel-lite station-service-card">
                <div className="mission-card-header">
                  <strong>Ore Buyback</strong>
                  <span className="status-chip">Local rates</span>
                </div>
                {bestResourceSales.map(([resourceId, value]) => (
                  <div key={resourceId} className="station-brief-list">
                    <div>
                      <strong>{resourceId}</strong>
                      <span>{value} cr/unit</span>
                    </div>
                  </div>
                ))}
              </article>
            </div>
            <div className="mkt-header-bar">
              <div className="mkt-table-copy">
                <strong>Commodity Exchange</strong>
                <span>All stocked goods in one sortable table.</span>
              </div>
              <div className="mkt-cargo-strip">
                <span className="mkt-cargo-label">Cargo</span>
                <div className="mkt-cargo-bar">
                  <div className="mkt-cargo-fill" style={{ width: `${cargoPct}%` }} />
                </div>
                <span className="mkt-cargo-label">{cargoUsed}/{roundedCargoCapacity}u · {roundedFreeCargo} free</span>
                {missionCargoUsed > 0 && <span className="mkt-cargo-label mkt-mission-lock">{missionCargoUsed}u mission locked</span>}
                <span className="mkt-cargo-label">✦ {world.player.credits} cr</span>
              </div>
            </div>
            <div className="mkt-table-shell">
              <div className="mkt-table">
                <div className="mkt-table-row mkt-table-head">
                  <button type="button" className="mkt-sort-btn" onClick={() => toggleMarketSort("name")}>Good{marketSortLabel("name")}</button>
                  <button type="button" className="mkt-sort-btn" onClick={() => toggleMarketSort("category")}>Category{marketSortLabel("category")}</button>
                  <button type="button" className="mkt-sort-btn" onClick={() => toggleMarketSort("volume")}>Vol{marketSortLabel("volume")}</button>
                  <button type="button" className="mkt-sort-btn" onClick={() => toggleMarketSort("owned")}>Owned{marketSortLabel("owned")}</button>
                  <button type="button" className="mkt-sort-btn" onClick={() => toggleMarketSort("buyPrice")}>Buy{marketSortLabel("buyPrice")}</button>
                  <button type="button" className="mkt-sort-btn" onClick={() => toggleMarketSort("sellPrice")}>Sell{marketSortLabel("sellPrice")}</button>
                  <button type="button" className="mkt-sort-btn" onClick={() => toggleMarketSort("profit")}>Best Margin{marketSortLabel("profit")}</button>
                  <span>Trade</span>
                </div>
                {sortedMarketRows.map(({ commodity, buyPrice, sellPrice, owned, hint, profitPerUnit }) => {
                  const quantity = quantityFor(commodity.id);
                  const buyTotal = buyPrice * quantity;
                  const sellQty = Math.min(quantity, owned);
                  const sellTotal = sellPrice * sellQty;
                  const canAfford = world.player.credits >= buyTotal;
                  const requiredVolume = commodity.volume * quantity;
                  const canFit = freeCargo >= requiredVolume;
                  const buyFill = Math.min(100, (buyPrice / maxMarketPrice) * 100);
                  const sellFill = Math.min(100, (sellPrice / maxMarketPrice) * 100);

                  return (
                    <div key={commodity.id} className="mkt-table-row">
                      <div className="mkt-good-cell">
                        <strong>{commodity.name}</strong>
                        <div className="mkt-row-tags">
                          {commodity.riskTag !== "legal" && <span className="status-chip mkt-risk-chip">{commodity.riskTag}</span>}
                        </div>
                      </div>
                      <span>{CATEGORY_ICONS[commodity.category] ?? "◦"} {CATEGORY_LABELS[commodity.category] ?? commodity.category}</span>
                      <span>{commodity.volume}u</span>
                      <span>{owned}</span>
                      <div className="mkt-price-cell">
                        <div className="mkt-bar"><div className="mkt-bar-fill mkt-buy-fill" style={{ width: `${buyFill}%` }} /></div>
                        <span>{buyPrice} cr</span>
                      </div>
                      <div className="mkt-price-cell">
                        <div className="mkt-bar"><div className="mkt-bar-fill mkt-sell-fill" style={{ width: `${sellFill}%` }} /></div>
                        <span>{sellPrice} cr</span>
                      </div>
                      <div className={`mkt-margin-cell${profitPerUnit > 0 ? " positive" : ""}`}>
                        <strong>{profitPerUnit > 0 ? `+${profitPerUnit}` : "0"}</strong>
                        <small>{hint && profitPerUnit > 0 ? `${hint.stationName} · ${hint.systemName}` : "—"}</small>
                      </div>
                      <div className="mkt-trade-cell">
                        <div className="mkt-qty-row">
                          <button type="button" className="mkt-qty-btn" onClick={() => setQuantity(commodity.id, quantity - 1)}>−</button>
                          <span className="mkt-qty-val">{quantity}</span>
                          <button type="button" className="mkt-qty-btn" onClick={() => setQuantity(commodity.id, quantity + 1)}>+</button>
                        </div>
                        <div className="mkt-action-row">
                          <button
                            type="button"
                            className={profitPerUnit > 0 ? "primary-button" : ""}
                            onClick={() => onBuyCommodity(commodity.id, quantity)}
                            disabled={!canAfford || !canFit}
                            title={
                              !canAfford
                                ? "Not enough credits"
                                : !canFit
                                  ? `Need ${requiredVolume}u, free ${freeCargo}u${
                                      missionCargoUsed > 0 ? ` (${missionCargoUsed}u locked by mission cargo)` : ""
                                    }`
                                  : `Buy ${quantity} ${commodity.name}`
                            }
                          >
                            Buy {buyTotal} cr
                          </button>
                          <button type="button" onClick={() => onSellCommodity(commodity.id, sellQty)} disabled={sellQty <= 0}>
                            Sell {sellQty > 0 ? `${sellQty} · ${sellTotal} cr` : "—"}
                          </button>
                        </div>
                        {(!canAfford || !canFit) && (
                          <span className="mkt-warn">
                            {!canAfford
                              ? "Need credits"
                              : `Need ${Math.max(0, requiredVolume - freeCargo)}u${missionCargoUsed > 0 ? " · mission locked" : ""}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── MODULES TAB ── */}
        {tab === "modules" && (
          <div className="mod-container">
            <div className="mod-topbar">
            <article className="panel-lite license-panel mod-top-card">
              <h3>Pilot License</h3>
              <div className="license-summary">
                <div className="license-summary-head">
                  <span>Current Authorization</span>
                  <span className="license-level-badge">L{pilotLicense.level}</span>
                </div>
                <div className="license-progress-bar">
                  <div className="license-progress-fill" style={{ width: `${pilotLicenseProgress}%` }} />
                </div>
                <div className="license-progress-sub">
                  {pilotLicense.level >= 3 ? "Authorization maxed" : `Next level: ${pilotLicenseNextTarget}`}
                </div>
              </div>
            </article>
            <article className="panel-lite mod-top-card mod-sort-panel">
              <div className="mod-sort-panel-head">
                <div>
                  <h3>Module Exchange</h3>
                  <p>Scan station stock by output, reach, price, or footprint without forcing the market into one wide strip.</p>
                </div>
                <span className="status-chip">{availableModules.length} stocked</span>
              </div>
            <div className="mod-sort-bar">
              {(["name", "dps", "range", "price", "size"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`mod-sort-btn${moduleSort.key === key ? " active" : ""}`}
                  onClick={() =>
                    setModuleSort((prev) => ({
                      key,
                      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
                    }))
                  }
                >
                  {key === "name" ? "Name" : key === "dps" ? "DPS" : key === "range" ? "Range" : key === "price" ? "Price" : "Size"}
                  {moduleSort.key === key && <span className="mod-sort-arrow">{moduleSort.direction === "asc" ? "↑" : "↓"}</span>}
                </button>
              ))}
            </div>
            </article>
            </div>
            <div className="mod-slot-toggle" role="tablist" aria-label="Module slot types">
              {(["weapon", "utility", "defense"] as ModuleSlot[]).map((slotType) => (
                <button
                  key={slotType}
                  type="button"
                  role="tab"
                  aria-selected={moduleSlotView === slotType}
                  className={`mod-slot-toggle-btn${moduleSlotView === slotType ? " active" : ""}`}
                  onClick={() => setModuleSlotView(slotType)}
                >
                  {slotType === "weapon" ? "Weapons" : slotType === "utility" ? "Utility" : "Defense"}
                  <span>{modulesBySlot[slotType].length}</span>
                </button>
              ))}
            </div>
            <div className="mod-market-grid">
            {(["weapon", "utility", "defense"] as ModuleSlot[]).map((slotType, index) => {
              if (slotType !== moduleSlotView) return null;
              const rawModules = modulesBySlot[slotType];
              if (rawModules.length === 0) return null;
              const slotModules = [...rawModules].sort((a, b) => {
                const dir = moduleSort.direction === "asc" ? 1 : -1;
                switch (moduleSort.key) {
                  case "dps": {
                    const aDps = a.slot === "weapon" && a.damage && a.cycleTime ? getWeaponSummaryStats(a).dps : 0;
                    const bDps = b.slot === "weapon" && b.damage && b.cycleTime ? getWeaponSummaryStats(b).dps : 0;
                    return (aDps - bDps) * dir;
                  }
                  case "range": return ((a.range ?? a.optimal ?? 0) - (b.range ?? b.optimal ?? 0)) * dir;
                  case "price": {
                    const ap = snapshot.economy.moduleBuyPrices[a.id] ?? a.price;
                    const bp = snapshot.economy.moduleBuyPrices[b.id] ?? b.price;
                    return (ap - bp) * dir;
                  }
                  case "size": return ((a.weaponClass ?? a.sizeClass ?? "").localeCompare(b.weaponClass ?? b.sizeClass ?? "")) * dir;
                  default: return a.name.localeCompare(b.name) * dir;
                }
              });
              return (
                <section key={slotType} className={`mod-slot-section mod-slot-section-${slotType}`}>
                  <div className="mod-slot-grid">
                    {slotModules.length > 0 ? (
                    slotModules.map((module) => {
                      const owned = world.player.inventory.modules[module.id] ?? 0;
                      const buyPrice = snapshot.economy.moduleBuyPrices[module.id] ?? module.price;
                      const sellPrice = snapshot.economy.moduleSellPrices[module.id] ?? Math.max(1, Math.floor(module.price * 0.55));
                      const miningSummary = moduleMiningSummary(module);
                      const licenseLocked = !hasPilotLicenseForModule(pilotLicense, module);
                      const requiredLicenseLevel = getRequiredPilotLicenseLevel(module);
                      const compareTo = findComparableEquippedWeapon(module, equippedWeaponIds);
                      return (
                        <article key={module.id} className={`mod-tile kind-${module.kind}${licenseLocked ? " mod-tile-locked" : ""}`}>
                          <span className="mod-kind-icon" title={module.kind}>{MODULE_KIND_ICONS[module.kind] ?? "·"}</span>
                          <div className="mod-row-info">
                            {owned > 0 && <span className="status-chip mod-owned-chip">{owned} owned</span>}
                            {miningSummary && <p className="mod-detail">{miningSummary}</p>}
                            <WeaponDetailsCard module={module} compareTo={compareTo} contextLabel="Market Analysis" compactMode="minimal" />
                          </div>
                          <div className="mod-row-trade">
                            <button
                              type="button"
                              className="mod-trade-btn buy"
                              onClick={() => onBuyModule(module.id)}
                              disabled={licenseLocked}
                              title={licenseLocked ? `Requires pilot license L${requiredLicenseLevel}` : `Buy ${module.name}`}
                            >
                              <span className="mod-trade-label">Buy</span>
                              <span className="mod-trade-price">{buyPrice} cr</span>
                            </button>
                            <button
                              type="button"
                              className="mod-trade-btn sell"
                              onClick={() => onSellModule(module.id)}
                              disabled={owned <= 0}
                              title={owned <= 0 ? "None in inventory" : `Sell ${module.name}`}
                            >
                              <span className="mod-trade-label">Sell</span>
                              <span className="mod-trade-price">{sellPrice} cr</span>
                            </button>
                          </div>
                        </article>
                      );
                    })
                    ) : (
                      <div className="fit-empty-copy">No {slotType} modules stocked here.</div>
                    )}
                  </div>
                </section>
              );
            })}
            </div>
          </div>
        )}

        {/* ── FITTING & BUILDS TAB ── */}
        {tab === "fitting" && (
          <article className="panel-lite fitting-panel">
            <div className="fitting-header">
              <div>
                <h3>Fitting Cradle</h3>
                <p className="fitting-subcopy">
                  {Math.round(currentStats.maxSpeed)}m/s · warp {currentStats.warpSpeed.toFixed(1)}c · lock {Math.round(currentStats.lockRange)}m
                </p>
              </div>
              <div className="fitting-summary-grid">
                <div className="fitting-summary-card">
                  <span>Slots</span>
                  <strong>{currentHull.slots.weapon}/{currentHull.slots.utility}/{currentHull.slots.defense}</strong>
                  <small>W / U / D</small>
                </div>
                <div className="fitting-summary-card">
                  <span>Tank</span>
                  <strong>{roundedShieldMax + roundedArmorMax + roundedHullMax}</strong>
                  <small>shield + armor + hull</small>
                </div>
                <div className="fitting-summary-card">
                  <span>Cap</span>
                  <strong>{Math.round(currentStats.capacitorCapacity)}</strong>
                  <small>{currentStats.capacitorRegen.toFixed(1)}/s regen</small>
                </div>
                <div className="fitting-summary-card">
                  <span>Cargo</span>
                  <strong>{roundedFreeCargo}/{roundedCargoCapacity}</strong>
                  <small>{Math.round(missionCargoUsed)} reserved</small>
                </div>
                <div className="fitting-summary-card">
                  <span>DPS</span>
                  <strong>{equippedWeaponDps > 0 ? equippedWeaponDps.toFixed(1) : "—"}</strong>
                  <small>weapon output</small>
                </div>
              </div>
            </div>
            <div className="ship-frame-shell fitting-shell">
              <div className="ship-frame-glow" />
              <div className="ship-frame-body ship-frame-body--diagram">
                <div className="ship-frame-title">
                  <strong>{playerShipById[world.player.hullId]?.name}</strong>
                  <span>
                    {playerShipById[world.player.hullId]?.shipClass} · {SHIP_ARCHETYPE_LABELS[playerShipById[world.player.hullId]?.archetype ?? ""] ?? playerShipById[world.player.hullId]?.archetype}
                    {" · "}
                    {playerShipById[world.player.hullId]?.role}
                  </span>
                </div>

                <div className="fitting-shell-layout">
                  <div className="fitting-main-stage">
                    <ShipFittingDiagram
                      hull={playerShipById[world.player.hullId]}
                      equipped={world.player.equipped}
                      draggedModuleId={draggedModuleId}
                      hoveredSlotKey={hoveredSlotKey}
                      selectedModuleId={selectedModuleId}
                      activeSlotKey={focusedSlotKey}
                      onSlotHover={setHoveredSlotKey}
                      onSlotDrop={handleSlotDrop}
                      onSlotTap={handleSlotTap}
                      onClearSlot={(slotType, index) => onEquip(slotType, index, null)}
                    />
                  </div>

                  <div className="fitting-inset-column">
                    <section className="fitting-inset-panel">
                      <div className="fitting-inset-head">
                        <strong>Selected Socket</strong>
                        <span>
                          {focusedSlot
                            ? `${focusedSlot.slotType.toUpperCase()} ${focusedSlot.index + 1}`
                            : "Tap a socket to focus its available fits"}
                        </span>
                      </div>
                      {focusedSlot ? (
                        <div className="fitting-slot-picker">
                          <div className="fitting-slot-picker-head">
                            <div>
                              <strong>{focusedEquippedModule?.name ?? "Empty"}</strong>
                              <span>
                                {focusedEquippedModule
                                  ? `${focusedSlotModules.length} compatible modules in storage`
                                  : `${focusedSlotModules.length} available fits for this socket`}
                              </span>
                            </div>
                            <div className="fitting-slot-picker-actions">
                              {focusedEquippedModuleId && (
                                <button
                                  type="button"
                                  className="ghost-button mini"
                                  onClick={() => onEquip(focusedSlot.slotType, focusedSlot.index, null)}
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>
                          {selectedModule && selectedModule.slot === focusedSlot.slotType && (
                            <div className="fit-empty-copy">
                              Dragging {selectedModule.name}. Drop it on the hull socket or use Fit on a card below.
                            </div>
                          )}
                          {focusedSlotModules.length > 0 ? (
                            <div className="fitting-slot-picker-list">
                              {focusedSlotModules.map(({ moduleId, count, module }) => renderFocusedSlotModuleCard(moduleId, count, module))}
                            </div>
                          ) : (
                            <div className="fit-empty-copy">No stored {focusedSlot.slotType} modules available for this socket.</div>
                          )}
                          {unknownOwnedModules.length > 0 && (
                            <div className="fit-empty-copy">
                              {unknownOwnedModules.length} owned module {unknownOwnedModules.length === 1 ? "entry is" : "entries are"} out of sync and could not be rendered.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="fit-empty-copy">Focus a socket on the hull to get a direct module picker for that spot.</div>
                      )}
                    </section>

                    <section className="fitting-inset-panel">
                      <div className="fitting-inset-head">
                        <strong>Build Slots</strong>
                        <span>Save or load 1, 2, 3</span>
                      </div>
                      <div className="build-slot-grid">
                        {world.player.savedBuilds.map((build, index) => (
                          <div key={build.id} className={`build-slot-card${build.savedAt !== null ? " saved" : ""}`}>
                            <div className="build-slot-label">Slot {index + 1}</div>
                            <div className="build-slot-name">{build.savedAt !== null ? (build.name || "Saved build") : "Empty"}</div>
                            <div className="build-slot-actions">
                              <button type="button" className="primary-button" onClick={() => onLoadBuild(build.id)} disabled={build.savedAt === null}>
                                Load
                              </button>
                              <button type="button" onClick={() => onSaveBuild(build.id)}>
                                Save
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </div>
          </article>
        )}

        {/* ── MISSIONS TAB ── */}
        {tab === "missions" && (() => {
          const STATUS_ORDER: Record<string, number> = { available: 0, readyToTurnIn: 1, active: 2, completed: 3, locked: 4 };
          const sortedStoryMissions = [...missionCatalog].sort((a, b) => {
            const aOrd = STATUS_ORDER[world.missions[a.id]?.status ?? "locked"] ?? 9;
            const bOrd = STATUS_ORDER[world.missions[b.id]?.status ?? "locked"] ?? 9;
            return aOrd - bOrd;
          });
          const visibleStoryMissions = showAvailableOnly
            ? sortedStoryMissions.filter(m => {
                const s = world.missions[m.id]?.status;
                return s === "available" || s === "active" || s === "readyToTurnIn";
              })
            : sortedStoryMissions;
          const visibleTransport = showAvailableOnly
            ? transportMissionCatalog.filter(m => world.transportMissions[m.id]?.status !== "completed")
            : transportMissionCatalog;
          return (
          <>
          <div className="missions-filter-bar">
            <button
              type="button"
              className={`filter-toggle-btn${showAvailableOnly ? " active" : ""}`}
              onClick={() => setShowAvailableOnly(v => !v)}
            >
              Available only
            </button>
          </div>
          <div className="missions-grid">
            <article className="panel-lite">
              <CollapsibleSection title="Story Mission Board" subtitle={`${visibleStoryMissions.length} missions`} defaultOpen>
                <div className="stack-list">
                  {visibleStoryMissions.map((mission) => {
                    const state = world.missions[mission.id];
                    const isLocked = state.status === "locked";
                    const isCompleted = state.status === "completed";
                    const missionFactionId = mission.issuerFaction ?? snapshot.sector.controllingFaction;
                    const missionStanding = world.player.factionStandings[missionFactionId] ?? 0;
                    const standingLocked =
                      mission.requiredStanding !== undefined && missionStanding < mission.requiredStanding;
                    const cardClass = `market-item${isLocked || isCompleted ? " mission-card-dim" : ""} mission-status-${state.status}`;
                    return (
                      <div key={mission.id} className={cardClass}>
                        <div className="mission-card-header">
                          <strong className={isLocked || isCompleted ? "mission-title-dim" : ""}>{mission.title}</strong>
                          <div className="mission-card-badges">
                            <span className={`status-chip mission-type-${mission.type}`}>{missionTypeLabel(mission.type)}</span>
                            <span className={`status-chip mission-status-chip-${state.status}`}>{state.status}</span>
                            {mission.issuerFaction ? (
                              <span
                                className="status-chip"
                                style={{
                                  borderColor: factionData[missionFactionId].color,
                                  color: factionData[missionFactionId].color
                                }}
                              >
                                {factionData[missionFactionId].icon} {getFactionStandingLabel(missionStanding)}
                              </span>
                            ) : null}
                            {mission.requiredStanding !== undefined ? (
                              <span className={`status-chip${standingLocked ? " mkt-risk-chip" : ""}`}>
                                Req {mission.requiredStanding.toFixed(2)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {!isLocked && <p>{mission.briefing}</p>}
                        {!isLocked && standingLocked ? (
                          <p style={{ color: "var(--text-dim)" }}>
                            Requires {factionData[missionFactionId].name} standing {mission.requiredStanding?.toFixed(2)}.
                          </p>
                        ) : null}
                        {(state.status === "available" || state.status === "readyToTurnIn") && (
                          <div className="market-actions">
                            {state.status === "available" && (
                              <button type="button" onClick={() => onAcceptMission(mission.id)} disabled={standingLocked}>Accept</button>
                            )}
                            {state.status === "readyToTurnIn" && (
                              <button type="button" className="primary-button" onClick={() => onTurnInMission(mission.id)}>
                                Claim {mission.rewardCredits} cr
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            </article>

            <article className="panel-lite">
              <CollapsibleSection title="Transport Contracts" subtitle={`${visibleTransport.length} jobs`} defaultOpen>
                <div className="stack-list">
                  {visibleTransport.map((mission) => {
                    const state = world.transportMissions[mission.id];
                    if (!state) return null;
                    const route = transportRouteMetrics(mission);
                    const transportStanding = world.player.factionStandings[mission.clientFaction] ?? 0;
                    const standingLocked =
                      mission.requiredStanding !== undefined && transportStanding < mission.requiredStanding;
                    return (
                      <div key={mission.id} className={`market-item mission-status-${state.status}${state.status === "active" ? " mission-active-card" : ""}${state.status === "completed" ? " mission-card-dim" : ""}`}>
                        <div className="mission-card-header">
                          <strong className={state.status === "completed" ? "mission-title-dim" : ""}>{mission.title}</strong>
                          <div className="mission-card-badges">
                            <span className="status-chip mission-type-haul">{missionTypeLabel("haul")}</span>
                            <span className={`status-chip mission-status-chip-${state.status}`}>{transportStatusLabel(state)}</span>
                            <span
                              className="status-chip"
                              style={{
                                borderColor: factionData[mission.clientFaction].color,
                                color: factionData[mission.clientFaction].color
                              }}
                            >
                              {factionData[mission.clientFaction].icon} {getFactionStandingLabel(transportStanding)}
                            </span>
                            {mission.requiredStanding !== undefined ? (
                              <span className={`status-chip${standingLocked ? " mkt-risk-chip" : ""}`}>
                                Req {mission.requiredStanding.toFixed(2)}
                              </span>
                            ) : null}
                            <RiskPips risk={route.risk} />
                            <span className="jump-badge">{route.deliveryJumps}J</span>
                            <span className="reward-badge">
                              {route.rewardEstimate} cr
                            </span>
                          </div>
                        </div>

                        <div className="mission-route">
                          <span>{sectorById[mission.pickupSystemId]?.name ?? mission.pickupSystemId}</span>
                          <span className="route-arrow">→</span>
                          <span>{sectorById[mission.destinationSystemId]?.name ?? mission.destinationSystemId}</span>
                          <span className="status-chip">{getRegionNameForSystem(mission.destinationSystemId)}</span>
                          {route.toPickup > 0 && (
                            <span className="status-chip">+{route.toPickup}J to pickup</span>
                          )}
                        </div>

                        <div className="mission-details">
                          <span className="status-chip">{mission.cargoVolume}u {mission.cargoType}</span>
                          {route.cargoReimbursement > 0 && (
                            <span className="status-chip">reimburses {route.cargoReimbursement} cr</span>
                          )}
                          {state.status === "available" && freeCargo < mission.cargoVolume && (
                            <span className="status-chip mkt-risk-chip">Needs more cargo room</span>
                          )}
                        </div>

                        <div className="market-actions">
                          {state.status === "available" && (
                            <button type="button" onClick={() => onAcceptMission(mission.id)} disabled={standingLocked}>
                              Accept Haul
                            </button>
                          )}
                          {state.status === "active" && (
                            <span className="status-chip">
                              {state.pickedUp ? "Delivering cargo" : "Travel to pickup"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            </article>

            <article className="panel-lite">
              <CollapsibleSection title="Operations Board" subtitle={`${snapshot.availableProceduralContracts.length} rotating contracts`} defaultOpen>
                <div className="stack-list">
                  {snapshot.availableProceduralContracts.map((contract) => {
                    const isActive = snapshot.activeProceduralContract?.id === contract.id;
                    const isOtherActive =
                      snapshot.activeProceduralContract !== null && snapshot.activeProceduralContract.id !== contract.id;
                    const progress = isActive
                      ? Math.round((contractProgressFraction(snapshot.activeProceduralContract!, world.procgen.activeContractState) || 0) * 100)
                      : 0;
                    const contractStanding = world.player.factionStandings[contract.issuerFaction] ?? 0;
                    const standingLocked =
                      contract.requiredStanding !== undefined && contractStanding < contract.requiredStanding;
                    const cargoTooLarge =
                      contract.type === "transport" && freeCargo < (contract.cargoVolume ?? 0);
                    return (
                      <div key={contract.id} className={`market-item${isActive ? " mission-active-card" : ""}`}>
                        <div className="mission-card-header">
                          <strong>{contract.title}</strong>
                          <div className="mission-card-badges">
                            <span className={`status-chip mission-type-${contract.type === "transport" ? "haul" : contract.type}`}>{missionTypeLabel(contract.type === "transport" ? "haul" : contract.type)}</span>
                            <span
                              className="status-chip"
                              style={{
                                borderColor: factionData[contract.issuerFaction].color,
                                color: factionData[contract.issuerFaction].color
                              }}
                            >
                              {factionData[contract.issuerFaction].icon} {getFactionStandingLabel(contractStanding)}
                            </span>
                            {contract.requiredStanding !== undefined ? (
                              <span className={`status-chip${standingLocked ? " mkt-risk-chip" : ""}`}>
                                Req {contract.requiredStanding.toFixed(2)}
                              </span>
                            ) : null}
                            <RiskPips risk={contract.riskLevel} />
                            <span className="reward-badge">
                              {Math.round(contract.rewardCredits + ((contract.cargoVolume ?? 0) * (contract.cargoUnitValue ?? 0)) + (contract.bonusReward ?? 0))} cr
                            </span>
                            {isActive && <span className={`status-chip mission-status-chip-${world.procgen.activeContractState?.status ?? "active"}`}>{world.procgen.activeContractState?.status}</span>}
                          </div>
                        </div>
                        <div className="mission-details">
                          <span className="status-chip">{factionData[contract.issuerFaction].name}</span>
                          <span className="status-chip">{sectorById[contract.targetSystemId]?.name ?? contract.targetSystemId}</span>
                          {contract.targetCount && contract.targetResource && (
                            <span className="status-chip">{contract.targetCount} {contract.targetResource}</span>
                          )}
                          {contract.targetCount && contract.type === "bounty" && (
                            <span className="status-chip">{contract.targetCount} kills</span>
                          )}
                          {contract.cargoVolume && contract.cargoType && (
                            <span className="status-chip">{contract.cargoVolume}u {contract.cargoType}</span>
                          )}
                          {contract.bonusReward && <span className="status-chip">bonus {contract.bonusReward} cr</span>}
                          {isActive && <span className="status-chip">{progress}% progress</span>}
                          {!isActive && cargoTooLarge && <span className="status-chip mkt-risk-chip">Needs more cargo room</span>}
                        </div>
                        <div className="market-actions">
                          {!isActive && (
                            <button type="button" onClick={() => onAcceptMission(contract.id)} disabled={isOtherActive || cargoTooLarge || standingLocked}>
                              Accept Contract
                            </button>
                          )}
                          {isActive && world.procgen.activeContractState?.status === "readyToTurnIn" && (
                            <button type="button" className="primary-button" onClick={() => onTurnInMission(contract.id)}>
                              Claim Payout
                            </button>
                          )}
                          {isActive && world.procgen.activeContractState?.status === "active" && (
                            <span className="status-chip">In progress</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            </article>
          </div>
          </>
          );
        })()}

      </div>
    </div>
  );
}
