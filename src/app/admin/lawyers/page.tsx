
'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  File,
  ListFilter,
  MoreHorizontal,
  PlusCircle,
  UserCheck,
  UserX,
  Clock
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { mockLawyers as allMockLawyers } from '@/lib/data';
import type { LawyerProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import AdminLayout from '../layout';

// Extend mock data with more varied statuses and join dates for filtering
const mockLawyers = allMockLawyers.map((lawyer, index) => ({
  ...lawyer,
  status: ['approved', 'pending', 'rejected'][index % 3] as 'approved' | 'pending' | 'rejected',
  joinedAt: `2024-07-${28 - index * 2}`
}));

export default function AdminLawyersPage() {
    const { toast } = useToast();
    const [filteredLawyers, setFilteredLawyers] = React.useState<LawyerProfile[]>(mockLawyers);
    const [activeTab, setActiveTab] = React.useState('all');
    const [action, setAction] = React.useState<{ type: LawyerProfile['status']; lawyerId: string } | null>(null);

    
    // In a real app, specialties would be fetched or managed globally
    const specialties = ['คดีฉ้อโกง SMEs', 'คดีแพ่งและพาณิชย์', 'การผิดสัญญา', 'ทรัพย์สินทางปัญญา', 'กฎหมายแรงงาน'];
    
    const [specialtyFilters, setSpecialtyFilters] = React.useState<Record<string, boolean>>(
        specialties.reduce((acc, s) => ({ ...acc, [s]: true }), {})
    );

    React.useEffect(() => {
        let lawyers = mockLawyers;

        if (activeTab !== 'all') {
            lawyers = lawyers.filter(l => l.status === activeTab);
        }
        
        const activeSpecialties = Object.keys(specialtyFilters).filter(s => specialtyFilters[s]);
        if (activeSpecialties.length > 0 && activeSpecialties.length < specialties.length) {
            lawyers = lawyers.filter(l => 
                l.specialty.some(s => activeSpecialties.includes(s))
            );
        }

        setFilteredLawyers(lawyers);
    }, [activeTab, specialtyFilters]);

    const handleExport = () => {
        const headers = ["ID", "Name", "Specialties", "JoinedAt", "Status"];
        const csvRows = [
            headers.join(','),
            ...filteredLawyers.map(l => 
                [l.id, `"${l.name}"`, `"${l.specialty.join(', ')}"`, l.joinedAt, l.status].join(',')
            )
        ];
        
        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'lawyers-export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleStatusChange = () => {
        if (!action) return;
        const { lawyerId, type: newStatus } = action;

        const lawyerName = mockLawyers.find(l => l.id === lawyerId)?.name;
        toast({
            title: `เปลี่ยนสถานะสำเร็จ`,
            description: `สถานะของ ${lawyerName} ถูกเปลี่ยนเป็น "${newStatus}" แล้ว`,
        });
        
        // This is where you would update the backend.
        // For now, we'll just refilter the list to simulate the change.
        const updatedLawyers = mockLawyers.map(l => l.id === lawyerId ? {...l, status: newStatus} : l);
        // This is a hacky way to force re-render/re-filter, not for production
        setActiveTab('all'); 
        setTimeout(() => setActiveTab(newStatus), 100);
        setAction(null);
    };
    
    const statusBadges: Record<LawyerProfile['status'], React.ReactNode> = {
        approved: <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">อนุมัติแล้ว</Badge>,
        pending: <Badge variant="outline" className="border-yellow-600 text-yellow-700 bg-yellow-50">รอตรวจสอบ</Badge>,
        rejected: <Badge variant="destructive" className="bg-red-100/50 text-red-800 border-red-200/50">ถูกปฏิเสธ</Badge>,
    }

  return (
    <AdminLayout>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>จัดการข้อมูลทนายความ</CardTitle>
                    <CardDescription>ตรวจสอบ, อนุมัติ, และจัดการโปรไฟล์ทนายความในระบบ</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
                        <div className="flex items-center">
                            <TabsList>
                                <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                                <TabsTrigger value="pending">รอตรวจสอบ</TabsTrigger>
                                <TabsTrigger value="approved">อนุมัติแล้ว</TabsTrigger>
                                <TabsTrigger value="rejected">ถูกปฏิเสธ</TabsTrigger>
                            </TabsList>
                            <div className="ml-auto flex items-center gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1">
                                    <ListFilter className="h-3.5 w-3.5" />
                                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">กรอง</span>
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuLabel>กรองตามความเชี่ยวชาญ</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {specialties.map(s => (
                                    <DropdownMenuCheckboxItem 
                                        key={s}
                                        checked={specialtyFilters[s]}
                                        onCheckedChange={(checked) => setSpecialtyFilters(prev => ({ ...prev, [s]: !!checked }))}
                                    >
                                        {s}
                                    </DropdownMenuCheckboxItem>
                                ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={handleExport}>
                                <File className="h-3.5 w-3.5" />
                                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Export</span>
                            </Button>
                            <Button size="sm" className="h-8 gap-1" asChild>
                              <Link href="/admin/lawyers/new">
                                <PlusCircle className="h-3.5 w-3.5" />
                                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">เพิ่มทนายความ</span>
                              </Link>
                            </Button>
                            </div>
                        </div>
                        <TabsContent value={activeTab}>
                             <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead>ทนายความ</TableHead>
                                    <TableHead className="hidden lg:table-cell">ความเชี่ยวชาญ</TableHead>
                                    <TableHead className="hidden md:table-cell">สถานะ</TableHead>
                                    <TableHead className="hidden md:table-cell">วันที่เข้าร่วม</TableHead>
                                    <TableHead><span className="sr-only">การดำเนินการ</span></TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {filteredLawyers.map(lawyer => (
                                    <TableRow key={lawyer.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={lawyer.imageUrl} alt={lawyer.name} />
                                                    <AvatarFallback>{lawyer.name.slice(0, 2)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    {lawyer.name}
                                                    <div className="text-xs text-muted-foreground">{lawyer.id}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell">
                                            <div className="flex flex-col gap-1">
                                                {lawyer.specialty.map(s => <Badge key={s} variant="outline" className="w-fit">{s}</Badge>)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">{statusBadges[lawyer.status]}</TableCell>
                                        <TableCell className="hidden md:table-cell">{lawyer.joinedAt}</TableCell>
                                        <TableCell>
                                            <AlertDialog>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">สลับเมนู</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>การดำเนินการ</DropdownMenuLabel>
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/admin/lawyers/${lawyer.id}`}>ดูโปรไฟล์</Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/admin/lawyers/${lawyer.id}/edit`}>แก้ไขข้อมูล</Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        {lawyer.status !== 'approved' && (
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setAction({ type: 'approved', lawyerId: lawyer.id }); }}>
                                                                    <UserCheck className="mr-2 h-4 w-4" /> อนุมัติ
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                        )}
                                                        {lawyer.status !== 'pending' && (
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setAction({ type: 'pending', lawyerId: lawyer.id }); }}>
                                                                    <Clock className="mr-2 h-4 w-4" /> รอตรวจสอบ
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                        )}
                                                        {lawyer.status !== 'rejected' && (
                                                             <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem className="text-destructive" onSelect={(e) => { e.preventDefault(); setAction({ type: 'rejected', lawyerId: lawyer.id }); }}>
                                                                    <UserX className="mr-2 h-4 w-4" /> ปฏิเสธ
                                                                </DropdownMenuItem>
                                                             </AlertDialogTrigger>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>ยืนยันการเปลี่ยนสถานะ?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            คุณแน่ใจหรือไม่ที่จะเปลี่ยนสถานะของ {mockLawyers.find(l => l.id === action?.lawyerId)?.name} เป็น "{action?.type}"?
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel onClick={() => setAction(null)}>ยกเลิก</AlertDialogCancel>
                                                        <AlertDialogAction onClick={handleStatusChange}>ยืนยัน</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
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
                        แสดง <strong>{filteredLawyers.length}</strong> จาก <strong>{mockLawyers.length}</strong> รายการ
                    </div>
                </CardFooter>
            </Card>
        </main>
    </AdminLayout>
  )
}
