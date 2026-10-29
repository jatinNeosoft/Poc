import { createElement } from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { prisma } from "@/lib/prisma"
import { jsonError, requireAdmin } from "@/lib/api"
import { CvDocument } from "@/lib/pdf/cv-document"

// GET → the candidate's CV as a PDF download
export async function GET(_req, { params }) {
  const { response } = await requireAdmin()
  if (response) return response

  const { id } = await params
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      job: true,
      interview: true,
      video: { select: { id: true } },
      screeningAnswers: { orderBy: { order: "asc" } },
    },
  })
  if (!candidate?.interview) return jsonError("Candidate not found", 404)

  const pdf = await renderToBuffer(
    createElement(CvDocument, { candidate, job: candidate.job, interview: candidate.interview })
  )
  const name = (candidate.fullName || "candidate").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "candidate"
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="CV-${name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
