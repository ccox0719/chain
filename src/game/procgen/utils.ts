export function hashString(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: string | number) {
  let state = typeof seed === "number" ? seed >>> 0 : hashString(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickOne<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)];
}

export function randomInt(min: number, max: number, random: () => number) {
  return Math.floor(min + random() * (max - min + 1));
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function weightedPick<T>(entries: Array<T & { weight: number }>, random: () => number) {
  const positive = entries.filter((entry) => entry.weight > 0);
  const totalWeight = positive.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return positive[0] ?? entries[0] ?? null;
  let roll = random() * totalWeight;
  for (const entry of positive) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return positive[positive.length - 1] ?? null;
}

export function weightedShuffle<T>(entries: Array<T & { weight: number }>, random: () => number) {
  const pool = [...entries];
  const ordered: T[] = [];
  while (pool.length > 0) {
    const picked = weightedPick(pool, random);
    if (!picked) break;
    ordered.push(picked);
    const index = pool.indexOf(picked);
    if (index >= 0) pool.splice(index, 1);
  }
  return ordered;
}
