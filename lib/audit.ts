import { db } from './db';

interface LogAuditParams {
    action: string;
    performedBy: string;
    targetUser?: string;
    details?: string;
}

export async function logAudit({
    action,
    performedBy,
    targetUser,
    details,
}: LogAuditParams): Promise<void> {
    await db.auditLog.create({
        data: {
            action,
            performerId: performedBy,
            targetId: targetUser,
            details: details,
        },
    });
}
