import { useState, useEffect, useMemo } from 'react';
import { onSnapshot, DocumentReference, DocumentData } from 'firebase/firestore';

export function useDoc<T>(ref: DocumentReference<DocumentData> | null) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (ref === null) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    const unsubscribe = onSnapshot(ref, 
      (doc) => {
        if (doc.exists()) {
          setData({ id: doc.id, ...doc.data() } as T);
        } else {
          setData(null);
        }
        setIsLoading(false);
      },
      (err) => {
        console.error("Error fetching document: ", err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ref]);

  return { data, isLoading, error };
}
