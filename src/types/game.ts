export type FactionId = "aurelian-league" | "cinder-union" | "veilborn";

export type ResourceId = "ferrite" | "ember-crystal" | "ghost-alloy";
export type CommodityId =
  | "food-supplies"
  | "industrial-parts"
  | "fuel-cells"
  | "medical-supplies"
  | "electronics"
  | "weapons-components"
  | "refined-alloys"
  | "frontier-survival-kits"
  | "luxury-goods"
  | "salvage-scrap";
export type CommodityCategory =
  | "essentials"
  | "industrial"
  | "energy"
  | "medical"
  | "technology"
  | "military"
  | "materials"
  | "frontier"
  | "luxury"
  | "salvage";

export type ModuleSlot = "weapon" | "utility" | "defense";
export type ShipClass = "frigate" | "destroyer" | "cruiser" | "industrial";
export type ShipArchetype = "skirmisher" | "brawler" | "sniper" | "kiter" | "support" | "hauler" | "miner";
export type ModuleCategory = "weapon" | "defense" | "propulsion" | "control" | "utility" | "mining" | "passive";
export type SizeClass = "light" | "medium" | "heavy";
export type RoleTag =
  | "Skirmisher"
  | "Brawler"
  | "Sniper"
  | "Kiter"
  | "Control"
  | "Hauler"
  | "Miner"
  | "Missile"
  | "Laser"
  | "Rail"
  | "Shield"
  | "Armor"
  | "Support";

export type MissionType = "bounty" | "mining" | "deliver" | "travel";
export type TransportRisk = "low" | "medium" | "high" | "extreme";

export type SecurityBand = "high" | "medium" | "low" | "frontier";

export type DestinationKind =
  | "station"
  | "gate"
  | "belt"
  | "beacon"
  | "anomaly"
  | "outpost"
  | "wreck";

export type SpaceObjectType =
  | "enemy"
  | "asteroid"
  | "loot"
  | "station"
  | "gate"
  | "beacon"
  | "belt"
  | "anomaly"
  | "outpost"
  | "wreck";

export type NavigationMode =
  | "idle"
  | "approach"
  | "keep_range"
  | "retreat"
  | "orbit"
  | "align"
  | "warping"
  | "docking"
  | "jumping";

export type ModuleKind =
  | "laser"
  | "railgun"
  | "missile"
  | "afterburner"
  | "webifier"
  | "target_painter"
  | "tracking_disruptor"
  | "sensor_dampener"
  | "shield_booster"
  | "armor_repairer"
  | "hardener"
  | "mining_laser"
  | "salvager"
  | "passive";

export type RoutePreference = "shortest" | "safer";
export type DifficultyId = "easy" | "normal" | "hard";
export type DamageType = "em" | "thermal" | "kinetic" | "explosive";
export type BuildSlotId = "build-1" | "build-2" | "build-3";
export type StarterShipConfigId =
  | "balanced-patrol"
  | "missile-runner"
  | "ore-hound"
  | "wreck-diver";

export type CommandAction =
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
  | { type: "show_info"; target: SelectableRef };

export interface Vec2 {
  x: number;
  y: number;
}

export interface DamageProfile {
  em: number;
  thermal: number;
  kinetic: number;
  explosive: number;
}

export interface ResistProfile {
  em: number;
  thermal: number;
  kinetic: number;
  explosive: number;
}

export interface SelectableRef {
  id: string;
  type: SpaceObjectType;
}

export interface RegionDefinition {
  id: string;
  name: string;
  description: string;
  security: SecurityBand;
  dominantFaction: FactionId;
  resourceProfile: ResourceId[];
  gameplayRole: string;
  color: string;
}

export interface SystemDestination {
  id: string;
  name: string;
  kind: DestinationKind;
  position: Vec2;
  warpable: boolean;
  dockable?: boolean;
  hostileActivity?: boolean;
  resource?: ResourceId;
  description: string;
  connectedSystemId?: string;
  arrivalGateId?: string;
  unlockMissionId?: string;
  tags?: string[];
}

