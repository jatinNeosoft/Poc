"use client"

import { useRouter } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TagInput } from "@/components/admin/tag-input"
import { QuestionListEditor } from "@/components/admin/question-list-editor"
import { jobInputSchema } from "@/lib/validators/job"
import { PROVIDER_LABELS } from "@/lib/ai/models"
import { JOB_TYPE_LABELS } from "@/lib/jobs/format"

const DEFAULT_PROVIDER = "DEFAULT" // Select needs a non-null value for "use the env default"

const toNumberOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v))

function FieldError({ error }) {
  return error ? <p className="text-sm text-destructive">{error.message}</p> : null
}

function emptyJob() {
  return {
    title: "",
    description: "",
    location: "",
    salaryMin: null,
    salaryMax: null,
    jobType: "FULL_TIME",
    openings: 1,
    requiredSkills: [],
    experienceRequired: "",
    customQuestions: [],
    aiProvider: null,
    aiModel: null,
  }
}

/**
 * Create / edit form. `job` given → edit mode (PUT), otherwise create (POST).
 * `defaultAI` is the default from Settings ({ provider, model }) shown in the "Default" option;
 * `models` = selectable models per provider ({ CLAUDE: [{ id, label }], OPENAI: [...] }).
 */
export function JobForm({ job, defaultAI, models }) {
  const router = useRouter()
  const isEdit = !!job

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(jobInputSchema),
    defaultValues: job
      ? {
          ...emptyJob(),
          ...Object.fromEntries(Object.keys(emptyJob()).map((k) => [k, job[k]])),
          experienceRequired: job.experienceRequired ?? "",
        }
      : emptyJob(),
  })

  const provider = useWatch({ control, name: "aiProvider" })

  async function onSubmit(values) {
    const res = await fetch(isEdit ? `/api/admin/jobs/${job.id}` : "/api/admin/jobs", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      for (const [field, messages] of Object.entries(body.fieldErrors ?? {})) {
        setError(field, { message: messages[0] })
      }
      toast.error(body.error || "Could not save the job")
      return
    }

    toast.success(isEdit ? "Job updated" : "Job created")
    if (body.warning) toast.warning(body.warning, { duration: 10000 })
    router.push(`/admin/jobs/${body.job.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
          <CardDescription>The AI recruiter explains this job to candidates in simple words.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">Job title</Label>
            <Input id="title" placeholder="Delivery Driver" aria-invalid={!!errors.title} {...register("title")} />
            <FieldError error={errors.title} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={6}
              placeholder="What will the worker do every day? Timings, place, vehicle, physical work…"
              aria-invalid={!!errors.description}
              {...register("description")}
            />
            <FieldError error={errors.description} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" placeholder="Hinjewadi, Pune" aria-invalid={!!errors.location} {...register("location")} />
            <FieldError error={errors.location} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobType">Job type</Label>
            <Controller
              control={control}
              name="jobType"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={Object.entries(JOB_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                >
                  <SelectTrigger id="jobType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="salaryMin">Salary min (₹/month)</Label>
            <Input
              id="salaryMin"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="15000"
              aria-invalid={!!errors.salaryMin}
              {...register("salaryMin", { setValueAs: toNumberOrNull })}
            />
            <FieldError error={errors.salaryMin} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="salaryMax">Salary max (₹/month)</Label>
            <Input
              id="salaryMax"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="20000"
              aria-invalid={!!errors.salaryMax}
              {...register("salaryMax", { setValueAs: toNumberOrNull })}
            />
            <FieldError error={errors.salaryMax} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="openings">Number of openings</Label>
            <Input
              id="openings"
              type="number"
              inputMode="numeric"
              min={1}
              aria-invalid={!!errors.openings}
              {...register("openings", { setValueAs: toNumberOrNull })}
            />
            <FieldError error={errors.openings} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="experienceRequired">Experience required</Label>
            <Input
              id="experienceRequired"
              placeholder="1–2 years, or Freshers welcome"
              aria-invalid={!!errors.experienceRequired}
              {...register("experienceRequired")}
            />
            <FieldError error={errors.experienceRequired} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="requiredSkills">Required skills</Label>
            <Controller
              control={control}
              name="requiredSkills"
              render={({ field }) => (
                <TagInput
                  id="requiredSkills"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={!!errors.requiredSkills}
                  placeholder="Type a skill and press Enter (e.g. Two-wheeler driving)"
                />
              )}
            />
            <FieldError error={errors.requiredSkills} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your screening questions</CardTitle>
          <CardDescription>
            Optional. The AI asks these first, then adds 2–4 of its own based on the job description.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Controller
            control={control}
            name="customQuestions"
            render={({ field }) => (
              <QuestionListEditor
                value={field.value}
                onChange={field.onChange}
                placeholder="e.g. Can you work night shifts?"
              />
            )}
          />
          <FieldError error={errors.customQuestions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI model</CardTitle>
          <CardDescription>Which AI runs the interviews for this job. Cheaper models lower the cost per interview.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="aiProvider">Provider</Label>
            <Controller
              control={control}
              name="aiProvider"
              render={({ field }) => {
                const items = [
                  { value: DEFAULT_PROVIDER, label: `Default (${PROVIDER_LABELS[defaultAI.provider]})` },
                  ...Object.entries(PROVIDER_LABELS).map(([value, label]) => ({ value, label })),
                ]
                return (
                  <Select
                    value={field.value ?? DEFAULT_PROVIDER}
                    items={items}
                    onValueChange={(v) => {
                      const next = v === DEFAULT_PROVIDER ? null : v
                      field.onChange(next)
                      setValue("aiModel", next ? (models[next][0]?.id ?? null) : null, { shouldValidate: true })
                    }}
                  >
                    <SelectTrigger id="aiProvider" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="aiModel">Model</Label>
            {provider ? (
              <Controller
                control={control}
                name="aiModel"
                render={({ field }) => {
                  const items = models[provider].map((m) => ({ value: m.id, label: m.label }))
                  return (
                    <Select value={field.value} onValueChange={field.onChange} items={items}>
                      <SelectTrigger id="aiModel" className="w-full" aria-invalid={!!errors.aiModel}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((i) => (
                          <SelectItem key={i.value} value={i.value}>
                            {i.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                }}
              />
            ) : (
              <p className="flex h-8 items-center text-sm text-muted-foreground">
                {defaultAI.model} <span className="ml-1">(default from Settings)</span>
              </p>
            )}
            <FieldError error={errors.aiModel} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {isEdit ? "Save changes" : isSubmitting ? "Creating & generating questions…" : "Create job"}
        </Button>
      </div>
    </form>
  )
}
