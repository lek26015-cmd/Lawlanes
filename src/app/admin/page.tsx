

'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Badge,
  BarChart,
  File,
  Home,
  LineChart,
  ListFilter,
  MoreHorizontal,
  Package,
  Package2,
  PanelLeft,
  PlusCircle,
  Search,
  Settings,
  ShoppingCart,
  Tag,
  Ticket,
  Users2,
  Landmark,
  ShieldCheck,
  FileText,
  Megaphone,
  BarChart3,
  DollarSign,
  Gavel,
  ArrowLeft
} from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Logo from '@/components/logo';

export default function AdminDashboard() {
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
                className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-primary transition-all hover:text-primary"
              >
                <Home className="h-4 w-4" />
                แดชบอร์ด
              </Link>
              <Link
                href="/admin/customers"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Users2 className="h-4 w-4" />
                ลูกค้า
              </Link>
              <Link
                href="/admin/lawyers"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <ShieldCheck className="h-4 w-4" />
                ทนายความ
              </Link>
              <Link
                href="/admin/financials"
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
               <Link
                href="#"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Megaphone className="h-4 w-4" />
                จัดการโฆษณา
              </Link>
               <Link
                href="#"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <FileText className="h-4 w-4" />
                เนื้อหาและ SEO
              </Link>
            </nav>
          </div>
          <div className="mt-auto p-4">
             <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
               <Link
                href="#"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Settings className="h-4 w-4" />
                ตั้งค่า
              </Link>
            </nav>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  รายได้รวม
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">฿1,259,345.00</div>
                <p className="text-xs text-muted-foreground">
                  +20.1% จากเดือนที่แล้ว
                </p>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  ผู้ใช้งานใหม่
                </CardTitle>
                <Users2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+342</div>
                <p className="text-xs text-muted-foreground">
                  +10% จากเดือนที่แล้ว
                </p>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ticket ที่เปิดอยู่</CardTitle>
                <Ticket className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">
                  5 เรื่องเป็นปัญหาเร่งด่วน
                </p>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  ทนายรออนุมัติ
                </CardTitle>
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+2</div>
                <p className="text-xs text-muted-foreground">
                  รอการตรวจสอบคุณสมบัติ
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
             <Card className="xl:col-span-2">
              <CardHeader className="flex flex-row items-center">
                <div className="grid gap-2">
                  <CardTitle>ทนายความรอการอนุมัติ</CardTitle>
                  <CardDescription>
                    ตรวจสอบและอนุมัติใบสมัครทนายความใหม่
                  </CardDescription>
                </div>
                <Button asChild size="sm" className="ml-auto gap-1">
                  <Link href="/admin/lawyers?status=pending">
                    ดูทั้งหมด
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                 <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ทนายความ</TableHead>
                      <TableHead className="hidden xl:table-cell">
                        ความเชี่ยวชาญ
                      </TableHead>
                       <TableHead className="hidden xl:table-cell">
                        สถานะ
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        วันที่สมัคร
                      </TableHead>
                      <TableHead>
                        <span className="sr-only">การดำเนินการ</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <div className="font-medium">นริศรา เพชร</div>
                        <div className="hidden text-sm text-muted-foreground md:inline">
                          narisara.p@example.com
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        กฎหมายองค์กร
                      </TableCell>
                       <TableCell className="hidden xl:table-cell">
                        <Badge className="text-xs" variant="outline">
                          รอตรวจสอบ
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        2024-07-28
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
                            <DropdownMenuItem>ดูใบสมัคร</DropdownMenuItem>
                            <DropdownMenuItem>อนุมัติ</DropdownMenuItem>
                            <DropdownMenuItem>ปฏิเสธ</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <div className="font-medium">ชานนท์ ทวี</div>
                        <div className="hidden text-sm text-muted-foreground md:inline">
                           chanon.t@example.com
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        คดีฉ้อโกง SMEs
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <Badge className="text-xs" variant="outline">
                          รอตรวจสอบ
                        </Badge>
                      </TableCell>
                       <TableCell className="hidden md:table-cell">
                        2024-07-27
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
                            <DropdownMenuItem>ดูใบสมัคร</DropdownMenuItem>
                            <DropdownMenuItem>อนุมัติ</DropdownMenuItem>
                            <DropdownMenuItem>ปฏิเสธ</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Ticket ช่วยเหลือล่าสุด</CardTitle>
                <CardDescription>
                  ตอบกลับคำขอความช่วยเหลือจากลูกค้าและทนายความ
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-8">
                <div className="flex items-center gap-4">
                  <Avatar className="hidden h-9 w-9 sm:flex">
                    <img src="https://picsum.photos/seed/user1-avatar/36/36" alt="Avatar" className="rounded-full" />
                  </Avatar>
                  <div className="grid gap-1">
                    <p className="text-sm font-medium leading-none">
                      สมหญิง ใจดี
                    </p>
                    <p className="text-sm text-muted-foreground">
                      TICKET-5891A: ปัญหาการชำระเงิน
                    </p>
                  </div>
                  <Button asChild size="sm" className="ml-auto gap-1">
                    <Link href="#">
                      ดู Ticket
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                 <div className="flex items-center gap-4">
                  <Avatar className="hidden h-9 w-9 sm:flex">
                     <img src="https://picsum.photos/seed/user2-avatar/36/36" alt="Avatar" className="rounded-full" />
                  </Avatar>
                  <div className="grid gap-1">
                    <p className="text-sm font-medium leading-none">
                      นายสมชาย กฎหมายดี
                    </p>
                    <p className="text-sm text-muted-foreground">
                      TICKET-5891B: ไม่สามารถอัปโหลดไฟล์ได้
                    </p>
                  </div>
                  <Button asChild size="sm" className="ml-auto gap-1">
                    <Link href="#">
                      ดู Ticket
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