export interface ShipHullDefinition {
  id: string;
  name: string;
  shipClass: ShipClass;
  archetype: ShipArchetype;
  faction: FactionId;
  role: string;
  roleTags: RoleTag[];
  description: string;
  price: number;
  color: string;
  silhouette: "dart" | "wing" | "heavy" | "needle" | "wedge" | "kite" | "box" | "claw";
  availabilityTags: string[];
  slots: Record<ModuleSlot, number>;
  baseShield: number;
  baseArmor: number;
  baseHull: number;
  shieldRegen: number;
  baseCapacitor: number;
  capacitorRegen: number;
  acceleration: number;
  turnSpeed: number;
  maxSpeed: number;
  lockRange: number;
  warpSpeed: number;
  cargoCapacity: number;
  interactionRange: number;
  signatureRadius: number;
  shieldResists: ResistProfile;
  armorResists: ResistProfile;
  hullResists: ResistProfile;
  bonuses?: ShipBonusProfile;
}

export interface ShipModuleBonusProfile {
  damageMultiplier?: number;
  cycleMultiplier?: number;
  miningYieldMultiplier?: number;
  repairAmountMultiplier?: number;
  capacitorUseMultiplier?: number;
  capacitorDrainMultiplier?: number;
  turretTrackingMultiplier?: number;
  turretOptimalMultiplier?: number;
  turretFalloffMultiplier?: number;
}

export interface ShipBonusProfile {
  cargoCapacity?: number;
  cargoCapacityMultiplier?: number;
  miningYieldMultiplier?: number;
  commodityBuyMultiplier?: number;
  commoditySellMultiplier?: number;
  resourceSellMultiplier?: number;
  moduleBuyMultiplier?: number;
  moduleSellMultiplier?: number;
  shipBuyMultiplier?: number;
  moduleKinds?: Partial<Record<ModuleKind, ShipModuleBonusProfile>>;
}

export interface ModuleDefinition {
  id: string;
  name: string;
  techLevel?: number;
  classTier?: "civilian" | "tech";
  slot: ModuleSlot;
  category: ModuleCategory;
  kind: ModuleKind;
  sizeClass?: SizeClass;
  price: number;
  description: string;
  tags: string[];
  roleTags?: RoleTag[];
  activation: "toggle" | "cycle" | "passive";
  requiresTarget?: SpaceObjectType[];
  cycleTime?: number;
  range?: number;
  optimal?: number;
  falloff?: number;
  capacitorUse?: number;
  capacitorDrain?: number;
  damage?: number;
  damageProfile?: DamageProfile;
  repairAmount?: number;
  miningAmount?: number;
  miningTargets?: ResourceId[];
  minesAllInRange?: boolean;
  speedBonus?: number;
  resistBonus?: number;
  speedPenalty?: number;
  signatureBonus?: number;
  trackingPenalty?: number;
  lockRangePenalty?: number;
  tracking?: number;
  signatureResolution?: number;
  weaponClass?: SizeClass;
  modifiers: {
    maxShield?: number;
    maxArmor?: number;
    maxHull?: number;
    shieldRegen?: number;
    cargoCapacity?: number;
    capacitorCapacity?: number;
    capacitorRegen?: number;
    maxSpeed?: number;
    lockRange?: number;
    warpSpeed?: number;
    turretTrackingMultiplier?: number;
    turretOptimalMultiplier?: number;
    turretFalloffMultiplier?: number;
    shieldResistBonus?: number;
    armorResistBonus?: number;
    hullResistBonus?: number;
    miningYieldMultiplier?: number;
    laserDamageMultiplier?: number;
    railgunDamageMultiplier?: number;
    missileDamageMultiplier?: number;
    laserCycleMultiplier?: number;
    railgunCycleMultiplier?: number;
    missileCycleMultiplier?: number;
  };
  activeModifiers?: {
    maxShield?: number;
    maxArmor?: number;
    maxHull?: number;
    shieldRegen?: number;
    cargoCapacity?: number;
    capacitorCapacity?: number;
    capacitorRegen?: number;
    maxSpeed?: number;
    lockRange?: number;
    warpSpeed?: number;
    turretTrackingMultiplier?: number;
    turretOptimalMultiplier?: number;
    turretFalloffMultiplier?: number;
    shieldResistBonus?: number;
    armorResistBonus?: number;
    hullResistBonus?: number;
    miningYieldMultiplier?: number;
    laserDamageMultiplier?: number;
    railgunDamageMultiplier?: number;
    missileDamageMultiplier?: number;
    laserCycleMultiplier?: number;
    railgunCycleMultiplier?: number;
    missileCycleMultiplier?: number;
  };
}

