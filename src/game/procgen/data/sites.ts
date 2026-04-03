export interface SiteHotspotTemplate {
  id: string;
  destinationKinds: Array<"anomaly" | "wreck" | "beacon">;
  weight: number;
  title: string;
  description: string;
  tags: string[];
  encounterWeight: number;
  rewardMultiplier: number;
}

export const siteHotspotTemplates: SiteHotspotTemplate[] = [
  {
    id: "combat-surge",
    destinationKinds: ["anomaly"],
    weight: 4,
    title: "Combat Surge",
    description: "Scouts flagged a spike in hostile traffic and salvage chatter around this site.",
    tags: ["combat", "salvage"],
    encounterWeight: 1.22,
    rewardMultiplier: 1.12
  },
  {
    id: "survey-window",
    destinationKinds: ["beacon", "anomaly"],
    weight: 3,
    title: "Survey Window",
    description: "Sensor drift has calmed just enough for route desks to pay for fresh readings.",
    tags: ["research", "navigation"],
    encounterWeight: 0.96,
    rewardMultiplier: 1.08
  },
  {
    id: "salvage-rush",
    destinationKinds: ["wreck", "anomaly"],
    weight: 3,
    title: "Salvage Rush",
    description: "Recent debris signatures pulled in crews, raiders, and opportunists.",
    tags: ["salvage", "frontier"],
    encounterWeight: 1.14,
    rewardMultiplier: 1.1
  }
];
