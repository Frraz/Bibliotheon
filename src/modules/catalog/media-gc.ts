import type { Payload } from 'payload'
import { lstat, readFile, readdir, realpath, rename, open, unlink } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { atomic, serial } from '../marketing/transaction'
import { MANAGED_MEDIA_NAME, MEDIA_FILES_LOCK, MEDIA_GC_GRACE, MEDIA_GC_INDEX } from './media-files'

type Journal = { version: 1; entries: Record<string, number> }
const missing = (error: unknown) => !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
async function readJournal(file: string): Promise<Journal> {
  try {
    const info = await lstat(file)
    if (!info.isFile() || info.isSymbolicLink() || info.size > 16 * 1024 * 1024) throw new Error('Índice de mídia inválido.')
    const data = JSON.parse(await readFile(file, 'utf8'))
    if (!data || data.version !== 1 || Object.keys(data).some(key => !['version', 'entries'].includes(key)) || !data.entries || typeof data.entries !== 'object' || Array.isArray(data.entries)) throw new Error('Índice de mídia inválido.')
    for (const [name, firstSeen] of Object.entries(data.entries)) if (!MANAGED_MEDIA_NAME.test(name) || typeof firstSeen !== 'number' || !Number.isSafeInteger(firstSeen) || firstSeen < 0) throw new Error('Índice de mídia inválido.')
    return data
  } catch (error) {
    if (missing(error)) return { version: 1, entries: {} }
    throw new Error('Não foi possível conferir o índice de mídia; nenhum caminho foi exibido.')
  }
}

async function writeJournal(file: string, journal: Journal) {
  const temp = `${file}.${randomUUID()}.tmp`
  try {
    const handle = await open(temp, 'wx', 0o600)
    try { await handle.writeFile(JSON.stringify(journal)); await handle.sync() } finally { await handle.close() }
    await rename(temp, file)
  } finally { await unlink(temp).catch(error => { if (!missing(error)) throw error }) }
}

/** Filesystem deletion is deliberately outside upload/delete transactions. No external transport. */
export async function collectMedia(payload: Payload, options: { apply?: boolean; now?: number } = {}) {
  const now = options.now ?? Date.now()
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Data de limpeza inválida.')
  const upload = payload.collections.media.config.upload
  if (!upload || typeof upload !== 'object' || !upload.staticDir || upload.imageSizes?.length || payload.collections.media.config.custom?.bibliotheonDeferredFileDeletion !== true) throw new Error('Configuração de mídia incompatível com a limpeza segura.')
  const staticDir = upload.staticDir
  return atomic(payload, async req => {
    await serial(req, MEDIA_FILES_LOCK)
    const counts = { mode: options.apply ? 'apply' : 'dry-run', scanned: 0, referenced: 0, candidates: 0, eligible: 0, removed: 0, skipped: 0 }
    let directory: string
    try { directory = await realpath(staticDir) } catch (error) { if (missing(error)) return counts; throw error }
    const referenced = new Set<string>()
    for (let page = 1; ; page++) {
      const result = await payload.find({ collection: 'media', overrideAccess: true, depth: 0, select: { filename: true }, limit: 1000, page, req })
      for (const doc of result.docs) if (doc.filename) referenced.add(doc.filename)
      if (!result.hasNextPage) break
    }
    const file = path.join(directory, MEDIA_GC_INDEX), journal = await readJournal(file)
    const next: Journal = { version: 1, entries: {} }
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === MEDIA_GC_INDEX) continue
      if (!entry.isFile() || entry.isSymbolicLink() || !MANAGED_MEDIA_NAME.test(entry.name)) { counts.skipped++; continue }
      counts.scanned++
      if (referenced.has(entry.name)) { counts.referenced++; continue }
      counts.candidates++
      const firstSeen = journal.entries[entry.name] ?? now
      if (now - firstSeen >= MEDIA_GC_GRACE) {
        counts.eligible++
        if (options.apply) {
          // Recheck type immediately before unlink; never follow a filesystem link.
          const target = path.join(directory, entry.name)
          try {
            const info = await lstat(target)
            if (!info.isFile() || info.isSymbolicLink()) { counts.skipped++; continue }
            await unlink(target); counts.removed++
          } catch (error) { if (!missing(error)) throw error }
          continue
        }
      }
      next.entries[entry.name] = firstSeen
    }
    // A dry run neither starts the grace period nor changes any file.
    if (options.apply) await writeJournal(file, next)
    return counts
  })
}
