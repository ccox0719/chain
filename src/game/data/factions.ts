import { FactionId } from "../../types/game";

export const factionData: Record<
  FactionId,
  { name: string; color: string; description: string }
> = {
  "aurelian-league": {
    name: "Aurelian League",
    color: "#79b8ff",
    description: "Orderly trade fleets, bright shield tech, and disciplined pilots."
  },
  "cinder-union": {
    name: "Cinder Union",
    color: "#ff9d6e",
    description: "Hard-burn prospectors and militias that turn mining lanes into war zones."
  },
  veilborn: {
    name: "Veilborn",
    color: "#c795ff",
    description: "Fast opportunists, scavenger crews, and quiet raiders from the edge."
  }
};
