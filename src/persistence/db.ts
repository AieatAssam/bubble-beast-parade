/**
 * Typed IndexedDB wrapper with a localStorage fallback (SPEC §10).
 * Stores: profile, captures, runs, leaderboard entries, unlocks.
 */
import type { Rarity } from "../data/creatures";

export interface ProfileRecord {
  id: "profile";
  name: string;
  theme: string;
  settings: {
    volume: number;
    muted: boolean;
    reducedMotion: boolean;
    reducedFlash: boolean;
    effectsQuality: 0 | 1 | 2;
  };
}

export interface CaptureRecord {
  creatureId: string;
  rarity: Rarity;
  color: string;
  firstCaptureAt: number;
  count: number;
  bestChain: number;
  totalPoints: number;
}

export interface RunRecord {
  id?: number;
  at: number;
  score: number;
  durationSeconds: number;
  captureCount: number;
  maxChain: number;
  effectsTriggered: string[];
  playerName: string;
  bestRarity: Rarity;
}

export interface UnlockRecord {
  id: string;
  unlockedAt: number;
}

export interface SaveBlob {
  version: 1;
  profile: ProfileRecord | null;
  captures: CaptureRecord[];
  runs: RunRecord[];
  unlocks: UnlockRecord[];
}

const DB_NAME = "bubble-beast-parade";
const DB_VERSION = 1;
const STORES = ["profile", "captures", "runs", "unlocks"] as const;

export const DEFAULT_PROFILE: ProfileRecord = {
  id: "profile",
  name: "Bubble Friend",
  theme: "conservatory",
  settings: {
    volume: 0.8,
    muted: false,
    reducedMotion:
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches,
    reducedFlash: false,
    effectsQuality: 2,
  },
};

class Database {
  private db: IDBDatabase | null = null;
  private useFallback = false;

  async open(): Promise<void> {
    if (this.db || this.useFallback) return;
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("profile"))
            db.createObjectStore("profile", { keyPath: "id" });
          if (!db.objectStoreNames.contains("captures"))
            db.createObjectStore("captures", { keyPath: "creatureId" });
          if (!db.objectStoreNames.contains("runs"))
            db.createObjectStore("runs", { keyPath: "id", autoIncrement: true });
          if (!db.objectStoreNames.contains("unlocks"))
            db.createObjectStore("unlocks", { keyPath: "id" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
      });
    } catch {
      this.useFallback = true;
    }
  }

  private lsKey(store: string): string {
    return `bbp:${store}`;
  }

  private lsRead<T>(store: string): T[] {
    try {
      return JSON.parse(localStorage.getItem(this.lsKey(store)) ?? "[]") as T[];
    } catch {
      return [];
    }
  }

  private lsWrite(store: string, rows: unknown[]): void {
    try {
      localStorage.setItem(this.lsKey(store), JSON.stringify(rows));
    } catch {
      // Storage full or unavailable — data stays in-memory for this session.
    }
  }

  async getAll<T>(store: (typeof STORES)[number]): Promise<T[]> {
    await this.open();
    if (this.useFallback || !this.db) return this.lsRead<T>(store);
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error ?? new Error("getAll failed"));
    });
  }

  async put(store: (typeof STORES)[number], value: unknown): Promise<void> {
    await this.open();
    if (this.useFallback || !this.db) {
      const rows = this.lsRead<Record<string, unknown>>(store);
      const keyField = store === "runs" ? "id" : store === "captures" ? "creatureId" : "id";
      const v = value as Record<string, unknown>;
      if (store === "runs" && v.id === undefined) {
        v.id = (rows.reduce((m, r) => Math.max(m, Number(r.id ?? 0)), 0) as number) + 1;
      }
      const idx = rows.findIndex((r) => r[keyField] === v[keyField]);
      if (idx >= 0) rows[idx] = v;
      else rows.push(v);
      this.lsWrite(store, rows);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, "readwrite");
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("put failed"));
    });
  }

  async clearAll(): Promise<void> {
    await this.open();
    if (this.useFallback || !this.db) {
      for (const s of STORES) localStorage.removeItem(this.lsKey(s));
      return;
    }
    await Promise.all(
      STORES.map(
        (store) =>
          new Promise<void>((resolve, reject) => {
            const tx = this.db!.transaction(store, "readwrite");
            tx.objectStore(store).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error ?? new Error("clear failed"));
          }),
      ),
    );
  }
}

