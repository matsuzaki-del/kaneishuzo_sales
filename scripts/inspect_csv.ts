import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const csvPath = path.join(process.cwd(), '..', 'monthly_sales_summary.csv');
const fileContent = fs.readFileSync(csvPath, 'utf-8');
const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
});

if (records.length > 0) {
    console.log("Keys found in first record:", Object.keys(records[0]));
    console.log("First record sample:", records[0]);
} else {
    console.log("No records found.");
}
