
'use client';

import React, { Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Ticket, Upload, ChevronLeft, User, Briefcase, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SupportChatBox } from '@/components/chat/support-chat-box';
import { Separator } from '@/components/ui/separator';
import AdminLayout from '../../layout';

const mockTickets = [
    {
        id: "TICKET-5891A",
        caseId: "case-001",
        clientName: "สมหญิง ใจดี",
        lawyerName: "นางสาวสมศรี ยุติธรรม",
        problemType: "ทนายตอบช้า",
        status: "pending",
        reportedAt: "2024-07-28"
    },
    {
        id: "TICKET-5891B",
        caseId: "case-002",
        clientName: "นายสมชาย กฎหมายดี",
        lawyerName: "ลูกค้า",
        problemType: "ไม่สามารถอัปโหลดไฟล์ได้",
        status: "pending",
        reportedAt: "2024-07-27"
    },
    {
        id: "TICKET-5890C",
        caseId: "case-003",
        clientName: "บริษัท เติบโต จำกัด",
        lawyerName: "นายวิชัย ชนะคดี",
        problemType: "ปัญหาการชำระเงิน",
        status: "resolved",
        reportedAt: "2024-07-25"
    }
]

function AdminTicketDetailPageContent() {
    const params = useParams();
    const router = useRouter();
    const ticketId = params.id as string;
    
    const [ticket, setTicket] = React.useState<typeof mockTickets[0] | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        setIsLoading(true);
        const currentTicket = mockTickets.find(t => t.id === ticketId);
        setTicket(currentTicket || null);
        setIsLoading(false);
    }, [ticketId]);

    const handleResolveTicket = () => {
        if (!ticket) return;
        setTicket({ ...ticket, status: 'resolved' });
        toast({
            title: "ดำเนินการสำเร็จ",
            description: `Ticket ${ticket.id} ถูกเปลี่ยนสถานะเป็น 'แก้ไขแล้ว'`,
        });
    };

    const statusBadges: { [key: string]: React.ReactNode } = {
        pending: <Badge variant="outline" className="border-yellow-600 text-yellow-700 bg-yellow-50">รอดำเนินการ</Badge>,
        resolved: <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">แก้ไขแล้ว</Badge>,
    }

    if (isLoading) {
        return <div>Loading ticket details...</div>
    }

    if (!ticket) {
        return <div>Ticket not found.</div>
    }
    
    const isResolved = ticket.status === 'resolved';
    const reportedTicket = { 
        ...ticket,
        caseTitle: `เคส ${ticket.caseId}`,
        reportedAt: new Date(ticket.reportedAt)
    }

    return (
      <AdminLayout>
        <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
             <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
                 <div className="flex items-center gap-4">
                    <Link href="/admin/tickets">
                      <Button variant="outline" size="icon" className="h-7 w-7">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="sr-only">กลับ</span>
                      </Button>
                    </Link>
                    <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
                      Ticket: {ticket.id}
                    </h1>
                     <div className="ml-auto">
                        {statusBadges[ticket.status]}
                     </div>
                  </div>
                 <SupportChatBox ticket={reportedTicket} isDisabled={isResolved} />
            </div>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>สรุปข้อมูล</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">หัวข้อปัญหา:</span>
                            <span className="font-semibold">{ticket.problemType}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">วันที่แจ้ง:</span>
                            <span>{ticket.reportedAt}</span>
                        </div>
                        <Separator />
                         <div className="flex justify-between items-center">
                            <span className="text-muted-foreground flex items-center gap-2"><User /> ผู้แจ้งปัญหา</span>
                            <Link href={`/admin/customers/cus_001`} className="font-semibold text-primary hover:underline">{ticket.clientName}</Link>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="text-muted-foreground flex items-center gap-2"><Briefcase /> เคสที่เกี่ยวข้อง</span>
                            <span className="font-mono">{ticket.caseId}</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>การดำเนินการ</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isResolved ? (
                             <div className="text-center p-4 bg-green-50 rounded-md border border-green-200">
                                <CheckCircle className="mx-auto w-8 h-8 text-green-600 mb-2"/>
                                <p className="font-semibold text-green-800">Ticket นี้ได้รับการแก้ไขแล้ว</p>
                            </div>
                        ) : (
                             <Button className="w-full" onClick={handleResolveTicket}>
                                <CheckCircle className="mr-2" />
                                Mark as Resolved
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
      </AdminLayout>
    )
}


export default function AdminTicketDetailPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AdminTicketDetailPageContent />
        </Suspense>
    )
}
