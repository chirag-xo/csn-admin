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
            const searchRole = search.trim().replace(/\s+/g, '_');

            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                // Enable search by role (handling "State Director" -> "STATE_DIRECTOR")
                { role: { contains: search, mode: 'insensitive' } },
                { role: { contains: searchRole, mode: 'insensitive' } }
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

        // ------------------------------------------------------------------
        // Fallback: finding state by city NAME for users with missing state
        // ------------------------------------------------------------------
        const usersNeedsStateLookup = users.filter(u => !u.stateId && !u.state && u.city);
        const cityNamesToLookup = [...new Set(usersNeedsStateLookup.map(u => u.city).filter(Boolean) as string[])];

        let cityByNameMap = new Map<string, any>();
        if (cityNamesToLookup.length > 0) {
            const foundCities = await db.city.findMany({
                where: { name: { in: cityNamesToLookup } },
                include: {
                    // We need to fetch the stateId to lookup the state
                }
            });

            // If we found cities, we need their states
            const extraStateIds = [...new Set(foundCities.map(c => c.stateId).filter(Boolean))];
            const extraStates = extraStateIds.length > 0
                ? await db.state.findMany({ where: { id: { in: extraStateIds } } })
                : [];

            const extraStateMap = new Map(extraStates.map(s => [s.id, s]));

            // Map City Name -> State Object
            foundCities.forEach(c => {
                if (c.stateId && extraStateMap.has(c.stateId)) {
                    // We use the first match if multiple cities have same name
                    if (!cityByNameMap.has(c.name)) {
                        cityByNameMap.set(c.name, extraStateMap.get(c.stateId));
                    }
                }
            });
        }


        const enrichedUsers = users.map(user => {
            const stateObj = user.stateId ? stateMap.get(user.stateId) : null;
            const cityObj = user.cityId ? cityMap.get(user.cityId) : null;

            // Try to find state by existing ID -> then by text fallback -> then by city name lookup
            let finalState = stateObj;
            if (!finalState) {
                if (user.state) {
                    finalState = { name: user.state } as any;
                } else if (user.city && cityByNameMap.has(user.city)) {
                    finalState = cityByNameMap.get(user.city);
                }
            }

            return {
                ...user,
                name: `${user.firstName} ${user.lastName}`,
                // Fallback to string fields if relation lookup fails or ID is missing
                state: finalState,
                city: cityObj || (user.city ? { name: user.city } : null),
            };
        });

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
