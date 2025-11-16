

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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Ticket
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
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"


const mockCustomers = [
  {
    id: "cus_001",
    name: "สมหญิง ใจดี",
    email: "somying.j@example.com",
    avatar: "https://picsum.photos/seed/user-avatar/40/40",
    type: "บุคคลทั่วไป",
    registeredAt: "2024-06-15",
    status: "active"
  },
  {
    id: "cus_002",
    name: "บริษัท เติบโต จำกัด",
    email: "contact@terbto.co.th",
    avatar: "https://picsum.photos/seed/company-logo1/40/40",
    type: "SME",
    registeredAt: "2024-05-20",
    status: "active"
  },
  {
    id: "cus_003",
    name: "วิชัย ประเสริฐ",
    email: "wichai.p@example.com",
    avatar: "https://picsum.photos/seed/user-avatar2/40/40",
    type: "บุคคลทั่วไป",
    registeredAt: "2024-07-01",
    status: "suspended"
  },
   {
    id: "cus_004",
    name: "หจก. รุ่งเรืองการค้า",
    email: "rungrueng@example.com",
    avatar: "https://picsum.photos/seed/company-logo2/40/40",
    type: "SME",
    registeredAt: "2024-04-10",
    status: "active"
  },
];


export default function AdminCustomersPage() {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[280px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/admin" className="flex items-center gap-2 font-semibold">
              <Gavel className="h-6 w-6" />
              <span className="">Lawlanes Admin</span>
            </Link>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              <Link
                href="/"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
                กลับไปหน้าแรก
              </Link>
              <Link
                href="/admin"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Home className="h-4 w-4" />
                แดชบอร์ด
              </Link>
              <Link
                href="/admin/customers"
                className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-primary transition-all hover:text-primary"
              >
                <Users2 className="h-4 w-4" />
                ลูกค้า
              </Link>
              <Link
                href="#"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <ShieldCheck className="h-4 w-4" />
                ทนายความ
              </Link>
              <Link
                href="#"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Landmark className="h-4 w-4" />
                การเงิน
              </Link>
               <Link
                href="/admin/tickets"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Ticket className="h-4 w-4" />
                Ticket ช่วยเหลือ
              </Link>
            </nav>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>จัดการข้อมูลลูกค้า</CardTitle>
                    <CardDescription>
                        ดู, ค้นหา, และจัดการบัญชีผู้ใช้งานทั้งหมดในระบบ
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="all">
                        <div className="flex items-center">
                            <TabsList>
                            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                            <TabsTrigger value="active">Active</TabsTrigger>
                            <TabsTrigger value="suspended">Suspended</TabsTrigger>
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
                                <DropdownMenuLabel>กรองตามประเภท</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem checked>
                                    บุคคลทั่วไป
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem>SME</DropdownMenuCheckboxItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button size="sm" variant="outline" className="h-8 gap-1">
                                <File className="h-3.5 w-3.5" />
                                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                Export
                                </span>
                            </Button>
                            <Button size="sm" className="h-8 gap-1">
                                <PlusCircle className="h-3.5 w-3.5" />
                                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                เพิ่มลูกค้า
                                </span>
                            </Button>
                            </div>
                        </div>
                        <TabsContent value="all">
                             <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead className="hidden w-[100px] sm:table-cell">
                                    <span className="sr-only">รูป</span>
                                    </TableHead>
                                    <TableHead>ลูกค้า</TableHead>
                                    <TableHead>ประเภท</TableHead>
                                    <TableHead className="hidden md:table-cell">
                                    วันที่ลงทะเบียน
                                    </TableHead>
                                    <TableHead className="hidden md:table-cell">
                                    สถานะ
                                    </TableHead>
                                    <TableHead>
                                    <span className="sr-only">การดำเนินการ</span>
                                    </TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {mockCustomers.map(customer => (
                                    <TableRow key={customer.id}>
                                        <TableCell className="hidden sm:table-cell">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={customer.avatar} alt={customer.name} />
                                                <AvatarFallback>{customer.name.slice(0, 2)}</AvatarFallback>
                                            </Avatar>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {customer.name}
                                             <div className="text-xs text-muted-foreground md:hidden">
                                                {customer.email}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{customer.type}</Badge>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {customer.registeredAt}
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            <Badge variant={customer.status === 'active' ? 'secondary' : 'destructive'}>
                                                {customer.status === 'active' ? 'Active' : 'Suspended'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                aria-haspopup="true"
                                                size="icon"
                                                variant="ghost"
                                                >
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">สลับเมนู</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>การดำเนินการ</DropdownMenuLabel>
                                                <DropdownMenuItem asChild>
                                                  <Link href={`/admin/customers/${customer.id}`}>ดูโปรไฟล์</Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                  <Link href={`/admin/customers/${customer.id}/edit`}>แก้ไขข้อมูล</Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-destructive">
                                                ระงับบัญชี
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                </TableBody>
                            </Table>
                        </TabsContent>
                    </Tabs>
                </CardContent>
                 <CardFooter>
                    <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
                        <div>แสดง <strong>1-4</strong> จาก <strong>{mockCustomers.length}</strong> รายการ</div>
                         <div className="flex items-center gap-2">
                             <Button
                              variant="outline"
                              className="h-8 w-8 p-0"
                            >
                              <span className="sr-only">Go to first page</span>
                              <ChevronsLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              className="h-8 w-8 p-0"
                            >
                              <span className="sr-only">Go to previous page</span>
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                             <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                              Page 1 of 1
                            </div>
                             <Button
                              variant="outline"
                              className="h-8 w-8 p-0"
                            >
                              <span className="sr-only">Go to next page</span>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              className="h-8 w-8 p-0"
                            >
                              <span className="sr-only">Go to last page</span>
                              <ChevronsRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardFooter>
            </Card>
        </main>
      </div>
    </div>
  )
}
