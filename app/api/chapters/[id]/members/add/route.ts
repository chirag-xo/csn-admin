import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { canManageChapters, canAssignPresident } from '@/lib/permissions';
import { sendMeetingInvite } from '@/lib/mail';
import { randomUUID } from 'crypto';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        console.log('POST /api/chapters/[id]/members/add HIT');
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
            // Check if they are actually a member (handle phantom state from previous bug)
            const existingMember = await db.chapterMember.findUnique({
                where: {
                    chapterId_userId: {
                        chapterId: user.chapterId,
                        userId: user.id
                    }
                }
            });

            if (existingMember) {
                return NextResponse.json(
                    { error: 'User is already a member of a chapter' },
                    { status: 400 }
                );
            }
            // If user.chapterId is set but no existingMember, we proceed (self-healing)
        }

        // 3. Add Member (Transaction)
        console.log('Starting transaction to add member...');
        await db.$transaction(async (tx) => {
            // Update User
            await tx.user.update({
                where: { id: userId },
                data: { chapterId },
            });
            // Create ChapterMember
            await tx.chapterMember.create({
                data: {
                    chapterId,
                    userId,
                    // role: 'MEMBER', // Default is MEMBER
                },
            });
            // If there was a pending join request, mark it approved
            await tx.joinRequest.updateMany({
                where: { chapterId, userId, status: 'PENDING' },
                data: { status: 'APPROVED', reviewedById: session.userId, reviewedAt: new Date() }
            });

            // 4. Sync with upcoming events
            console.log('Syncing with upcoming events...');
            const upcomingEvents = await tx.event.findMany({
                where: {
                    chapterId,
                    date: { gte: new Date() }
                }
            });

            if (upcomingEvents.length > 0) {
                const attendeesData = upcomingEvents.map(event => ({
                    id: randomUUID(),
                    eventId: event.id,
                    userId,
                    status: 'INVITED',
                    paymentStatus: 'PENDING',
                    role: 'ATTENDEE'
                }));

                await tx.eventAttendee.createMany({
                    data: attendeesData,
                    skipDuplicates: true
                });

                // Send invites asynchronously
                // We need to fetch the user email first or use what we might have passed?
                // The `user` object (fetched above) has the email.
                if (user.email) {
                    for (const event of upcomingEvents) {
                        // Helper to format time from date
                        const eventTime = new Date(event.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

                        // We construct the meeting details object expected by sendMeetingInvite
                        const meetingDetails = {
                            title: event.title,
                            description: event.description || '',
                            date: event.date,
                            time: eventTime, // Derived from date
                            venue: event.location || 'Online', // Map location to venue
                            entryFee: event.entryFee,
                            link: `${process.env.NEXT_PUBLIC_APP_URL}/events/${event.id}`
                        };

                        // Send to the new member
                        sendMeetingInvite([user.email], meetingDetails).catch(err =>
                            console.error(`Failed to send invite to ${user.email} for event ${event.id}`, err)
                        );
                    }
                }
            }
        });

        return NextResponse.json({ message: 'Member added successfully' });

    } catch (error: any) {
        console.error('Add member error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
