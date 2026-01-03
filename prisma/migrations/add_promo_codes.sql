-- Add pendingPromoCode and creditApplied columns to Shop table
ALTER TABLE `Shop` ADD COLUMN `pendingPromoCode` VARCHAR(191) NULL;
ALTER TABLE `Shop` ADD COLUMN `creditApplied` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable PromoCode
CREATE TABLE `PromoCode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `type` ENUM('RECURRING', 'ONE_TIME') NOT NULL,
    `discountPercent` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PromoCode_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed the promo codes
INSERT INTO `PromoCode` (`code`, `type`, `discountPercent`, `isActive`, `description`, `createdAt`, `updatedAt`) VALUES
('90FIRSTMONTH', 'ONE_TIME', 90, true, '90% off first month - one-time discount', NOW(), NOW()),
('50MONTHLY', 'RECURRING', 50, true, '50% off every month - recurring discount', NOW(), NOW())
ON DUPLICATE KEY UPDATE `isActive` = VALUES(`isActive`), `updatedAt` = NOW();
