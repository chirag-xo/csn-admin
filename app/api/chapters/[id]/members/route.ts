import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { getChapterScopeFilter } from '@/lib/permissions';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Authenticate
        const session = await requireAuth();

        // Parse query params
        const searchParams = request.nextUrl.searchParams;
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

        // Apply scope filter to ensure user can access this chapter
        const scopeFilter = getChapterScopeFilter(session);

        const chapter = await db.chapter.findFirst({
            where: {
                id,
                ...scopeFilter,
            },
        });

        if (!chapter) {
            return NextResponse.json(
                { error: 'Chapter not found or access denied' },
                { status: 404 }
            );
        }

        // Fetch paginated members
        const members = await db.chapterMember.findMany({
            where: { chapterId: id },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { joinedAt: 'desc' },
        });

        const total = await db.chapterMember.count({
            where: { chapterId: id },
        });

        // Fetch user details from unified DB
        const userIds = members.map(m => m.userId);

        let users: any[] = [];
        if (userIds.length > 0) {
            users = await db.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, firstName: true, lastName: true, email: true }
            });
        }

        const userMap = new Map(users.map(u => [u.id, u]));

        // Enrich members
        const enrichedMembers = members.map(member => {
            const user = userMap.get(member.userId);
            return {
                id: member.id, // Membership ID
                user: {
                    id: member.userId,
                    name: user ? `${user.firstName} ${user.lastName}`.trim() : 'Unknown User',
                    email: user?.email || '',
                },
                role: member.role,
                joinedAt: member.joinedAt,
            };
        });

        return NextResponse.json({
            members: enrichedMembers,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });

    } catch (error: any) {
        console.error('Get chapter members error:', error);

        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return NextResponse.json(
            { error: 'Internal server error', message: error.message },
            { status: 500 }
        );
    }
}
