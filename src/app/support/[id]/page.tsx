
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getDashboardData } from '@/lib/data';
import type { ReportedTicket } from '@/lib/types';
import { SupportChatBox } from '@/components/chat/support-chat-box';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LifeBuoy, FileText, Ticket, ShieldX } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

function SupportPageContent() {
    const params = useParams();
    const router = useRouter();
    const ticketId = params.id as string;
    
    const [ticket, setTicket] = useState<ReportedTicket | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchTicket() {
            if (!ticketId) {
                setIsLoading(false);
                return;
            }
            const { tickets } = await getDashboardData();
            const currentTicket = tickets.find(t => t.id === ticketId);
            setTicket(currentTicket || null);
            setIsLoading(false);
        }
        fetchTicket();
    }, [ticketId]);
    
    const statusBadges: { [key: string]: React.ReactNode } = {
        pending: <Badge variant="outline" className="border-yellow-600 text-yellow-700 bg-yellow-50">กำลังตรวจสอบ</Badge>,
        resolved: <Badge variant="secondary">แก้ไขแล้ว</Badge>,
    }

    if (isLoading) {
        return <div>Loading support chat...</div>
    }

    if (!ticket) {
        return <div>Ticket not found.</div>
    }

    return (
        <div className="container mx-auto px-4 md:px-6 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <SupportChatBox ticket={ticket} />
                </div>
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Ticket className="w-5 h-5 text-muted-foreground" />
                                รายละเอียด Ticket
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Ticket ID:</span>
                                <span className="font-mono font-semibold">{ticket.id}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">เคสที่เกี่ยวข้อง:</span>
                                <span className="font-mono">{ticket.caseId}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">ประเภทปัญหา:</span>
                                <span className="font-semibold">{ticket.problemType}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">วันที่แจ้ง:</span>
                                <span>{format(ticket.reportedAt, 'dd MMM yyyy', { locale: th })}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">สถานะ:</span>
                                {statusBadges[ticket.status]}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>การดำเนินการ</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                             <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="w-full">
                                            <Button className="w-full" disabled>
                                                <ShieldX className="mr-2 h-4 w-4" /> ปิด Ticket
                                            </Button>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>เฉพาะเจ้าหน้าที่เท่านั้นที่สามารถปิด Ticket นี้ได้</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <Button variant="outline">
                                <LifeBuoy className="mr-2 h-4 w-4" /> สร้างหน้าต่อไป
                            </Button>
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader>
                            <CardTitle>เอกสารที่เกี่ยวข้อง</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm text-center text-muted-foreground py-4">
                                <FileText className="mx-auto h-8 w-8" />
                                <p>ยังไม่มีเอกสารแนบ</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

export default function SupportPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SupportPageContent />
        </Suspense>
    )
}
