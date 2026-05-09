-- AlterTable
ALTER TABLE [settings] ADD [isSystem] BIT NOT NULL DEFAULT 0;
ALTER TABLE [settings] ADD [isPublic] BIT NOT NULL DEFAULT 0;
