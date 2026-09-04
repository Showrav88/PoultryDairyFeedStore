-- AlterEnum: FARMER was used in code but never added to DB enum
ALTER TYPE "AuditEntity" ADD VALUE IF NOT EXISTS 'FARMER';
