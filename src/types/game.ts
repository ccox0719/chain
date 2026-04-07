export type FactionId =
  | "aurelian-league"
  | "cinder-union"
  | "veilborn"
  | "helion-cabal"
  | "ironbound-syndicate"
  | "blackwake-clans";

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
  | "salvage-scrap"
  | "coolant-gel"
  | "reactor-coils"
  | "drone-parts"
  | "archive-shards"
  | "siege-stims";
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
export type EnemyArchetypeId =
  | "swarm"
  | "siege_sniper"
  | "heavy_bruiser"
  | "interceptor"
  | "support_frigate"
  | "missile_skirmisher"
  | "artillery"
  | "hunter";
export type HostilePackRole =
  | "swarm"
  | "tackle"
  | "sniper"
  | "brawler"
  | "support"
  | "skirmisher"
  | "anchor"
  | "escort"
  | "artillery"
  | "hunter";
export type CombatObjective = "standard" | "survive" | "clear" | "intercept" | "defend";
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
  | "Cannon"
  | "Shield"
  | "Armor"
  | "Support";

export type MissionType = "bounty" | "mining" | "deliver" | "travel";
export type TransportRisk = "low" | "medium" | "high" | "extreme";
export type ProceduralContractType = "transport" | "mining" | "bounty";

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
  | "boundary_return"
  | "warping"
  | "docking"
  | "jumping";

export type ModuleKind =
  | "laser"
  | "railgun"
  | "missile"
  | "cannon"
  | "afterburner"
  | "webifier"
  | "warp_disruptor"
  | "target_painter"
  | "tracking_disruptor"
  | "sensor_dampener"
  | "energy_neutralizer"
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
export type StationIdentityId =
  | "trade-hub"
  | "military-outpost"
  | "industrial-station"
  | "mining-support"
  | "frontier-outpost"
  | "logistics-depot"
  | "research-exchange"
  | "salvage-den";
export type StarterShipConfigId =
  | "balanced-patrol"
  | "missile-runner"
  | "ore-hound"
  | "wreck-diver";

export type CommandAction =
  | { type: "approach"; target: SelectableRef; range?: number }
  | { type: "travel"; destination: Vec2 }
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

export type WeaponDefinition = ModuleDefinition & {
  slot: "weapon";
  damage: number;
  damageProfile: DamageProfile;
};

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
  secondaryFactions?: FactionId[];
  shipAccessPolicy?: "native" | "mixed" | "restricted" | "smuggler-friendly";
  resourceProfile: ResourceId[];
  gameplayRole: string;
  identitySummary: string;
  prepAdvice: string;
  color: string;
  threatSummary?: string;
  marketIdentity?: string[];
  missionIdentity?: string[];
  enemyIdentity?: string[];
  stationIdentity?: string[];
  localShipFamilies?: string[];
  wartimeRole?: "rear-core" | "staging" | "border-corridor" | "frontline" | "raid-march" | "deep-wild" | "relic-zone";
  frontlineStatus?: "rear" | "staging" | "contested" | "frontline" | "raided" | "deep-wild" | "relic";
  mobilizationPriority?: "low" | "medium" | "high";
  occupationRisk?: "low" | "medium" | "high";
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
  anomalyField?: {
    effect: "push" | "pull" | "drag" | "ion" | "slipstream";
    radius: number;
    strength: number;
    debrisCount?: number;
    tint?: string;
  };
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
  shieldResistBonus?: number;
  armorResistBonus?: number;
  hullResistBonus?: number;
  shieldResistProfile?: Partial<ResistProfile>;
  armorResistProfile?: Partial<ResistProfile>;
  hullResistProfile?: Partial<ResistProfile>;
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
  shipSellMultiplier?: number;
  moduleKinds?: Partial<Record<ModuleKind, ShipModuleBonusProfile>>;
}

export interface FactionThreatProfile {
  damage: DamageProfile;
  resist: ResistProfile;
  tankStyle: "shield" | "armor" | "mixed";
  doctrine: string[];
}

