
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; memberId: string }> }
) {
    try {
        const { id: chapterId, memberId } = await params;
        const session = await requireAuth();

        // 1. Fetch Chapter for context
        const chapter = await db.chapter.findUnique({
            where: { id: chapterId },
        });

        if (!chapter) {
            return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
        }

        // 2. Permission Check
        // President, Directors, Super Admin can manage members
        // We can reuse a helper or check explicitly
        const hasPermission =
            session.role === 'SUPER_ADMIN' ||
            (session.role === 'STATE_DIRECTOR' && session.stateId === chapter.stateId) ||
            (session.role === 'CITY_DIRECTOR' && session.cityId === chapter.cityId) ||
            (session.role === 'PRESIDENT' && session.userId === chapter.presidentId); // Ensure they are THIS chapter's president

        if (!hasPermission) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 3. Find the Member to be removed
        // 3. Find the Member to be removed
        const memberToRemove = await db.chapterMember.findUnique({
            where: { id: memberId }
        });

        if (!memberToRemove) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }

        const userToRemove = await db.user.findUnique({
            where: { id: memberToRemove.userId }
        });

        // Prevent removing the President without reassigning first?
        // Logic: If they are the current president of the chapter, we block removal.
        if (memberToRemove.userId === chapter.presidentId) {
            return NextResponse.json({ error: 'Cannot remove the current President. Assign a new President first.' }, { status: 400 });
        }

        // 4. Execute Removal (Transaction)
        await db.$transaction(async (tx) => {
            // Delete membership
            await tx.chapterMember.delete({
                where: { id: memberId }
            });

            // Clean up User Role if necessary
            // If they were VP or Secretary, revert to USER
            // ALSO: We MUST clear the chapterId so they can join another chapter (or rejoin this one)
            await tx.user.update({
                where: { id: memberToRemove.userId },
                data: {
                    role: (userToRemove.role === 'VICE_PRESIDENT' || userToRemove.role === 'SECRETARY') ? 'USER' : undefined,
                    chapterId: null
                }
            });

            // Sync: Remove from upcoming meetings
            // We find all upcoming events for this chapter and delete the attendee record
            await tx.eventAttendee.deleteMany({
                where: {
                    userId: memberToRemove.userId,
                    Event: {
                        chapterId: chapterId,
                        date: { gte: new Date() }
                    }
                }
            });
        });

        return NextResponse.json({ message: 'Member removed successfully' });

    } catch (error: any) {
        console.error('Remove member error:', error);
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
