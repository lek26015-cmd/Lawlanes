#!/usr/bin/env node

/**
 * Lawslane Transaction Migration & Global Stats Bootstrap Script
 * 
 * Usage:
 *   node scripts/migrate-transactions.js
 * 
 * Description:
 *   - Iterates through `appointments` and `chats`
 *   - Creates historical elements in the `transactions` collection.
 *   - Aggregates stats into `system/global_stats` using Atomic queries.
 */

const admin = require('firebase-admin');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

function loadEnv() {
  try {
    const dotenv = require('dotenv');
    dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
  } catch (e) {
    console.warn('⚠️  dotenv not found, using existing environment variables');
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
    console.error('❌ Missing required environment variables.');
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

const APPOINTMENT_FEE_GROSS = 3500;
const CHAT_FEE_GROSS = 500;
const PLATFORM_FEE_RATE = 0.15;

async function migrate() {
  console.log("🚀 Starting Data Migration...");
  const db = admin.firestore();

  const transactionsRef = db.collection('transactions');
  const globalStatsRef = db.doc('system/global_stats');
  
  // Stats tracking
  let totalServiceValue = 0;
  let platformTotalRevenue = 0;
  let appointmentsMigrated = 0;
  let chatsMigrated = 0;
  const monthlyRevenue = {}; // We'll accumulate locally to update batch

  const batchSize = 400; // Safe limit below 500 max writes
  let currentBatch = db.batch();
  let operationCount = 0;

  async function commitBatchIfNeeded() {
    if (operationCount >= batchSize) {
      await currentBatch.commit();
      console.log(`✅ Committed batch of ${operationCount} operations`);
      currentBatch = db.batch();
      operationCount = 0;
    }
  }

  // 1. Process Appointments
  const appointmentsSnap = await db.collection('appointments').get();
  console.log(`\n📋 Found ${appointmentsSnap.size} appointments. Processing...`);

  for (const doc of appointmentsSnap.docs) {
    const data = doc.data();
    // Replicate previous hardcoded logic status check
    if (data.status !== 'pending' && data.status !== 'pending_payment' && data.status !== 'cancelled') {
        const gross = APPOINTMENT_FEE_GROSS;
        const platformTake = gross * PLATFORM_FEE_RATE;
        const netAmount = gross - platformTake;

        const ts = data.createdAt ? data.createdAt.toDate() : new Date();

        const txRef = transactionsRef.doc(`apt_${doc.id}`);
        const txDoc = {
            amount: gross,
            platformFee: platformTake,
            netAmount: netAmount,
            lawyerId: data.lawyerId || '',
            clientId: data.userId || '',
            type: 'revenue',
            status: data.status === 'completed' ? 'completed' : 'pending',
            createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            transactionId: data.paymentId || `mock_txn_${uuidv4()}`,
            sourceId: doc.id
        };

        currentBatch.set(txRef, txDoc);
        operationCount++;

        totalServiceValue += gross;
        platformTotalRevenue += platformTake;
        
        const monthKey = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + platformTake;

        appointmentsMigrated++;
        await commitBatchIfNeeded();
    }
  }

  // 2. Process Chats
  const chatsSnap = await db.collection('chats').get();
  console.log(`\n💬 Found ${chatsSnap.size} chats. Processing...`);

  for (const doc of chatsSnap.docs) {
      const data = doc.data();
      if (data.status !== 'pending_payment') {
          const gross = CHAT_FEE_GROSS;
          const platformTake = gross * PLATFORM_FEE_RATE;
          const netAmount = gross - platformTake;

          const ts = data.createdAt ? data.createdAt.toDate() : new Date();
          let lawyerId = data.lawyerId || (data.participants && data.participants[0]) || '';
          let clientId = data.participants?.find(p => p !== lawyerId) || '';

          const txRef = transactionsRef.doc(`chat_${doc.id}`);
          const txDoc = {
            amount: gross,
            platformFee: platformTake,
            netAmount: netAmount,
            lawyerId: lawyerId,
            clientId: clientId,
            type: 'revenue',
            status: data.status === 'closed' ? 'completed' : 'pending',
            createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            transactionId: data.paymentId || `mock_txn_${uuidv4()}`,
            sourceId: doc.id
          };

          currentBatch.set(txRef, txDoc);
          operationCount++;

          totalServiceValue += gross;
          platformTotalRevenue += platformTake;

          const monthKey = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
          monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + platformTake;

          chatsMigrated++;
          await commitBatchIfNeeded();
      }
  }

  // Final batch commit for transactions
  if (operationCount > 0) {
      await currentBatch.commit();
      console.log(`✅ Committed final batch of ${operationCount} operations`);
  }

  // 3. Update global_stats
  console.log(`\n📊 Updating global_stats...`);
  
  const statsPayload = {
      totalServiceValue: admin.firestore.FieldValue.increment(totalServiceValue),
      platformTotalRevenue: admin.firestore.FieldValue.increment(platformTotalRevenue),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      monthlyData: {}
  };

  // Add monthly aggregates to merge payload
  for (const [month, value] of Object.entries(monthlyRevenue)) {
      statsPayload[`monthlyData.${month}`] = admin.firestore.FieldValue.increment(value);
  }

  await globalStatsRef.set(statsPayload, { merge: true });

  console.log("\n🎉 Migration Complete!");
  console.log(`   - Appointments Migrated: ${appointmentsMigrated}`);
  console.log(`   - Chats Migrated:        ${chatsMigrated}`);
  console.log(`   - Total Service Value:   ฿${totalServiceValue}`);
  console.log(`   - Platform Total Rev:    ฿${platformTotalRevenue}`);
}

initializeAdmin();

migrate().then(() => process.exit(0)).catch(e => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});
