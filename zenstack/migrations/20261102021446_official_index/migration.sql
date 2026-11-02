-- CreateTable
CREATE TABLE "OfficialIndex" (
    "id" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfficialIndex_series_period_key" ON "OfficialIndex"("series", "period");
