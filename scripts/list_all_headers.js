const fs = require('fs');
const iconv = require('iconv-lite');

const masterPath = "g:\\共有ドライブ\\【金井酒造店】営業・配送\\AI用_売掛金元帳\\学習用データ\\商品ﾏｽﾀﾘｽﾄ.csv";
const urikakePath = "g:\\共有ドライブ\\【金井酒造店】営業・配送\\AI用_売掛金元帳\\学習用データ\\2101-2602urikakekin_v2.csv";

function listHeaders(filePath, label) {
    try {
        const buffer = fs.readFileSync(filePath);
        const content = iconv.decode(buffer, 'shift-jis');
        const firstLine = content.split('\n')[0];
        const headers = firstLine.split(',');
        console.log(`--- Headers for ${label} ---`);
        headers.forEach((h, i) => {
            console.log(`${i + 1}: ${h.trim()} (index ${i})`);
        });
    } catch (e) {
        console.error(`Error reading ${label}:`, e.message);
    }
}

listHeaders(masterPath, "商品マスタ");
listHeaders(urikakePath, "売掛金データ");
