import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';
import { FirebaseProvider, useFirebase, useFirebaseApp, useAuth, useFirestore } from './provider';
import { useUser } from './auth/use-user';
import { useCollection } from './firestore/use-collection';
import { useDoc } from './firestore/use-doc';
import { FirebaseClientProvider } from './client-provider';


let firebaseApp: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

function initializeFirebase() {
  if (typeof window !== 'undefined') {
    if (!getApps().length) {
      firebaseApp = initializeApp(firebaseConfig);
      auth = getAuth(firebaseApp);
      firestore = getFirestore(firebaseApp);
    }
  }
  // This is a server-only block.
  // @ts-ignore
  else if (!global.firebaseApp) {
    // @ts-ignore
    global.firebaseApp = initializeApp(firebaseConfig);
  }
  // @ts-ignore
  firebaseApp = global.firebaseApp;
  auth = getAuth(firebaseApp);
  firestore = getFirestore(firebaseApp);
  return { firebaseApp, auth, firestore };
}


export {
  initializeFirebase,
  FirebaseProvider,
  FirebaseClientProvider,
  useUser,
  useCollection,
  useDoc,
  useFirebase,
  useFirebaseApp,
  useAuth,
  useFirestore,
};
