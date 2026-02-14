const fs = require('fs');

// Use the names provided by the Netlify-Supabase integration
const configContent = `
export const SUPABASE_URL = "${process.env.SUPABASE_DATABASE_URL}";
export const SUPABASE_ANON_KEY = "${process.env.SUPABASE_ANON_KEY}";
`;

fs.writeFileSync('./js/config.js', configContent);
console.log('✅ Config generated');