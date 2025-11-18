

'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  File,
  Home,
  ListFilter,
  MoreHorizontal,
  Package2,
  PanelLeft,
  PlusCircle,
  Search,
  Settings,
  Users2,
  Landmark,
  ShieldCheck,
  FileText,
  Megaphone,
  Gavel,
  ArrowLeft,
  Ticket,
  Clock,
  User,
  AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import AdminLayout from '../layout';


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

export default function AdminTicketsPage() {

    const statusBadges: { [key: string]: React.ReactNode } = {
        pending: <Badge variant="outline" className="border-yellow-600 text-yellow-700 bg-yellow-50">รอดำเนินการ</Badge>,
        resolved: <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">แก้ไขแล้ว</Badge>,
    }

  return (
    <AdminLayout>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Ticket ช่วยเหลือ</CardTitle>
                    <CardDescription>
                        จัดการและตอบกลับคำร้องขอความช่วยเหลือจากผู้ใช้งาน
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="all">
                        <div className="flex items-center">
                            <TabsList>
                            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                            <TabsTrigger value="pending">รอดำเนินการ</TabsTrigger>
                            <TabsTrigger value="resolved">แก้ไขแล้ว</TabsTrigger>
                            </TabsList>
                            <div className="ml-auto flex items-center gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 gap-1">
                                        <ListFilter className="h-3.5 w-3.5" />
                                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                        กรอง
                                        </span>
                                    </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>กรองตามประเภทปัญหา</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuCheckboxItem checked>
                                        ทนายตอบช้า
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem>ปัญหาทางเทคนิค</DropdownMenuCheckboxItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                         <TabsContent value="all">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ticket ID</TableHead>
                                        <TableHead>หัวข้อปัญหา</TableHead>
                                        <TableHead>ผู้แจ้ง</TableHead>
                                        <TableHead>สถานะ</TableHead>
                                        <TableHead>วันที่แจ้ง</TableHead>
                                        <TableHead>
                                            <span className="sr-only">Actions</span>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mockTickets.map(ticket => (
                                        <TableRow key={ticket.id}>
                                            <TableCell className="font-mono">{ticket.id}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{ticket.problemType}</div>
                                                <div className="text-xs text-muted-foreground">เคส: {ticket.caseId}</div>
                                            </TableCell>
                                            <TableCell>{ticket.clientName}</TableCell>
                                            <TableCell>{statusBadges[ticket.status]}</TableCell>
                                            <TableCell>{ticket.reportedAt}</TableCell>
                                            <TableCell>
                                                <Button asChild variant="outline" size="sm">
                                                    <Link href={`/admin/tickets/${ticket.id}`}>
                                                        ดูรายละเอียด
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TabsContent>
                    </Tabs>
                </CardContent>
                 <CardFooter>
                    <div className="text-xs text-muted-foreground">
                       แสดง <strong>{mockTickets.length}</strong> จาก <strong>{mockTickets.length}</strong> รายการ
                    </div>
                </CardFooter>
            </Card>
        </main>
    </AdminLayout>
  )
}
