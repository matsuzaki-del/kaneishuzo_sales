import { prisma } from '../src/lib/prisma';
import dotenv from 'dotenv';

async function main() {
    console.log('--- Database Ping Test ---');
    try {
        const counts = await Promise.all([
            prisma.customer.count(),
            prisma.product.count(),
            prisma.monthlySales.count()
        ]);
        console.log('Connection successful!');
        console.log(`- Customers: ${counts[0]}`);
        console.log(`- Products: ${counts[1]}`);
        console.log(`- MonthlySales: ${counts[2]}`);
    } catch (e) {
        console.error('❌ Connection failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
