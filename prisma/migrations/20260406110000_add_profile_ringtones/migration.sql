ALTER TABLE `Profile`
    ADD COLUMN `customRingtoneFileKey` VARCHAR(191) NULL,
    ADD COLUMN `customRingtoneOriginalName` VARCHAR(191) NULL,
    ADD COLUMN `customRingtoneMimeType` VARCHAR(191) NULL,
    ADD COLUMN `customRingtoneBytes` INTEGER NULL,
    ADD COLUMN `callRingtonePreset` ENUM('CLASSIC', 'SOFT', 'DIGITAL', 'PULSE', 'NIGHT', 'CLEAR_SIGNAL') NOT NULL DEFAULT 'CLASSIC';
