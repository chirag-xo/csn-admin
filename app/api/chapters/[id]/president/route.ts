import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { canManageChapters } from '@/lib/permissions';
import { addMemberSchema } from '@/lib/validations';
import { logAudit } from '@/lib/audit';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Authenticate
        const session = await requireAuth();
        const { id: chapterId } = await params;

        // Check permission
        if (!canManageChapters(session)) {
            return NextResponse.json(
                { error: 'Forbidden: only CITY_DIRECTOR can assign president' },
                { status: 403 }
            );
        }

        // Parse body
        const body = await request.json();
        const validation = addMemberSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.errors },
                { status: 400 }
            );
        }

        const { userId } = validation.data;

        // Check if user is a member of this chapter in unified DB
        const member = await db.chapterMember.findFirst({
            where: {
                chapterId,
                userId,
            },
        });

        if (!member) {
            return NextResponse.json(
                { error: 'User must be a member of this chapter first' },
                { status: 400 }
            );
        }

        // Find current president
        const currentPresidentMember = await db.chapterMember.findFirst({
            where: {
                chapterId,
                role: 'PRESIDENT',
            },
        });

        // Use transaction for unified DB updates
        await db.$transaction(async (tx) => {
            // Remove old president role (if exists)
            if (currentPresidentMember) {
                await tx.chapterMember.update({
                    where: { id: currentPresidentMember.id },
                    data: { role: 'MEMBER' },
                });

                await tx.user.update({
                    where: { id: currentPresidentMember.userId },
                    data: { role: 'USER' },
                });
            }

            // Assign new president
            await tx.chapterMember.update({
                where: { id: member.id },
                data: { role: 'PRESIDENT' },
            });

            await tx.user.update({
                where: { id: userId },
                data: { role: 'PRESIDENT' },
            });
        });

        // Log audit (now in unified DB)
        await logAudit({
            action: 'PRESIDENT_ASSIGNED',
            performedBy: session.userId,
            targetUser: userId,
            details: JSON.stringify({
                chapterId,
                previousPresidentId: currentPresidentMember?.userId,
            }),
        });

        return NextResponse.json({
            message: 'President assigned successfully',
        });
    } catch (error: any) {
        console.error('Assign president error:', error);

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
