const fs = require('fs');
const iconv = require('iconv-lite');

const filePath = "g:\\共有ドライブ\\【金井酒造店】営業・配送\\AI用_売掛金元帳\\学習用データ\\2101-2602urikakekin_v2.csv";

try {
    const buffer = fs.readFileSync(filePath);
    const content = iconv.decode(buffer, 'shift-jis');
    const firstLine = content.split('\n')[0];
    const headers = firstLine.split(',');

    headers.forEach((h, i) => {
        console.log(`${i}: ${h.trim()}`);
    });
} catch (e) {
    console.error("Error:", e.message);
}
