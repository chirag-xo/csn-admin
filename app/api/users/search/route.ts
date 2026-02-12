import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const session = await requireAuth();
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q');

        if (!query || query.length < 2) {
            return NextResponse.json([]);
        }

        // Find users matching query who are NOT in a chapter
        const users = await db.user.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { firstName: { contains: query, mode: 'insensitive' } },
                            { lastName: { contains: query, mode: 'insensitive' } },
                            { email: { contains: query, mode: 'insensitive' } },
                        ],
                    },
                    {
                        chapterId: null, // Only users not in a chapter
                    },
                    {
                        role: 'USER', // Generally only add normal users, but maybe we want to allow others? Sticking to 'USER' for now to be safe, or maybe allow any role that isn't already assigned?
                        // Actually, directors/presidents are just roles, so they might be addable if not in a chapter.
                        // But 'chapterId' check is the most important.
                    }
                ],
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profilePhoto: true,
            },
            take: 10,
        });

        return NextResponse.json(users);
    } catch (error) {
        console.error('User search error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
