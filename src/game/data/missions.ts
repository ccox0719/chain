import { MissionDefinition } from "../../types/game";

export const missionCatalog: MissionDefinition[] = [
  {
    id: "debt-ledger",
    title: "Debt Ledger",
    type: "mining",
    briefing: "Mine 18 ferrite in Lumen Rest so the station debt office keeps your inherited hull supplied.",
    rewardCredits: 700,
    targetCount: 18,
    targetResource: "ferrite",
    targetSystemId: "lumen-rest",
    targetDestinationId: "lumen-belt-alpha"
  },
  {
    id: "lane-cleanup",
    title: "Lane Cleanup",
    type: "bounty",
    briefing: "Clear three pirate hulls near the academy relay approach in Lumen Rest.",
    rewardCredits: 900,
    requiredMissionId: "debt-ledger",
    targetCount: 3,
    enemyVariantIds: ["scrap-drone", "dust-raider"],
    targetSystemId: "lumen-rest",
    targetDestinationId: "lumen-relay"
  },
  {
    id: "market-run",
    title: "Market Run",
    type: "deliver",
    briefing: "Move 12 ferrite to Farpoint Exchange. It is only a short route if you pick the quick lane.",
    rewardCredits: 1100,
    requiredMissionId: "lane-cleanup",
    targetCount: 12,
    targetResource: "ferrite",
    targetStationId: "farpoint-exchange",
    targetSystemId: "farpoint-market"
  },
  {
    id: "survey-reach",
    title: "Survey Reach",
    type: "travel",
    briefing: "Carry survey telemetry to the Reach Survey Beacon in Ember Reach and confirm the fringe lane is still open.",
    rewardCredits: 1200,
    requiredMissionId: "market-run",
    targetSystemId: "ember-reach",
    targetDestinationId: "reach-beacon",
    unlockSystemId: "ember-reach"
  },
  {
    id: "crystal-sweep",
    title: "Crystal Sweep",
    type: "mining",
    briefing: "Mine 10 ember crystal in Ember Reach and haul it back through active pirate territory.",
    rewardCredits: 1400,
    requiredMissionId: "survey-reach",
    targetCount: 10,
    targetResource: "ember-crystal",
    targetSystemId: "ember-reach",
    targetDestinationId: "ember-belt-alpha"
  },
  {
    id: "border-watch",
    title: "Border Watch",
    type: "travel",
    briefing: "Push to the Frontier Signal Beacon in Outer Verge and report on pirate movement along the chokepoint.",
    rewardCredits: 1600,
    requiredMissionId: "crystal-sweep",
    targetSystemId: "outer-verge",
    targetDestinationId: "verge-beacon",
    unlockSystemId: "outer-verge"
  },
  {
    id: "wake-hunt",
    title: "Wake Hunt",
    type: "bounty",
    briefing: "Break four raider hulls in Blackwake to make the shortcut survivable for convoy captains.",
    rewardCredits: 2200,
    requiredMissionId: "border-watch",
    targetCount: 4,
    enemyVariantIds: ["veil-stalker", "reaver-gunship"],
    targetSystemId: "blackwake",
    targetDestinationId: "blackwake-rift"
  },
  {
    id: "ghostlight-charter",
    title: "Ghostlight Charter",
    type: "travel",
    briefing: "Obtain the charter by reaching the Ghostlight vault marker. That unlocks the pocket gate.",
    rewardCredits: 2600,
    requiredMissionId: "wake-hunt",
    targetSystemId: "ghostlight-pocket",
    targetDestinationId: "ghostlight-vault",
    unlockSystemId: "ghostlight-pocket"
  },
  {
    id: "vault-salvage",
    title: "Vault Salvage",
    type: "mining",
    briefing: "Bring back 8 ghost alloy from the Ghostlight pocket to prove you can hold the frontier line.",
    rewardCredits: 3200,
    requiredMissionId: "ghostlight-charter",
    targetCount: 8,
    targetResource: "ghost-alloy",
    targetSystemId: "ghostlight-pocket",
    targetDestinationId: "ghostlight-belt-alpha"
  }
];

export const missionById = Object.fromEntries(missionCatalog.map((mission) => [mission.id, mission]));
