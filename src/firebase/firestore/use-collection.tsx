import { useState, useEffect, useMemo } from 'react';
import { onSnapshot, Query, DocumentData, collection, query, where, getDocs, QuerySnapshot } from 'firebase/firestore';

export function useCollection<T>(q: Query | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (q === null) {
      setData(null);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);

    const unsubscribe = onSnapshot(q, 
      (querySnapshot: QuerySnapshot<DocumentData>) => {
        const documents = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as T));
        setData(documents);
        setIsLoading(false);
      },
      (err) => {
        console.error("Error fetching collection: ", err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [q]);

  return { data, isLoading, error };
}
