
'use client';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User, Auth, signInAnonymously as firebaseSignInAnonymously } from 'firebase/auth';

export const useUser = (auth: Auth | null) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        setIsLoading(false);
      } else {
        // If no user, sign in anonymously
        try {
          const userCredential = await firebaseSignInAnonymously(auth);
          setUser(userCredential.user);
        } catch (error) {
          console.error("Anonymous sign-in error:", error);
        } finally {
          setIsLoading(false);
        }
      }
    }, (error) => {
      console.error("Auth state change error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  return { data: user, isLoading };
};