export interface CombatEffectsState {
  speedMultiplier: number;
  signatureMultiplier: number;
  turretTrackingMultiplier: number;
  lockRangeMultiplier: number;
}

export interface EnemyVariant {
  id: string;
  name: string;
  faction: FactionId;
  color: string;
  silhouette: "dart" | "wing" | "heavy" | "needle" | "wedge" | "kite" | "box" | "claw";
  combatStyle: "shield" | "armor" | "speed";
  shield: number;
  armor: number;
  hull: number;
  capacitor: number;
  capacitorRegen: number;
  speed: number;
  turnSpeed: number;
  lockRange: number;
  preferredRange: number;
  lootCredits: number;
  lootTable: Partial<Record<ResourceId, number>>;
  fittedModules: string[];
  signatureRadius: number;
  shieldResists: ResistProfile;
  armorResists: ResistProfile;
  hullResists: ResistProfile;
}

export interface EnemySpawnDefinition {
  variantId: string;
  count: number;
  center: Vec2;
  radius: number;
}

export interface AsteroidFieldDefinition {
  beltId: string;
  center: Vec2;
  count: number;
  resource: ResourceId;
  spread: number;
  richness: number;
  hostileSpawnChance?: number;
  hostileSpawnCount?: number;
  hostileSpawnVariantIds?: string[];
}

export interface SolarSystemDefinition {
  id: string;
  name: string;
  regionId: string;
  security: SecurityBand;
  danger: number;
  description: string;
  flavorText: string;
  controllingFaction: FactionId;
  visualTheme: string;
  economyTags: string[];
  missionTags: string[];
  traffic: "low" | "medium" | "high";
  population: string;
  width: number;
  height: number;
  backdrop: {
    nebula: string;
    dust: string;
  };
  mapPosition: Vec2;
  destinations: SystemDestination[];
  neighbors: string[];
  asteroidFields: AsteroidFieldDefinition[];
  enemySpawns: EnemySpawnDefinition[];
}

export interface MissionDefinition {
  id: string;
  title: string;
  type: MissionType;
  briefing: string;
  rewardCredits: number;
  requiredMissionId?: string;
  unlockSystemId?: string;
  targetCount?: number;
  targetResource?: ResourceId;
  targetSystemId?: string;
  targetDestinationId?: string;
  targetStationId?: string;
  enemyVariantIds?: string[];
}

export interface TransportMissionDefinition {
  id: string;
  title: string;
  description: string;
  cargoType: string;
  cargoVolume: number;
  cargoUnitValue?: number;
  pickupStationId: string;
  pickupSystemId: string;
  destinationStationId: string;
  destinationSystemId: string;
  baseReward: number;
  bonusReward?: number;
  bonusTimeLimitSec?: number;
  riskLevel: TransportRisk;
  clientFaction: FactionId;
  routePreference: RoutePreference;
  requiredMissionId?: string;
  variant: "standard" | "urgent" | "frontier" | "short-hop" | "bulk" | "pickup-return";
}

export interface CommodityDefinition {
  id: CommodityId;
  name: string;
  category: CommodityCategory;
  basePrice: number;
  volume: number;
  riskTag?: "legal" | "restricted" | "volatile";
  tags: string[];
}

export interface StationMarketProfile {
  stationId: string;
  supplyTags: string[];
  demandTags: string[];
  buyMultiplier: number;
  sellMultiplier: number;
  inventoryBias: number;
}

export interface Inventory {
  modules: Record<string, number>;
}

export interface MissionCargoEntry {
  missionId: string;
  cargoType: string;
  volume: number;
}

export interface EquippedLoadout {
  weapon: Array<string | null>;
  utility: Array<string | null>;
  defense: Array<string | null>;
}

export interface StarterShipConfig {
  id: StarterShipConfigId;
  name: string;
  shipId: string;
  summary: string;
  description: string;
  equipped: EquippedLoadout;
}

export interface SavedBuild {
  id: BuildSlotId;
  name: string;
  shipId: string;
  equipped: EquippedLoadout;
  savedAt: number | null;
}

