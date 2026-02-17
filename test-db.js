
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Connecting to database...');
        await prisma.$connect();
        console.log('Connected successfully.');

        const count = await prisma.chapter.count();
        console.log(`Found ${count} chapters.`);

        const chapters = await prisma.chapter.findMany({ take: 5, select: { name: true } });
        console.log('First 5 chapters:', chapters);

    } catch (e) {
        console.error('Database connection failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
