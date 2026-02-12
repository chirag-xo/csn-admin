import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { canManageChapters, canAssignPresident } from '@/lib/permissions';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth();
        const { id: chapterId } = await params;
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        // 1. Verify Chapter Existence and Permissions
        const chapter = await db.chapter.findUnique({
            where: { id: chapterId },
            select: { id: true, stateId: true, cityId: true }
        });

        if (!chapter) {
            return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
        }

        // Check if user has permission to add members to THIS chapter
        // We can reuse `canDeleteChapter` logic or similar strict checks.
        // Basically: Super Admin, or Director of that State/City, or President of that Chapter.

        let hasPermission = false;
        if (session.role === 'SUPER_ADMIN') hasPermission = true;
        else if (session.role === 'STATE_DIRECTOR' && session.stateId === chapter.stateId) hasPermission = true;
        else if (session.role === 'CITY_DIRECTOR' && session.cityId === chapter.cityId) hasPermission = true;
        // else if (session.role === 'PRESIDENT' && session.chapterId === chapter.id) hasPermission = true; 
        // Note: session.chapterId might need to be refreshed or we trust the session. 
        // Alternatively, check against chapter.presidentId if we fetched it? 
        // Let's stick to session role context. 
        // Actually, let's fetch chapter presidentId to be sure for President role.

        // Re-fetch chapter with presidentId for precise check
        const chapterWithPrez = await db.chapter.findUnique({
            where: { id: chapterId },
            select: { id: true, stateId: true, cityId: true, presidentId: true }
        });

        if (session.role === 'PRESIDENT' && session.userId === chapterWithPrez?.presidentId) {
            hasPermission = true;
        }

        if (!hasPermission) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Verify User
        const user = await db.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (user.chapterId) {
            return NextResponse.json(
                { error: 'User is already a member of a chapter' },
                { status: 400 }
            );
        }

        // 3. Add Member (Transaction)
        await db.$transaction([
            // Update User
            db.user.update({
                where: { id: userId },
                data: { chapterId },
            }),
            // Create ChapterMember
            db.chapterMember.create({
                data: {
                    chapterId,
                    userId,
                    // role: 'MEMBER', // Default is MEMBER
                },
            }),
            // If there was a pending join request, mark it approved (optional, but good cleanup)
            // We can't easily know if one exists without looking, but `updateMany` is safe.
            db.joinRequest.updateMany({
                where: { chapterId, userId, status: 'PENDING' },
                data: { status: 'APPROVED', reviewedById: session.userId, reviewedAt: new Date() }
            })
        ]);

        return NextResponse.json({ message: 'Member added successfully' });

    } catch (error: any) {
        console.error('Add member error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
