import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from './lib/auth';

export async function middleware(request: NextRequest) {
    try {
        const { pathname } = request.nextUrl;

        // Protect dashboard routes
        if (pathname.startsWith('/dashboard')) {
            const session = await getSession();

            if (!session) {
                return NextResponse.redirect(new URL('/login', request.url));
            }

            // Enforce Admin Roles
            const allowedRoles = ['SUPER_ADMIN', 'STATE_DIRECTOR', 'CITY_DIRECTOR', 'PRESIDENT'];
            if (!allowedRoles.includes(session.role)) {
                return NextResponse.redirect(new URL('/login', request.url));
            }
        }

        // Redirect root/login to dashboard if logged in AS ADMIN
        if (pathname === '/' || pathname === '/login') {
            const session = await getSession();
            if (session) {
                const allowedRoles = ['SUPER_ADMIN', 'STATE_DIRECTOR', 'CITY_DIRECTOR', 'PRESIDENT'];
                if (allowedRoles.includes(session.role)) {
                    return NextResponse.redirect(new URL('/dashboard', request.url));
                }
            }
        }

        return NextResponse.next();
    } catch (error) {
        console.error('Middleware error:', error);
        return NextResponse.next();
    }
}

export const config = {
    matcher: ['/', '/dashboard/:path*', '/login'],
};
