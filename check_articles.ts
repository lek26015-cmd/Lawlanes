import { initializeFirebase } from './src/firebase';
import { collection, getDocs } from 'firebase/firestore';

async function listArticles() {
  const { firestore } = initializeFirebase();
  const snapshot = await getDocs(collection(firestore, 'articles'));
  console.log(`Found ${snapshot.size} articles:`);
  snapshot.forEach(doc => {
    console.log(`- ${doc.data().title}`);
  });
  process.exit(0);
}

listArticles();
