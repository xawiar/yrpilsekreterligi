const XLSX = require('xlsx');
const fs = require('fs');

try {
    const buf = fs.readFileSync('test-members.xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log('Headers:', JSON.stringify(data[0]));
    console.log('First Row:', JSON.stringify(data[1]));
} catch (e) {
    console.error('Error:', e.message);
}
