
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { razorpay } from '@/lib/razorpay';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        console.log('POST /api/events/[id]/register HIT');
        const { id: eventId } = await params;
        const session = await requireAuth();
        console.log('Session User:', session.userId);
        console.log('Env Key ID:', process.env.RAZORPAY_KEY_ID ? 'Loaded' : 'Missing');

        const event = await db.event.findUnique({
            where: { id: eventId },
        });

        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        if (!event.entryFee || event.entryFee === 0) {
            return NextResponse.json({ message: 'Free event, no payment needed' });
        }

        // Check if already registered/paid?
        const existingAttendee = await db.eventAttendee.findUnique({
            where: {
                eventId_userId: {
                    eventId,
                    userId: session.userId
                }
            }
        });

        if (existingAttendee && existingAttendee.paymentStatus === 'PAID') {
            return NextResponse.json({ message: 'Already paid' });
        }

        // Create Razorpay Order
        const amount = event.entryFee * 100; // Amount in paise
        const currency = 'INR';

        console.log('Creating Razorpay Order with amount:', amount);

        const order = await razorpay.orders.create({
            amount,
            currency,
            receipt: `receipt_${eventId}_${session.userId}`,
            notes: {
                eventId,
                userId: session.userId
            }
        });

        return NextResponse.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID
        });

    } catch (error: any) {
        console.error('Create order error:', error);
        console.error('Stack:', error.stack);
        // If it's a Razorpay error, log it specifically
        if (error.statusCode) {
            console.error('Razorpay Error Status:', error.statusCode);
            console.error('Razorpay Error Response:', JSON.stringify(error.error));
        }
        return NextResponse.json({
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
}
