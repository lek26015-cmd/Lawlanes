
try {
    const auth = require('firebase-tools/lib/auth');
    console.log('Keys:', Object.keys(auth));
    console.log('ClientID:', auth.clientId || auth.CLIENT_ID);
    console.log('ClientSecret:', auth.clientSecret || auth.CLIENT_SECRET);
} catch (e) {
    console.error(e);
}
