// generate-config.js
const fs = require('fs');

// The content of the config file, using the environment variables
const configContent = `
export const SUPABASE_URL = "${process.env.SUPABASE_URL}";
export const SUPABASE_ANON_KEY = "${process.env.SUPABASE_ANON_KEY}";
`;

// Write the file to the correct location
// (Adjust 'html/js/config.js' if your path is different)
fs.writeFileSync('./js/config.js', configContent);

console.log('✅ Config file generated successfully!');
