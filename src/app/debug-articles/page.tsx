'use client';

import { useEffect, useState } from 'react';
import { useFirebase } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function DebugArticlesPage() {
    const { firestore } = useFirebase();
    const [articles, setArticles] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchArticles() {
            if (!firestore) return;
            try {
                const articlesRef = collection(firestore, 'articles');
                // Fetch WITHOUT orderBy to see if data exists
                const querySnapshot = await getDocs(articlesRef);
                const fetchedArticles = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    // Try to format date, handle errors
                    publishedAtFormatted: doc.data().publishedAt?.toDate?.()?.toISOString() || 'Invalid Date'
                }));
                setArticles(fetchedArticles);
            } catch (err: any) {
                console.error("Error fetching articles:", err);
                setError(err.message);
            }
        }

        fetchArticles();
    }, [firestore]);

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Debug Articles</h1>
            {error && <div className="text-red-500 mb-4">Error: {error}</div>}
            <div className="space-y-4">
                {articles.map(article => (
                    <div key={article.id} className="border p-4 rounded shadow">
                        <h2 className="font-bold">{article.title}</h2>
                        <p>ID: {article.id}</p>
                        <p>Slug: {article.slug}</p>
                        <p>Published At (Raw): {JSON.stringify(article.publishedAt)}</p>
                        <p>Published At (Formatted): {article.publishedAtFormatted}</p>
                        <img src={article.imageUrl} alt={article.title} className="w-32 h-20 object-cover mt-2" />
                    </div>
                ))}
            </div>
        </div>
    );
}
