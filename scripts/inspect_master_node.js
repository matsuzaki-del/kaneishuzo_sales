const fs = require('fs');
const iconv = require('iconv-lite');
const { parse } = require('csv-parse/sync');

const filePath = "g:\\共有ドライブ\\【金井酒造店】営業・配送\\AI用_売掛金元帳\\学習用データ\\商品マスタリスト.csv";

try {
    const buffer = fs.readFileSync(filePath);
    // 日本語環境のCSVはShift-JISであることが多いため
    const content = iconv.decode(buffer, 'shift-jis');
    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
    });

    if (records.length > 0) {
        console.log("Headers:", Object.keys(records[0]));
        console.log("First record:", JSON.stringify(records[0], null, 2));
    } else {
        console.log("CSV is empty");
    }
} catch (e) {
    console.error("Error reading file:", e.message);
}
