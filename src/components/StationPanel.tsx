import { useMemo, useState } from "react";
import { ShipFittingDiagram } from "./ShipFittingDiagram";
import { ShipGeoIcon } from "./ShipGeoIcon";
import { WeaponDetailsCard } from "./WeaponDetailsCard";
import { CommandAction } from "../types/game";
import { missionCatalog } from "../game/data/missions";
import { CollapsibleSection } from "./CollapsibleSection";
import { moduleById, moduleCatalog } from "../game/data/modules";
import { getStationCommodityStock } from "../game/economy/commodityAvailability";
import { isModuleAvailableAtStation } from "../game/economy/moduleAvailability";
import { playerShipById, playerShips } from "../game/data/ships";
import { commodityCatalog } from "../game/economy/data/commodities";
import { getBestSellLocationForCommodity } from "../game/economy/market";
import {
  getPilotLicenseProgressPercent,
  getPilotLicenseProgressRange,
  getRequiredPilotLicenseLevel,
  hasPilotLicenseForModule
} from "../game/utils/pilotLicense";
import { transportMissionCatalog } from "../game/missions/data/transportMissions";
import { estimateRouteRisk, planRoute } from "../game/universe/routePlanning";
import { regionById, sectorById } from "../game/data/sectors";
import { computeDerivedStats, getCargoUsed, getRepairCost } from "../game/utils/stats";
import { findComparableEquippedWeapon, getWeaponSummaryStats } from "../game/utils/weaponStats";
import { CommodityId, GameSnapshot, ModuleSlot, TransportMissionDefinition, TransportMissionState, TransportRisk } from "../types/game";

type StationTab = "services" | "ships" | "market" | "modules" | "fitting" | "missions";
type MarketSortKey = "name" | "category" | "volume" | "owned" | "buyPrice" | "sellPrice" | "profit";

