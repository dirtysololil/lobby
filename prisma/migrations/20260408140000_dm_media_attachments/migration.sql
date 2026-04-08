ALTER TABLE `DirectMessage`
  MODIFY COLUMN `type` ENUM('TEXT', 'STICKER', 'GIF', 'MEDIA', 'FILE') NOT NULL DEFAULT 'TEXT';

ALTER TABLE `DirectMessageLinkEmbed`
  MODIFY COLUMN `provider` ENUM('TENOR', 'DIRECT_MEDIA', 'OPEN_GRAPH') NOT NULL,
  ADD COLUMN `kind` ENUM('IMAGE', 'VIDEO', 'GIF') NULL AFTER `status`,
  ADD COLUMN `previewUrl` TEXT NULL AFTER `canonicalUrlHash`,
  ADD COLUMN `playableUrl` TEXT NULL AFTER `previewUrl`,
  ADD COLUMN `posterUrl` TEXT NULL AFTER `playableUrl`;

UPDATE `DirectMessageLinkEmbed`
SET
  `previewUrl` = COALESCE(`previewUrl`, `previewImage`),
  `playableUrl` = COALESCE(`playableUrl`, `animatedMediaUrl`),
  `posterUrl` = COALESCE(`posterUrl`, `previewImage`);

UPDATE `DirectMessageLinkEmbed`
SET `kind` = CASE
  WHEN COALESCE(`playableUrl`, '') REGEXP '\\.(mp4|webm)(\\?|$)' THEN 'VIDEO'
  WHEN COALESCE(`playableUrl`, '') REGEXP '\\.(gif|webp)(\\?|$)' THEN 'GIF'
  WHEN COALESCE(`previewUrl`, '') REGEXP '\\.(gif)(\\?|$)' THEN 'GIF'
  WHEN COALESCE(`previewUrl`, '') <> '' THEN 'IMAGE'
  ELSE NULL
END
WHERE `kind` IS NULL;

ALTER TABLE `DirectMessageLinkEmbed`
  DROP COLUMN `title`,
  DROP COLUMN `previewImage`,
  DROP COLUMN `animatedMediaUrl`,
  DROP COLUMN `contentType`;

CREATE TABLE `DirectMessageAttachment` (
  `id` VARCHAR(191) NOT NULL,
  `messageId` VARCHAR(191) NOT NULL,
  `kind` ENUM('IMAGE', 'VIDEO', 'DOCUMENT') NOT NULL,
  `fileKey` VARCHAR(191) NOT NULL,
  `previewKey` VARCHAR(191) NULL,
  `originalName` VARCHAR(191) NOT NULL,
  `mimeType` VARCHAR(191) NOT NULL,
  `fileSize` INTEGER NOT NULL,
  `width` INTEGER NULL,
  `height` INTEGER NULL,
  `durationMs` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `DirectMessageAttachment_messageId_key`(`messageId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DirectMessageAttachment`
  ADD CONSTRAINT `DirectMessageAttachment_messageId_fkey`
  FOREIGN KEY (`messageId`) REFERENCES `DirectMessage`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
