import { getApprovedLawyers } from '@/lib/data';
import LawyerCard from '@/components/lawyer-card';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Expert Lawyers | Lawlane',
  description: 'Find a curated list of expert lawyers specializing in SME civil and fraud cases.',
};

export default async function LawyersPage() {
  const lawyers = await getApprovedLawyers();

  return (
    <div className="container mx-auto px-4 md:px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl font-headline">
          Expert Lawyer Marketplace
        </h1>
        <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
          A curated list of approved lawyers specializing in civil and fraud cases for SMEs.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {lawyers.map((lawyer) => (
          <LawyerCard key={lawyer.id} lawyer={lawyer} />
        ))}
      </div>
    </div>
  );
}
