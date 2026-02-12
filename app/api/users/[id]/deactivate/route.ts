import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { requireRole } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        // Authenticate
        const session = await requireAuth();

        // Only SUPER_ADMIN and STATE_DIRECTOR can deactivate users
        requireRole(session, ['SUPER_ADMIN', 'STATE_DIRECTOR', 'CITY_DIRECTOR']);

        // Get user from unified DB
        const user = await db.user.findUnique({
            where: { id },
            select: { id: true, isActive: true },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Deactivate user in unified DB
        await db.user.update({
            where: { id },
            data: { isActive: false },
        });

        // Remove from all chapters in unified DB
        await db.chapterMember.deleteMany({
            where: { userId: id },
        });

        // Log audit (now in unified DB)
        await logAudit({
            action: 'USER_DEACTIVATED',
            performedBy: session.userId,
            targetUser: id,
        });

        return NextResponse.json({
            message: 'User deactivated successfully',
        });
    } catch (error: any) {
        console.error('Deactivate user error:', error);

        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (error.message?.startsWith('Forbidden')) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