export interface FactionDefinition {
  id: FactionId;
  name: string;
  description: string;
  loreBlurb: string;
  visualIdentity: string;
  color: string;
  icon: string;
  preferredDamageProfile: DamageProfile;
  preferredResistanceProfile: ResistProfile;
  tankStyle: "shield" | "armor" | "mixed";
  doctrineTags: string[];
  doctrineSummary: string;
  enemyArchetypePreferences: string[];
  prepAdvice: string;
  regions: string[];
  threatSummary: string;
  homeRegions?: string[];
  civilianCulture?: string;
  stationTone?: string;
  marketBias?: string[];
  legalStyle?: "strict" | "contractual" | "loose" | "technical" | "customs" | "criminal";
  shipFamilies?: string[];
  allies?: FactionId[];
  rivals?: FactionId[];
  warAims?: string[];
  recruitmentStyle?: string;
  fleetIdentity?: string;
  serviceBranches?: string[];
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
  reloadTime?: number;
  range?: number;
  optimal?: number;
  falloff?: number;
  projectileSpeed?: number;
  capacitorUse?: number;
  capacitorDrain?: number;
  damage?: number;
  damageProfile?: DamageProfile;
  ammoType?: string;
  magazineSize?: number;
  repairAmount?: number;
  miningAmount?: number;
  miningYieldMultiplier?: number;
  miningTier?: number;
  salvageYieldMultiplier?: number;
  miningTargets?: ResourceId[];
  minesAllInRange?: boolean;
  autoMine?: boolean;
  autoSalvage?: boolean;
  speedBonus?: number;
  resistBonus?: number;
  resistLayer?: "shield" | "armor" | "hull";
  resistProfile?: Partial<ResistProfile>;
  resistMode?: "specific" | "adaptive" | "reactive";
  speedPenalty?: number;
  warpDisruptStrength?: number;
  signatureBonus?: number;
  trackingPenalty?: number;
  lockRangePenalty?: number;
  capacitorNeutralizeAmount?: number;
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
    shieldRepairAmountMultiplier?: number;
    armorRepairAmountMultiplier?: number;
    commodityBuyMultiplier?: number;
    commoditySellMultiplier?: number;
    resourceSellMultiplier?: number;
    moduleBuyMultiplier?: number;
    moduleSellMultiplier?: number;
    shipBuyMultiplier?: number;
    shipSellMultiplier?: number;
    turretTrackingMultiplier?: number;
    turretOptimalMultiplier?: number;
    turretFalloffMultiplier?: number;
    shieldResistBonus?: number;
    armorResistBonus?: number;
    hullResistBonus?: number;
    shieldResistProfile?: Partial<ResistProfile>;
    armorResistProfile?: Partial<ResistProfile>;
    hullResistProfile?: Partial<ResistProfile>;
    miningYieldMultiplier?: number;
    salvageYieldMultiplier?: number;
    laserDamageMultiplier?: number;
    railgunDamageMultiplier?: number;
    missileDamageMultiplier?: number;
    cannonDamageMultiplier?: number;
    laserCycleMultiplier?: number;
    railgunCycleMultiplier?: number;
    missileCycleMultiplier?: number;
    cannonCycleMultiplier?: number;
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
    shieldRepairAmountMultiplier?: number;
    armorRepairAmountMultiplier?: number;
    commodityBuyMultiplier?: number;
    commoditySellMultiplier?: number;
    resourceSellMultiplier?: number;
    moduleBuyMultiplier?: number;
    moduleSellMultiplier?: number;
    shipBuyMultiplier?: number;
    shipSellMultiplier?: number;
    turretTrackingMultiplier?: number;
    turretOptimalMultiplier?: number;
    turretFalloffMultiplier?: number;
    shieldResistBonus?: number;
    armorResistBonus?: number;
    hullResistBonus?: number;
    shieldResistProfile?: Partial<ResistProfile>;
    armorResistProfile?: Partial<ResistProfile>;
    hullResistProfile?: Partial<ResistProfile>;
    miningYieldMultiplier?: number;
    salvageYieldMultiplier?: number;
    laserDamageMultiplier?: number;
    railgunDamageMultiplier?: number;
    missileDamageMultiplier?: number;
    cannonDamageMultiplier?: number;
    laserCycleMultiplier?: number;
    railgunCycleMultiplier?: number;
    missileCycleMultiplier?: number;
    cannonCycleMultiplier?: number;
  };
}

export interface CombatEffectsState {
  speedMultiplier: number;
  signatureMultiplier: number;
  turretTrackingMultiplier: number;
  lockRangeMultiplier: number;
  capacitorRegenMultiplier: number;
}

