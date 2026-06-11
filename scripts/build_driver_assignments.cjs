const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const xlsxPath = 'C:/Users/marc/Downloads/Updated_FBN_Fleet_Master_List (2).xlsx';
const { vehicles } = JSON.parse(fs.readFileSync(path.join(__dirname, 'fuel_vehicles.json'), 'utf8'));

const normReg = (s) => (s || '').toString().toUpperCase().replace(/\(.*?\)/g, '').replace(/[^A-Z0-9]/g, '');
const byName = new Map(vehicles.map(v => [v.name.trim().toUpperCase(), v]));
const byReg = new Map(vehicles.map(v => [normReg(v.registration), v]));

const wb = XLSX.readFile(xlsxPath);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Consolidated Fleet'], { header: 1, blankrows: false }).slice(1);

const SKIP = new Set(['', '---', '(NONE)']); // not real drivers / no driver
const assignments = [];
const unmatched = [];
const skipped = [];

for (const r of rows) {
  const id = (r[0] || '').toString().trim();
  const driver = (r[3] || '').toString().trim();
  const reg = (r[4] || '').toString().trim();
  if (!id) continue;
  if (SKIP.has(driver.toUpperCase())) { skipped.push(`${id} (${driver || 'blank'})`); continue; }

  const veh = byName.get(id.toUpperCase()) || byReg.get(normReg(reg));
  if (!veh) { unmatched.push(`${id} / ${reg} -> ${driver}`); continue; }
  assignments.push({ id: veh.id, name: veh.name, driver });
}

// Build a single UPDATE ... FROM (VALUES ...) statement.
const esc = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const values = assignments.map(a => `(${esc(a.id)}::uuid, ${esc(a.driver)})`).join(',\n  ');
const sql = `update vehicles v set driver_name = d.driver, updated_at = now()
from (values
  ${values}
) as d(id, driver)
where v.id = d.id;`;

fs.writeFileSync(path.join(__dirname, 'driver_assignments_update.sql'), sql);

console.log('Assignments to apply :', assignments.length);
console.log('Skipped (no driver)  :', skipped.length, '->', skipped.join(', '));
console.log('Unmatched (NEEDS REVIEW):', unmatched.length);
unmatched.forEach(u => console.log('   ', u));
console.log('\nSample assignments:');
assignments.slice(0, 10).forEach(a => console.log('   ', a.name.padEnd(8), '->', a.driver));
