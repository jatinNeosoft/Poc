-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('NEW', 'SHORTLISTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "InterviewStep" AS ENUM ('GREETING', 'CV', 'VIDEO', 'SCREENING', 'DONE');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('CLAUDE', 'OPENAI');

-- CreateEnum
CREATE TYPE "AIPurpose" AS ENUM ('INTERVIEW_TURN', 'SCREENING_GEN', 'SUMMARY', 'TTS');

-- CreateEnum
CREATE TYPE "VideoChoice" AS ENUM ('PENDING', 'YES', 'NO');

-- CreateEnum
CREATE TYPE "AnswerQuality" AS ENUM ('GOOD', 'OKAY', 'POOR');

-- CreateEnum
CREATE TYPE "AnswerFit" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'NA');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "jobType" "JobType" NOT NULL,
    "openings" INTEGER NOT NULL DEFAULT 1,
    "requiredSkills" TEXT[],
    "experienceRequired" TEXT,
    "customQuestions" TEXT[],
    "generatedQuestions" TEXT[],
    "aiProvider" "AIProvider",
    "aiModel" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fullName" TEXT,
    "phone" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "city" TEXT,
    "willingToRelocate" BOOLEAN,
    "education" TEXT,
    "totalExperienceYears" DOUBLE PRECISION,
    "previousJobs" JSONB,
    "skills" TEXT[],
    "languagesKnown" TEXT[],
    "certifications" TEXT[],
    "currentSalary" TEXT,
    "expectedSalary" TEXT,
    "joiningDate" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'NEW',
    "aiSummary" TEXT,
    "fitScore" INTEGER,
    "fitReason" TEXT,
    "flaggedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "step" "InterviewStep" NOT NULL DEFAULT 'GREETING',
    "videoChoice" "VideoChoice" NOT NULL DEFAULT 'PENDING',
    "screeningIdx" INTEGER NOT NULL DEFAULT 0,
    "resumeToken" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerCheck" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "messageId" TEXT,
    "target" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "inputMode" TEXT NOT NULL,
    "sttConfidence" DOUBLE PRECISION,
    "relevant" BOOLEAN NOT NULL,
    "clear" BOOLEAN NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "misheard" BOOLEAN NOT NULL,
    "quality" "AnswerQuality" NOT NULL,
    "fit" "AnswerFit" NOT NULL DEFAULT 'NA',
    "fitReason" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningAnswer" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "quality" "AnswerQuality",
    "fit" "AnswerFit",
    "fitReason" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreeningAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "durationSec" INTEGER,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsage" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT,
    "jobId" TEXT,
    "purpose" "AIPurpose" NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DECIMAL(12,6) NOT NULL,
    "costInr" DECIMAL(12,4) NOT NULL,
    "usdToInr" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelPricing" (
    "id" TEXT NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "inputPerMillionUsd" DECIMAL(10,4) NOT NULL,
    "outputPerMillionUsd" DECIMAL(10,4) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Job_slug_key" ON "Job"("slug");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Candidate_status_idx" ON "Candidate"("status");

-- CreateIndex
CREATE INDEX "Candidate_createdAt_idx" ON "Candidate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_jobId_phone_key" ON "Candidate"("jobId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Interview_candidateId_key" ON "Interview"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Interview_resumeToken_key" ON "Interview"("resumeToken");

-- CreateIndex
CREATE INDEX "Interview_jobId_startedAt_idx" ON "Interview"("jobId", "startedAt");

-- CreateIndex
CREATE INDEX "Interview_language_idx" ON "Interview"("language");

-- CreateIndex
CREATE INDEX "Message_interviewId_createdAt_idx" ON "Message"("interviewId", "createdAt");

-- CreateIndex
CREATE INDEX "AnswerCheck_interviewId_target_idx" ON "AnswerCheck"("interviewId", "target");

-- CreateIndex
CREATE UNIQUE INDEX "Video_candidateId_key" ON "Video"("candidateId");

-- CreateIndex
CREATE INDEX "AIUsage_createdAt_idx" ON "AIUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AIUsage_provider_idx" ON "AIUsage"("provider");

-- CreateIndex
CREATE INDEX "AIUsage_jobId_idx" ON "AIUsage"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelPricing_provider_model_key" ON "ModelPricing"("provider", "model");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerCheck" ADD CONSTRAINT "AnswerCheck_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningAnswer" ADD CONSTRAINT "ScreeningAnswer_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
