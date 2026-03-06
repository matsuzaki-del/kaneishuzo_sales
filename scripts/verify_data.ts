import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import 'dotenv/config';

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter: adapter as any });

async function main() {
    console.log("🔍 Checking database records...");
    const count = await prisma.monthlySales.count();
    console.log(`📊 Total MonthlySales records: ${count}`);

    if (count > 0) {
        const samples = await prisma.monthlySales.findMany({
            take: 3,
            orderBy: { id: 'desc' }
        });
        console.log("📝 Sample records:", JSON.stringify(samples, null, 2));
    }
}

main()
    .catch((e) => {
        console.error("❌ Verification failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
