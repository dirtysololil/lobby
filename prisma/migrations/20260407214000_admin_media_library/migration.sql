ALTER TABLE `StickerPack`
  ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `Sticker`
  ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `CustomEmoji` (
  `id` VARCHAR(191) NOT NULL,
  `alias` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `fileKey` VARCHAR(191) NOT NULL,
  `originalName` VARCHAR(191) NULL,
  `mimeType` VARCHAR(191) NOT NULL,
  `fileSize` INTEGER NOT NULL,
  `width` INTEGER NOT NULL,
  `height` INTEGER NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  UNIQUE INDEX `CustomEmoji_alias_key`(`alias`),
  INDEX `CustomEmoji_isActive_deletedAt_sortOrder_idx`(`isActive`, `deletedAt`, `sortOrder`),
  INDEX `CustomEmoji_createdById_createdAt_idx`(`createdById`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GifAsset` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `tags` JSON NULL,
  `fileKey` VARCHAR(191) NOT NULL,
  `previewKey` VARCHAR(191) NULL,
  `originalName` VARCHAR(191) NULL,
  `mimeType` VARCHAR(191) NOT NULL,
  `fileSize` INTEGER NOT NULL,
  `width` INTEGER NOT NULL,
  `height` INTEGER NOT NULL,
  `durationMs` INTEGER NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  INDEX `GifAsset_isActive_deletedAt_sortOrder_idx`(`isActive`, `deletedAt`, `sortOrder`),
  INDEX `GifAsset_createdById_createdAt_idx`(`createdById`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DirectMessage`
  MODIFY `type` ENUM('TEXT', 'STICKER', 'GIF') NOT NULL DEFAULT 'TEXT',
  ADD COLUMN `gifId` VARCHAR(191) NULL;

CREATE INDEX `DirectMessage_gifId_idx` ON `DirectMessage`(`gifId`);

ALTER TABLE `CustomEmoji`
  ADD CONSTRAINT `CustomEmoji_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GifAsset`
  ADD CONSTRAINT `GifAsset_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DirectMessage`
  ADD CONSTRAINT `DirectMessage_gifId_fkey`
  FOREIGN KEY (`gifId`) REFERENCES `GifAsset`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
