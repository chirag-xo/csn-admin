import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, signJWT, setSessionCookie } from '@/lib/auth';
import { loginSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 1. Validate Input
        const validation = loginSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.errors },
                { status: 400 }
            );
        }

        const { email, password } = validation.data;

        // 2. Fetch User (Using Prisma - now working with unified schema)
        const user = await db.user.findUnique({
            where: { email },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // 3. Verify Password
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // 4. Check If Active
        if (!user.isActive) {
            return NextResponse.json(
                { error: 'Account is deactivated' },
                { status: 403 }
            );
        }

        // 5. Check Role (Block USER)
        const allowedRoles = ['SUPER_ADMIN', 'STATE_DIRECTOR', 'CITY_DIRECTOR', 'PRESIDENT'];
        if (!allowedRoles.includes(user.role)) {
            return NextResponse.json(
                { error: 'Unauthorized access' },
                { status: 403 }
            );
        }

        // 6. Fetch Admin Details (State/City)
        // Since we are unified, we can use relations if needed, but keeping logic for now
        let state = null;
        let city = null;

        if (user.stateId) {
            state = await db.state.findUnique({ where: { id: user.stateId } });
        }
        if (user.cityId) {
            city = await db.city.findUnique({ where: { id: user.cityId } });
        }

        // 7. Generate JWT
        const sessionPayload = {
            userId: user.id,
            role: user.role,
            ...(user.stateId && { stateId: user.stateId }),
            ...(user.cityId && { cityId: user.cityId }),
        };

        const token = await signJWT(sessionPayload as any);

        // 8. Set Cookie
        await setSessionCookie(token);

        // 9. Return Success (Sanitized)
        const { password: _, ...userWithoutPassword } = user;

        return NextResponse.json({
            user: {
                ...userWithoutPassword,
                state,
                city,
                name: `${user.firstName} ${user.lastName}`.trim(),
            },
            message: 'Login successful',
        });

    } catch (error: any) {
        console.error('Login error FULL:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error?.message || 'Unknown error',
                details: process.env.NODE_ENV === 'development' ? String(error) : undefined
            },
            { status: 500 }
        );
    }
}
