const XLSX = require('xlsx');
const path = 'C:/Users/marc/Downloads/Updated_FBN_Fleet_Master_List (2).xlsx';
const wb = XLSX.readFile(path);
console.log('=== SHEETS ===', wb.SheetNames);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const json = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
  console.log('\n===== SHEET: ' + name + ' (' + json.length + ' rows) =====');
  for (let i = 0; i < Math.min(4, json.length); i++) {
    console.log('Row ' + i + ':', JSON.stringify(json[i]));
  }
}