export interface TacticalSlowState {
  activeRemaining: number;
  cooldownRemaining: number;
  capPenaltyRemaining: number;
  speedPenaltyRemaining: number;
}

export type PocketType = "transit" | "station" | "gate" | "belt" | "anomaly" | "mission" | "wreck";
export type BoundaryTone = "transit" | "station" | "gate" | "belt" | "anomaly" | "mission" | "wreck";
export type BoundaryZone = "active" | "buffer" | "containment" | "recovery";

export interface BoundaryProfile {
  id: string;
  type: PocketType;
  center: Vec2;
  activeRadius: number;
  bufferRadius: number;
  containmentRadius: number;
  recoveryReleaseRadius: number;
  pullStrength: number;
  dampingStrength: number;
  turnAssistStrength: number;
  zoneType: BoundaryTone;
  visualLabel: string;
  title: string;
  detail: string;
}

export interface BoundaryReturnState {
  active: boolean;
  releaseRadius: number;
  suspendedNav: NavigationState | null;
  recoveryPoint: Vec2 | null;
  pocketId: string | null;
  reason: string | null;
}

export interface BoundaryState {
  profile: BoundaryProfile;
  warningLevel: number;
  correctionLevel: number;
  active: boolean;
  zone: BoundaryZone;
  title: string | null;
  detail: string | null;
  tone: BoundaryTone;
  forcedFacing: number | null;
  forcedTurnRate: number;
  returnState: BoundaryReturnState;
}

export interface DeathSummary {
  id: string;
  shipId: string;
  shipName: string;
  respawnStationId: string;
  respawnStationName: string;
  respawnSystemId: string;
  respawnSystemName: string;
  wreckSystemId: string;
  wreckSystemName: string;
  wreckPosition: Vec2;
  droppedCredits: number;
  flatFee: number;
  lostCredits: number;
  lostLicenseProgress: number;
}

export interface EnemyVariant {
  id: string;
  name: string;
  faction: FactionId;
  archetype: EnemyArchetypeId;
  roleTags: RoleTag[];
  color: string;
  silhouette: "dart" | "wing" | "heavy" | "needle" | "wedge" | "kite" | "box" | "claw";
  combatStyle: "shield" | "armor" | "speed";
  threatLevel: number;
  elite?: boolean;
  eliteTitle?: string;
  boss?: boolean;
  bossTitle?: string;
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
  recoveryRate?: number;
  depletionRate?: number;
  hiddenPocketChance?: number;
}

export type SystemEcologyStateId =
  | "stable"
  | "exploited"
  | "tense"
  | "overmined"
  | "suppressed"
  | "militarized"
  | "scavenger_rich"
  | "recovering"
  | "rerouted"
  | "frontier_rush";

export interface AsteroidFieldRuntimeState {
  beltId: string;
  reserve: number;
  density: number;
  richness: number;
  depletionPressure: number;
  recoveryTimer: number;
  desiredCount: number;
  maxCount: number;
  hiddenPocketChance: number;
}

export interface SystemEcology {
  state: SystemEcologyStateId;
  asteroidReserve: number;
  hostilePressure: number;
  patrolPressure: number;
  scavengerPressure: number;
  tradeActivity: number;
  missionReserve: number;
  depletionPressure: number;
  reinforcementBudget: number;
  recoveryProgress: number;
  lastIncidentAt: number;
  lastStateChangeAt: number;
  nearbyInfluence: {
    pirateBias: number;
    militaryBias: number;
    miningBias: number;
    salvageBias: number;
    tradeBias: number;
  };
  ambientRespawnTimer: number;
  missionSpawnTimer: number;
}

