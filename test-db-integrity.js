
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    try {
        const usersWithChapters = await prisma.user.count({
            where: {
                chapterId: { not: null }
            }
        });
        console.log(`Users with chapterId assigned: ${usersWithChapters}`);

        if (usersWithChapters > 0) {
            const user = await prisma.user.findFirst({
                where: { chapterId: { not: null } },
                select: { chapterId: true }
            });
            console.log(`Sample chapterId from user: ${user.chapterId}`);

            const chapter = await prisma.chapter.findUnique({
                where: { id: user.chapterId }
            });
            console.log(`Does this chapter exist in DB? ${!!chapter}`);
        }

    } catch (e) {
        console.error('Database connection failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
