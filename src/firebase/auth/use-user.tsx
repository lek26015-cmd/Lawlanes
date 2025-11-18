'use client';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User, Auth } from 'firebase/auth';

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

    return () => unsubscribe();
  }, [auth]);

  return { data: user, isLoading };
};
