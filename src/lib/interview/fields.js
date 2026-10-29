// CV fields in the order the AI asks them. `ask` is the instruction given to the model.
export const CV_FIELDS = [
  { key: "fullName", label: "Full name", ask: "Full name" },
  { key: "phone", label: "Mobile number", ask: "Mobile number (10 digits)" },
  { key: "age", label: "Age", ask: "Age in years" },
  { key: "gender", label: "Gender", ask: "Gender — OPTIONAL: tell them they may skip it", optional: true },
  { key: "city", label: "City / area", ask: "City and area where they live now" },
  {
    key: "willingToRelocate",
    label: "Willing to relocate",
    ask: "Are they willing to move to the job location (yes/no). If they already live in or near the job location, do not ask — put it in skippedFields",
  },
  { key: "education", label: "Education", ask: "Education — highest class or degree passed (no schooling is fine)" },
  { key: "totalExperienceYears", label: "Total experience", ask: "Total work experience in years" },
  {
    key: "previousJobs",
    label: "Previous jobs",
    ask: "Previous jobs — company, role and how long. For a fresher put it in skippedFields",
  },
  { key: "skills", label: "Skills", ask: "Main skills / work they can do" },
  { key: "languagesKnown", label: "Languages known", ask: "Languages they can speak" },
  {
    key: "certifications",
    label: "Certificates / licences",
    ask: "Certificates or licences, e.g. driving licence (none is fine → skippedFields)",
  },
  {
    key: "currentSalary",
    label: "Current salary",
    ask: "Current or last monthly salary (if they never worked → skippedFields)",
  },
  { key: "expectedSalary", label: "Expected salary", ask: "Expected monthly salary" },
  { key: "joiningDate", label: "Joining date", ask: "When they can join" },
]

export const CV_FIELD_KEYS = CV_FIELDS.map((f) => f.key)

export const FIELD_BY_KEY = Object.fromEntries(CV_FIELDS.map((f) => [f.key, f]))

// Max answers per question: first try + 2 retries, then flag and move on
export const MAX_ATTEMPTS = 3
