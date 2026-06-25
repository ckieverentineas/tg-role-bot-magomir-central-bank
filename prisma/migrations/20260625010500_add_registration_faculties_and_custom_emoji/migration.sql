ALTER TABLE "User" ADD COLUMN "characterName" TEXT;
ALTER TABLE "User" ADD COLUMN "className" TEXT;
ALTER TABLE "User" ADD COLUMN "spec" TEXT;
ALTER TABLE "User" ADD COLUMN "activeAllianceId" INTEGER REFERENCES "Alliance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Currency" ADD COLUMN "symbolCustomEmojiId" TEXT;

CREATE TABLE "Faculty" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "allianceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "symbolCustomEmojiId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Faculty_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "AllianceMember" ADD COLUMN "facultyId" INTEGER REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Faculty_allianceId_name_key" ON "Faculty"("allianceId", "name");
CREATE INDEX "Faculty_allianceId_sortOrder_idx" ON "Faculty"("allianceId", "sortOrder");
CREATE INDEX "Faculty_allianceId_isHidden_idx" ON "Faculty"("allianceId", "isHidden");
CREATE INDEX "User_activeAllianceId_idx" ON "User"("activeAllianceId");
CREATE INDEX "AllianceMember_facultyId_idx" ON "AllianceMember"("facultyId");
