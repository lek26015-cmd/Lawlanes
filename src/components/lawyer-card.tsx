import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { LawyerProfile } from '@/lib/types';
import { Mail } from 'lucide-react';

interface LawyerCardProps {
  lawyer: LawyerProfile;
}

export default function LawyerCard({ lawyer }: LawyerCardProps) {
  return (
    <Card className="flex flex-col md:flex-row items-center p-4 gap-4 h-full">
      <div className="relative h-24 w-24 flex-shrink-0">
        <Image
          src={lawyer.imageUrl}
          alt={`Profile of ${lawyer.name}`}
          fill
          className="rounded-full object-cover border-4 border-secondary"
          data-ai-hint={lawyer.imageHint}
        />
      </div>

      <div className="flex-grow text-center md:text-left">
        <h3 className="font-bold text-lg">{lawyer.name}</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-2">{lawyer.description}</p>
        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
          {lawyer.specialty.map((spec, index) => (
            <Badge key={index} variant="secondary">{spec}</Badge>
          ))}
        </div>
      </div>

      <div className="flex-shrink-0 flex flex-col items-center justify-center md:pl-4 md:border-l md:border-border/50 w-full md:w-auto">
        <Button className="w-full md:w-auto">
          <Mail className="mr-2 h-4 w-4" /> ติดต่อทนาย
        </Button>
      </div>
    </Card>
  );
}
