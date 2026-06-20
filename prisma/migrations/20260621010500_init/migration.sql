-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "displayName" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Alliance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "telegramChatId" BIGINT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AllianceMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "allianceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "className" TEXT,
    "spec" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AllianceMember_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AllianceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "allianceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "isTransferEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Currency_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Balance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Balance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Balance_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SbpTransferRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "allianceId" INTEGER NOT NULL,
    "currencyId" INTEGER,
    "minAmount" DECIMAL NOT NULL DEFAULT 0,
    "maxAmount" DECIMAL NOT NULL,
    "periodAmountLimit" DECIMAL,
    "periodKind" TEXT NOT NULL DEFAULT 'UNLIMITED',
    "periodSeconds" INTEGER,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SbpTransferRule_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SbpTransferRule_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SbpTransfer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "allianceId" INTEGER NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "senderUserId" INTEGER NOT NULL,
    "receiverUserId" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SbpTransfer_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SbpTransfer_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SbpTransfer_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SbpTransfer_receiverUserId_fkey" FOREIGN KEY ("receiverUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "allianceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shop_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShopCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShopCategory_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShopItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopId" INTEGER NOT NULL,
    "categoryId" INTEGER,
    "currencyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "price" DECIMAL NOT NULL,
    "stock" INTEGER,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "maxQuantityPerPurchase" INTEGER NOT NULL DEFAULT 1,
    "periodQuantityLimit" INTEGER,
    "limitPeriodKind" TEXT NOT NULL DEFAULT 'UNLIMITED',
    "limitPeriodSeconds" INTEGER,
    "limitStartsAt" DATETIME,
    "limitEndsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShopItem_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShopItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ShopCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ShopItem_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShopPurchase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalPrice" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShopPurchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ShopItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "purchaseId" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ShopItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "ShopPurchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LogTarget" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "allianceId" INTEGER,
    "scope" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "topicId" INTEGER,
    "title" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceTargetId" INTEGER,
    "createdByUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LogTarget_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LogTarget_sourceTargetId_fkey" FOREIGN KEY ("sourceTargetId") REFERENCES "LogTarget" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LogTarget_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "Alliance_slug_key" ON "Alliance"("slug");

-- CreateIndex
CREATE INDEX "AllianceMember_userId_idx" ON "AllianceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AllianceMember_allianceId_userId_key" ON "AllianceMember"("allianceId", "userId");

-- CreateIndex
CREATE INDEX "Currency_allianceId_sortOrder_idx" ON "Currency"("allianceId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_allianceId_name_key" ON "Currency"("allianceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Balance_userId_currencyId_key" ON "Balance"("userId", "currencyId");

-- CreateIndex
CREATE INDEX "SbpTransferRule_allianceId_currencyId_isActive_idx" ON "SbpTransferRule"("allianceId", "currencyId", "isActive");

-- CreateIndex
CREATE INDEX "SbpTransfer_senderUserId_currencyId_createdAt_idx" ON "SbpTransfer"("senderUserId", "currencyId", "createdAt");

-- CreateIndex
CREATE INDEX "SbpTransfer_receiverUserId_currencyId_createdAt_idx" ON "SbpTransfer"("receiverUserId", "currencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_allianceId_name_key" ON "Shop"("allianceId", "name");

-- CreateIndex
CREATE INDEX "ShopCategory_shopId_sortOrder_idx" ON "ShopCategory"("shopId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ShopCategory_shopId_name_key" ON "ShopCategory"("shopId", "name");

-- CreateIndex
CREATE INDEX "ShopItem_shopId_isHidden_idx" ON "ShopItem"("shopId", "isHidden");

-- CreateIndex
CREATE UNIQUE INDEX "ShopItem_shopId_name_key" ON "ShopItem"("shopId", "name");

-- CreateIndex
CREATE INDEX "ShopPurchase_userId_itemId_createdAt_idx" ON "ShopPurchase"("userId", "itemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_purchaseId_key" ON "InventoryItem"("purchaseId");

-- CreateIndex
CREATE INDEX "InventoryItem_userId_idx" ON "InventoryItem"("userId");

-- CreateIndex
CREATE INDEX "LogTarget_allianceId_eventType_scope_isActive_idx" ON "LogTarget"("allianceId", "eventType", "scope", "isActive");

-- CreateIndex
CREATE INDEX "LogTarget_sourceTargetId_idx" ON "LogTarget"("sourceTargetId");

-- CreateIndex
CREATE UNIQUE INDEX "LogTarget_scope_allianceId_eventType_chatId_topicId_key" ON "LogTarget"("scope", "allianceId", "eventType", "chatId", "topicId");

