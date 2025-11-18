

'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  DollarSign,
  Gavel,
  Home,
  Landmark,
  Megaphone,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  Ticket,
  Users2,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { Badge } from '@/components/ui/badge';

export default function AdminDashboard() {
  return (
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
  );
}