export interface BuildSwapState {
  active: boolean;
  targetBuildId: BuildSlotId | null;
  targetBuildName: string | null;
  targetShipId: string | null;
  targetEquipped: EquippedLoadout | null;
  duration: number;
  remaining: number;
  changedModuleCount: number;
}

export interface ModuleRuntimeState {
  moduleId: string | null;
  active: boolean;
  cycleRemaining: number;
  autoRepeat: boolean;
}

export interface NavigationState {
  mode: NavigationMode;
  target: SelectableRef | null;
  desiredRange: number;
  destination: Vec2 | null;
  warpFrom: Vec2 | null;
  warpProgress: number;
}

export interface RouteStep {
  fromSystemId: string;
  toSystemId: string;
  gateId: string;
  gateName: string;
  security: SecurityBand;
}

export interface RoutePlan {
  destinationSystemId: string;
  destinationDestinationId?: string;
  preference: RoutePreference;
  autoFollow: boolean;
  steps: RouteStep[];
}

export interface PlayerState {
  starterConfigId: StarterShipConfigId;
  hullId: string;
  ownedShips: string[];
  position: Vec2;
  velocity: Vec2;
  rotation: number;
  shield: number;
  armor: number;
  hull: number;
  capacitor: number;
  cargo: Record<ResourceId, number>;
  commodities: Record<CommodityId, number>;
  missionCargo: MissionCargoEntry[];
  credits: number;
  inventory: Inventory;
  equipped: EquippedLoadout;
  modules: Record<ModuleSlot, ModuleRuntimeState[]>;
  navigation: NavigationState;
  queuedUndockActions: CommandAction[];
  effects: CombatEffectsState;
  savedBuilds: SavedBuild[];
  buildSwap: BuildSwapState;
  recentDamageTimer: number;
}

export interface EnemyState {
  id: string;
  variantId: string;
  position: Vec2;
  velocity: Vec2;
  rotation: number;
  shield: number;
  armor: number;
  hull: number;
  capacitor: number;
  patrolBehavior: "stationary" | "anchor-patrol" | "roaming";
  patrolAnchor: Vec2;
  patrolTarget: Vec2 | null;
  navigation: NavigationState;
  lockedTargets: SelectableRef[];
  activeTarget: SelectableRef | null;
  modules: ModuleRuntimeState[];
  effects: CombatEffectsState;
  recentDamageTimer: number;
}

export interface AsteroidState {
  id: string;
  beltId: string;
  position: Vec2;
  radius: number;
  resource: ResourceId;
  oreRemaining: number;
}

export interface ProjectileState {
  id: string;
  owner: "player" | "enemy";
  moduleId: string;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  damage: number;
  ttl: number;
  target?: SelectableRef | null;
  qualityLabel?: "miss" | "grazing" | "solid" | "excellent";
}

export interface LootDropState {
  id: string;
  position: Vec2;
  velocity: Vec2;
  credits: number;
  resources: Partial<Record<ResourceId, number>>;
  commodities?: Partial<Record<CommodityId, number>>;
}

export interface WreckState {
  id: string;
  position: Vec2;
  credits: number;
  resources: Partial<Record<ResourceId, number>>;
  commodities: Partial<Record<CommodityId, number>>;
  sourceName: string;
  modules: string[];
}

export interface FloatingText {
  id: string;
  position: Vec2;
  text: string;
  color: string;
  ttl: number;
}

export interface MissionState {
  missionId: string;
  status: "locked" | "available" | "active" | "readyToTurnIn" | "completed";
  progress: number;
}

export interface TransportMissionState {
  missionId: string;
  status: "locked" | "available" | "active" | "readyToTurnIn" | "completed";
  pickedUp: boolean;
  delivered: boolean;
  rewardClaimed?: boolean;
  acceptedAt: number | null;
  dueAt: number | null;
  rewardEstimate: number;
}

export interface SectorRuntime {
  enemies: EnemyState[];
  asteroids: AsteroidState[];
  projectiles: ProjectileState[];
  loot: LootDropState[];
  wrecks: WreckState[];
  floatingText: FloatingText[];
}

