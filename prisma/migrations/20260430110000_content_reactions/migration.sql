-- CreateTable
CREATE TABLE `DirectMessageReaction` (
  `id` VARCHAR(191) NOT NULL,
  `messageId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `emoji` VARCHAR(32) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `DirectMessageReaction_messageId_userId_emoji_key`(`messageId`, `userId`, `emoji`),
  INDEX `DirectMessageReaction_messageId_emoji_idx`(`messageId`, `emoji`),
  INDEX `DirectMessageReaction_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeedPostReaction` (
  `id` VARCHAR(191) NOT NULL,
  `postId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `emoji` VARCHAR(32) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `FeedPostReaction_postId_userId_emoji_key`(`postId`, `userId`, `emoji`),
  INDEX `FeedPostReaction_postId_emoji_idx`(`postId`, `emoji`),
  INDEX `FeedPostReaction_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ForumTopicReaction` (
  `id` VARCHAR(191) NOT NULL,
  `topicId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `emoji` VARCHAR(32) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ForumTopicReaction_topicId_userId_emoji_key`(`topicId`, `userId`, `emoji`),
  INDEX `ForumTopicReaction_topicId_emoji_idx`(`topicId`, `emoji`),
  INDEX `ForumTopicReaction_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DirectMessageReaction`
  ADD CONSTRAINT `DirectMessageReaction_messageId_fkey`
  FOREIGN KEY (`messageId`) REFERENCES `DirectMessage`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DirectMessageReaction`
  ADD CONSTRAINT `DirectMessageReaction_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeedPostReaction`
  ADD CONSTRAINT `FeedPostReaction_postId_fkey`
  FOREIGN KEY (`postId`) REFERENCES `FeedPost`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeedPostReaction`
  ADD CONSTRAINT `FeedPostReaction_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ForumTopicReaction`
  ADD CONSTRAINT `ForumTopicReaction_topicId_fkey`
  FOREIGN KEY (`topicId`) REFERENCES `ForumTopic`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ForumTopicReaction`
  ADD CONSTRAINT `ForumTopicReaction_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
