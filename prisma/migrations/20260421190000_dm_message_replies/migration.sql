ALTER TABLE `DirectMessage`
  ADD COLUMN `replyToMessageId` VARCHAR(191) NULL AFTER `gifId`;

CREATE INDEX `DirectMessage_replyToMessageId_idx`
  ON `DirectMessage`(`replyToMessageId`);

ALTER TABLE `DirectMessage`
  ADD CONSTRAINT `DirectMessage_replyToMessageId_fkey`
  FOREIGN KEY (`replyToMessageId`) REFERENCES `DirectMessage`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
