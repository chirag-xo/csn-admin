
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; attendeeId: string }> }
) {
    try {
        const { id: eventId, attendeeId } = await params;
        const session = await requireAuth();

        // 1. Fetch Event to check permissions
        const event = await db.event.findUnique({
            where: { id: eventId },
            include: {
                Chapter: true
            }
        });

        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // 2. Permission Check
        const hasPermission =
            session.role === 'SUPER_ADMIN' ||
            session.userId === event.creatorId ||
            (session.role === 'PRESIDENT' && session.userId === event.Chapter?.presidentId) ||
            (session.role === 'STATE_DIRECTOR' && session.stateId === event.Chapter?.stateId) ||
            (session.role === 'CITY_DIRECTOR' && session.cityId === event.Chapter?.cityId);

        if (!hasPermission) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 3. Delete Attendee
        await db.eventAttendee.delete({
            where: {
                id: attendeeId
            }
        });

        return NextResponse.json({ message: 'Attendee removed successfully' });

    } catch (error) {
        console.error('Remove attendee error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
