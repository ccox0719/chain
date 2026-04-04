export type BalanceRootKey = "combat" | "capacitor" | "economy" | "missions" | "movement" | "progression" | "spawns";

type BalanceOverrideTree = Record<string, unknown>;

const STORAGE_KEY = "starfall-dev-balance-overrides";
const proxyCache = new WeakMap<object, unknown>();

let cachedOverrides: Record<BalanceRootKey, BalanceOverrideTree> | null = null;

function hasWindow() {
  return typeof window !== "undefined";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadOverrides() {
  if (cachedOverrides) return cachedOverrides;
  if (!hasWindow()) {
    cachedOverrides = {
      combat: {},
      capacitor: {},
      economy: {},
      missions: {},
      movement: {},
      progression: {},
      spawns: {}
    };
    return cachedOverrides;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Record<BalanceRootKey, BalanceOverrideTree>>) : {};
    cachedOverrides = {
      combat: parsed.combat ?? {},
      capacitor: parsed.capacitor ?? {},
      economy: parsed.economy ?? {},
      missions: parsed.missions ?? {},
      movement: parsed.movement ?? {},
      progression: parsed.progression ?? {},
      spawns: parsed.spawns ?? {}
    };
  } catch {
    cachedOverrides = {
      combat: {},
      capacitor: {},
      economy: {},
      missions: {},
      movement: {},
      progression: {},
      spawns: {}
    };
  }
  return cachedOverrides;
}

function saveOverrides(next: Record<BalanceRootKey, BalanceOverrideTree>) {
  cachedOverrides = next;
  if (!hasWindow()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function cloneOverrides(overrides: BalanceOverrideTree): BalanceOverrideTree {
  if (!isPlainObject(overrides)) return {};
  return Object.fromEntries(
    Object.entries(overrides).map(([key, value]) => [key, isPlainObject(value) ? cloneOverrides(value) : value])
  );
}

function ensureRoot(rootKey: BalanceRootKey) {
  const current = loadOverrides();
  if (!current[rootKey]) current[rootKey] = {};
  return current;
}

function getNestedValue(tree: BalanceOverrideTree, path: string[]) {
  let current: unknown = tree;
  for (const key of path) {
    if (!isPlainObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

function setNestedValue(tree: BalanceOverrideTree, path: string[], value: unknown) {
  if (path.length === 0) return value;
  const [head, ...tail] = path;
  const next = isPlainObject(tree[head]) ? cloneOverrides(tree[head] as BalanceOverrideTree) : {};
  tree[head] = tail.length === 0 ? value : setNestedValue(next, tail, value);
  return tree;
}

function deleteNestedValue(tree: BalanceOverrideTree, path: string[]): boolean {
  if (path.length === 0) return true;
  const [head, ...tail] = path;
  const current = tree[head];
  if (!tail.length) {
    delete tree[head];
    return true;
  }
  if (!isPlainObject(current)) return false;
  const next = cloneOverrides(current);
  const removed: boolean = deleteNestedValue(next, tail);
  if (removed) {
    if (Object.keys(next).length === 0) delete tree[head];
    else tree[head] = next;
  }
  return removed;
}

function getRootOverrides(rootKey: BalanceRootKey) {
  return loadOverrides()[rootKey] ?? {};
}

function setRootOverrides(rootKey: BalanceRootKey, next: BalanceOverrideTree) {
  const current = loadOverrides();
  current[rootKey] = next;
  saveOverrides(current);
}

function createProxy<T extends Record<string, unknown>>(rootKey: BalanceRootKey, base: T, path: string[] = []): T {
  if (proxyCache.has(base)) return proxyCache.get(base) as T;
  const proxy = new Proxy(base, {
    get(target, prop, receiver) {
      if (typeof prop === "symbol") {
        return Reflect.get(target, prop, receiver);
      }
      const key = String(prop);
      const baseValue = Reflect.get(target, prop, receiver);
      const overrideValue = getNestedValue(getRootOverrides(rootKey), [...path, key]);
      if (isPlainObject(baseValue)) {
        return createProxy(rootKey, baseValue as T, [...path, key]);
      }
      return overrideValue !== undefined ? overrideValue : baseValue;
    },
    set() {
      return false;
    }
  });
  proxyCache.set(base, proxy);
  return proxy as T;
}

export function createBalanceConfig<T extends Record<string, unknown>>(rootKey: BalanceRootKey, defaults: T): T {
  return createProxy(rootKey, defaults);
}

export function setBalanceOverride(rootKey: BalanceRootKey, path: string[], value: unknown) {
  const root = cloneOverrides(ensureRoot(rootKey)[rootKey]);
  if (value === undefined) {
    deleteNestedValue(root, path);
  } else {
    setNestedValue(root, path, value);
  }
  setRootOverrides(rootKey, root);
}

export function clearBalanceOverrides(rootKey?: BalanceRootKey) {
  if (!rootKey) {
    cachedOverrides = {
      combat: {},
      capacitor: {},
      economy: {},
      missions: {},
      movement: {},
      progression: {},
      spawns: {}
    };
    if (hasWindow()) window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const current = loadOverrides();
  current[rootKey] = {};
  saveOverrides(current);
}
