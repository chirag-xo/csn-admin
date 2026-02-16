
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { canAssignRole } from '@/lib/permissions';
import { z } from 'zod'; // Import zod directly for simple schema or use validations

const assignRoleSchema = z.object({
    userId: z.string().uuid(),
    role: z.enum(['VICE_PRESIDENT', 'SECRETARY', 'USER']), // "USER" maps to "MEMBER" in chapter context
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        console.log('POST /api/chapters/[id]/assign-role: Starting...');
        const { id: chapterId } = await params;
        const session = await requireAuth();
        console.log('POST /api/chapters/[id]/assign-role: Authenticated', session);

        const body = await request.json();
        console.log('POST /api/chapters/[id]/assign-role: Body', body);

        const validation = assignRoleSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.errors },
                { status: 400 }
            );
        }

        const { userId, role } = validation.data;

        // 1. Fetch Chapter to verify existence and get context (State/City)
        const chapter = await db.chapter.findUnique({
            where: { id: chapterId },
        });

        if (!chapter) {
            return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
        }

        // 2. Fetch Target User (Member) to verify membership
        const member = await db.chapterMember.findUnique({
            where: {
                chapterId_userId: {
                    chapterId,
                    userId,
                },
            },
            // include: { user: true } // Relation does not exist in schema
        });

        if (!member) {
            return NextResponse.json(
                { error: 'User is not a member of this chapter' },
                { status: 404 }
            );
        }

        const targetUser = await db.user.findUnique({
            where: { id: userId }
        });

        if (!targetUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 3. Permission Check
        const targetUserForCheck = {
            ...targetUser,
            stateId: chapter.stateId,
            cityId: chapter.cityId,
        };

        console.log('POST /api/chapters/[id]/assign-role: Checking permission for', session.role);
        if (!canAssignRole(session, role as any, targetUserForCheck)) {
            console.error('POST /api/chapters/[id]/assign-role: Permission Denied');
            return NextResponse.json(
                { error: 'Forbidden: You cannot assign this role' },
                { status: 403 }
            );
        }
        console.log('POST /api/chapters/[id]/assign-role: Permission Granted');

        // Special Check for Presidents: Verification they own THIS chapter
        if (session.role === 'PRESIDENT') {
            const presidentChapter = await db.chapter.findFirst({
                where: { presidentId: session.userId, id: chapterId }
            });
            if (!presidentChapter) {
                return NextResponse.json(
                    { error: 'Forbidden: You are not the president of this chapter' },
                    { status: 403 }
                );
            }
        }

        // 4. Update Logic (Transaction)
        // Map "USER" role to "MEMBER" for ChapterMember role, but keep "USER" for User role.
        // VP/SECRETARY map 1:1.
        const chapterRole = role === 'USER' ? 'MEMBER' : role;

        await db.$transaction(async (tx) => {
            // Update ChapterMember Role
            await tx.chapterMember.update({
                where: { id: member.id },
                data: { role: chapterRole }
            });

            // Update User Global Role
            // ALERT: This overrides their global role. 
            // If they are a PRESIDENT of ANOTHER chapter, this would demote them.
            // We should check if they are president of another chapter before changing User.role?
            // For now, assuming strict hierarchy where a user has one primary role.
            await tx.user.update({
                where: { id: userId },
                data: {
                    role: role,
                    // Ensure their location matches chapter if we are promoting them
                    // This ensures directories confirm to chapter location
                    ...(role !== 'USER' ? {
                        stateId: chapter.stateId,
                        cityId: chapter.cityId
                    } : {})
                }
            });
        });

        return NextResponse.json({ message: 'Role assigned successfully' });

    } catch (error: any) {
        console.error('Assign role error details:', error);
        console.error('Assign role error stack:', error.stack);
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
    }
}
