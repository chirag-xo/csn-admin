import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function GET(request: NextRequest) {
    try {
        const session = await requireAuth();
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q');

        if (!query || query.length < 2) {
            return NextResponse.json([]);
        }

        // Find users matching query
        // We do NOT filter by chapterId: null here initially because we want to find users in "stale" state.
        // We will filter them out if they have a valid ChapterMember record.
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
                        role: { in: ['USER', 'VICE_PRESIDENT', 'SECRETARY'] } // Allow finding these roles 
                    }
                ],
            },
            include: {
                ChapterMember: true // Include membership to verify
            },
            take: 20, // Increase limit slightly to account for post-filtering
        });

        // Filter: Only return users who are NOT in a chapter (or are in a stale state)
        // A user is "available" if:
        // 1. They have NO ChapterMember records.
        // OR
        // 2. Their chapterId is set but ChapterMember is empty (stale state).
        const availableUsers = users.filter(user => {
            return user.ChapterMember.length === 0;
        }).map(user => ({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profilePhoto: user.profilePhoto,
            // We can optionally return a flag indicating if they need 'fixing' but the UI doesn't need to know.
        }));

        return NextResponse.json(availableUsers);
    } catch (error) {
        console.error('User search error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
