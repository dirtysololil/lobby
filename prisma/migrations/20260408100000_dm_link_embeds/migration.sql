CREATE TABLE `DirectMessageLinkEmbed` (
  `id` VARCHAR(191) NOT NULL,
  `messageId` VARCHAR(191) NOT NULL,
  `provider` ENUM('TENOR') NOT NULL,
  `status` ENUM('PENDING', 'READY', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `sourceUrl` TEXT NOT NULL,
  `sourceUrlHash` CHAR(64) NOT NULL,
  `canonicalUrl` TEXT NULL,
  `canonicalUrlHash` CHAR(64) NULL,
  `title` VARCHAR(191) NULL,
  `previewImage` TEXT NULL,
  `animatedMediaUrl` TEXT NULL,
  `width` INTEGER NULL,
  `height` INTEGER NULL,
  `aspectRatio` DOUBLE NULL,
  `contentType` VARCHAR(191) NULL,
  `failureCode` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `DirectMessageLinkEmbed_messageId_key`(`messageId`),
  INDEX `DirectMessageLinkEmbed_provider_sourceUrlHash_idx`(`provider`, `sourceUrlHash`),
  INDEX `DirectMessageLinkEmbed_provider_canonicalUrlHash_idx`(`provider`, `canonicalUrlHash`),
  INDEX `DirectMessageLinkEmbed_status_updatedAt_idx`(`status`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DirectMessageLinkEmbed`
  ADD CONSTRAINT `DirectMessageLinkEmbed_messageId_fkey`
  FOREIGN KEY (`messageId`) REFERENCES `DirectMessage`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
