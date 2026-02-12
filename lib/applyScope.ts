import { Role, Session } from './auth';

export function applyScope(session: Session) {
    if (session.role === 'SUPER_ADMIN') {
        return {};
    }

    if (session.role === 'STATE_DIRECTOR') {
        return { stateId: session.stateId };
    }

    if (session.role === 'CITY_DIRECTOR') {
        return {
            stateId: session.stateId,
            cityId: session.cityId
        };
    }

    if (session.role === 'PRESIDENT') {
        // Presidents can only see their own chapter data
        // For users, they can't see the users list at all (enforced in route)
        // For chapters, they see where they are president
        return {
            OR: [
                { presidentId: session.userId },
                { id: session.cityId } // Fallback or specific logic depends on the query target
            ]
        };
    }

    return { id: 'none' }; // Block all for USER or unknown roles
}

/**
 * Specifically for User queries since User table doesn't have presidentId
 */
export function applyUserScope(session: Session) {
    if (session.role === 'SUPER_ADMIN') {
        return {};
    }

    if (session.role === 'STATE_DIRECTOR') {
        return { stateId: session.stateId };
    }

    if (session.role === 'CITY_DIRECTOR') {
        return {
            stateId: session.stateId,
            cityId: session.cityId
        };
    }

    // PRESIDENT and USER are not allowed to view user list
    return { id: 'none' };
}