export interface SolarSystemDefinition {
  id: string;
  name: string;
  regionId: string;
  security: SecurityBand;
  danger: number;
  description: string;
  identityLabel: string;
  gameplayPurpose: string;
  prepAdvice: string;
  flavorText: string;
  controllingFaction: FactionId;
  factionInfluence?: number;
  contestedFactionIds?: FactionId[];
  threatSummary?: string;
  theaterTag?: "rear" | "staging" | "border" | "frontline" | "raid" | "deep-wild" | "relic";
  frontlinePressure?: "low" | "medium" | "high" | "extreme";
  supplyLineImportance?: "low" | "medium" | "high";
  chartStatus?: "charted" | "partial" | "restricted" | "rumored";
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
  issuerFaction?: FactionId;
  requiredStanding?: number;
  requiredMissionId?: string;
  minPowerTier?: number;
  unlockSystemId?: string;
  targetCount?: number;
  targetResource?: ResourceId;
  targetSystemId?: string;
  targetDestinationId?: string;
  targetStationId?: string;
  enemyVariantIds?: string[];
  bossEncounter?: BossEncounterDefinition;
  combatObjective?: CombatObjective;
  objectiveDurationSec?: number;
  reinforcementIntervalSec?: number;
  reinforcementRoles?: HostilePackRole[];
  reinforcementVariantIds?: string[];
}

export interface BossEncounterDefinition {
  bossVariantId: string;
  escortVariantIds?: string[];
  bossTitle: string;
  missionBriefing?: string;
  specialMechanicTags?: string[];
  rewardCreditsBonus?: number;
  threatSummary?: string;
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
  requiredStanding?: number;
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
  identity: StationIdentityId;
  headline: string;
  planningNote: string;
  supplyTags: string[];
  demandTags: string[];
  buyMultiplier: number;
  sellMultiplier: number;
  inventoryBias: number;
  factionControl?: FactionId;
  shipAccessTier?: "native" | "allied" | "neutral" | "export" | "black";
  legalStatus?: "lawful" | "licensed" | "gray" | "black";
  shipFamilyBias?: string[];
  standingRequirement?: number;
  blackMarketAllowed?: boolean;
  fleetSupportLevel?: "rear" | "staging" | "frontline" | "black";
  recruitmentNode?: boolean;
  recruitmentBranch?: string;
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
  ammoRemaining?: number;
}

export interface PendingTargetLock {
  ref: SelectableRef;
  progress: number;
  duration: number;
}

export interface NavigationState {
  mode: NavigationMode;
  target: SelectableRef | null;
  desiredRange: number;
  destination: Vec2 | null;
  warpFrom: Vec2 | null;
  warpProgress: number;
  postWarpDock: boolean;
  postWarpJump: boolean;
}

export type LocalSiteType =
  | "transit"
  | "station"
  | "gate"
  | "belt"
  | "anomaly"
  | "mission"
  | "wreck"
  | "outpost";

