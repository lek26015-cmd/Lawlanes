'use client';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User, Auth } from 'firebase/auth';
import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';

export const useUser = (auth: Auth | null) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setIsLoading(false);
    }, (error) => {
      console.error("Auth state change error:", error);
      setIsLoading(false);
    });

    // Sign in anonymously if not logged in
    const signInAnonymously = async () => {
        if (!auth.currentUser) {
            const { signInAnonymously } = await import('firebase/auth');
            try {
                await signInAnonymously(auth);
            } catch (error) {
                console.error("Anonymous sign-in error:", error);
            }
        }
    };
    
    signInAnonymously();


    return () => unsubscribe();
  }, [auth]);

  return { data: user, isLoading };
};