const TAB_LABELS: Record<StationTab, string> = {
  services: "⚙ Services",
  ships:    "◈ Ships",
  market:   "⊞ Market",
  modules:  "⬡ Modules",
  fitting:  "⊕ Fitting",
  missions: "✦ Missions",
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

const SHIP_ARCHETYPE_LABELS: Record<string, string> = {
  skirmisher: "Skirmisher",
  brawler: "Brawler",
  sniper: "Sniper",
  kiter: "Kiter",
  support: "Support",
  hauler: "Hauler",
  miner: "Miner"
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
    <div className="resist-block">
      <span className="resist-block-label">{label}</span>
      <div className="resist-bar-stack">
        {entries.map((entry) => {
          const currentValue = current[entry.key];
          const previewValue = preview[entry.key];
          const delta = previewValue - currentValue;
          return (
            <div
              key={entry.key}
              className={`resist-bar-row resist-${entry.className}${delta > 0.004 ? " good" : delta < -0.004 ? " bad" : ""}`}
              title={`${label} ${entry.short} ${Math.round(previewValue * 100)}%`}
            >
              <span className="resist-bar-label">{entry.short}</span>
              <div className="meter resist-meter">
                <span
                  className={`ship-stat-fill resist-fill resist-${entry.className}`}
                  style={{ width: `${Math.min(100, Math.max(0, previewValue * 100))}%` }}
                />
              </div>
              <span className="resist-bar-value">{Math.round(previewValue * 100)}%</span>
            </div>
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
  onSwitchShip: (shipId: string) => void;
  onSaveBuild: (buildId: "build-1" | "build-2" | "build-3") => void;
  onLoadBuild: (buildId: "build-1" | "build-2" | "build-3") => void;
  onQueueUndockAction: (command: CommandAction) => void;
  onClearUndockQueue: () => void;
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
  onSwitchShip,
  onSaveBuild,
  onLoadBuild,
  onQueueUndockAction,
  onClearUndockQueue
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
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [focusedSlot, setFocusedSlot] = useState<{ slotType: ModuleSlot; index: number } | null>(null);
  const [hoveredSlotKey, setHoveredSlotKey] = useState<string | null>(null);
  const stationTags = currentStation?.tags ?? [];
  const security = snapshot.sector.security;

  function inventoryAllows(tags: string[]) {
    if (tags.includes("common")) return true;
    if (security === "high") {
      return tags.some((tag) => stationTags.includes(tag)) && !tags.includes("frontier") && !tags.includes("high-tech");
    }
    if (security === "medium") {
      return (
        tags.some((tag) => stationTags.includes(tag)) ||
        tags.includes("military") ||
        tags.includes("industrial") ||
        tags.includes("research")
      ) && !tags.includes("frontier");
    }
    return (
      tags.some((tag) => stationTags.includes(tag)) ||
      tags.includes("military") ||
      tags.includes("industrial") ||
      tags.includes("high-tech") ||
      tags.includes("frontier")
    );
  }

  const availableShips = useMemo(
    () => playerShips.filter((ship) => ship.id === world.player.hullId || inventoryAllows(ship.availabilityTags)),
    [security, stationTags, world.player.hullId]
  );
  const availableModules = useMemo(
    () => moduleCatalog.filter((module) => isModuleAvailableAtStation(module, security, currentStation)),
    [security, currentStation?.id]
  );
  const currentHull = playerShipById[world.player.hullId];
  const previewHull = playerShipById[shipPreviewId] ?? currentHull;
  const currentStats = computeDerivedStats(world.player);
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
    () => getStationCommodityStock(commodityCatalog, security, currentStation),
    [currentStation?.id, security]
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

  const plannedCommands: Array<{ label: string; command: CommandAction }> = selectedInfo
    ? selectedInfo.type === "enemy"
      ? [
          { label: "Queue Attack",      command: { type: "attack",  target: selectedInfo.ref } },
          { label: "Queue Approach",    command: { type: "approach", target: selectedInfo.ref } },
          { label: "Queue Orbit 220 m", command: { type: "orbit",   target: selectedInfo.ref, range: 220 } }
        ]
      : selectedInfo.type === "station"
        ? [
            { label: "Queue Warp", command: { type: "warp", target: selectedInfo.ref, range: 130 } },
            { label: "Queue Dock", command: { type: "dock", target: selectedInfo.ref } }
          ]
        : selectedInfo.type === "gate"
          ? [
              { label: "Queue Align", command: { type: "align", target: selectedInfo.ref } },
              { label: "Queue Warp",  command: { type: "warp",  target: selectedInfo.ref, range: 120 } },
              { label: "Queue Jump",  command: { type: "jump",  target: selectedInfo.ref } }
            ]
          : selectedInfo.type === "asteroid"
            ? [
                { label: "Queue Orbit 100 m", command: { type: "orbit", target: selectedInfo.ref, range: 100 } },
                { label: "Queue Mine",         command: { type: "mine",  target: selectedInfo.ref } }
              ]
            : [
                { label: "Queue Warp",    command: { type: "warp",    target: selectedInfo.ref, range: 110 } },
                { label: "Queue Approach", command: { type: "approach", target: selectedInfo.ref } }
              ]
    : [];

  function moduleMiningSummary(module: (typeof moduleCatalog)[number]) {
    if (module.kind !== "mining_laser") return null;
    if (module.minesAllInRange) return "Sweeps all asteroids in range.";
    const targets = module.miningTargets?.length ? module.miningTargets.join(", ") : "any ore";
    return `Mines ${targets}.`;
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
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span className="credit-badge">✦ {world.player.credits.toLocaleString()} cr</span>
          <button type="button" className="primary-button" onClick={onUndock}>Undock</button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="station-tabs">
        {(Object.keys(TAB_LABELS) as StationTab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`station-tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="station-content">

        {/* ── SERVICES TAB ── */}
        {tab === "services" && (
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
                  <span>Cargo Hold</span>
                  <span>{cargoUsed} / {roundedCargoCapacity}u · {roundedFreeCargo} free</span>
                </div>
                <div className="svc-cargo-bar">
                  <div className="svc-cargo-fill" style={{ width: `${cargoPct}%` }} />
                </div>
              </div>
              <div className="license-summary">
                <div className="license-summary-head">
                  <span>Pilot License</span>
                  <span>L{pilotLicense.level} {pilotLicense.level >= 3 ? "· Max" : `· ${pilotLicenseNextTarget}`}</span>
                </div>
                <div className="license-progress-bar">
                  <div className="license-progress-fill" style={{ width: `${pilotLicenseProgress}%` }} />
                </div>
              </div>
              <div className="ship-resist-section">
                <h4>Current Ship Details</h4>
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
                <div className="ship-stat-list svc-ship-stat-list">
                  <div className="ship-stat-item">
                    <span>Speed</span>
                    <StatBar value={currentHull.maxSpeed} max={MAX_SHIP_SPEED} fillClass="speed-fill" />
                    <strong>{currentHull.maxSpeed}</strong>
                    <span className="stat-delta">Live</span>
                  </div>
                  <div className="ship-stat-item">
                    <span>Cargo</span>
                    <StatBar value={currentHull.cargoCapacity} max={MAX_SHIP_CARGO} fillClass="cargo-fill-stat" />
                    <strong>{currentHull.cargoCapacity}</strong>
                    <span className="stat-delta">Live</span>
                  </div>
                  <div className="ship-stat-item">
                    <span>Shield</span>
                    <StatBar value={currentHull.baseShield} max={MAX_SHIP_TANK / 3} fillClass="shield-fill" />
                    <strong>{currentHull.baseShield}</strong>
                    <span className="stat-delta">Live</span>
                  </div>
                  <div className="ship-stat-item">
                    <span>Armor</span>
                    <StatBar value={currentHull.baseArmor} max={MAX_SHIP_TANK / 3} fillClass="armor-fill" />
                    <strong>{currentHull.baseArmor}</strong>
                    <span className="stat-delta">Live</span>
                  </div>
                  <div className="ship-stat-item">
                    <span>Hull</span>
                    <StatBar value={currentHull.baseHull} max={MAX_SHIP_TANK / 3} fillClass="hull-fill" />
                    <strong>{currentHull.baseHull}</strong>
                    <span className="stat-delta">Live</span>
                  </div>
                  <div className="ship-stat-item">
                    <span>Capacitor</span>
                    <StatBar value={currentHull.baseCapacitor} max={MAX_SHIP_CAP} fillClass="cap-fill" />
                    <strong>{currentHull.baseCapacitor}</strong>
                    <span className="stat-delta">Live</span>
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
              <div className="action-row">
                <button type="button" onClick={onRepair}>
                  Repair ({getRepairCost(world.player)} cr)
                </button>
                <button type="button" onClick={onSellCargo}>
                  Sell All Cargo
                </button>
              </div>
            </article>

            <article className="panel-lite">
              <h3>Undock Planner</h3>
              {selectedInfo ? (
                <div className="stack-list">
                  <div className="market-item">
                    <div>
                      <strong>{selectedInfo.name}</strong>
                      <p>{selectedInfo.type} · {Math.round(selectedInfo.distance)} m</p>
                    </div>
                    <div className="market-actions">
                      {plannedCommands.map((item) => (
                        <button key={item.label} type="button" onClick={() => onQueueUndockAction(item.command)}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p>Select an object from the overview to queue undock commands.</p>
              )}
              <div style={{ marginTop: "0.75rem" }}>
                {world.player.queuedUndockActions.length > 0 ? (
                  <div className="queued-action-list">
                    {world.player.queuedUndockActions.map((action, index) => (
                      <span key={`${action.type}-${index}`} className="status-chip">
                        {index + 1}. {action.type.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p>Queue empty.</p>
                )}
              </div>
              <button type="button" className="ghost-button" style={{ marginTop: "0.6rem" }} onClick={onClearUndockQueue}>
                Clear Queue
              </button>
            </article>
          </div>
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
                          <button type="button" onClick={() => onSwitchShip(ship.id)} disabled={active}>
                            {active ? "Active" : "Activate"}
                          </button>
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
            <article className="panel-lite license-panel">
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
            {(["weapon", "utility", "defense"] as ModuleSlot[]).map((slotType, index) => {
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
                <CollapsibleSection
                  key={slotType}
                  title={`${slotType} modules`}
                  subtitle={`${slotModules.length} listings`}
                  defaultOpen={index === 0}
                  className="mod-slot-section"
                >
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
                        <div key={module.id} className={`mod-row kind-${module.kind}${licenseLocked ? " mod-row-locked" : ""}`}>
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
                        </div>
                      );
                    })
                  ) : (
                    <div className="fit-empty-copy">No {slotType} modules stocked here.</div>
                  )}
                </CollapsibleSection>
              );
            })}
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
        {tab === "missions" && (
          <div className="station-grid">
            <article className="panel-lite">
              <CollapsibleSection title="Story Mission Board" subtitle={`${missionCatalog.length} missions`} defaultOpen>
                <div className="stack-list">
                  {missionCatalog.map((mission) => {
                    const state = world.missions[mission.id];
                    return (
                      <div key={mission.id} className="market-item">
                        <div className="mission-card-header">
                          <strong>{mission.title}</strong>
                          <span className="status-chip">{missionTypeLabel(mission.type)}</span>
                          <span className="status-chip">{state.status}</span>
                        </div>
                        <p>{mission.briefing}</p>
                        <div className="market-actions">
                          {state.status === "available" && (
                            <button type="button" onClick={() => onAcceptMission(mission.id)}>Accept</button>
                          )}
                          {state.status === "readyToTurnIn" && (
                            <button type="button" className="primary-button" onClick={() => onTurnInMission(mission.id)}>
                              Claim {mission.rewardCredits} cr
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            </article>

            <article className="panel-lite">
              <CollapsibleSection title="Transport Contracts" subtitle={`${transportMissionCatalog.length} jobs`} defaultOpen>
                <div className="stack-list">
                  {transportMissionCatalog.map((mission) => {
                    const state = world.transportMissions[mission.id];
                    if (!state) return null;
                    const route = transportRouteMetrics(mission);
                    return (
                      <div key={mission.id} className={`market-item${state.status === "active" ? " mission-active-card" : ""}`}>
                        <div className="mission-card-header">
                          <strong>{mission.title}</strong>
                          <div className="mission-card-badges">
                            <span className="status-chip">{missionTypeLabel("haul")}</span>
                            <span className="status-chip">{transportStatusLabel(state)}</span>
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

                        <p style={{ fontSize: "0.76rem", color: "var(--text-dim)", margin: 0 }}>{mission.description}</p>

                        <div className="market-actions">
                          {state.status === "available" && (
                            <button type="button" onClick={() => onAcceptMission(mission.id)}>
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
          </div>
        )}

      </div>
    </div>
  );
}
