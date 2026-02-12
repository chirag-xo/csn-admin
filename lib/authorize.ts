import { NextResponse } from 'next/server';
import { getSession, Role } from './auth';

export function authorize(...allowedRoles: Role[]) {
    return async function (req: Request) {
        const session = await getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!allowedRoles.includes(session.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Return session to be used in the route handler if needed
        // (Though typically we call getSession again inside the handler or use a wrapper)
        return null; // Success
    };
}
