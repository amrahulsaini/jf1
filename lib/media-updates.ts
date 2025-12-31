import { promises as fs } from 'fs'
import path from 'path'

export type MediaUpdateType = 'photo' | 'signature'

export type MediaUpdateEntry = {
  photo: number
  signature: number
  lastUpdatedAt: string
}

export type MediaUpdatesDb = Record<string, MediaUpdateEntry>

const dbPath = path.join(process.cwd(), 'data', 'media-updates.json')

async function ensureDbFile() {
  await fs.mkdir(path.dirname(dbPath), { recursive: true })
  try {
    await fs.access(dbPath)
  } catch {
    await fs.writeFile(dbPath, '{}\n', 'utf8')
  }
}

export async function readMediaUpdates(): Promise<MediaUpdatesDb> {
  await ensureDbFile()
  const text = await fs.readFile(dbPath, 'utf8')
  try {
    const parsed = JSON.parse(text) as MediaUpdatesDb
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function incrementMediaUpdate(rollNo: string, type: MediaUpdateType) {
  const key = (rollNo || '').trim().toUpperCase()
  if (!key) return

  const db = await readMediaUpdates()
  const existing = db[key] || { photo: 0, signature: 0, lastUpdatedAt: new Date(0).toISOString() }

  const updated: MediaUpdateEntry = {
    photo: existing.photo,
    signature: existing.signature,
    lastUpdatedAt: new Date().toISOString(),
  }

  if (type === 'photo') updated.photo += 1
  if (type === 'signature') updated.signature += 1

  db[key] = updated
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2) + '\n', 'utf8')
}
