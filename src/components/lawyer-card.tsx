import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { LawyerProfile } from '@/lib/types';
import { Mail, Scale, Phone } from 'lucide-react';
import { StarIcon } from '@/components/icons/star-icon';
import Image from 'next/image';
import Link from 'next/link';

interface LawyerCardProps {
  lawyer: LawyerProfile;
}

export default function LawyerCard({ lawyer }: LawyerCardProps) {
  // Mock data for rating and reviews
  const rating = (Number(lawyer.id) % 2) + 3.5;
  const reviewCount = Number(lawyer.id) * 7 + 5;

  return (
    <div className="flex flex-col md:flex-row items-start p-6 gap-6 w-full bg-card text-card-foreground rounded-lg border">
      <div className="flex-shrink-0 flex flex-col items-center gap-2 w-full md:w-24">
        <div className="relative h-20 w-20 flex-shrink-0">
          <Image
            src={lawyer.imageUrl}
            alt={lawyer.name}
            fill
            className="rounded-full object-cover"
            data-ai-hint={lawyer.imageHint}
          />
        </div>
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <StarIcon key={i} className={`w-4 h-4 ${i < Math.floor(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">({reviewCount} รีวิว)</p>
      </div>

      <div className="flex-grow text-center md:text-left">
        <h3 className="font-bold text-xl">{lawyer.name}</h3>
        <p className="font-semibold text-primary mt-1 mb-2">{lawyer.specialty[0]}</p>
        <p className="text-sm text-muted-foreground mt-1 mb-4">{lawyer.description}</p>
        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
          {lawyer.specialty.map((spec, index) => (
            <Badge key={index} variant="secondary">{spec}</Badge>
          ))}
        </div>
      </div>

      <div className="flex-shrink-0 flex flex-col items-center justify-center gap-2 w-full md:w-36 mt-4 md:mt-0">
        <Link href={`/lawyers/${lawyer.id}`} className="w-full">
          <Button className="w-full bg-foreground text-background hover:bg-foreground/90">
            ดูโปรไฟล์
          </Button>
        </Link>
        <Link href={`/lawyers/${lawyer.id}`} className="w-full">
            <Button variant="outline" className="w-full">
                <Mail className="mr-2 h-4 w-4" /> ส่งข้อความ
            </Button>
        </Link>
      </div>
    </div>
  );
}
