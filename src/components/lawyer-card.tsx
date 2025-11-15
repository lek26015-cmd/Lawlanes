import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { LawyerProfile } from '@/lib/types';
import { Mail } from 'lucide-react';

interface LawyerCardProps {
  lawyer: LawyerProfile;
}

export default function LawyerCard({ lawyer }: LawyerCardProps) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="items-center text-center">
        <div className="relative h-32 w-32">
          <Image
            src={lawyer.imageUrl}
            alt={`Profile of ${lawyer.name}`}
            fill
            className="rounded-full object-cover border-4 border-secondary"
            data-ai-hint={lawyer.imageHint}
          />
        </div>
        <CardTitle className="mt-4">{lawyer.name}</CardTitle>
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {lawyer.specialty.map((spec, index) => (
            <Badge key={index} variant="secondary">{spec}</Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <CardDescription className="text-center flex-grow">{lawyer.description}</CardDescription>
        <Button className="w-full mt-4">
          <Mail className="mr-2 h-4 w-4" /> ติดต่อทนาย
        </Button>
      </CardContent>
    </Card>
  );
}
