import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { requireRole } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        // Authenticate
        const session = await requireAuth();

        // Only SUPER_ADMIN, STATE_DIRECTOR, and CITY_DIRECTOR can activate users
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

        // Activate user in unified DB
        await db.user.update({
            where: { id },
            data: { isActive: true },
        });

        // Log audit (now in unified DB)
        await logAudit({
            action: 'USER_ACTIVATED',
            performedBy: session.userId,
            targetUser: id,
        });

        return NextResponse.json({
            message: 'User activated successfully',
        });
    } catch (error: any) {
        console.error('Activate user error:', error);

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
