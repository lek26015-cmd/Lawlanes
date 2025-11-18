
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { useToast } from '@/hooks/use-toast';


const mockAdmins = [
    { id: 'admin-1', name: 'แอดมินหลัก', email: 'admin@lawlanes.com', role: 'Super Admin', avatar: 'https://picsum.photos/seed/admin1/40/40' },
    { id: 'admin-2', name: 'สมศรี มีชัย', email: 'somsri.m@lawlanes.com', role: 'Content Manager', avatar: 'https://picsum.photos/seed/admin2/40/40' },
    { id: 'admin-3', name: 'วิชัย รักดี', email: 'wichai.r@lawlanes.com', role: 'Support Lead', avatar: 'https://picsum.photos/seed/admin3/40/40' },
];

export default function AdminAdministratorsPage() {
    const { toast } = useToast();

    const handleDelete = (adminName: string) => {
        toast({
            title: "ลบผู้ดูแลระบบสำเร็จ",
            description: `"${adminName}" ได้ถูกลบออกจากระบบแล้ว (จำลอง)`,
            variant: "destructive"
        })
    }

  return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="mx-auto grid w-full max-w-4xl gap-2">
          <h1 className="text-3xl font-semibold">ตั้งค่าระบบ</h1>
          <p className="text-muted-foreground">จัดการการตั้งค่าทั่วไปของแพลตฟอร์ม Lawlanes</p>
        </div>
        <div className="mx-auto grid w-full max-w-4xl items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
          <nav
            className="grid gap-4 text-sm text-muted-foreground"
          >
            <Link href="/admin/settings">
              ทั่วไป
            </Link>
            <Link href="/admin/settings/financials">
              การเงิน
            </Link>
            <Link href="/admin/settings/administrators" className="font-semibold text-primary">
              ผู้ดูแลระบบ
            </Link>
            <a href="#">การแจ้งเตือน</a>
          </nav>
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>จัดการผู้ดูแลระบบ</CardTitle>
                        <CardDescription>
                        เพิ่ม, ลบ, หรือแก้ไขสิทธิ์ของผู้ดูแลระบบ
                        </CardDescription>
                    </div>
                    <Button size="sm" className="gap-1" asChild>
                       <Link href="/admin/settings/administrators/new">
                        <PlusCircle className="h-3.5 w-3.5" />
                        เพิ่มผู้ดูแลใหม่
                       </Link>
                    </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>ผู้ใช้งาน</TableHead>
                        <TableHead>ตำแหน่ง</TableHead>
                        <TableHead>
                            <span className="sr-only">การดำเนินการ</span>
                        </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockAdmins.map(admin => (
                        <TableRow key={admin.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={admin.avatar} alt={admin.name} />
                                        <AvatarFallback>{admin.name.slice(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <div className="font-medium">
                                        {admin.name}
                                        <div className="text-xs text-muted-foreground">{admin.email}</div>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={admin.role === 'Super Admin' ? 'destructive' : 'secondary'}>{admin.role}</Badge>
                            </TableCell>
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
                                                <Link href={`/admin/settings/administrators/${admin.id}/edit`}>แก้ไขสิทธิ์</Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                                    ลบออกจากระบบ
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                     <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>คุณแน่ใจหรือไม่?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                การกระทำนี้ไม่สามารถย้อนกลับได้ คุณกำลังจะลบผู้ดูแลระบบ "{admin.name}" ออกจากระบบอย่างถาวร
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                            <AlertDialogAction
                                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                                onClick={() => handleDelete(admin.name)}
                                            >
                                                ยืนยันการลบ
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
  );
}
