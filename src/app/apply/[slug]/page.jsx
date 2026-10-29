import { notFound } from "next/navigation"
import { Noto_Sans_Devanagari } from "next/font/google"
import { prisma } from "@/lib/prisma"
import { formatSalary } from "@/lib/jobs/format"
import { getLanguages, publicLanguage } from "@/lib/languages"
import { InterviewApp } from "@/components/interview/interview-app"
import { getTtsSettings } from "@/lib/settings"

export const dynamic = "force-dynamic"

// Clear Hindi text on cheap phones that lack a good Devanagari system font
const devanagari = Noto_Sans_Devanagari({ subsets: ["devanagari", "latin"], weight: ["400", "500", "700"] })

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" }

export async function generateMetadata({ params }) {
  const { slug } = await params
  const job = await prisma.job.findUnique({ where: { slug }, select: { title: true } })
  return { title: job ? `${job.title} — Apply` : "Job not found", robots: { index: false } }
}

export default async function ApplyPage({ params }) {
  const { slug } = await params
  const job = await prisma.job.findUnique({ where: { slug } })
  if (!job) notFound()

  const { mode } = await getTtsSettings()
  return (
    <div className={devanagari.className}>
      <InterviewApp
        job={{
          slug: job.slug,
          title: job.title,
          location: job.location,
          salary: formatSalary(job.salaryMin, job.salaryMax),
          closed: job.status !== "OPEN",
        }}
        languages={getLanguages().map(publicLanguage)}
        ttsMode={mode}
      />
    </div>
  )
}
