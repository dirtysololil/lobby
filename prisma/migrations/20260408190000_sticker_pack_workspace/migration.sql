ALTER TABLE `StickerPack`
  ADD COLUMN `isPublished` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `isDiscoverable` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `isHidden` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `isArchived` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `Sticker`
  ADD COLUMN `isPublished` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `isHidden` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `isArchived` BOOLEAN NOT NULL DEFAULT false;

UPDATE `StickerPack`
SET
  `isPublished` = CASE
    WHEN `publishedAt` IS NOT NULL THEN true
    WHEN `isActive` = true AND `archivedAt` IS NULL THEN true
    ELSE false
  END,
  `isDiscoverable` = CASE
    WHEN `publishedAt` IS NOT NULL AND `deletedAt` IS NULL THEN true
    ELSE false
  END,
  `isHidden` = CASE
    WHEN `deletedAt` IS NULL AND `archivedAt` IS NULL AND `isActive` = false THEN true
    ELSE false
  END,
  `isArchived` = CASE
    WHEN `archivedAt` IS NOT NULL THEN true
    ELSE false
  END;

UPDATE `Sticker`
SET
  `isPublished` = CASE
    WHEN `publishedAt` IS NOT NULL THEN true
    WHEN `isActive` = true AND `archivedAt` IS NULL THEN true
    ELSE false
  END,
  `isHidden` = CASE
    WHEN `deletedAt` IS NULL AND `archivedAt` IS NULL AND `isActive` = false THEN true
    ELSE false
  END,
  `isArchived` = CASE
    WHEN `archivedAt` IS NOT NULL THEN true
    ELSE false
  END;

CREATE TABLE `UserStickerPack` (
  `userId` VARCHAR(191) NOT NULL,
  `packId` VARCHAR(191) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `UserStickerPack_userId_sortOrder_idx`(`userId`, `sortOrder`),
  INDEX `UserStickerPack_packId_createdAt_idx`(`packId`, `createdAt`),
  PRIMARY KEY (`userId`, `packId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `StickerPack_deletedAt_isPublished_isDiscoverable_sortOrder_idx`
  ON `StickerPack`(`deletedAt`, `isPublished`, `isDiscoverable`, `sortOrder`);

CREATE INDEX `StickerPack_coverStickerId_idx`
  ON `StickerPack`(`coverStickerId`);

CREATE INDEX `Sticker_packId_deletedAt_isPublished_sortOrder_idx`
  ON `Sticker`(`packId`, `deletedAt`, `isPublished`, `sortOrder`);

ALTER TABLE `StickerPack`
  ADD CONSTRAINT `StickerPack_coverStickerId_fkey`
  FOREIGN KEY (`coverStickerId`) REFERENCES `Sticker`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `UserStickerPack`
  ADD CONSTRAINT `UserStickerPack_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UserStickerPack`
  ADD CONSTRAINT `UserStickerPack_packId_fkey`
  FOREIGN KEY (`packId`) REFERENCES `StickerPack`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
