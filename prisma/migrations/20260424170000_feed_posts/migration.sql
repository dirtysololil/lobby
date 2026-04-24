-- CreateTable
CREATE TABLE `FeedPost` (
  `id` VARCHAR(191) NOT NULL,
  `authorId` VARCHAR(191) NOT NULL,
  `kind` ENUM('ARTICLE', 'VIDEO') NOT NULL DEFAULT 'ARTICLE',
  `title` VARCHAR(191) NULL,
  `body` TEXT NOT NULL,
  `mediaUrl` TEXT NULL,
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `FeedPost_deletedAt_createdAt_idx`(`deletedAt`, `createdAt`),
  INDEX `FeedPost_authorId_createdAt_idx`(`authorId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FeedPost`
  ADD CONSTRAINT `FeedPost_authorId_fkey`
  FOREIGN KEY (`authorId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
