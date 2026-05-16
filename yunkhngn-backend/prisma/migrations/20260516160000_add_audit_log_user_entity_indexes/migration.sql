BEGIN TRY

BEGIN TRAN;

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_userId_idx] ON [dbo].[audit_logs]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_logs_entity_entityId_idx] ON [dbo].[audit_logs]([entity], [entityId]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
