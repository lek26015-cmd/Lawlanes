
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowRight, Briefcase, Calendar, FileText, Loader2, Search } from 'lucide-react';
import { getDashboardData } from '@/lib/data';
import type { Case, UpcomingAppointment } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

export default function DashboardPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [appointments, setAppointments] = useState<UpcomingAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const { cases, appointments } = await getDashboardData();
      setCases(cases);
      setAppointments(appointments);
      setIsLoading(false);
    }
    fetchData();
  }, []);

  return (
    <div className="container mx-auto px-4 md:px-6 py-12">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl font-headline text-foreground">
          แดชบอร์ดของคุณ
        </h1>
        <p className="max-w-2xl mt-2 text-muted-foreground md:text-xl">
          ภาพรวมคดีและการนัดหมายทั้งหมดของคุณในที่เดียว
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Ongoing Cases */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-6 h-6" />
                  คดีที่กำลังดำเนินงาน ({cases.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cases.length > 0 ? (
                  <div className="space-y-4">
                    {cases.map((caseItem) => (
                      <Link href={`/chat/${caseItem.id}`} key={caseItem.id}>
                        <div className="flex items-center p-3 -mx-3 rounded-lg hover:bg-secondary transition-colors">
                          <Avatar className="h-12 w-12 mr-4">
                            <AvatarImage src={caseItem.lawyer.imageUrl} alt={caseItem.lawyer.name} data-ai-hint={caseItem.lawyer.imageHint} />
                            <AvatarFallback>{caseItem.lawyer.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-grow overflow-hidden">
                            <p className="font-semibold truncate">{caseItem.title}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {caseItem.lastMessage}
                            </p>
                          </div>
                          <div className="text-right ml-4 flex-shrink-0">
                            <p className="text-xs text-muted-foreground">{caseItem.lastMessageTimestamp}</p>
                            <Badge variant="secondary" className="mt-1 bg-green-100 text-green-800">Active</Badge>
                          </div>
                          <ArrowRight className="w-4 h-4 ml-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Briefcase className="mx-auto h-10 w-10 mb-2" />
                    <p>ยังไม่มีคดีที่กำลังดำเนินงาน</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Appointments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-6 h-6" />
                  การนัดหมายที่กำลังจะมาถึง ({appointments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {appointments.length > 0 ? (
                  <div className="space-y-4">
                    {appointments.map((appt) => (
                      <div key={appt.id} className="flex items-start p-3 -mx-3 rounded-lg hover:bg-secondary transition-colors">
                        <Avatar className="h-12 w-12 mr-4">
                          <AvatarImage src={appt.lawyer.imageUrl} alt={appt.lawyer.name} data-ai-hint={appt.lawyer.imageHint} />
                          <AvatarFallback>{appt.lawyer.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-grow">
                          <p className="font-semibold">ปรึกษากับ {appt.lawyer.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(appt.date, 'EEEE, d MMMM yyyy', { locale: th })}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                           <span className='font-medium'>หัวข้อ:</span> {appt.description}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" className="ml-4">จัดการนัดหมาย</Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="mx-auto h-10 w-10 mb-2" />
                    <p>ยังไม่มีการนัดหมายที่กำลังจะมาถึง</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>การดำเนินการด่วน</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Link href="/lawyers" className='w-full'>
                    <Button className="w-full justify-start" variant="outline">
                        <Search className="mr-2 h-4 w-4" /> ค้นหาทนายความคนใหม่
                    </Button>
                </Link>
                <Link href="/articles" className='w-full'>
                    <Button className="w-full justify-start" variant="outline">
                        <FileText className="mr-2 h-4 w-4" /> อ่านบทความกฎหมาย
                    </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
