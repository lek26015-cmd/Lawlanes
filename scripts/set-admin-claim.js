#!/usr/bin/env node

/**
 * Lawslane Admin Claim Management Script
 * 
 * Usage:
 *   # Set admin claim
 *   node scripts/set-admin-claim.js <UID> --admin
 * 
 *   # Set lawyer claim
 *   node scripts/set-admin-claim.js <UID> --lawyer
 * 
 *   # Set both admin + lawyer
 *   node scripts/set-admin-claim.js <UID> --admin --lawyer
 *
 *   # Remove admin claim
 *   node scripts/set-admin-claim.js <UID> --remove-admin
 *
 *   # View current claims
 *   node scripts/set-admin-claim.js <UID> --view
 *
 * Requirements:
 *   Environment variables must be set (from .env.local):
 *     - NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *     - FIREBASE_CLIENT_EMAIL
 *     - FIREBASE_PRIVATE_KEY
 */

const admin = require('firebase-admin');
const path = require('path');

// ─── Load environment variables from .env.local ─────────────────────────────

function loadEnv() {
  try {
    const dotenv = require('dotenv');
    dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
  } catch (e) {
    console.warn('⚠️  dotenv not found, using existing environment variables');
  }
}

loadEnv();

// ─── Initialize Firebase Admin ──────────────────────────────────────────────

function formatPrivateKey(key) {
  if (!key) return key;
  
  // Handle JSON-wrapped keys
  if (key.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(key);
      if (parsed.private_key) key = parsed.private_key;
    } catch (e) { /* not JSON */ }
  }

  let cleaned = key.trim().replace(/^"|"$/g, '').trim();
  cleaned = cleaned.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
  return cleaned;
}

function initializeAdmin() {
  if (admin.apps.length > 0) return admin.app();

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY || '');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing required environment variables:');
    if (!projectId) console.error('   - NEXT_PUBLIC_FIREBASE_PROJECT_ID');
    if (!clientEmail) console.error('   - FIREBASE_CLIENT_EMAIL');
    if (!privateKey) console.error('   - FIREBASE_PRIVATE_KEY');
    console.error('\nMake sure .env.local exists and contains these variables.');
    process.exit(1);
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: projectId.trim(),
      clientEmail: clientEmail.trim(),
      privateKey: privateKey,
    }),
  });
}

// ─── Claim Management Functions ─────────────────────────────────────────────

async function viewClaims(uid) {
  const user = await admin.auth().getUser(uid);
  console.log('\n📋 User Details:');
  console.log(`   UID:    ${user.uid}`);
  console.log(`   Email:  ${user.email || '(none)'}`);
  console.log(`   Name:   ${user.displayName || '(none)'}`);
  console.log(`   Claims: ${JSON.stringify(user.customClaims || {}, null, 2)}`);
  return user.customClaims || {};
}

async function setClaims(uid, newClaims) {
  // Get existing claims and merge
  const user = await admin.auth().getUser(uid);
  const existingClaims = user.customClaims || {};
  const mergedClaims = { ...existingClaims, ...newClaims };

  // Remove keys with false value to keep claims clean
  for (const key of Object.keys(mergedClaims)) {
    if (mergedClaims[key] === false || mergedClaims[key] === null) {
      delete mergedClaims[key];
    }
  }

  await admin.auth().setCustomUserClaims(uid, mergedClaims);

  console.log(`\n✅ Claims updated for user ${uid}`);
  console.log(`   Email:      ${user.email || '(none)'}`);
  console.log(`   Name:       ${user.displayName || '(none)'}`);
  console.log(`   Old Claims: ${JSON.stringify(existingClaims)}`);
  console.log(`   New Claims: ${JSON.stringify(mergedClaims)}`);
  console.log('\n⚠️  Note: The user must sign out and sign back in (or wait ~1 hour)');
  console.log('   for the new claims to take effect in the client SDK.');
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
╔══════════════════════════════════════════════════════╗
║   Lawslane Admin Claim Management                    ║
╚══════════════════════════════════════════════════════╝

Usage:
  node scripts/set-admin-claim.js <UID> [options]

Options:
  --admin          Set admin: true custom claim
  --lawyer         Set lawyer: true custom claim
  --remove-admin   Remove admin claim
  --remove-lawyer  Remove lawyer claim
  --view           View current claims (no changes)
  --help           Show this help message

Examples:
  # Make a user an admin
  node scripts/set-admin-claim.js wS9w7ysNYUajNsBYZ6C7n2Afe9H3 --admin

  # Make a user both admin + lawyer
  node scripts/set-admin-claim.js wS9w7ysNYUajNsBYZ6C7n2Afe9H3 --admin --lawyer

  # Remove admin access
  node scripts/set-admin-claim.js wS9w7ysNYUajNsBYZ6C7n2Afe9H3 --remove-admin

  # Just view current claims
  node scripts/set-admin-claim.js wS9w7ysNYUajNsBYZ6C7n2Afe9H3 --view
`);
    process.exit(0);
  }

  const uid = args[0];
  if (!uid || uid.startsWith('--')) {
    console.error('❌ Please provide a user UID as the first argument.');
    process.exit(1);
  }

  initializeAdmin();

  try {
    // View only
    if (args.includes('--view')) {
      await viewClaims(uid);
      process.exit(0);
    }

    // Build claims object from flags
    const claimsToSet = {};

    if (args.includes('--admin')) claimsToSet.admin = true;
    if (args.includes('--lawyer')) claimsToSet.lawyer = true;
    if (args.includes('--remove-admin')) claimsToSet.admin = false;
    if (args.includes('--remove-lawyer')) claimsToSet.lawyer = false;

    if (Object.keys(claimsToSet).length === 0) {
      console.error('❌ No action specified. Use --admin, --lawyer, --remove-admin, --remove-lawyer, or --view');
      process.exit(1);
    }

    console.log(`\n🔄 Updating claims for UID: ${uid}`);
    console.log(`   Changes: ${JSON.stringify(claimsToSet)}`);

    await setClaims(uid, claimsToSet);

    // Show final state
    console.log('\n--- Final State ---');
    await viewClaims(uid);

  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`\n❌ User not found: ${uid}`);
      console.error('   Please check the UID and try again.');
    } else {
      console.error('\n❌ Error:', error.message);
    }
    process.exit(1);
  }

  process.exit(0);
}

main();
