import { EnemyArchetypeId, NavigationMode } from "../../types/game";

export interface EnemyArchetypeDefinition {
  id: EnemyArchetypeId;
  name: string;
  roleLabel: string;
  threatLabel: string;
  movementStyle: "swarm" | "siege" | "bruiser" | "hunter" | "support" | "skirmisher" | "artillery";
  preferredRange: number;
  minRange: number;
  maxRange: number;
  preferredMode: NavigationMode;
  speedMultiplier: number;
  turnMultiplier: number;
  patrolBehavior: "stationary" | "anchor-patrol" | "roaming";
  summary: string;
  weaknessHint: string;
  roleTags: string[];
}

const archetypes: EnemyArchetypeDefinition[] = [
  {
    id: "swarm",
    name: "Swarm Drone",
    roleLabel: "Swarm",
    threatLabel: "Harassment Pack",
    movementStyle: "swarm",
    preferredRange: 150,
    minRange: 60,
    maxRange: 240,
    preferredMode: "orbit",
    speedMultiplier: 1.28,
    turnMultiplier: 1.28,
    patrolBehavior: "roaming",
    summary: "Fast close-range pressure that overwhelms by numbers and target switching.",
    weaknessHint: "Fragile when focused and weak if forced to chase at distance.",
    roleTags: ["Swarm", "Control", "Skirmisher"]
  },
  {
    id: "siege_sniper",
    name: "Siege Sniper",
    roleLabel: "Sniper",
    threatLabel: "Longshot Platform",
    movementStyle: "siege",
    preferredRange: 640,
    minRange: 320,
    maxRange: 900,
    preferredMode: "keep_range",
    speedMultiplier: 0.58,
    turnMultiplier: 0.72,
    patrolBehavior: "stationary",
    summary: "Extremely slow artillery platform that punishes anyone who lets it keep line-of-fire.",
    weaknessHint: "Collapses under pressure once forced into close combat.",
    roleTags: ["Sniper", "Rail", "Artillery"]
  },
  {
    id: "heavy_bruiser",
    name: "Heavy Bruiser",
    roleLabel: "Bruiser",
    threatLabel: "Frontline Pressure",
    movementStyle: "bruiser",
    preferredRange: 180,
    minRange: 40,
    maxRange: 260,
    preferredMode: "approach",
    speedMultiplier: 0.82,
    turnMultiplier: 0.82,
    patrolBehavior: "anchor-patrol",
    summary: "Slow, oppressive hull that wants to crash into the player and stay there.",
    weaknessHint: "Vulnerable to kiting and range control.",
    roleTags: ["Brawler", "Armor", "Control"]
  },
  {
    id: "interceptor",
    name: "Interceptor",
    roleLabel: "Tackle",
    threatLabel: "Pinning Hunter",
    movementStyle: "hunter",
    preferredRange: 120,
    minRange: 20,
    maxRange: 220,
    preferredMode: "approach",
    speedMultiplier: 1.38,
    turnMultiplier: 1.42,
    patrolBehavior: "roaming",
    summary: "Fast tackle ship that hunts, scrams, and pins targets in place.",
    weaknessHint: "Low durability if it cannot keep a target pinned.",
    roleTags: ["Control", "Skirmisher", "Support"]
  },
  {
    id: "support_frigate",
    name: "Support Frigate",
    roleLabel: "Support",
    threatLabel: "Force Multiplier",
    movementStyle: "support",
    preferredRange: 320,
    minRange: 180,
    maxRange: 520,
    preferredMode: "keep_range",
    speedMultiplier: 0.96,
    turnMultiplier: 1.02,
    patrolBehavior: "anchor-patrol",
    summary: "Keeps allies alive or accurate with repairs, paints, and disruption.",
    weaknessHint: "High-priority target once the player can reach the back line.",
    roleTags: ["Support", "Control", "Shield"]
  },
  {
    id: "missile_skirmisher",
    name: "Missile Skirmisher",
    roleLabel: "Skirmisher",
    threatLabel: "Mobile Pressure",
    movementStyle: "skirmisher",
    preferredRange: 300,
    minRange: 140,
    maxRange: 420,
    preferredMode: "keep_range",
    speedMultiplier: 1.0,
    turnMultiplier: 1.08,
    patrolBehavior: "anchor-patrol",
    summary: "Flexible mid-range pressure that stays mobile and keeps missiles in the fight.",
    weaknessHint: "Can be outplayed if its spacing is broken.",
    roleTags: ["Missile", "Skirmisher", "Control"]
  },
  {
    id: "artillery",
    name: "Artillery Platform",
    roleLabel: "Artillery",
    threatLabel: "Siege Pressure",
    movementStyle: "artillery",
    preferredRange: 500,
    minRange: 260,
    maxRange: 780,
    preferredMode: "keep_range",
    speedMultiplier: 0.68,
    turnMultiplier: 0.76,
    patrolBehavior: "stationary",
    summary: "Heavy launcher platform that wants an open lane and a stable firing solution.",
    weaknessHint: "Poor close-in handling and slow target reacquisition.",
    roleTags: ["Artillery", "Missile", "Sniper"]
  },
  {
    id: "hunter",
    name: "Hunter",
    roleLabel: "Hunter",
    threatLabel: "Chasing Pressure",
    movementStyle: "hunter",
    preferredRange: 210,
    minRange: 60,
    maxRange: 320,
    preferredMode: "approach",
    speedMultiplier: 1.18,
    turnMultiplier: 1.22,
    patrolBehavior: "roaming",
    summary: "Fast pursuer that punishes retreat and tries to hold a favorable brawl range.",
    weaknessHint: "Loses effectiveness if the player can force a long reset.",
    roleTags: ["Skirmisher", "Brawler", "Control"]
  }
];

export const enemyArchetypesById = Object.fromEntries(archetypes.map((entry) => [entry.id, entry])) as Record<
  EnemyArchetypeId,
  EnemyArchetypeDefinition
>;

export function getEnemyArchetypeDefinition(archetypeId?: EnemyArchetypeId | null) {
  return archetypeId ? enemyArchetypesById[archetypeId] : null;
}

