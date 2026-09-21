#!/usr/bin/env node

/**
 * bookOrders -> orders migration (LAWSLANE-PLAN-01 3.1)
 *
 * Context: education.lawslane.com writes book purchases to `orders`, but
 * admin.lawslane.com's order-management UI and lawslane.com's dashboard both
 * read `bookOrders` instead — so anything sold through education is
 * invisible in the back office. The ecosystem doc's decision is to make
 * `orders` the standard going forward (it already supports book/course/exam
 * item types; `bookOrders` only ever supported books), so this migrates the
 * OLDER `bookOrders` records IN to `orders`, normalizing field names:
 *
 *   bookOrders field         ->  orders field
 *   items[].bookId           ->  items[].id  (+ items[].type = 'BOOK')
 *   items[].imageUrl         ->  items[].coverUrl
 *   shippingAddress          ->  shippingInfo
 *   status (lowercase)       ->  status (uppercase: pending->PENDING, paid->PAID,
 *                                 shipped->SHIPPING, delivered->DELIVERED,
 *                                 cancelled->CANCELLED)
 *
 * This script is intentionally NOT wired into any app — it's a one-off,
 * run-by-hand migration. It is purely additive: it never modifies or deletes
 * the original `bookOrders` documents, so it's safe to re-run (idempotent —
 * see DOC_ID below) and trivially reversible (just delete the migrated docs
 * it created, identifiable by `migratedFrom: 'bookOrders'`).
 *
 * IMPORTANT — do not run this against production without:
 *   1. Running with no flags first (dry run) and reviewing the output.
 *   2. Taking a real backup — this script's own --backup step writes one,
 *      but a `gcloud firestore export` / Firebase console export of
 *      `bookOrders` (and ideally `orders`) is a good idea too before --execute.
 *   3. Testing against a small subset first if possible (see --limit).
 *
 * Usage:
 *   node scripts/migrate-bookorders-into-orders.js                  # dry run, all docs
 *   node scripts/migrate-bookorders-into-orders.js --limit=5         # dry run, first 5 docs
 *   node scripts/migrate-bookorders-into-orders.js --backup          # dry run + write backup JSON
 *   node scripts/migrate-bookorders-into-orders.js --backup --execute  # actually write to Firestore
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  try {
    const dotenv = require('dotenv');
    dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
  } catch (e) {
    console.warn('dotenv not found, using existing environment variables');
  }
}

loadEnv();

function formatPrivateKey(key) {
  if (!key) return key;
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
    console.error('Missing required environment variables (NEXT_PUBLIC_FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY).');
    process.exit(1);
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: projectId.trim(),
      clientEmail: clientEmail.trim(),
      privateKey,
    }),
  });
}

const STATUS_MAP = {
  pending: 'PENDING',
  paid: 'PAID',
  shipped: 'SHIPPING',
  delivered: 'DELIVERED',
  cancelled: 'CANCELLED',
};

function normalizeBookOrder(doc) {
  const data = doc.data();

  const items = (data.items || []).map((item) => ({
    id: item.bookId || '',
    type: 'BOOK',
    title: item.title || '',
    price: item.price || 0,
    coverUrl: item.imageUrl || '',
    quantity: item.quantity || 1,
  }));

  const status = STATUS_MAP[data.status] || 'PENDING';

  return {
    // Deterministic id so re-running this script is a no-op for docs already
    // migrated, instead of creating duplicates.
    newDocId: `legacy_bookorder_${doc.id}`,
    data: {
      userId: data.userId || '',
      items,
      totalAmount: data.totalAmount || 0,
      status,
      paymentMethod: data.paymentMethod || 'bank-transfer',
      paymentSlipUrl: data.paymentSlipUrl || '',
      shippingInfo: data.shippingAddress || null,
      trackingNumber: data.trackingNumber || null,
      createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: data.updatedAt || admin.firestore.FieldValue.serverTimestamp(),
      // Audit trail — lets this migration be identified/reversed later.
      migratedFrom: 'bookOrders',
      legacyId: doc.id,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const backup = args.includes('--backup');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  initializeAdmin();
  const db = admin.firestore();

  console.log(execute ? 'RUNNING FOR REAL (--execute passed)' : 'DRY RUN (pass --execute to actually write)');

  let query = db.collection('bookOrders').orderBy('createdAt', 'asc');
  if (limit) query = query.limit(limit);
  const snap = await query.get();

  console.log(`Found ${snap.size} bookOrders document(s)${limit ? ` (limited to ${limit})` : ''}.`);

  if (backup) {
    const backupData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const backupPath = path.resolve(__dirname, `bookOrders-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backupData, (_key, value) => {
      // Firestore Timestamps aren't plain-JSON-serializable by default.
      if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
      return value;
    }, 2));
    console.log(`Backup written to ${backupPath}`);
  }

  let skipped = 0;
  let planned = 0;
  const batchSize = 400;
  let batch = db.batch();
  let opCount = 0;

  for (const doc of snap.docs) {
    const { newDocId, data } = normalizeBookOrder(doc);
    const targetRef = db.collection('orders').doc(newDocId);

    if (execute) {
      const existing = await targetRef.get();
      if (existing.exists) {
        skipped++;
        continue;
      }
      batch.set(targetRef, data);
      opCount++;
      planned++;
      if (opCount >= batchSize) {
        await batch.commit();
        console.log(`Committed batch of ${opCount}`);
        batch = db.batch();
        opCount = 0;
      }
    } else {
      planned++;
      console.log(`[dry run] would create orders/${newDocId} from bookOrders/${doc.id} (status: ${data.status}, items: ${data.items.length})`);
    }
  }

  if (execute && opCount > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${opCount}`);
  }

  console.log('\nDone.');
  console.log(`  Planned/created: ${planned}`);
  if (execute) console.log(`  Skipped (already migrated): ${skipped}`);
  if (!execute) console.log('\nThis was a dry run — nothing was written. Re-run with --execute to apply.');
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
