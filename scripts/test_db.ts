import pg from "pg";
import "dotenv/config";

async function testConnection() {
    // パターンの列挙
    const urls = [
        // パターン1: 直接接続 (標準ホスト名)
        `postgresql://postgres:%24hirasasa2025@db.nnqqxkzffnzzoawmpqqo.supabase.co:5432/postgres`,
        // パターン2: プーラー (Transaction)
        `postgresql://postgres.nnqqxkzffnzzoawmpqqo:%24hirasasa2025@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
        // パターン3: プーラー (Session) - ポート5432
        `postgresql://postgres.nnqqxkzffnzzoawmpqqo:%24hirasasa2025@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`
    ];

    for (const url of urls) {
        console.log(`Testing URL: ${url.replace(/%24hirasasa2025/, '****')}`);
        const client = new pg.Client({ connectionString: url });
        try {
            await client.connect();
            console.log("✅ Success!");
            await client.query("SELECT 1");
            await client.end();
            return url;
        } catch (e: any) {
            console.log(`❌ Failed: ${e.message}`);
        }
    }
}

testConnection().then(url => {
    if (url) console.log(`\nFinal Working URL: ${url}`);
});
