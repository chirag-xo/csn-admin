import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { getScopeFilter } from '@/lib/permissions';
import { userFiltersSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
    try {
        // Authenticate
        console.log('GET /api/users: Authenticating...');
        const session = await requireAuth();
        console.log('GET /api/users: Authenticated', session);

        // Parse query params
        const searchParams = request.nextUrl.searchParams;
        const validation = userFiltersSchema.safeParse({
            page: searchParams.get('page') || '1',
            limit: searchParams.get('limit') || '20',
            search: searchParams.get('search') || undefined,
            role: searchParams.get('role') || undefined,
            stateId: searchParams.get('stateId') || undefined,
            cityId: searchParams.get('cityId') || undefined,
        });

        if (!validation.success) {
            console.error('GET /api/users: Validation failed', validation.error);
            return NextResponse.json(
                { error: 'Invalid query parameters', details: validation.error.errors },
                { status: 400 }
            );
        }

        const { page, limit, search, role, stateId, cityId } = validation.data;

        // Build WHERE clause with scope filter
        const scopeFilter = getScopeFilter(session);
        console.log('GET /api/users: Scope filter', scopeFilter);

        const where: any = {
            ...(role && { role }),
            ...(stateId && { stateId }),
            ...(cityId && { cityId }),
            ...scopeFilter,
        };

        // Add search filter
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        console.log('GET /api/users: Querying User DB with where:', JSON.stringify(where));

        // Get users and total count in parallel using unified database
        const [users, total] = await Promise.all([
            db.user.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    // Inclusion of state and city would go here if relations are fully setup,
                    // but keeping the map approach for safety during the transition phase.
                }
            }),
            db.user.count({ where })
        ]);

        console.log(`GET /api/users: Found ${users.length} users, total: ${total}`);

        // Enrich with State/City details from Admin models (now in the same DB)
        const stateIds = [...new Set(users.map(u => u.stateId).filter(Boolean) as string[])];
        const cityIds = [...new Set(users.map(u => u.cityId).filter(Boolean) as string[])];

        const [states, cities] = await Promise.all([
            stateIds.length ? db.state.findMany({ where: { id: { in: stateIds } } }) : [],
            cityIds.length ? db.city.findMany({ where: { id: { in: cityIds } } }) : [],
        ]);

        const stateMap = new Map(states.map(s => [s.id, s]));
        const cityMap = new Map(cities.map(c => [c.id, c]));

        const enrichedUsers = users.map(user => ({
            ...user,
            name: `${user.firstName} ${user.lastName}`,
            state: user.stateId ? stateMap.get(user.stateId) || null : null,
            city: user.cityId ? cityMap.get(user.cityId) || null : null,
        }));

        return NextResponse.json({
            users: enrichedUsers,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error: any) {
        console.error('Get users error:', error);

        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}
