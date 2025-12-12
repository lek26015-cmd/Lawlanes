
import fs from 'fs';
import path from 'path';

const configPath = '/Users/tawanberkfah/.config/configstore/firebase-tools.json';

try {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);
    if (config.tokens) {
        console.log('Keys in tokens:', Object.keys(config.tokens));
        // console.log('Refresh Token:', config.tokens.refresh_token); // Don't print secrets yet
    } else {
        console.log('No tokens found.');
    }
} catch (e) {
    console.error('Error reading config:', e);
}
