import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { canVerifyUsers } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        // Authenticate
        const session = await requireAuth();

        // Check permission
        if (!canVerifyUsers(session)) {
            return NextResponse.json(
                { error: 'Forbidden: only SUPER_ADMIN and STATE_DIRECTOR can verify users' },
                { status: 403 }
            );
        }

        // Get current user from unified DB
        const user = await db.user.findUnique({
            where: { id },
            select: { id: true, isVerified: true },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Toggle verification status
        const isVerified = !user.isVerified;

        const updatedUser = await db.user.update({
            where: { id },
            data: { isVerified },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                isVerified: true,
                isActive: true,
            },
        });

        // Log audit (now in unified DB)
        await logAudit({
            action: isVerified ? 'USER_VERIFIED' : 'USER_UNVERIFIED',
            performedBy: session.userId,
            targetUser: id,
        });

        return NextResponse.json({
            user: { ...updatedUser, name: `${updatedUser.firstName} ${updatedUser.lastName}` },
            message: `User ${isVerified ? 'verified' : 'unverified'} successfully`,
        });
    } catch (error: any) {
        console.error('Verify user error:', error);

        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