export interface LocalSiteState {
  systemId: string;
  destinationId: string | null;
  type: LocalSiteType;
  center: Vec2;
  activeRadius: number;
  label: string;
  subtitle: string;
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

export interface PilotLicenseState {
  level: 1 | 2 | 3;
  progress: number;
}

export type FactionStandingState = Record<FactionId, number>;

export interface PlayerState {
  starterConfigId: StarterShipConfigId;
  pilotLicense: PilotLicenseState;
  factionStandings: FactionStandingState;
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
  weaponHoldFire: boolean;
  navigation: NavigationState;
  pendingLocks: PendingTargetLock[];
  queuedUndockActions: CommandAction[];
  effects: CombatEffectsState;
  tacticalSlow: TacticalSlowState;
  deathSummary: DeathSummary | null;
  savedBuilds: SavedBuild[];
  buildSwap: BuildSwapState;
  recentDamageTimer: number;
}

export interface EnemyState {
  id: string;
  variantId: string;
  bossMissionId?: string;
  boss?: boolean;
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
  pursuitTimer: number;
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
  impactPosition?: Vec2 | null;
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
  shipId?: string;
  modules: string[];
}

export interface FloatingText {
  id: string;
  position: Vec2;
  text: string;
  color: string;
  ttl: number;
}

export type ParticleShape = "spark" | "dot" | "diamond";

export interface ParticleState {
  id: string;
  position: Vec2;
  velocity: Vec2;
  lifetime: number;
  ttl: number;
  color: string;
  size: number;
  shape: ParticleShape;
  glow: number;
}

export interface MissionState {
  missionId: string;
  status: "locked" | "available" | "active" | "readyToTurnIn" | "completed";
  progress: number;
  bossSpawned?: boolean;
  bossDefeated?: boolean;
  objectiveTimer?: number;
  reinforcementTimer?: number;
  challengePressure?: number;
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

export interface RegionalEventState {
  id: string;
  regionId: string;
  cycle: number;
  name: string;
  description: string;
  affectedTags: string[];
  serviceOffer?: string;
  hostileActivityMultiplier?: number;
  rewardMultiplier?: number;
  missionTypeWeights?: Partial<Record<ProceduralContractType, number>>;
  stockBiasTags?: string[];
  priceAdjustments?: Array<{
    tag: string;
    buyMultiplier: number;
    sellMultiplier: number;
  }>;
}

export interface ProceduralContractDefinition {
  id: string;
  templateId: string;
  type: ProceduralContractType;
  title: string;
  briefing: string;
  issuerStationId: string;
  issuerSystemId: string;
  issuerRegionId: string;
  issuerFaction: FactionId;
  requiredStanding?: number;
  riskLevel: TransportRisk;
  rewardCredits: number;
  bonusReward?: number;
  bonusTimeLimitSec?: number;
  routePreference?: RoutePreference;
  targetSystemId: string;
  targetDestinationId?: string;
  targetStationId?: string;
  targetCount?: number;
  targetResource?: ResourceId;
  enemyVariantIds?: string[];
  cargoType?: string;
  cargoVolume?: number;
  cargoUnitValue?: number;
}

export interface ProceduralContractState {
  contractId: string;
  status: "active" | "readyToTurnIn" | "completed";
  progress: number;
  acceptedAt: number;
  dueAt: number | null;
  rewardClaimed: boolean;
  pickedUp?: boolean;
  delivered?: boolean;
}

export interface ProcgenState {
  seed: number;
  eventCycle: number;
  regionalEvents: Record<string, RegionalEventState>;
  siteHotspots: Record<string, ProceduralSiteHotspotState>;
  activeContract: ProceduralContractDefinition | null;
  activeContractState: ProceduralContractState | null;
}

export interface ProceduralSiteHotspotState {
  id: string;
  systemId: string;
  destinationId: string;
  cycle: number;
  title: string;
  description: string;
  encounterWeight: number;
  rewardMultiplier: number;
  tags: string[];
}

export interface SectorRuntime {
  enemies: EnemyState[];
  asteroids: AsteroidState[];
  projectiles: ProjectileState[];
  loot: LootDropState[];
  wrecks: WreckState[];
  floatingText: FloatingText[];
  particles: ParticleState[];
  beltSpawnCooldowns: Record<string, number>;
  challengePressure: number;
  reinforcementTimer: number;
  ecology: SystemEcology;
  fieldStates: Record<string, AsteroidFieldRuntimeState>;
  cameraShake?: number;
  playerHitFlash?: number;
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
  maxLockedTargets: number;
  lockTimeMultiplier: number;
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
  shipSellMultiplier: number;
  turretTrackingMultiplier: number;
  turretOptimalMultiplier: number;
  turretFalloffMultiplier: number;
  laserDamageMultiplier: number;
  railgunDamageMultiplier: number;
  missileDamageMultiplier: number;
  cannonDamageMultiplier: number;
  laserCycleMultiplier: number;
  railgunCycleMultiplier: number;
  missileCycleMultiplier: number;
  cannonCycleMultiplier: number;
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
  roleLabel?: string;
  bossLabel?: string;
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
  localSite: LocalSiteState;
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
  timeScale: number;
  boundary: BoundaryState;
  procgen: ProcgenState;
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
  shipSellPrices: Record<string, number>;
}

export interface GameSnapshot {
  world: GameWorld;
  derived: DerivedShipStats;
  sector: SolarSystemDefinition;
  currentRegion: RegionDefinition;
  currentSite: SystemDestination | null;
  currentStation: SystemDestination | null;
  activeMission: MissionDefinition | null;
  selectedInfo: ObjectInfo | null;
  activeTargetInfo: ObjectInfo | null;
  lockedTargetInfos: ObjectInfo[];
  pendingLockInfos: Array<{ info: ObjectInfo; progress: number; duration: number }>;
  overview: OverviewEntry[];
  navLabel: string;
  nearbyPrompt: string | null;
  nextRouteStep: RouteStep | null;
  buildMatchId: BuildSlotId | null;
  activeTransportMission: TransportTracker | null;
  activeProceduralContract: ProceduralContractDefinition | null;
  availableProceduralContracts: ProceduralContractDefinition[];
  regionalEvent: RegionalEventState | null;
  currentHotspot: ProceduralSiteHotspotState | null;
  economy: EconomySnapshot;
}
