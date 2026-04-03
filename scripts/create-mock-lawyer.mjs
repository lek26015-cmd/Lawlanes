import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌ Missing Firebase Admin environment variables in .env.local");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function createMockLawyer() {
  const email = "lawyer-test@lawslane.com";
  const password = "lawslane1234";
  const name = "ทนายประจักษ์ ยุติธรรม";

  console.log(`🚀 Creating mock lawyer: ${name} (${email})...`);

  try {
    // 1. Create or Get Auth User
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log(`✅ User already exists with UID: ${userRecord.uid}`);
    } catch (e) {
      userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
      });
      console.log(`✅ Created new Auth User with UID: ${userRecord.uid}`);
    }

    // 2. Set User Claims (optional but good practice)
    await auth.setCustomUserClaims(userRecord.uid, { role: 'lawyer' });
    console.log(`✅ Set custom claims for role: lawyer`);

    // 3. Create/Update Lawyer Profile
    const lawyerId = "mock-lawyer-001"; // Specific ID for consistency
    const lawyerProfileRef = db.collection('lawyerProfiles').doc(lawyerId);
    
    const lawyerData = {
      id: lawyerId,
      userId: userRecord.uid,
      name: name,
      email: email,
      phone: "081-111-2222",
      specialty: ["กฎหมายทั่วไป", "คดีแพ่ง", "กฎหมายครอบครัว"],
      status: "approved",
      licenseNumber: "1234/2567",
      description: "ทนายความผู้เชี่ยวชาญด้านกฎหมายทั่วไปและคดีแพ่ง พร้อมให้คำปรึกษาด้วยความยุติธรรม",
      education: "นิติศาสตรบัณฑิต มหาวิทยาลัยธรรมศาสตร์",
      experience: "ประสบการณ์ว่าความมมากกว่า 10 ปี",
      imageUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=800",
      imageHint: "lawyer-male",
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      averageRating: 4.8,
      reviewCount: 0,
      pricing: {
        appointmentFee: 3500,
        chatFee: 500,
        platformFeeRate: 0.15
      }
    };

    await lawyerProfileRef.set(lawyerData, { merge: true });
    console.log(`✅ Created/Updated Lawyer Profile in 'lawyerProfiles' collection`);

    // 4. Create/Update User document in 'users' collection
    const userDocRef = db.collection('users').doc(userRecord.uid);
    await userDocRef.set({
      uid: userRecord.uid,
      name: name,
      email: email,
      role: 'lawyer',
      status: 'active',
      registeredAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`✅ Created/Updated User Profile in 'users' collection`);

    console.log("\n--------------------------------------------------");
    console.log("🎉 SUCCESS: Mock Lawyer Created!");
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`🔗 Dashboard: http://localhost:9002/th/lawyer-dashboard`);
    console.log("--------------------------------------------------\n");

  } catch (error) {
    console.error("❌ Error creating mock lawyer:", error);
  }
}

createMockLawyer();
