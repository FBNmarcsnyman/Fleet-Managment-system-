const fs = require('fs');
const src = 'C:/Users/marc/.claude/projects/c--Dev-Fleet-Managment-system-/232a8c3e-641e-49ed-a3c0-84c74d8deedb/tool-results/mcp-claude_ai_Supabase-generate_typescript_types-1781359549130.txt';
const raw = fs.readFileSync(src, 'utf8');
const obj = JSON.parse(raw);
if (!obj.types || !obj.types.includes('export type Database')) {
  console.error('Unexpected content; aborting'); process.exit(1);
}
fs.writeFileSync('lib/database.types.ts', obj.types, 'utf8');
console.log('Wrote lib/database.types.ts:', obj.types.length, 'chars');
console.log('Has loadcon new field:', obj.types.includes('arranging_branch'));
