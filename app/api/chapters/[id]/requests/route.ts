import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await requireAuth();

        const chapter = await db.chapter.findUnique({
            where: { id },
        });

        if (!chapter) {
            return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
        }

        // Permission Logic
        let canView = false;
        if (session.role === 'SUPER_ADMIN') {
            canView = true;
        } else if (session.role === 'STATE_DIRECTOR') {
            if (chapter.stateId === session.stateId) {
                canView = true;
            }
        } else if (session.role === 'CITY_DIRECTOR') {
            if (chapter.stateId === session.stateId && chapter.cityId === session.cityId) {
                canView = true;
            }
        } else if (session.role === 'PRESIDENT') {
            if (chapter.presidentId === session.userId) {
                canView = true;
            }
        }

        if (!canView) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const requests = await db.joinRequest.findMany({
            where: {
                chapterId: id,
                status: 'PENDING',
            },
            orderBy: { createdAt: 'desc' },
        });

        const userIds = requests.map(r => r.userId);
        let users: any[] = [];
        if (userIds.length > 0) {
            users = await db.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, firstName: true, lastName: true, email: true }
            });
        }
        const userMap = new Map(users.map(u => [u.id, u]));

        const formattedRequests = requests.map(req => {
            const user = userMap.get(req.userId);
            return {
                id: req.id,
                user: {
                    id: req.userId,
                    name: user ? `${user.firstName} ${user.lastName}`.trim() : 'Unknown User',
                    email: user?.email || '',
                },
                createdAt: req.createdAt,
            };
        });

        return NextResponse.json(formattedRequests);

    } catch (error: any) {
        console.error('Get chapter requests error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
