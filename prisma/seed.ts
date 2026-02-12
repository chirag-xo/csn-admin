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

const CITIES_BY_STATE = [
    { stateName: 'Maharashtra', cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Thane', 'Solapur'] },
    { stateName: 'Karnataka', cities: ['Bangalore', 'Mysore', 'Mangalore', 'Hubli', 'Belgaum', 'Gulbarga'] },
    { stateName: 'Tamil Nadu', cities: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli'] },
    { stateName: 'Gujarat', cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar'] },
    { stateName: 'Rajasthan', cities: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner'] },
    { stateName: 'West Bengal', cities: ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri'] },
    { stateName: 'Uttar Pradesh', cities: ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Meerut', 'Allahabad', 'Noida', 'Ghaziabad', 'Bareilly', 'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur', 'Jhansi', 'Firozabad', 'Loni', 'Mathura'] },
    { stateName: 'Uttarakhand', cities: ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur', 'Kashipur', 'Rishikesh', 'Mussoorie', 'Nainital', 'Pithoragarh', 'Almora'] },
    { stateName: 'Delhi', cities: ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'] },
    { stateName: 'Telangana', cities: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'] },
    { stateName: 'Andhra Pradesh', cities: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati'] },
    { stateName: 'Kerala', cities: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam'] },
    { stateName: 'Punjab', cities: ['Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala'] },
    { stateName: 'Haryana', cities: ['Gurgaon', 'Faridabad', 'Panipat', 'Ambala', 'Karnal'] },
    { stateName: 'Bihar', cities: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga'] },
    { stateName: 'Madhya Pradesh', cities: ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain'] },
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

    // Create cities
    console.log('🏙️  Creating cities...');
    for (const stateData of CITIES_BY_STATE) {
        const state = await db.state.findFirst({
            where: { name: stateData.stateName },
        });

        if (state) {
            for (const cityName of stateData.cities) {
                await db.city.upsert({
                    where: {
                        stateId_name: {
                            stateId: state.id,
                            name: cityName,
                        },
                    },
                    update: {},
                    create: {
                        name: cityName,
                        stateId: state.id,
                    },
                });
            }
        }
    }
    console.log('✅ Cities created');

    // Create SUPER_ADMIN
    console.log('👤 Creating SUPER_ADMIN...');
    const hashedPassword = await bcrypt.hash('SuperAdmin@2026!', 10);

    await db.user.upsert({
        where: { email: 'admin@csnworld.com' },
        update: {
            role: 'SUPER_ADMIN',
            isActive: true,
        },
        create: {
            firstName: 'Super',
            lastName: 'Admin',
            email: 'admin@csnworld.com',
            password: hashedPassword,
            role: 'SUPER_ADMIN',
            isActive: true,
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
