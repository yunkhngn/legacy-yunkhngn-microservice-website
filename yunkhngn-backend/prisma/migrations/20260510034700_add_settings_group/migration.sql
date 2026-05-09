BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[settings] ADD [group] NVARCHAR(1000) NOT NULL CONSTRAINT [settings_group_df] DEFAULT 'Uncategorized';
ALTER TABLE [dbo].[settings] ADD [sortOrder] INT NOT NULL CONSTRAINT [settings_sortOrder_df] DEFAULT 0;

-- CreateIndex
CREATE NONCLUSTERED INDEX [settings_group_idx] ON [dbo].[settings]([group]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
