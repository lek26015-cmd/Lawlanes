
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = '/Users/tawanberkfah/.config/configstore/firebase-tools.json';

async function main() {
    try {
        const content = fs.readFileSync(CONFIG_PATH, 'utf8');
        const config = JSON.parse(content);
        const tokens = config.tokens;

        if (!tokens) throw new Error('No tokens found');

        const auth = require('firebase-tools/lib/auth');
        // getAccessToken signature might be (refreshToken, scopes) or just (refreshToken)
        // Let's try passing the refresh token.
        const token = await auth.getAccessToken(tokens.refresh_token, []);
        console.log('AccessToken:', token.access_token || token);
    } catch (e) {
        console.error(e);
    }
}

main();