export interface DerivedShipStats {
  maxHull: number;
  maxShield: number;
  maxArmor: number;
  shieldRegen: number;
  capacitorCapacity: number;
  capacitorRegen: number;
  acceleration: number;
  turnSpeed: number;
  maxSpeed: number;
  maxSpeedWithAfterburner: number;
  lockRange: number;
  warpSpeed: number;
  cargoCapacity: number;
  interactionRange: number;
  miningYieldMultiplier: number;
  shieldRepairAmountMultiplier: number;
  armorRepairAmountMultiplier: number;
  commodityBuyMultiplier: number;
  commoditySellMultiplier: number;
  resourceSellMultiplier: number;
  moduleBuyMultiplier: number;
  moduleSellMultiplier: number;
  shipBuyMultiplier: number;
  turretTrackingMultiplier: number;
  turretOptimalMultiplier: number;
  turretFalloffMultiplier: number;
  laserDamageMultiplier: number;
  railgunDamageMultiplier: number;
  missileDamageMultiplier: number;
  laserCycleMultiplier: number;
  railgunCycleMultiplier: number;
  missileCycleMultiplier: number;
  shieldResists: ResistProfile;
  armorResists: ResistProfile;
  hullResists: ResistProfile;
}

export interface ObjectInfo {
  ref: SelectableRef;
  name: string;
  type: SpaceObjectType;
  position: Vec2;
  distance: number;
  velocity: number;
  angularVelocity?: number;
  signatureRadius?: number;
  subtitle?: string;
  factionLabel?: string;
  threatLabel?: string;
  combatProfileLabel?: string;
  combatProfileTone?: "shield" | "armor" | "speed";
  weaknessLabel?: string;
  preferredRange?: number;
  armorPercent?: number;
  hullPercent?: number;
  shieldPercent?: number;
  shieldResists?: ResistProfile;
  armorResists?: ResistProfile;
  hullResists?: ResistProfile;
  oreRemaining?: number;
  lootCredits?: number;
}

export interface OverviewEntry extends ObjectInfo {}

export interface GameWorld {
  player: PlayerState;
  difficulty: DifficultyId;
  currentSectorId: string;
  unlockedSectorIds: string[];
  sectors: Record<string, SectorRuntime>;
  missions: Record<string, MissionState>;
  transportMissions: Record<string, TransportMissionState>;
  dockedStationId: string | null;
  selectedObject: SelectableRef | null;
  lockedTargets: SelectableRef[];
  activeTarget: SelectableRef | null;
  storyLog: string[];
  routePlan: RoutePlan | null;
  elapsedTime: number;
}

export interface TransportTracker {
  missionId: string;
  title: string;
  objective: "pickup" | "deliver";
  objectiveText: string;
  objectiveSystemId: string;
  objectiveStationId: string;
  cargoType: string;
  cargoVolume: number;
  cargoOnboard: number;
  pickupSystemId: string;
  pickupStationName: string;
  pickupSystemName: string;
  destinationSystemId: string;
  destinationStationName: string;
  destinationSystemName: string;
  jumpsRemaining: number;
  nextGateId: string | null;
  nextGateName: string | null;
  routeSystemIds: string[];
  routeRisk: TransportRisk;
  baseReward: number;
  bonusReward: number;
  cargoReimbursement: number;
  rewardEstimate: number;
  cargoFitLabel: string;
  dueInSec: number | null;
  recommendedRoute: RoutePreference;
}

export interface EconomySnapshot {
  resourceSellPrices: Record<ResourceId, number>;
  commodityBuyPrices: Record<CommodityId, number>;
  commoditySellPrices: Record<CommodityId, number>;
  moduleBuyPrices: Record<string, number>;
  moduleSellPrices: Record<string, number>;
  shipBuyPrices: Record<string, number>;
}

export interface GameSnapshot {
  world: GameWorld;
  derived: DerivedShipStats;
  sector: SolarSystemDefinition;
  currentRegion: RegionDefinition;
  currentStation: SystemDestination | null;
  activeMission: MissionDefinition | null;
  selectedInfo: ObjectInfo | null;
  activeTargetInfo: ObjectInfo | null;
  lockedTargetInfos: ObjectInfo[];
  overview: OverviewEntry[];
  navLabel: string;
  nearbyPrompt: string | null;
  nextRouteStep: RouteStep | null;
  buildMatchId: BuildSlotId | null;
  activeTransportMission: TransportTracker | null;
  economy: EconomySnapshot;
}
