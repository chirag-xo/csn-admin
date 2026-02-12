import { db } from './db';

/**
 * Automatically join a user to a chapter based on their state and city
 * Called during user registration or when user's location is updated
 */
export async function autoJoinUserToChapter(
    userId: string,
    stateId: string | null,
    cityId: string | null
): Promise<{ joined: boolean; chapterId?: string; chapterName?: string }> {
    try {
        // Skip if user doesn't have both state and city
        if (!stateId || !cityId) {
            return { joined: false };
        }

        // Find first active chapter in user's city
        const chapter = await db.chapter.findFirst({
            where: {
                stateId,
                cityId,
                status: 'ACTIVE',
            },
            orderBy: {
                createdAt: 'asc', // Join oldest chapter first
            },
        });

        if (!chapter) {
            // No chapter found in user's city
            return { joined: false };
        }

        // Check if user is already a member
        const existingMembership = await db.chapterMember.findFirst({
            where: {
                chapterId: chapter.id,
                userId,
            },
        });

        if (existingMembership) {
            // User is already a member
            return {
                joined: true,
                chapterId: chapter.id,
                chapterName: chapter.name,
            };
        }

        // Create chapter membership
        await db.chapterMember.create({
            data: {
                chapterId: chapter.id,
                userId,
            },
        });

        return {
            joined: true,
            chapterId: chapter.id,
            chapterName: chapter.name,
        };
    } catch (error) {
        console.error('Auto-join user to chapter error:', error);
        // Don't throw - auto-join is a best-effort operation
        return { joined: false };
    }
}

/**
 * Remove user from all chapters (e.g., when user is deactivated)
 */
export async function removeUserFromAllChapters(userId: string): Promise<number> {
    try {
        const result = await db.chapterMember.deleteMany({
            where: { userId },
        });

        return result.count;
    } catch (error) {
        console.error('Remove user from chapters error:', error);
        return 0;
    }
}

/**
 * Update user's chapter membership when their location changes
 */
export async function updateUserChapterMembership(
    userId: string,
    newStateId: string | null,
    newCityId: string | null
): Promise<{ removed: number; joined: boolean; chapterId?: string }> {
    try {
        // Remove from all current chapters
        const removed = await removeUserFromAllChapters(userId);

        // Auto-join to new chapter if location is set
        const joinResult = await autoJoinUserToChapter(userId, newStateId, newCityId);

        return {
            removed,
            ...joinResult,
        };
    } catch (error) {
        console.error('Update user chapter membership error:', error);
        return { removed: 0, joined: false };
    }
}
