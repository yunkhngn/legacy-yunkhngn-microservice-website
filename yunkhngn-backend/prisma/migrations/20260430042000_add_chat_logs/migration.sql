BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[chat_logs] (
    [id] NVARCHAR(1000) NOT NULL,
    [userMessage] NVARCHAR(MAX) NOT NULL,
    [aiResponse] NVARCHAR(MAX) NOT NULL,
    [imageUrl] NVARCHAR(1000),
    [language] NVARCHAR(1000) NOT NULL CONSTRAINT [chat_logs_language_df] DEFAULT 'vi',
    [responseTime] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [chat_logs_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [chat_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [chat_logs_createdAt_idx] ON [dbo].[chat_logs]([createdAt]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
