import { CommodityDefinition } from "../../../types/game";

export const commodityCatalog: CommodityDefinition[] = [
  { id: "food-supplies", name: "Food Supplies", category: "essentials", basePrice: 34, volume: 1, riskTag: "legal", tags: ["trade", "logistics"] },
  { id: "industrial-parts", name: "Industrial Parts", category: "industrial", basePrice: 62, volume: 2, riskTag: "legal", tags: ["industrial", "manufacturing"] },
  { id: "fuel-cells", name: "Fuel Cells", category: "energy", basePrice: 56, volume: 1, riskTag: "volatile", tags: ["logistics", "frontier"] },
  { id: "medical-supplies", name: "Medical Supplies", category: "medical", basePrice: 74, volume: 1, riskTag: "legal", tags: ["medical", "frontier"] },
  { id: "electronics", name: "Electronics", category: "technology", basePrice: 92, volume: 1, riskTag: "legal", tags: ["research", "high-tech"] },
  { id: "weapons-components", name: "Weapons Components", category: "military", basePrice: 108, volume: 2, riskTag: "restricted", tags: ["military", "frontier"] },
  { id: "refined-alloys", name: "Refined Alloys", category: "materials", basePrice: 86, volume: 2, riskTag: "legal", tags: ["industrial", "mining"] },
  { id: "frontier-survival-kits", name: "Frontier Survival Kits", category: "frontier", basePrice: 128, volume: 2, riskTag: "legal", tags: ["frontier", "logistics"] },
  { id: "luxury-goods", name: "Luxury Goods", category: "luxury", basePrice: 152, volume: 1, riskTag: "legal", tags: ["trade", "high-tech"] },
  { id: "salvage-scrap", name: "Salvage Scrap", category: "salvage", basePrice: 48, volume: 1, riskTag: "legal", tags: ["salvage", "industrial"] }
];

export const commodityById = Object.fromEntries(commodityCatalog.map((commodity) => [commodity.id, commodity]));
