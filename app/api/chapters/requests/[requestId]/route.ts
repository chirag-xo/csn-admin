import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { sendMeetingInvite } from '@/lib/mail';
import { z } from 'zod';

const actionSchema = z.object({
    action: z.enum(['APPROVE', 'REJECT']),
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ requestId: string }> }
) {
    try {
        const { requestId } = await params;
        const session = await requireAuth();
        const body = await request.json();

        const validation = actionSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
        const { action } = validation.data;

        // Fetch request from unified DB
        const joinRequest = await db.joinRequest.findUnique({
            where: { id: requestId },
            include: { chapter: true },
        });

        if (!joinRequest) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        if (joinRequest.status !== 'PENDING') {
            return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
        }

        const chapter = joinRequest.chapter;

        // Permission Logic
        let canReview = false;

        if (session.role === 'PRESIDENT') {
            if (chapter.presidentId === session.userId) {
                canReview = true;
            }
        }

        if (!canReview) {
            return NextResponse.json({ error: 'Forbidden: Only the chapter president can approve/reject join requests' }, { status: 403 });
        }

        // Process Action in unified DB
        if (action === 'APPROVE') {
            await db.$transaction(async (tx) => {
                // 1. Update Request
                await tx.joinRequest.update({
                    where: { id: requestId },
                    data: {
                        status: 'APPROVED',
                        reviewedById: session.userId,
                        reviewedAt: new Date(),
                    },
                });

                // 2. Add Member (if not exists)
                const existingMember = await tx.chapterMember.findUnique({
                    where: {
                        chapterId_userId: {
                            chapterId: chapter.id,
                            userId: joinRequest.userId,
                        },
                    },
                });

                if (!existingMember) {
                    await tx.chapterMember.create({
                        data: {
                            chapterId: chapter.id,
                            userId: joinRequest.userId,
                        },
                    });

                    // Sync with upcoming events
                    const upcomingEvents = await tx.event.findMany({
                        where: {
                            chapterId: chapter.id,
                            date: { gte: new Date() }
                        }
                    });

                    if (upcomingEvents.length > 0) {
                        const attendeesData = upcomingEvents.map(event => ({
                            id: crypto.randomUUID(),
                            eventId: event.id,
                            userId: joinRequest.userId,
                            status: 'INVITED',
                            paymentStatus: 'PENDING',
                            role: 'ATTENDEE'
                        }));

                        await tx.eventAttendee.createMany({
                            data: attendeesData,
                            skipDuplicates: true
                        });

                        // Send invites asynchronously
                        // Fetch the user to get email
                        const approvedUser = await tx.user.findUnique({
                            where: { id: joinRequest.userId },
                            select: { email: true }
                        });

                        if (approvedUser && approvedUser.email) {
                            for (const event of upcomingEvents) {
                                const eventTime = new Date(event.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

                                const meetingDetails = {
                                    title: event.title,
                                    description: event.description || '',
                                    date: event.date,
                                    time: eventTime,
                                    venue: event.location || 'Online',
                                    entryFee: event.entryFee,
                                    link: `${process.env.NEXT_PUBLIC_APP_URL}/events/${event.id}`
                                };

                                sendMeetingInvite([approvedUser.email], meetingDetails).catch(err =>
                                    console.error(`Failed to send invite to ${approvedUser.email} for event ${event.id}`, err)
                                );
                            }
                        }
                    }
                }
            });
        } else {
            // REJECT
            await db.joinRequest.update({
                where: { id: requestId },
                data: {
                    status: 'REJECTED',
                    reviewedById: session.userId,
                    reviewedAt: new Date(),
                },
            });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Process request error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
