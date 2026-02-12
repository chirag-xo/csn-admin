import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { canAssignPresident, getChapterScopeFilter } from '@/lib/permissions';
import { assignPresidentSchema } from '@/lib/validations';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Authenticate
        const session = await requireAuth();

        const { id: chapterId } = await params;

        // Parse and validate body
        const body = await request.json();
        const validation = assignPresidentSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.errors },
                { status: 400 }
            );
        }

        const { userId } = validation.data;

        // Apply scope filter
        const scopeFilter = getChapterScopeFilter(session);

        // Fetch chapter with scope check
        const chapter = await db.chapter.findFirst({
            where: {
                id: chapterId,
                ...scopeFilter,
            },
        });

        if (!chapter) {
            return NextResponse.json(
                { error: 'Chapter not found or access denied' },
                { status: 404 }
            );
        }

        // Check permission
        if (!canAssignPresident(session, { stateId: chapter.stateId, cityId: chapter.cityId })) {
            return NextResponse.json(
                { error: 'Forbidden: You do not have permission to assign presidents for this chapter' },
                { status: 403 }
            );
        }

        // Verify user exists in chapter members
        const membership = await db.chapterMember.findFirst({
            where: {
                chapterId,
                userId,
            },
        });

        if (!membership) {
            return NextResponse.json(
                { error: 'User is not a member of this chapter' },
                { status: 400 }
            );
        }

        // Update chapter president in unified DB
        const updatedChapter = await db.chapter.update({
            where: { id: chapterId },
            data: { presidentId: userId },
            include: {
                state: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
                cityRel: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        // Fetch president details from unified DB
        const president = await db.user.findUnique({
            where: { id: userId },
            select: { id: true, firstName: true, lastName: true, email: true, role: true }
        });

        return NextResponse.json({
            chapter: {
                ...updatedChapter,
                city: updatedChapter.cityRel,
                president,
                cityRel: undefined,
            },
            message: 'President assigned successfully',
        });
    } catch (error: any) {
        console.error('Assign president error:', error);

        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return NextResponse.json(
            { error: 'Internal server error', message: error.message },
            { status: 500 }
        );
    }
}
