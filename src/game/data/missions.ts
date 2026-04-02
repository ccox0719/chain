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
    id: "crown-ledger-rush",
    title: "Crown Ledger Rush",
    type: "travel",
    briefing: "Carry brokerage telemetry to the Ledger Relay in Crown Exchange so the route desk can price new convoy cover.",
    rewardCredits: 1250,
    requiredMissionId: "market-run",
    targetSystemId: "crown-exchange",
    targetDestinationId: "crown-ledger"
  },
  {
    id: "harbor-tooling",
    title: "Harbor Tooling",
    type: "deliver",
    briefing: "Move 10 units of ferrite into Glass Quay to support a civilian tooling contract.",
    rewardCredits: 1320,
    requiredMissionId: "crown-ledger-rush",
    targetCount: 10,
    targetResource: "ferrite",
    targetStationId: "glass-quay",
    targetSystemId: "glass-harbor"
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
    id: "slag-arc-sweep",
    title: "Slag Arc Sweep",
    type: "bounty",
    briefing: "Break four hostile hulls around Slag Yard so the refinery route can hold its schedule.",
    rewardCredits: 1680,
    requiredMissionId: "crystal-sweep",
    targetCount: 4,
    enemyVariantIds: ["dust-raider", "cinder-pike"],
    targetSystemId: "slag-arc",
    targetDestinationId: "slag-break"
  },
  {
    id: "brass-strait-ledger",
    title: "Brass Strait Ledger",
    type: "travel",
    briefing: "Reach Transit Ops Beacon in Brass Strait and verify the safer freight corridor is still viable.",
    rewardCredits: 1750,
    requiredMissionId: "slag-arc-sweep",
    targetSystemId: "brass-strait",
    targetDestinationId: "brass-ops"
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
    id: "ashen-breach-mapping",
    title: "Ashen Breach Mapping",
    type: "travel",
    briefing: "Push into Ashen Deep and record the pull signature around the Ashen Breach for frontier patrol planners.",
    rewardCredits: 2480,
    requiredMissionId: "wake-hunt",
    targetSystemId: "ashen-deep",
    targetDestinationId: "ashen-breach"
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
    id: "hush-chart-recovery",
    title: "Hush Chart Recovery",
    type: "travel",
    briefing: "Reach the Chart Beacon in Hush Atlas and bring its route overlays back into frontier circulation.",
    rewardCredits: 2940,
    requiredMissionId: "ghostlight-charter",
    targetSystemId: "hush-atlas",
    targetDestinationId: "hush-chart"
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
  },
  {
    id: "revenant-salvage-line",
    title: "Revenant Salvage Line",
    type: "bounty",
    briefing: "Crack five hostile hulls around Revenant Rift so salvage crews can work the crossing again.",
    rewardCredits: 3680,
    requiredMissionId: "vault-salvage",
    targetCount: 5,
    enemyVariantIds: ["veil-stalker", "reaver-gunship"],
    targetSystemId: "revenant-crossing",
    targetDestinationId: "revenant-rift"
  }
];

export const missionById = Object.fromEntries(missionCatalog.map((mission) => [mission.id, mission]));
