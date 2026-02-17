
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const event = await db.event.findUnique({
            where: { id },
            include: {
                Chapter: {
                    select: { name: true }
                },
                EventAttendee: {
                    include: {
                        User: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                profilePhoto: true,
                                email: true // For admin view only? Or user list?
                            }
                        }
                    },
                    orderBy: {
                        paymentStatus: 'desc' // PAID first
                    }
                }
            }
        });

        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        return NextResponse.json(event);
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await requireAuth();

        const event = await db.event.findUnique({
            where: { id },
            select: {
                creatorId: true,
                chapterId: true,
                Chapter: {
                    select: {
                        id: true,
                        presidentId: true
                    }
                }
            }
        });

        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Permission Check:
        // 1. Super Admin
        // 2. Creator of the event
        // 3. President of the Chapter (if event belongs to a chapter)

        let isAuthorized = false;

        if (session.role === 'SUPER_ADMIN') {
            isAuthorized = true;
        } else if (event.creatorId === session.userId) {
            isAuthorized = true;
        } else if (session.role === 'PRESIDENT') {
            if (event.Chapter?.presidentId === session.userId) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        await db.event.delete({
            where: { id }
        });

        return NextResponse.json({ message: 'Event deleted successfully' });

    } catch (error) {
        console.error('Delete event error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
