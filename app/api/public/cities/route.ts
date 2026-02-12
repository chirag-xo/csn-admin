import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
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

        return NextResponse.json(cities);
    } catch (error) {
        console.error('Get public cities error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
