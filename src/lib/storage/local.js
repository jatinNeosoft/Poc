import { createReadStream } from "node:fs"
import { mkdir, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"

const ROOT = path.join(process.cwd(), "uploads")

// Keys look like "videos/abc.webm"; never allow escaping the uploads folder
function resolveKey(key) {
  const full = path.resolve(ROOT, key)
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid storage key")
  return full
}

export const localStorageDriver = {
  name: "local",

  async save(key, buffer) {
    const file = resolveKey(key)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, buffer)
    return { key, url: `/api/media/${key}` }
  },

  /** @returns {Promise<{ size: number } | null>} */
  async stat(key) {
    try {
      const s = await stat(resolveKey(key))
      return s.isFile() ? { size: s.size } : null
    } catch {
      return null
    }
  },

  /** Web ReadableStream of the file, optionally a byte range (inclusive). */
  read(key, range) {
    const nodeStream = createReadStream(resolveKey(key), range ? { start: range.start, end: range.end } : undefined)
    return Readable.toWeb(nodeStream)
  },

  async remove(key) {
    await rm(resolveKey(key), { force: true })
  },
}
