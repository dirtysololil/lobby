ALTER TABLE `DirectMessage`
    ADD COLUMN `type` ENUM('TEXT', 'STICKER') NOT NULL DEFAULT 'TEXT',
    ADD COLUMN `stickerId` VARCHAR(191) NULL;

CREATE TABLE `StickerPack` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    INDEX `StickerPack_ownerId_deletedAt_sortOrder_idx`(`ownerId`, `deletedAt`, `sortOrder`),
    PRIMARY KEY (`id`)
);

CREATE TABLE `Sticker` (
    `id` VARCHAR(191) NOT NULL,
    `packId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `fileKey` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `isAnimated` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    INDEX `Sticker_packId_deletedAt_sortOrder_idx`(`packId`, `deletedAt`, `sortOrder`),
    PRIMARY KEY (`id`)
);

CREATE TABLE `StickerRecent` (
    `userId` VARCHAR(191) NOT NULL,
    `stickerId` VARCHAR(191) NOT NULL,
    `packId` VARCHAR(191) NOT NULL,
    `usedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `usageCount` INTEGER NOT NULL DEFAULT 1,
    INDEX `StickerRecent_userId_usedAt_idx`(`userId`, `usedAt`),
    INDEX `StickerRecent_packId_usedAt_idx`(`packId`, `usedAt`),
    PRIMARY KEY (`userId`, `stickerId`)
);

CREATE INDEX `DirectMessage_stickerId_idx` ON `DirectMessage`(`stickerId`);
CREATE INDEX `DirectMessage_type_idx` ON `DirectMessage`(`type`);

ALTER TABLE `StickerPack` ADD CONSTRAINT `StickerPack_ownerId_fkey`
    FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Sticker` ADD CONSTRAINT `Sticker_packId_fkey`
    FOREIGN KEY (`packId`) REFERENCES `StickerPack`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `StickerRecent` ADD CONSTRAINT `StickerRecent_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `StickerRecent` ADD CONSTRAINT `StickerRecent_stickerId_fkey`
    FOREIGN KEY (`stickerId`) REFERENCES `Sticker`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `StickerRecent` ADD CONSTRAINT `StickerRecent_packId_fkey`
    FOREIGN KEY (`packId`) REFERENCES `StickerPack`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DirectMessage` ADD CONSTRAINT `DirectMessage_stickerId_fkey`
    FOREIGN KEY (`stickerId`) REFERENCES `Sticker`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
