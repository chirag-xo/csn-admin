import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { canCreateChapter, getChapterScopeFilter } from '@/lib/permissions';
import { createChapterSchema, chapterFiltersSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
    try {
        // Authenticate
        const session = await requireAuth();

        // Parse query params
        const searchParams = request.nextUrl.searchParams;
        const validation = chapterFiltersSchema.safeParse({
            page: searchParams.get('page') || '1',
            limit: searchParams.get('limit') || '20',
            search: searchParams.get('search') || undefined,
            stateId: searchParams.get('stateId') || undefined,
            cityId: searchParams.get('cityId') || undefined,
            status: searchParams.get('status') || undefined,
        });

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid query parameters', details: validation.error.errors },
                { status: 400 }
            );
        }

        const { page, limit, search, stateId, cityId, status } = validation.data;

        // Build WHERE clause with scope filter
        const scopeFilter = getChapterScopeFilter(session);

        const where: any = {
            ...(stateId && { stateId }),
            ...(cityId && { cityId }),
            ...(status && { status }),
            ...scopeFilter,
        };

        // Add search filter
        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }

        // Get paginated chapters from unified DB
        const chapters = await db.chapter.findMany({
            where,
            select: {
                id: true,
                name: true,
                stateId: true,
                cityId: true,
                presidentId: true,
                status: true,
                createdBy: true,
                createdAt: true,
                state: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
                cityRel: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                _count: {
                    select: {
                        members: true,
                    },
                },
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
        });

        // Fetch president details from unified DB
        const presidentIds = chapters
            .map(c => c.presidentId)
            .filter(Boolean) as string[];

        let presidents: any[] = [];
        if (presidentIds.length > 0) {
            presidents = await db.user.findMany({
                where: { id: { in: presidentIds } },
                select: { id: true, firstName: true, lastName: true, email: true }
            });
        }

        const presidentMap = new Map(presidents.map(p => [p.id, p]));

        // Enrich chapters with president info
        const enrichedChapters = chapters.map(chapter => ({
            ...chapter,
            city: chapter.cityRel,
            memberCount: chapter._count.members,
            president: chapter.presidentId ? presidentMap.get(chapter.presidentId) || null : null,
            _count: undefined,
            cityRel: undefined,
        }));

        const total = await db.chapter.count({ where });

        return NextResponse.json({
            chapters: enrichedChapters,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error: any) {
        console.error('Get chapters error:', error);

        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return NextResponse.json(
            { error: 'Internal server error', message: error.message },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        // Authenticate
        const session = await requireAuth();

        const body = await request.json();

        // Validate input
        const validation = createChapterSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.errors },
                { status: 400 }
            );
        }

        const { name, stateId, cityId } = validation.data;

        // Check permission
        if (!canCreateChapter(session, stateId, cityId)) {
            return NextResponse.json(
                { error: 'Forbidden: You do not have permission to create chapters in this location' },
                { status: 403 }
            );
        }

        // Validate state-city relationship
        const city = await db.city.findUnique({
            where: { id: cityId },
            select: { stateId: true },
        });

        if (!city || city.stateId !== stateId) {
            return NextResponse.json(
                { error: 'Invalid location: The selected city does not belong to the selected state' },
                { status: 400 }
            );
        }

        // Check unique constraint [name, cityId]
        const existing = await db.chapter.findFirst({
            where: { name, cityId },
        });

        if (existing) {
            return NextResponse.json(
                { error: 'A chapter with this name already exists in this city' },
                { status: 409 }
            );
        }

        // Create chapter
        const chapter = await db.chapter.create({
            data: {
                name,
                stateId,
                cityId,
                createdBy: session.userId,
                status: 'ACTIVE',
            },
            include: {
                state: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
                cityRel: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        return NextResponse.json({
            chapter: {
                ...chapter,
                city: chapter.cityRel,
                cityRel: undefined,
            },
            message: 'Chapter created successfully',
        }, { status: 201 });
    } catch (error: any) {
        console.error('Create chapter error:', error);

        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return NextResponse.json(
            { error: 'Internal server error', message: error.message },
            { status: 500 }
        );
    }
}
