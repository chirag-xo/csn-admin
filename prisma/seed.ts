import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

const INDIAN_STATES = [
    // States
    { name: 'Andhra Pradesh', code: 'AP' },
    { name: 'Arunachal Pradesh', code: 'AR' },
    { name: 'Assam', code: 'AS' },
    { name: 'Bihar', code: 'BR' },
    { name: 'Chhattisgarh', code: 'CG' },
    { name: 'Goa', code: 'GA' },
    { name: 'Gujarat', code: 'GJ' },
    { name: 'Haryana', code: 'HR' },
    { name: 'Himachal Pradesh', code: 'HP' },
    { name: 'Jharkhand', code: 'JH' },
    { name: 'Karnataka', code: 'KA' },
    { name: 'Kerala', code: 'KL' },
    { name: 'Madhya Pradesh', code: 'MP' },
    { name: 'Maharashtra', code: 'MH' },
    { name: 'Manipur', code: 'MN' },
    { name: 'Meghalaya', code: 'ML' },
    { name: 'Mizoram', code: 'MZ' },
    { name: 'Nagaland', code: 'NL' },
    { name: 'Odisha', code: 'OR' },
    { name: 'Punjab', code: 'PB' },
    { name: 'Rajasthan', code: 'RJ' },
    { name: 'Sikkim', code: 'SK' },
    { name: 'Tamil Nadu', code: 'TN' },
    { name: 'Telangana', code: 'TG' },
    { name: 'Tripura', code: 'TR' },
    { name: 'Uttar Pradesh', code: 'UP' },
    { name: 'Uttarakhand', code: 'UK' },
    { name: 'West Bengal', code: 'WB' },
    // Union Territories
    { name: 'Andaman and Nicobar Islands', code: 'AN' },
    { name: 'Chandigarh', code: 'CH' },
    { name: 'Dadra and Nagar Haveli and Daman and Diu', code: 'DH' },
    { name: 'Delhi', code: 'DL' },
    { name: 'Jammu and Kashmir', code: 'JK' },
    { name: 'Ladakh', code: 'LA' },
    { name: 'Lakshadweep', code: 'LD' },
    { name: 'Puducherry', code: 'PY' },
];

async function main() {
    console.log('🌱 Starting seed...');

    // Create states
    console.log('📍 Creating states...');
    for (const state of INDIAN_STATES) {
        await db.state.upsert({
            where: { code: state.code },
            update: {},
            create: state,
        });
    }
    console.log(`✅ Created ${INDIAN_STATES.length} states`);

    // Create SUPER_ADMIN
    console.log('👤 Creating SUPER_ADMIN...');
    const hashedPassword = await bcrypt.hash('SuperAdmin@2026!', 10);

    await db.user.upsert({
        where: { email: 'admin@csnworld.com' },
        update: {
            role: 'SUPER_ADMIN',
            isActive: true,
            isVerified: true,
        },
        create: {
            firstName: 'Super',
            lastName: 'Admin',
            email: 'admin@csnworld.com',
            password: hashedPassword,
            role: 'SUPER_ADMIN',
            isActive: true,
            isVerified: true,
        },
    });

    console.log('✅ SUPER_ADMIN created:');
    console.log('   Email: admin@csnworld.com');
    console.log('   Password: SuperAdmin@2026!');
    console.log('   ⚠️  CHANGE THIS PASSWORD AFTER FIRST LOGIN!');

    console.log('\n🎉 Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