const db = new Database();

export async function loadProfile(): Promise<ProfileRecord> {
  const rows = await db.getAll<ProfileRecord>("profile");
  return rows[0] ?? structuredClone(DEFAULT_PROFILE);
}

export async function saveProfile(p: ProfileRecord): Promise<void> {
  await db.put("profile", p);
}

export async function loadCaptures(): Promise<CaptureRecord[]> {
  return db.getAll<CaptureRecord>("captures");
}

export async function saveCapture(c: CaptureRecord): Promise<void> {
  await db.put("captures", c);
}

export async function loadRuns(): Promise<RunRecord[]> {
  return db.getAll<RunRecord>("runs");
}

export async function saveRun(r: RunRecord): Promise<void> {
  await db.put("runs", r);
}

export async function loadUnlocks(): Promise<UnlockRecord[]> {
  return db.getAll<UnlockRecord>("unlocks");
}

export async function saveUnlock(u: UnlockRecord): Promise<void> {
  await db.put("unlocks", u);
}

export async function exportSave(): Promise<SaveBlob> {
  const [profileRows, captures, runs, unlocks] = await Promise.all([
    db.getAll<ProfileRecord>("profile"),
    loadCaptures(),
    loadRuns(),
    loadUnlocks(),
  ]);
  return { version: 1, profile: profileRows[0] ?? null, captures, runs, unlocks };
}

export function validateSave(data: unknown): data is SaveBlob {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Partial<SaveBlob>;
  return (
    d.version === 1 &&
    Array.isArray(d.captures) &&
    Array.isArray(d.runs) &&
    Array.isArray(d.unlocks) &&
    d.captures.every((c) => typeof c.creatureId === "string" && typeof c.count === "number") &&
    d.runs.every((r) => typeof r.score === "number" && typeof r.at === "number")
  );
}

export async function importSave(blob: SaveBlob): Promise<void> {
  await db.clearAll();
  if (blob.profile) await saveProfile(blob.profile);
  for (const c of blob.captures) await saveCapture(c);
  for (const r of blob.runs) await saveRun(r);
  for (const u of blob.unlocks) await saveUnlock(u);
}

export async function resetAllData(): Promise<void> {
  await db.clearAll();
}

/**
 * Future-ready leaderboard service seam (SPEC §11): the game only talks to
 * this interface. Today's only implementation is device-local.
 */
export interface LeaderboardService {
  topScores(limit: number): Promise<RunRecord[]>;
  topChains(limit: number): Promise<RunRecord[]>;
  topCaptures(limit: number): Promise<RunRecord[]>;
  latestRuns(limit: number): Promise<RunRecord[]>;
  submitRun(run: RunRecord): Promise<void>;
}

export const localLeaderboard: LeaderboardService = {
  async topScores(limit) {
    return (await loadRuns()).sort((a, b) => b.score - a.score).slice(0, limit);
  },
  async topChains(limit) {
    return (await loadRuns()).sort((a, b) => b.maxChain - a.maxChain).slice(0, limit);
  },
  async topCaptures(limit) {
    return (await loadRuns()).sort((a, b) => b.captureCount - a.captureCount).slice(0, limit);
  },
  async latestRuns(limit) {
    return (await loadRuns()).sort((a, b) => b.at - a.at).slice(0, limit);
  },
  async submitRun(run) {
    await saveRun(run);
  },
};
