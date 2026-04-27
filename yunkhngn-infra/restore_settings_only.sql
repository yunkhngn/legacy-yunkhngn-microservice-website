-- 1. Attach the backup as a temporary database
CREATE DATABASE [blogdb_temp] ON 
(FILENAME = '/var/opt/mssql/backups/blogdb_20260325_020001.mdf'), 
(FILENAME = '/var/opt/mssql/backups/blogdb_20260325_020001.ldf') 
FOR ATTACH;
GO

-- 2. Update existing settings in the main database with values from backup
-- We use a join on settingTitle to restore content
UPDATE s
SET s.content = t.content
FROM [blogdb].[dbo].[settings] s
INNER JOIN [blogdb_temp].[dbo].[settings] t ON s.settingTitle = t.settingTitle;
GO

-- 3. Insert any missing settings from backup that are not in main database
INSERT INTO [blogdb].[dbo].[settings] (settingTitle, content)
SELECT t.settingTitle, t.content
FROM [blogdb_temp].[dbo].[settings] t
WHERE NOT EXISTS (
    SELECT 1 FROM [blogdb].[dbo].[settings] s 
    WHERE s.settingTitle = t.settingTitle
);
GO

-- 4. Detach the temporary database
EXEC sp_detach_db 'blogdb_temp';
GO
