import path from "node:path"
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { CV_FIELDS } from "@/lib/interview/fields"
import { dateFmt, formatCvValue, LANGUAGE_NAMES } from "@/lib/candidates/format"

// Noto Sans (Latin + ₹) with Noto Sans Devanagari as fallback, so Hindi text also renders
const fontFile = (pkg, file) => path.join(process.cwd(), "node_modules", "@fontsource", pkg, "files", file)
let fontsRegistered = false
function registerFonts() {
  if (fontsRegistered) return
  Font.register({
    family: "NotoSans",
    fonts: [
      { src: fontFile("noto-sans", "noto-sans-latin-400-normal.woff") },
      { src: fontFile("noto-sans", "noto-sans-latin-700-normal.woff"), fontWeight: 700 },
    ],
  })
  Font.register({
    family: "NotoSansDevanagari",
    fonts: [
      { src: fontFile("noto-sans-devanagari", "noto-sans-devanagari-devanagari-400-normal.woff") },
      { src: fontFile("noto-sans-devanagari", "noto-sans-devanagari-devanagari-700-normal.woff"), fontWeight: 700 },
    ],
  })
  Font.registerHyphenationCallback((word) => [word]) // don't break words with hyphens
  fontsRegistered = true
}

const ACCENT = "#0f766e"

const s = StyleSheet.create({
  page: { padding: 36, fontFamily: ["NotoSans", "NotoSansDevanagari"], fontSize: 10, color: "#1f2937", lineHeight: 1.4 },
  header: { borderBottom: `2pt solid ${ACCENT}`, paddingBottom: 10, marginBottom: 14 },
  // Explicit lineHeight: the page-level one is resolved against the 10pt body size and would clip this
  name: { fontSize: 22, lineHeight: 1.25, fontWeight: 700, color: "#111827" },
  applied: { fontSize: 11, color: ACCENT, fontWeight: 700, marginTop: 2 },
  contact: { fontSize: 10, color: "#4b5563", marginTop: 4 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 },
  row: { flexDirection: "row", paddingVertical: 2.5, borderBottom: "0.5pt solid #e5e7eb" },
  label: { width: 140, color: "#6b7280" },
  value: { flex: 1 },
  job: { marginBottom: 4 },
  jobRole: { fontWeight: 700 },
  qa: { marginBottom: 6 },
  q: { color: "#6b7280" },
  a: { fontWeight: 700 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 8, color: "#9ca3af", textAlign: "center" },
})

function Row({ label, children }) {
  return (
    <View style={s.row} wrap={false}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{children}</Text>
    </View>
  )
}

const field = (c, key) => formatCvValue(key, c[key])
const LABEL = Object.fromEntries(CV_FIELDS.map((f) => [f.key, f.label]))

/** Candidate CV built from the interview data (facts only — no AI score). */
export function CvDocument({ candidate, job, interview }) {
  registerFonts()
  const c = candidate
  const contact = [c.phone, c.city, c.age ? `${c.age} years` : null, c.gender].filter(Boolean).join("  ·  ")
  const jobs = Array.isArray(c.previousJobs) ? c.previousJobs : []

  return (
    <Document title={`CV - ${c.fullName ?? "Candidate"}`} author="HireVoice">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.name}>{c.fullName || "Candidate"}</Text>
          <Text style={s.applied}>
            Applied for: {job.title} · {job.location}
          </Text>
          {contact && <Text style={s.contact}>{contact}</Text>}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Work experience</Text>
          <Row label={LABEL.totalExperienceYears}>{field(c, "totalExperienceYears")}</Row>
          {jobs.length > 0 && (
            <View style={{ marginTop: 6 }}>
              {jobs.map((j, i) => (
                <View key={i} style={s.job} wrap={false}>
                  <Text style={s.jobRole}>{[j.role, j.company].filter(Boolean).join(" — ")}</Text>
                  {j.duration && <Text style={{ color: "#4b5563" }}>{j.duration}</Text>}
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Skills & qualifications</Text>
          <Row label={LABEL.skills}>{field(c, "skills")}</Row>
          <Row label={LABEL.education}>{field(c, "education")}</Row>
          <Row label={LABEL.certifications}>{field(c, "certifications")}</Row>
          <Row label={LABEL.languagesKnown}>{field(c, "languagesKnown")}</Row>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Salary & availability</Text>
          <Row label={LABEL.currentSalary}>{field(c, "currentSalary")}</Row>
          <Row label={LABEL.expectedSalary}>{field(c, "expectedSalary")}</Row>
          <Row label={LABEL.joiningDate}>{field(c, "joiningDate")}</Row>
          <Row label={LABEL.willingToRelocate}>{field(c, "willingToRelocate")}</Row>
        </View>

        {c.screeningAnswers.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Screening answers</Text>
            {c.screeningAnswers.map((a) => (
              <View key={a.id} style={s.qa} wrap={false}>
                <Text style={s.q}>{a.question}</Text>
                <Text style={s.a}>{a.answer}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Interview</Text>
          <Row label="Date">{dateFmt.format(interview.startedAt)}</Row>
          <Row label="Language">{LANGUAGE_NAMES[interview.language] ?? interview.language}</Row>
          <Row label="Intro video">{c.video ? "Recorded (view in HireVoice)" : "Not recorded"}</Row>
        </View>

        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Created by HireVoice from an AI voice interview · Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  )
}
