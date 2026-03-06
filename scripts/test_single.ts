import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import 'dotenv/config';

neonConfig.webSocketConstructor = ws;

const connectionString = "postgresql://neondb_owner:npg_3Pe2ZjLTXsbW@ep-snowy-heart-ai9cc23s.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";
const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter: adapter as any });

async function main() {
    try {
        console.log("📡 Attempting to create one record...");
        const result = await prisma.monthlySales.create({
            data: {
                month: "2024-01",
                productName: "Test Product",
                quantity: 100.5
            }
        });
        console.log("✅ Success! ID:", result.id);
    } catch (e) {
        console.error("❌ Failed to create record:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
