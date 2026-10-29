import { jsonError, requireAdmin } from "@/lib/api"
import { getStorage } from "@/lib/storage"

const TYPES = { webm: "video/webm", mp4: "video/mp4", mp3: "audio/mpeg" }

// Admin-only media (candidate videos). Supports Range requests so the video player can seek.
export async function GET(req, { params }) {
  const { response } = await requireAdmin()
  if (response) return response

  const { key: parts } = await params
  const key = parts.join("/")
  const storage = getStorage()

  let info
  try {
    info = await storage.stat(key)
  } catch {
    return jsonError("Not found", 404)
  }
  if (!info) return jsonError("Not found", 404)

  const headers = {
    "Content-Type": TYPES[key.split(".").pop()] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "")
  if (match && (match[1] || match[2])) {
    const start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]))
    const end = match[1] && match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1
    if (start > end || start >= info.size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } })
    }
    return new Response(storage.read(key, { start, end }), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": String(end - start + 1) },
    })
  }

  return new Response(storage.read(key), { headers: { ...headers, "Content-Length": String(info.size) } })
}
