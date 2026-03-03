const fs = require('fs');

const authTsPath = 'src/app/actions/auth.ts';
let code = fs.readFileSync(authTsPath, 'utf8');

code = code.replace(/await auth\.generateEmailVerificationLink/g, 'await auth.auth().generateEmailVerificationLink');
code = code.replace(/await auth\.generatePasswordResetLink/g, 'await auth.auth().generatePasswordResetLink');

fs.writeFileSync(authTsPath, code);

const sessionRoutePath = 'src/app/api/auth/session/route.ts';
let sessionCode = fs.readFileSync(sessionRoutePath, 'utf8');

if (!sessionCode.includes("import { initAdmin } from")) {
    sessionCode = sessionCode.replace(
        "import { NextResponse } from 'next/server';",
        "import { NextResponse } from 'next/server';\nimport { initAdmin } from '@/lib/firebase-admin';"
    );
}

const sessionPostSearch = `// Add a non-httpOnly hint for the client
        // We can't verify the token here without jose, so we trust it was just sent from a successful login
        cookieStore.set('session_hint', 'authenticated', {
            ...cookieOptions,
            httpOnly: false,
        });

        return NextResponse.json({ success: true });`;

const sessionPostReplace = `const auth = await initAdmin();
        if (!auth) {
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }
        
        const sessionCookie = await auth.auth().createSessionCookie(idToken, { expiresIn });

        // Store the verified session cookie
        cookieStore.set('session', sessionCookie, cookieOptions);

        // Add a non-httpOnly hint for the client
        cookieStore.set('session_hint', 'authenticated', {
            ...cookieOptions,
            httpOnly: false,
        });

        return NextResponse.json({ success: true });`;

if (sessionCode.includes("// We can't verify the token here without jose")) {
    sessionCode = sessionCode.replace(sessionPostSearch, sessionPostReplace);
}

const sessionGetSearch = `// For Edge Runtime, we return a basic status. 
        // Real validation would happen via JWT decoding.
        return NextResponse.json({
            authenticated: true,
            note: "Authenticated via lightweight edge session"
        });`;

const sessionGetReplace = `// Validate via Firebase Admin
        const auth = await initAdmin();
        if (!auth) {
             return NextResponse.json({ authenticated: false }, { status: 401 });
        }
        try {
            const decodedToken = await auth.auth().verifySessionCookie(sessionCookie, true);
            return NextResponse.json({ authenticated: true, uid: decodedToken.uid });
        } catch (error) {
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }`;

if (sessionCode.includes("// Real validation would happen via JWT decoding.")) {
    sessionCode = sessionCode.replace(sessionGetSearch, sessionGetReplace);
}

fs.writeFileSync(sessionRoutePath, sessionCode);
console.log("Updated files.");
