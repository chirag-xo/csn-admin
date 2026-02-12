import { User } from '@prisma/client';
import { Session, Role } from './session';

// Permission matrix: who can view what
export function canViewUser(viewer: Session, targetUser: User): boolean {
    switch (viewer.role) {
        case 'SUPER_ADMIN':
            return true;

        case 'STATE_DIRECTOR':
            return targetUser.stateId === viewer.stateId;

        case 'CITY_DIRECTOR':
            return targetUser.cityId === viewer.cityId;

        case 'PRESIDENT':
        case 'USER':
            // PRESIDENT and USER are not allowed to view user list/other users
            return targetUser.id === viewer.userId;

        default:
            return false;
    }
}

// Permission matrix: who can assign what role
export function canAssignRole(
    assigner: Session,
    targetRole: Role,
    targetUser: any // Can be raw user object
): boolean {
    const targetStateId = targetUser.stateId || targetUser.state_id;
    const targetCityId = targetUser.cityId || targetUser.city_id;

    switch (assigner.role) {
        case 'SUPER_ADMIN':
            // Super Admin can assign STATE_DIRECTOR, CITY_DIRECTOR, PRESIDENT
            return ['STATE_DIRECTOR', 'CITY_DIRECTOR', 'PRESIDENT'].includes(targetRole);

        case 'STATE_DIRECTOR':
            // Can assign City Director only inside his state
            if (targetRole === 'CITY_DIRECTOR') {
                return targetStateId === assigner.stateId;
            }
            return false;

        case 'CITY_DIRECTOR':
            // Can assign President only inside his city
            if (targetRole === 'PRESIDENT') {
                return targetCityId === assigner.cityId;
            }
            return false;

        default:
            return false;
    }
}

// Generate Prisma WHERE filter based on role for Users
export function getScopeFilter(session: Session) {
    switch (session.role) {
        case 'SUPER_ADMIN':
            return {}; // No filter, see all

        case 'STATE_DIRECTOR':
            return { stateId: session.stateId };

        case 'CITY_DIRECTOR':
            return { cityId: session.cityId };

        case 'PRESIDENT':
        case 'USER':
            // These roles generally shouldn't call get users, 
            // but if they do, they only see themselves
            return { id: session.userId };

        default:
            return { id: 'never-match' }; // Deny all
    }
}

// Generate Prisma WHERE filter for chapters based on role
export function getChapterScopeFilter(session: Session) {
    switch (session.role) {
        case 'SUPER_ADMIN':
            return {}; // No filter, see all

        case 'STATE_DIRECTOR':
            return { stateId: session.stateId };

        case 'CITY_DIRECTOR':
            return {
                stateId: session.stateId,
                cityId: session.cityId
            };

        case 'PRESIDENT':
            return { presidentId: session.userId };

        default:
            return { id: 'never-match' }; // Deny all
    }
}

// Require specific role(s)
export function requireRole(session: Session, allowedRoles: Role[]): void {
    if (!allowedRoles.includes(session.role)) {
        throw new Error('Forbidden');
    }
}

// Check if user can create a chapter in the given state/city
export function canCreateChapter(
    session: Session,
    stateId: string,
    cityId: string
): boolean {
    switch (session.role) {
        case 'SUPER_ADMIN':
            return true;

        case 'STATE_DIRECTOR':
            return session.stateId === stateId;

        case 'CITY_DIRECTOR':
            return session.stateId === stateId && session.cityId === cityId;

        default:
            return false;
    }
}

// Check if user can verify other users
export function canVerifyUsers(session: Session): boolean {
    return ['SUPER_ADMIN', 'STATE_DIRECTOR'].includes(session.role);
}

// Check if user can assign chapter president
export function canAssignPresident(session: Session, context: { stateId?: string | null, cityId?: string | null }): boolean {
    switch (session.role) {
        case 'SUPER_ADMIN':
            return true;

        case 'STATE_DIRECTOR':
            return !!context.stateId && session.stateId === context.stateId;

        case 'CITY_DIRECTOR':
            return !!context.stateId && !!context.cityId && session.stateId === context.stateId && session.cityId === context.cityId;

        default:
            return false;
    }
}

// Check if user can manage chapters generally (e.g. settings)
export function canManageChapters(session: Session): boolean {
    return ['SUPER_ADMIN', 'STATE_DIRECTOR', 'CITY_DIRECTOR'].includes(session.role);
}

// Check if user can delete a chapter
export function canDeleteChapter(
    session: Session,
    chapter: { stateId: string | null; cityId: string | null }
): boolean {
    switch (session.role) {
        case 'SUPER_ADMIN':
            return true;

        case 'STATE_DIRECTOR':
            return !!chapter.stateId && session.stateId === chapter.stateId;

        case 'CITY_DIRECTOR':
            return (
                !!chapter.stateId &&
                !!chapter.cityId &&
                session.stateId === chapter.stateId &&
                session.cityId === chapter.cityId
            );

        default:
            return false;
    }
}

