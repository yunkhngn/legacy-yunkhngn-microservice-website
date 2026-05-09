/*
  Warnings:

  - Added the required column `isPublic` to the `settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isSystem` to the `settings` table without a default value. This is not possible if the table is not empty.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [settings] ADD [isSystem] BIT NOT NULL DEFAULT 0;
ALTER TABLE [settings] ADD [isPublic] BIT NOT NULL DEFAULT 0;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END
THROW

END CATCH
