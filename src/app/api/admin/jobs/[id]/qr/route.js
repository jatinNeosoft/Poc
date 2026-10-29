import { prisma } from "@/lib/prisma"
import { jsonError, requireAdmin } from "@/lib/api"
import { publicJobUrl } from "@/lib/jobs/format"
import { qrPngBuffer } from "@/lib/qr"

// GET → QR PNG for the job's public link. ?download=1 makes the browser save it.
export async function GET(req, { params }) {
  const { response } = await requireAdmin()
  if (response) return response

  const { id } = await params
  const job = await prisma.job.findUnique({ where: { id }, select: { slug: true } })
  if (!job) return jsonError("Job not found", 404)

  const png = await qrPngBuffer(publicJobUrl(job.slug))
  const headers = { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" }
  if (req.nextUrl.searchParams.get("download")) {
    headers["Content-Disposition"] = `attachment; filename="qr-${job.slug}.png"`
  }
  return new Response(png, { headers })
}
