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
  },
  {
    id: "wreck-field",
    destinationKinds: ["wreck", "anomaly"],
    weight: 4,
    title: "Wreck Field",
    description: "A thick debris pocket is full of salvage, shattered escorts, and opportunists circling the fringe.",
    tags: ["salvage", "combat", "frontier"],
    encounterWeight: 1.2,
    rewardMultiplier: 1.14
  },
  {
    id: "patrol-surge",
    destinationKinds: ["beacon", "anomaly"],
    weight: 3,
    title: "Patrol Surge",
    description: "Security sweeps are clustered around this site, creating a hot lane for patrol work and surprise contacts.",
    tags: ["combat", "military", "patrol"],
    encounterWeight: 1.16,
    rewardMultiplier: 1.08
  },
  {
    id: "black-market-window",
    destinationKinds: ["beacon", "wreck"],
    weight: 2,
    title: "Black Market Window",
    description: "A temporary trade hole opened around this site, and the local fence network is moving quietly.",
    tags: ["trade", "salvage", "frontier"],
    encounterWeight: 0.98,
    rewardMultiplier: 1.12
  },
  {
    id: "ancient-signal",
    destinationKinds: ["anomaly", "beacon"],
    weight: 2,
    title: "Ancient Signal",
    description: "A repeating signal is bleeding through the noise, pulling explorers and recovery crews toward old debris.",
    tags: ["research", "navigation", "frontier"],
    encounterWeight: 1.03,
    rewardMultiplier: 1.16
  },
  {
    id: "drift-cache",
    destinationKinds: ["wreck", "beacon"],
    weight: 2,
    title: "Drift Cache",
    description: "A hidden stash or dead drop is drawing salvage crews and opportunists into a short, profitable scramble.",
    tags: ["salvage", "trade", "frontier"],
    encounterWeight: 1.06,
    rewardMultiplier: 1.1
  }
];
