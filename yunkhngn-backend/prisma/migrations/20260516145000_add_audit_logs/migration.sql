
> be@0.0.1 npx
> prisma migrate diff --from-schema-datamodel prisma/schema.old.prisma --to-schema-datamodel prisma/schema.prisma --script

BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[audit_logs] (
    [id] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [entity] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000),
    [userId] NVARCHAR(1000),
    [details] NVARCHAR(max),
    [ipAddress] NVARCHAR(1000),
    [userAgent] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [audit_logs_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_action_idx] ON [dbo].[audit_logs]([action]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_entity_idx] ON [dbo].[audit_logs]([entity]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_createdAt_idx] ON [dbo].[audit_logs]([createdAt]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

