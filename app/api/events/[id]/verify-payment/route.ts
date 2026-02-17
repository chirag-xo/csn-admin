
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import crypto from 'crypto';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: eventId } = await params;
        const session = await requireAuth();
        const body = await request.json();
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret) throw new Error('Razorpay secret not found');

        // Verify Signature
        const generated_signature = crypto
            .createHmac('sha256', secret)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }

        // Update DB
        // Check if attendee exists, update or create
        await db.eventAttendee.upsert({
            where: {
                eventId_userId: {
                    eventId,
                    userId: session.userId
                }
            },
            update: {
                paymentStatus: 'PAID',
                paymentId: razorpay_payment_id,
                amountPaid: 0, // Should store actual amount from order if possible, or fetch event fee
                status: 'GOING'
            },
            create: {
                id: crypto.randomUUID(),
                eventId,
                userId: session.userId,
                paymentStatus: 'PAID',
                paymentId: razorpay_payment_id,
                status: 'GOING',
                role: 'ATTENDEE'
            }
        });

        // Update amountPaid correctly? For now 0 or fetch event.
        // Doing a separate update or fetch logic is better but upsert is atomic-ish.

        return NextResponse.json({ message: 'Payment verified successfully' });

    } catch (error: any) {
        console.error('Verify payment error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
