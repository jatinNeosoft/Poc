import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatSalary, publicJobUrl } from "@/lib/jobs/format"
import { qrDataUrl } from "@/lib/qr"
import { PrintButton } from "@/components/admin/print-button"

export const dynamic = "force-dynamic"
export const metadata = { title: "Print QR — HireVoice" }

// Printable A4 poster, outside the admin sidebar layout
export default async function PrintJobPage({ params }) {
  if (!(await getServerSession(authOptions))) redirect("/admin/login")

  const { id } = await params
  const job = await prisma.job.findUnique({ where: { id } })
  if (!job) notFound()

  const url = publicJobUrl(job.slug)
  const qr = await qrDataUrl(url, 900)

  return (
    <main className="mx-auto flex min-h-svh max-w-[210mm] flex-col items-center justify-center gap-6 bg-white p-10 text-center text-black">
      <PrintButton />
      <div className="space-y-2">
        <p className="text-2xl font-semibold">नौकरी के लिए आवेदन करें · Apply for this job</p>
        <h1 className="text-5xl font-bold">{job.title}</h1>
        <p className="text-2xl">
          {job.location} · {formatSalary(job.salaryMin, job.salaryMax)}
        </p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL for print */}
      <img src={qr} alt="QR code" className="size-[110mm]" />
      <div className="space-y-1">
        <p className="text-3xl font-bold">फ़ोन से स्कैन करें · Scan with your phone</p>
        <p className="text-xl">बोलकर इंटरव्यू दें — हिंदी या English · Speak your interview in Hindi or English</p>
      </div>
      <p className="break-all font-mono text-sm text-neutral-600">{url}</p>
    </main>
  )
}
