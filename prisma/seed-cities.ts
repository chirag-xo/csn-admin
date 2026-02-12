import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const db = new PrismaClient();

// Map JSON state names to DB state names if they differ
const STATE_NAME_MAPPING: { [key: string]: string } = {
    'Orissa': 'Odisha',
    'Pondicherry': 'Puducherry',
    'Uttarakhand': 'Uttarakhand',
    'Uttaranchal': 'Uttarakhand',
    // Add others if needed
};

interface CityEntry {
    id: string;
    name: string;
    state: string;
}

async function main() {
    console.log('🌱 Starting comprehensive city seed (optimized)...');

    const citiesFilePath = path.join(__dirname, 'cities.json');
    if (!fs.existsSync(citiesFilePath)) {
        throw new Error(`Cities file not found at ${citiesFilePath}`);
    }

    const rawData = fs.readFileSync(citiesFilePath, 'utf-8');
    const citiesData: CityEntry[] = JSON.parse(rawData);

    console.log(`📦 Loaded ${citiesData.length} cities from JSON.`);

    const states = await db.state.findMany();
    const stateMap = new Map<string, string>(); // Name -> ID

    for (const state of states) {
        stateMap.set(state.name.toLowerCase(), state.id);
    }

    const citiesToCreate: { name: string; stateId: string }[] = [];
    let skippedCount = 0;

    for (const cityEntry of citiesData) {
        let stateName = cityEntry.state;

        // Handle mapping
        if (STATE_NAME_MAPPING[stateName]) {
            stateName = STATE_NAME_MAPPING[stateName];
        }

        const stateId = stateMap.get(stateName.toLowerCase());

        if (!stateId) {
            // console.warn(`⚠️ State not found for city: ${cityEntry.name} (${cityEntry.state})`);
            skippedCount++;
            continue;
        }

        citiesToCreate.push({
            name: cityEntry.name,
            stateId,
        });
    }

    if (citiesToCreate.length > 0) {
        const result = await db.city.createMany({
            data: citiesToCreate,
            skipDuplicates: true,
        });
        console.log(`✅ Batch inserted/skipped: ${result.count} new cities.`);
    } else {
        console.log('⚠️ No valid cities found to insert.');
    }

    console.log(`\n🎉 City seeding completed!`);
    console.log(`⚠️ Skipped (State not found): ${skippedCount}`);
}

main()
    .catch((e) => {
        console.error('❌ City seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
