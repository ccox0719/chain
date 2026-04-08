import { FactionId } from "../../../types/game";

export interface FactionWarEventTemplate {
  id: string;
  regions: string[];
  weight: number;
  title: string;
  description: string;
  alliedFactionId: FactionId;
  enemyFactionId: FactionId;
  alliedShipCap: number;
  enemyShipCap: number;
  durationSec: number;
}

export const factionWarEventTemplates: FactionWarEventTemplate[] = [
  {
    id: "verge-border-clash",
    regions: ["frontier-march"],
    weight: 4,
    title: "Border Clash",
    description: "A contested frontier lane has erupted into a formal fleet clash. Dock command is broadcasting the engagement as a joinable warzone.",
    alliedFactionId: "veilborn",
    enemyFactionId: "ironbound-syndicate",
    alliedShipCap: 4,
    enemyShipCap: 6,
    durationSec: 360
  },
  {
    id: "forge-counterpush",
    regions: ["industrial-fringe"],
    weight: 3,
    title: "Counterpush Alert",
    description: "Industrial security has pinned an enemy raiding group in a special engagement pocket. Allied ships are already holding the line.",
    alliedFactionId: "cinder-union",
    enemyFactionId: "blackwake-clans",
    alliedShipCap: 5,
    enemyShipCap: 5,
    durationSec: 360
  },
  {
    id: "prism-intercept",
    regions: ["aurelian-core"],
    weight: 2,
    title: "Prism Intercept",
    description: "Cabal command has flagged an incoming strike group and opened a sanctioned intercept pocket for allied captains.",
    alliedFactionId: "helion-cabal",
    enemyFactionId: "blackwake-clans",
    alliedShipCap: 4,
    enemyShipCap: 5,
    durationSec: 320
  }
];
