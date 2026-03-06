const fs = require('fs');
const path = require('path');
const dir = 'c:/Users/Semij/Documents/WK2026/html';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const injection = `
    <link rel="manifest" href="./manifest.json">
    <meta name="theme-color" content="#FF7F00">
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW ref fail', err));
            });
        }
    </script>
</head>`;

files.forEach(file => {
    const p = path.join(dir, file);
    let content = fs.readFileSync(p, 'utf8');
    if (!content.includes('manifest.json')) {
        content = content.replace(/<\/head>/i, injection);
        fs.writeFileSync(p, content);
        console.log('Updated ' + file);
    }
});
