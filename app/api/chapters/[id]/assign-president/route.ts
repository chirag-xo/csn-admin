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

        // Update in transaction to ensure consistency
        const updatedChapter = await db.$transaction(async (tx) => {
            // 1. Fetch current chapter details to get old president
            const currentChapter = await tx.chapter.findUnique({
                where: { id: chapterId },
                select: { presidentId: true }
            });

            // 2. Demote old president if exists
            if (currentChapter?.presidentId) {
                // Determine if we should set User role to USER. 
                // Only do this if they are currently PRESIDENT. 
                // We don't want to demote a CITY_DIRECTOR who happened to be acting as president.
                const oldPrezUser = await tx.user.findUnique({
                    where: { id: currentChapter.presidentId },
                    select: { role: true }
                });

                if (oldPrezUser?.role === 'PRESIDENT') {
                    await tx.user.update({
                        where: { id: currentChapter.presidentId },
                        data: { role: 'USER' }
                    });
                }

                // Update ChapterMember role
                // We need to find the membership record first or update many
                await tx.chapterMember.updateMany({
                    where: {
                        chapterId,
                        userId: currentChapter.presidentId
                    },
                    data: { role: 'MEMBER' }
                });
            }

            // 3. Promote new president
            await tx.user.update({
                where: { id: userId },
                data: { role: 'PRESIDENT' }
            });

            await tx.chapterMember.updateMany({
                where: {
                    chapterId,
                    userId
                },
                data: { role: 'PRESIDENT' }
            });

            // 4. Update Chapter
            return await tx.chapter.update({
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
