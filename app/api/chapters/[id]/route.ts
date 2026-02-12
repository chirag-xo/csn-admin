import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getChapterScopeFilter, canDeleteChapter } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Authenticate
        const session = await requireAuth();

        // Apply scope filter
        const scopeFilter = getChapterScopeFilter(session);

        // Fetch chapter with scope check from unified DB
        const chapter = await db.chapter.findFirst({
            where: {
                id,
                ...scopeFilter,
            },
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
                _count: {
                    select: {
                        members: true,
                        joinRequests: {
                            where: { status: 'PENDING' },
                        },
                    },
                },
            },
        });

        if (!chapter) {
            return NextResponse.json(
                { error: 'Chapter not found or access denied' },
                { status: 404 }
            );
        }

        // Get president details from unified DB
        let president = null;
        if (chapter.presidentId) {
            const p = await db.user.findUnique({
                where: { id: chapter.presidentId },
                select: { id: true, firstName: true, lastName: true, email: true }
            });

            if (p) {
                president = {
                    id: p.id,
                    name: `${p.firstName} ${p.lastName}`.trim(),
                    email: p.email,
                };
            }
        }

        return NextResponse.json({
            id: chapter.id,
            name: chapter.name,
            stateId: chapter.stateId,
            cityId: chapter.cityId,
            status: chapter.status,
            createdAt: chapter.createdAt,
            state: chapter.state,
            city: chapter.cityRel,
            president,
            _count: {
                members: chapter._count.members,
                joinRequests: chapter._count.joinRequests,
            },
        });
    } catch (error: any) {
        console.error('Get chapter detail error:', error);

        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return NextResponse.json(
            { error: 'Internal server error', message: error.message },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Authenticate
        const session = await requireAuth();

        // Fetch chapter to check permissions
        const chapter = await db.chapter.findUnique({
            where: { id },
            select: { id: true, name: true, stateId: true, cityId: true }
        });

        if (!chapter) {
            return NextResponse.json(
                { error: 'Chapter not found' },
                { status: 404 }
            );
        }

        // Check permission
        if (!canDeleteChapter(session, chapter)) {
            return NextResponse.json(
                { error: 'Forbidden: You do not have permission to delete this chapter' },
                { status: 403 }
            );
        }

        // Delete chapter (Cascade will handle JoinRequests, SetNull handles Users/Events)
        await db.chapter.delete({
            where: { id }
        });

        // Log audit
        await logAudit({
            action: 'CHAPTER_DELETED',
            performedBy: session.userId,
            details: JSON.stringify({
                chapterId: id,
                chapterName: chapter.name,
            }),
        });

        return NextResponse.json({
            message: 'Chapter deleted successfully',
        });
    } catch (error: any) {
        console.error('Delete chapter error:', error);

        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return NextResponse.json(
            { error: 'Internal server error', message: error.message },
            { status: 500 }
        );
    }
}
