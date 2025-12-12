import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

async function seedArticle() {
    console.log("Project ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    const { initializeFirebase } = await import('./src/firebase');
    const { firestore } = initializeFirebase();
    const articlesRef = collection(firestore, 'articles');

    // Check if it exists
    const q = query(articlesRef, where('title', '==', 'กฎหมายมรดกเบื้องต้น'));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        console.log('Article already exists.');
        process.exit(0);
    }

    await addDoc(articlesRef, {
        title: 'กฎหมายมรดกเบื้องต้น',
        slug: 'inheritance-law-basic',
        content: 'มรดก คือ ทรัพย์สินทุกชนิดของผู้ตาย ตลอดจนสิทธิหน้าที่และความรับผิดต่างๆ... (ข้อมูลตัวอย่าง) การแบ่งมรดกจะแบ่งให้ทายาทโดยธรรม 6 ลำดับ ได้แก่ 1. ผู้สืบสันดาน 2. บิดามารดา 3. พี่น้องร่วมบิดามารดา...',
        publishedAt: new Date().toISOString(),
        imageUrl: 'https://placehold.co/600x400',
        category: 'Civil Law'
    });

    console.log('Seeded "Inheritance" article.');
    process.exit(0);
}

seedArticle();
