// generate-config.js
const fs = require('fs');

// The content of the config file, using the environment variables
const configContent = `
const config = {
    SUPABASE_URL: "${process.env.SUPABASE_URL}",
    SUPABASE_ANON_KEY: "${process.env.SUPABASE_ANON_KEY}"
};
export default config;
`;

// Write the file to the correct location
// (Adjust 'html/js/config.js' if your path is different)
fs.writeFileSync('./js/config.js', configContent);

console.log('✅ Config file generated successfully!');
