BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[knowledge_entries] (
    [id] NVARCHAR(1000) NOT NULL,
    [category] NVARCHAR(1000) NOT NULL CONSTRAINT [knowledge_entries_category_df] DEFAULT 'general',
    [title] NVARCHAR(1000) NOT NULL,
    [content] NVARCHAR(MAX) NOT NULL,
    [synced] BIT NOT NULL CONSTRAINT [knowledge_entries_synced_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [knowledge_entries_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [knowledge_entries_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [knowledge_entries_category_idx] ON [dbo].[knowledge_entries]([category]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
