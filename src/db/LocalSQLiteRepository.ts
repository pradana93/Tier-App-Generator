import type { IProfileRepository } from './IProfileRepository'
import type { LayerPattern, StackingProfile } from '../types'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'

// IndexedDB + localStorage persistence wrapper for sql.js
const IDB_NAME = 'tier-app-db'
const IDB_STORE = 'sqlite'
const IDB_KEY = 'warehouse-pallet-db'

function idbGet(): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction(IDB_STORE, 'readonly')
      const store = tx.objectStore(IDB_STORE)
      const getReq = store.get(IDB_KEY)
      getReq.onsuccess = () => {
        db.close()
        const val = getReq.result as Uint8Array | ArrayBuffer | null
        if (!val) return resolve(null)
        if (val instanceof Uint8Array) return resolve(val)
        if (val instanceof ArrayBuffer) return resolve(new Uint8Array(val))
        // localStorage fallback stored as base64
        return resolve(null)
      }
      getReq.onerror = () => {
        db.close()
        reject(getReq.error)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

function idbSet(data: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction(IDB_STORE, 'readwrite')
      const store = tx.objectStore(IDB_STORE)
      const putReq = store.put(data, IDB_KEY)
      putReq.onsuccess = () => {
        db.close()
        // also mirror to localStorage for debugging
        try {
          const b64 = btoa(String.fromCharCode(...data.slice(0, 1024 * 1024 * 4)))
          localStorage.setItem('tier-app-db-backup', b64.slice(0, 5000000))
        } catch {
          // ignore
        }
        resolve()
      }
      putReq.onerror = () => {
        db.close()
        reject(putReq.error)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

function parseRow(row: unknown[]): StackingProfile {
  // id, itemName, palletWidth, palletLength, casesPerLayer, totalLayersHigh, layerPatterns, totalCasesPerPallet, maxPalletStack, createdAt, updatedAt
  const [id, itemName, palletWidth, palletLength, casesPerLayer, totalLayersHigh, layerPatternsRaw, totalCasesPerPallet, maxPalletStack, createdAt, updatedAt] = row as [
    string, string, number, number, number, number, string, number, number, string, string,
  ]
  let layerPatterns: LayerPattern[] = []
  try {
    layerPatterns = JSON.parse(layerPatternsRaw) as LayerPattern[]
  } catch {
    layerPatterns = []
  }
  return {
    id,
    itemName,
    palletWidth,
    palletLength,
    casesPerLayer,
    totalLayersHigh,
    layerPatterns,
    totalCasesPerPallet,
    maxPalletStack,
    createdAt,
    updatedAt,
  }
}

export class LocalSQLiteRepository implements IProfileRepository {
  private SQL: SqlJsStatic | null = null
  private db: Database | null = null
  private initPromise: Promise<void> | null = null

  async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise
    this.initPromise = this.doInit()
    return this.initPromise
  }

  private async doInit(): Promise<void> {
    this.SQL = await initSqlJs({
      locateFile: (file: string) => {
        if (file.endsWith('.wasm')) {
          // Both sql-wasm.wasm and sql-wasm-browser.wasm are identical; serve same-origin
          return `${import.meta.env.BASE_URL}sql-wasm.wasm`
        }
        return file
      },
    })

    let existing: Uint8Array | null = null
    try {
      existing = await idbGet()
    } catch {
      existing = null
    }

    if (existing && existing.length > 0) {
      try {
        this.db = new this.SQL.Database(existing)
      } catch {
        this.db = new this.SQL.Database()
      }
    } else {
      this.db = new this.SQL.Database()
    }

    this.ensureSchema()
    await this.persist()
  }

  private ensureSchema(): void {
    if (!this.db) throw new Error('DB not initialized')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        itemName TEXT NOT NULL,
        palletWidth INTEGER NOT NULL DEFAULT 100,
        palletLength INTEGER NOT NULL DEFAULT 120,
        casesPerLayer INTEGER NOT NULL,
        totalLayersHigh INTEGER NOT NULL,
        layerPatterns TEXT NOT NULL,
        totalCasesPerPallet INTEGER NOT NULL,
        maxPalletStack INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `)
    // Ensure indexes
    try {
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_profiles_itemName ON profiles(itemName);`)
    } catch {
      // ignore
    }
  }

  private async persist(): Promise<void> {
    if (!this.db) return
    const data = this.db.export()
    try {
      await idbSet(data)
    } catch (e) {
      console.warn('[LocalSQLiteRepository] persist failed', e)
    }
  }

  async getAll(): Promise<StackingProfile[]> {
    await this.init()
    const stmt = this.db!.prepare('SELECT * FROM profiles ORDER BY createdAt DESC')
    const rows: StackingProfile[] = []
    while (stmt.step()) {
      const row = stmt.get()
      rows.push(parseRow(row as unknown[]))
    }
    stmt.free()
    return rows
  }

  async getById(id: string): Promise<StackingProfile | null> {
    await this.init()
    const stmt = this.db!.prepare('SELECT * FROM profiles WHERE id = ? LIMIT 1')
    stmt.bind([id])
    if (stmt.step()) {
      const row = stmt.get()
      stmt.free()
      return parseRow(row as unknown[])
    }
    stmt.free()
    return null
  }

  async create(profile: StackingProfile): Promise<StackingProfile> {
    await this.init()
    const now = new Date().toISOString()
    const p: StackingProfile = {
      ...profile,
      createdAt: profile.createdAt || now,
      updatedAt: profile.updatedAt || now,
    }
    // validate
    if (p.layerPatterns.length !== p.totalLayersHigh) {
      throw new Error(`LayerPatterns length (${p.layerPatterns.length}) must equal TotalLayersHigh (${p.totalLayersHigh})`)
    }
    this.db!.run(
      `INSERT INTO profiles (id, itemName, palletWidth, palletLength, casesPerLayer, totalLayersHigh, layerPatterns, totalCasesPerPallet, maxPalletStack, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        p.itemName,
        p.palletWidth,
        p.palletLength,
        p.casesPerLayer,
        p.totalLayersHigh,
        JSON.stringify(p.layerPatterns),
        p.totalCasesPerPallet,
        p.maxPalletStack,
        p.createdAt,
        p.updatedAt,
      ],
    )
    await this.persist()
    return p
  }

  async update(id: string, patch: Partial<StackingProfile>): Promise<StackingProfile> {
    await this.init()
    const existing = await this.getById(id)
    if (!existing) throw new Error(`Profile ${id} not found`)
    const merged: StackingProfile = {
      ...existing,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    }
    merged.totalCasesPerPallet = merged.casesPerLayer * merged.totalLayersHigh
    if (merged.layerPatterns.length !== merged.totalLayersHigh) {
      throw new Error(`LayerPatterns length (${merged.layerPatterns.length}) must equal TotalLayersHigh (${merged.totalLayersHigh})`)
    }
    this.db!.run(
      `UPDATE profiles SET itemName = ?, palletWidth = ?, palletLength = ?, casesPerLayer = ?, totalLayersHigh = ?, layerPatterns = ?, totalCasesPerPallet = ?, maxPalletStack = ?, updatedAt = ? WHERE id = ?`,
      [
        merged.itemName,
        merged.palletWidth,
        merged.palletLength,
        merged.casesPerLayer,
        merged.totalLayersHigh,
        JSON.stringify(merged.layerPatterns),
        merged.totalCasesPerPallet,
        merged.maxPalletStack,
        merged.updatedAt,
        id,
      ],
    )
    await this.persist()
    return merged
  }

  async delete(id: string): Promise<void> {
    await this.init()
    this.db!.run(`DELETE FROM profiles WHERE id = ?`, [id])
    await this.persist()
  }

  async clear(): Promise<void> {
    await this.init()
    this.db!.exec(`DELETE FROM profiles`)
    await this.persist()
  }
}

// Singleton for app use
export const localRepo = new LocalSQLiteRepository()
