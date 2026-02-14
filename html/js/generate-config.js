// html/js/generate-config.js
const fs = require('fs');
const path = require('path');

const configContent = `
export const SUPABASE_URL = "${process.env.SUPABASE_DATABASE_URL}";
export const SUPABASE_ANON_KEY = "${process.env.SUPABASE_ANON_KEY}";
`;

// This targets the folder the script is in (html/js/)
const outPath = path.join(__dirname, 'config.js');

fs.writeFileSync(outPath, configContent, 'utf8');
console.log('✅ Config generated at:', outPath);