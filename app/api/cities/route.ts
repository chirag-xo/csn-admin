import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        // Authenticate
        await requireAuth();

        const searchParams = request.nextUrl.searchParams;
        const stateId = searchParams.get('stateId');

        if (!stateId) {
            return NextResponse.json(
                { error: 'stateId query parameter is required' },
                { status: 400 }
            );
        }

        const cities = await db.city.findMany({
            where: {
                stateId,
            },
            select: {
                id: true,
                name: true,
            },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json({ cities });
    } catch (error: any) {
        console.error('Get cities error:', error);

        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
