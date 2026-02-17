
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { canManageChapters } from '@/lib/permissions';
import { sendMeetingInvite } from '@/lib/mail';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: chapterId } = await params;
        console.log(`[API] Creating meeting for chapter: ${chapterId}`);

        const session = await requireAuth();
        console.log(`[API] Session user: ${session?.userId}, Role: ${session?.role}`);

        // 1. Fetch Chapter
        const chapter = await db.chapter.findUnique({
            where: { id: chapterId },
        });

        if (!chapter) {
            return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
        }

        // 2. Permission Check (President, VP, Secretary, Directors, Super Admin)
        const hasPermission =
            session.role === 'SUPER_ADMIN' ||
            (session.role === 'STATE_DIRECTOR' && session.stateId === chapter.stateId) ||
            (session.role === 'CITY_DIRECTOR' && session.cityId === chapter.cityId) ||
            (session.role === 'PRESIDENT' && session.userId === chapter.presidentId) ||
            // Also allow VP and Secretary if they are members of this chapter
            (session.role === 'VICE_PRESIDENT' /* Logic needed to verify chapter membership */) ||
            (session.role === 'SECRETARY' /* Logic needed */);

        // Better check: Verify they are a member of this chapter with high role
        const membership = await db.chapterMember.findUnique({
            where: {
                chapterId_userId: {
                    chapterId,
                    userId: session.userId,
                }
            }
        });

        const isChapterAdmin = membership && ['PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY'].includes(membership.role);
        const isGlobalAdmin = ['SUPER_ADMIN', 'STATE_DIRECTOR', 'CITY_DIRECTOR'].includes(session.role); // Simplified

        if (!isChapterAdmin && !isGlobalAdmin) {
            // Strict check for Directors matching location
            if (session.role === 'STATE_DIRECTOR' && session.stateId !== chapter.stateId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            if (session.role === 'CITY_DIRECTOR' && session.cityId !== chapter.cityId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            if (!isChapterAdmin && session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }


        const body = await request.json();
        const { title, description, date, time, venue, entryFee, isRecurring, recurrencePattern, sendInvites, isPublic } = body;

        // Combine date and time - parse components to avoid timezone issues
        const [year, month, day] = date.split('-').map(Number);
        const [hours, minutes] = time.split(':').map(Number);
        const eventDate = new Date(year, month - 1, day, hours, minutes, 0);

        // 3. Create Event
        const event = await db.event.create({
            data: {
                id: crypto.randomUUID(),
                title,
                description,
                type: 'MEETING',
                location: venue,
                date: eventDate,
                isRecurring: isRecurring || false,
                recurrencePattern: isRecurring ? recurrencePattern : null,
                recurrenceType: isRecurring ? 'WEEKLY' : null, // Default to weekly if recurring
                entryFee: entryFee ? parseInt(entryFee) : 0,
                isPublic: isPublic !== undefined ? isPublic : true,
                chapterId: chapter.id,
                creatorId: session.userId,
            }
        });

        // 4. Always add all chapter members as attendees (INVITED/PENDING)
        // Fetch all members
        const members = await db.chapterMember.findMany({
            where: { chapterId },
            include: { user: true }
        });

        const attendees = members.map(m => ({
            id: crypto.randomUUID(),
            eventId: event.id,
            userId: m.userId,
            status: 'INVITED',
            paymentStatus: 'PENDING',
            role: 'ATTENDEE'
        }));

        if (attendees.length > 0) {
            await db.eventAttendee.createMany({
                data: attendees,
                skipDuplicates: true
            });
        }

        // 5. Send Invites if requested
        if (sendInvites) {
            const emails = members.map(m => m.user.email);

            // Send asynchronously to not block response
            sendMeetingInvite(emails, {
                title,
                description,
                date: eventDate,
                time,
                venue,
                entryFee,
                link: `${process.env.NEXT_PUBLIC_APP_URL}/events/${event.id}` // Public link
            }).catch(console.error);
        }

        return NextResponse.json({ message: 'Meeting created successfully', event });

    } catch (error: any) {
        console.error('Create meeting error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: chapterId } = await params;
        const session = await requireAuth(); // Optional: public? meetings might be public.
        // But for dashboard listing, we might want all details.

        const meetings = await db.event.findMany({
            where: {
                chapterId,
                type: 'MEETING'
            },
            orderBy: { date: 'desc' },
            include: {
                _count: {
                    select: { EventAttendee: true }
                }
            }
        });

        return NextResponse.json(meetings);
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

