-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ReportModule" AS ENUM ('BDG', 'PODS');

-- CreateEnum
CREATE TYPE "FileFormat" AS ENUM ('CSV', 'XLS', 'XLSX', 'DOC', 'DOCX', 'PDF');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'PARSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PREVIEW', 'COMMITTED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "format" "FileFormat" NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "module" "ReportModule" NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "module" "ReportModule" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PREVIEW',
    "recordsFound" INTEGER NOT NULL DEFAULT 0,
    "recordsValid" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "previewPayload" JSONB,
    "errorDetails" JSONB,
    "summary" TEXT,
    "committedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bdg_members" (
    "id" TEXT NOT NULL,
    "memberName" TEXT NOT NULL,
    "normalizedMemberName" TEXT NOT NULL,
    "totalInbound" INTEGER,
    "totalOutbound" INTEGER,
    "apacInbound" INTEGER,
    "apacOutbound" INTEGER,
    "menaInbound" INTEGER,
    "menaOutbound" INTEGER,
    "internationalInbound" INTEGER,
    "internationalOutbound" INTEGER,
    "ukeuInbound" INTEGER,
    "ukeuOutbound" INTEGER,
    "naInbound" INTEGER,
    "naOutbound" INTEGER,
    "periodStart" DATE,
    "periodEnd" DATE,
    "sourceImportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bdg_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT,
    "startDate" DATE,
    "developers" TEXT,
    "machineOwner" TEXT,
    "machineAlignedToProject" TEXT,
    "feCompletion" DOUBLE PRECISION,
    "beCompletion" DOUBLE PRECISION,
    "integrationCompletion" DOUBLE PRECISION,
    "sourceImportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pod_daily_updates" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "feCompletion" DOUBLE PRECISION,
    "beCompletion" DOUBLE PRECISION,
    "integrationCompletion" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pod_daily_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "uploads_module_idx" ON "uploads"("module");

-- CreateIndex
CREATE INDEX "uploads_uploadedById_idx" ON "uploads"("uploadedById");

-- CreateIndex
CREATE INDEX "import_jobs_module_idx" ON "import_jobs"("module");

-- CreateIndex
CREATE INDEX "import_jobs_status_idx" ON "import_jobs"("status");

-- CreateIndex
CREATE INDEX "import_jobs_createdAt_idx" ON "import_jobs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "bdg_members_normalizedMemberName_key" ON "bdg_members"("normalizedMemberName");

-- CreateIndex
CREATE INDEX "bdg_members_memberName_idx" ON "bdg_members"("memberName");

-- CreateIndex
CREATE INDEX "bdg_members_updatedAt_idx" ON "bdg_members"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "pods_normalizedName_key" ON "pods"("normalizedName");

-- CreateIndex
CREATE INDEX "pods_status_idx" ON "pods"("status");

-- CreateIndex
CREATE INDEX "pods_name_idx" ON "pods"("name");

-- CreateIndex
CREATE INDEX "pods_updatedAt_idx" ON "pods"("updatedAt");

-- CreateIndex
CREATE INDEX "pod_daily_updates_date_idx" ON "pod_daily_updates"("date");

-- CreateIndex
CREATE UNIQUE INDEX "pod_daily_updates_podId_date_key" ON "pod_daily_updates"("podId", "date");

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_committedById_fkey" FOREIGN KEY ("committedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bdg_members" ADD CONSTRAINT "bdg_members_sourceImportId_fkey" FOREIGN KEY ("sourceImportId") REFERENCES "import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pods" ADD CONSTRAINT "pods_sourceImportId_fkey" FOREIGN KEY ("sourceImportId") REFERENCES "import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pod_daily_updates" ADD CONSTRAINT "pod_daily_updates_podId_fkey" FOREIGN KEY ("podId") REFERENCES "pods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
