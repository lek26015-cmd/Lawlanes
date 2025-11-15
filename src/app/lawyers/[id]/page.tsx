import { getLawyerById } from '@/lib/data';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { StarIcon } from '@/components/icons/star-icon';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default async function LawyerProfilePage({ params }: { params: { id: string } }) {
  const lawyer = await getLawyerById(params.id);

  if (!lawyer) {
    notFound();
  }

  const rating = (Number(lawyer.id) % 2) + 3.5;
  const reviewCount = Number(lawyer.id) * 7 + 5;

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="max-w-4xl mx-auto">
            <Link href="/lawyers" className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                กลับไปหน้ารายชื่อทนาย
            </Link>

            <Card className="overflow-hidden">
                <div className="bg-card">
                    <div className="p-8 flex flex-col md:flex-row items-center gap-8">
                        <div className="relative h-32 w-32 flex-shrink-0">
                            <Image
                                src={lawyer.imageUrl}
                                alt={lawyer.name}
                                fill
                                className="rounded-full object-cover border-4 border-white shadow-lg"
                                data-ai-hint={lawyer.imageHint}
                                priority
                            />
                        </div>
                        <div className="text-center md:text-left">
                            <h1 className="text-3xl font-bold font-headline text-foreground">{lawyer.name}</h1>
                            <p className="text-lg text-primary font-semibold mt-1">{lawyer.specialty[0]}</p>
                            <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
                                <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                    <StarIcon key={i} className={`w-5 h-5 ${i < Math.floor(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                                ))}
                                </div>
                                <span className="text-muted-foreground">({reviewCount} รีวิว)</span>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                                {lawyer.specialty.map((spec, index) => (
                                    <Badge key={index} variant="secondary">{spec}</Badge>
                                ))}
                            </div>
                        </div>
                         <div className="flex-shrink-0 flex flex-col items-center justify-center gap-3 w-full md:w-40 md:ml-auto">
                            <Button className="w-full bg-foreground text-background hover:bg-foreground/90">
                                <Phone className="mr-2 h-4 w-4" /> นัดปรึกษา
                            </Button>
                            <Button variant="outline" className="w-full">
                                <Mail className="mr-2 h-4 w-4" /> ส่งข้อความ
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>เกี่ยวกับ</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <p className="text-muted-foreground">{lawyer.description}</p>
                        </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-6 mt-6">
                        <Card>
                             <CardHeader>
                                <CardTitle>การศึกษาและใบอนุญาต</CardTitle>
                            </CardHeader>
                             <CardContent className="text-muted-foreground space-y-2">
                                <p>นิติศาสตรบัณฑิต (เกียรตินิยม) - จุฬาลงกรณ์มหาวิทยาลัย</p>
                                <p>ใบอนุญาตให้ว่าความเลขที่ 12345/2550</p>
                             </CardContent>
                        </Card>
                         <Card>
                             <CardHeader>
                                <CardTitle>ประสบการณ์</CardTitle>
                            </CardHeader>
                             <CardContent className="text-muted-foreground">
                                <p>15+ ปี ในการว่าความคดีแพ่งและพาณิชย์</p>
                             </CardContent>
                        </Card>
                    </div>
                </div>

            </Card>
        </div>
      </div>
    </div>
  );
}
