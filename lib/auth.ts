import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// Define Role manually to avoid Prisma import in Edge runtime (middleware)
export type Role = 'SUPER_ADMIN' | 'STATE_DIRECTOR' | 'CITY_DIRECTOR' | 'PRESIDENT' | 'VICE_PRESIDENT' | 'SECRETARY' | 'USER';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-secret-key-change-in-production'
);

export interface SessionPayload {
    userId: string;
    role: Role;
    stateId?: string;
    cityId?: string;
}

export interface Session extends SessionPayload {
    iat: number;
    exp: number;
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

export async function verifyPassword(
    password: string,
    hash: string
): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// JWT operations
export async function signJWT(payload: SessionPayload): Promise<string> {
    return new SignJWT(payload as any)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h') // 24 hour session
        .sign(JWT_SECRET);
}

export async function verifyJWT(token: string): Promise<Session> {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as Session;
}

// Session management
export async function getSession(): Promise<Session | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    if (!token) {
        return null;
    }

    try {
        return await verifyJWT(token);
    } catch (error) {
        console.error('getSession error:', error);
        return null;
    }
}

export async function setSessionCookie(token: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set('session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
    });
}

export async function clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete('session');
}

// Helper to require authentication
export async function requireAuth(): Promise<Session> {
    const session = await getSession();
    if (!session) {
        throw new Error('Unauthorized');
    }
    return session;
}
