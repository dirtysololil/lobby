ALTER TABLE `DirectMessage`
  ADD COLUMN `stickerSnapshot` JSON NULL;

ALTER TABLE `StickerPack`
  ADD COLUMN `slug` VARCHAR(191) NULL,
  ADD COLUMN `description` VARCHAR(191) NULL,
  ADD COLUMN `coverStickerId` VARCHAR(191) NULL,
  ADD COLUMN `publishedAt` DATETIME(3) NULL,
  ADD COLUMN `archivedAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `StickerPack_slug_key` ON `StickerPack`(`slug`);
CREATE INDEX `StickerPack_publishedAt_archivedAt_deletedAt_sortOrder_idx`
  ON `StickerPack`(`publishedAt`, `archivedAt`, `deletedAt`, `sortOrder`);

ALTER TABLE `Sticker`
  ADD COLUMN `type` ENUM('STATIC', 'ANIMATED') NOT NULL DEFAULT 'STATIC',
  ADD COLUMN `animatedFileKey` VARCHAR(191) NULL,
  ADD COLUMN `animatedMimeType` VARCHAR(191) NULL,
  ADD COLUMN `sourceFileKey` VARCHAR(191) NULL,
  ADD COLUMN `sourceMimeType` VARCHAR(191) NULL,
  ADD COLUMN `sourceFileSize` INTEGER NULL,
  ADD COLUMN `durationMs` INTEGER NULL,
  ADD COLUMN `keywords` JSON NULL,
  ADD COLUMN `searchText` TEXT NULL,
  ADD COLUMN `publishedAt` DATETIME(3) NULL,
  ADD COLUMN `archivedAt` DATETIME(3) NULL;

CREATE INDEX `Sticker_packId_publishedAt_archivedAt_deletedAt_sortOrder_idx`
  ON `Sticker`(`packId`, `publishedAt`, `archivedAt`, `deletedAt`, `sortOrder`);
