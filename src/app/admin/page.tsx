
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
  Gavel
} from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Logo from '@/components/logo';
import { Progress } from '@/components/ui/progress';

export default function AdminDashboard() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
       <TooltipProvider>
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
        <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
          <Link
            href="#"
            className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
          >
            <Gavel className="h-4 w-4 transition-all group-hover:scale-110" />
            <span className="sr-only">Lawlanes Admin</span>
          </Link>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8 bg-accent text-accent-foreground"
              >
                <Home className="h-5 w-5" />
                <span className="sr-only">แดชบอร์ด</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">แดชบอร์ด</TooltipContent>
          </Tooltip>
           <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
              >
                <Users2 className="h-5 w-5" />
                <span className="sr-only">ลูกค้า</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">ลูกค้า</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
              >
                <ShieldCheck className="h-5 w-5" />
                <span className="sr-only">ทนายความ</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">ทนายความ</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
              >
                <Landmark className="h-5 w-5" />
                <span className="sr-only">การเงิน</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">การเงิน</TooltipContent>
          </Tooltip>
           <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
              >
                <Ticket className="h-5 w-5" />
                <span className="sr-only">Ticket ช่วยเหลือ</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Ticket ช่วยเหลือ</TooltipContent>
          </Tooltip>
           <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
              >
                <Megaphone className="h-5 w-5" />
                <span className="sr-only">จัดการโฆษณา</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">จัดการโฆษณา</TooltipContent>
          </Tooltip>
           <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 mdW-8"
              >
                <FileText className="h-5 w-5" />
                <span className="sr-only">เนื้อหาและ SEO</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">เนื้อหาและ SEO</TooltipContent>
          </Tooltip>
        </nav>
        <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
              >
                <Settings className="h-5 w-5" />
                <span className="sr-only">ตั้งค่า</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">ตั้งค่า</TooltipContent>
          </Tooltip>
        </nav>
      </aside>
       </TooltipProvider>
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="sm:hidden">
                <PanelLeft className="h-5 w-5" />
                <span className="sr-only">สลับเมนู</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="sm:max-w-xs">
              <nav className="grid gap-6 text-lg font-medium">
                <Link
                  href="#"
                  className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
                >
                  <Gavel className="h-5 w-5 transition-all group-hover:scale-110" />
                  <span className="sr-only">Lawlanes Admin</span>
                </Link>
                <Link
                  href="#"
                  className="flex items-center gap-4 px-2.5 text-foreground"
                >
                  <Home className="h-5 w-5" />
                  แดชบอร์ด
                </Link>
                <Link
                  href="#"
                  className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <Users2 className="h-5 w-5" />
                  ลูกค้า
                </Link>
                <Link
                  href="#"
                  className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <ShieldCheck className="h-5 w-5" />
                  ทนายความ
                </Link>
                 <Link
                  href="#"
                  className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <Landmark className="h-5 w-5" />
                  การเงิน
                </Link>
                 <Link
                  href="#"
                  className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <Ticket className="h-5 w-5" />
                  Ticket ช่วยเหลือ
                </Link>
                  <Link
                  href="#"
                  className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <Megaphone className="h-5 w-5" />
                  โฆษณา
                </Link>
                  <Link
                  href="#"
                  className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <FileText className="h-5 w-5" />
                  เนื้อหา
                </Link>
                <Link
                  href="#"
                  className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                >
                  <Settings className="h-5 w-5" />
                  ตั้งค่า
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
          <Breadcrumb className="hidden md:flex">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="#">แดชบอร์ด</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="relative ml-auto flex-1 md:grow-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="ค้นหา..."
              className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="overflow-hidden rounded-full"
              >
                <img
                  src="https://picsum.photos/seed/admin-avatar/36/36"
                  width={36}
                  height={36}
                  alt="Admin Avatar"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>บัญชีของฉัน</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>ตั้งค่า</DropdownMenuItem>
              <DropdownMenuItem>ช่วยเหลือ</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>ออกจากระบบ</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
          <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              <Card
                className="sm:col-span-2"
                x-chunk="dashboard-05-chunk-0"
              >
                <CardHeader className="pb-3">
                  <CardTitle>ยินดีต้อนรับ, แอดมิน!</CardTitle>
                  <CardDescription className="max-w-lg text-balance leading-relaxed">
                    นี่คือศูนย์กลางการจัดการ Lawlanes ที่นี่คุณสามารถดูแลผู้ใช้,
                    อนุมัติทนายความ, ตรวจสอบการเงิน และจัดการเนื้อหา
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button>สร้างบทความใหม่</Button>
                </CardFooter>
              </Card>
              <Card x-chunk="dashboard-05-chunk-1">
                <CardHeader className="pb-2">
                  <CardDescription>รายได้รวม</CardDescription>
                  <CardTitle className="text-4xl">฿1,259,345</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground">
                    +25% จากเดือนที่แล้ว
                  </div>
                </CardContent>
                <CardFooter>
                  <Progress value={25} aria-label="25% increase" />
                </CardFooter>
              </Card>
              <Card x-chunk="dashboard-05-chunk-2">
                <CardHeader className="pb-2">
                  <CardDescription>ผู้ใช้ใหม่เดือนนี้</CardDescription>
                  <CardTitle className="text-4xl">342</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground">
                    +10% จากเดือนที่แล้ว
                  </div>
                </CardContent>
                <CardFooter>
                  <Progress value={10} aria-label="10% increase" />
                </CardFooter>
              </Card>
            </div>
            <Tabs defaultValue="pending_lawyers">
              <div className="flex items-center">
                <TabsList>
                  <TabsTrigger value="pending_lawyers">ทนายความรออนุมัติ</TabsTrigger>
                  <TabsTrigger value="open_tickets">Ticket ที่เปิดอยู่</TabsTrigger>
                  <TabsTrigger value="recent_tx">ธุรกรรมล่าสุด</TabsTrigger>
                </TabsList>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-sm"
                  >
                    <ListFilter className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only">ตัวกรอง</span>
                  </Button>
                  <Button size="sm" className="h-7 gap-1 text-sm">
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only">เพิ่ม</span>
                  </Button>
                </div>
              </div>
              <TabsContent value="pending_lawyers">
                <Card>
                  <CardHeader className="px-7">
                    <CardTitle>ทนายความรอการอนุมัติ</CardTitle>
                    <CardDescription>
                      ตรวจสอบและอนุมัติใบสมัครทนายความใหม่
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ทนายความ</TableHead>
                          <TableHead className="hidden sm:table-cell">
                            ความเชี่ยวชาญ
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            วันที่สมัคร
                          </TableHead>
                          <TableHead className="text-right">การดำเนินการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>
                            <div className="font-medium">นริศรา เพชร</div >
                            <div className="hidden text-sm text-muted-foreground md:inline">
                              narisara.p@example.com
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            กฎหมายองค์กร
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            2024-07-28
                          </TableCell>
                          <TableCell className="text-right">
                             <Button size="sm">ดูใบสมัคร</Button>
                          </TableCell>
                        </TableRow>
                         <TableRow>
                          <TableCell>
                            <div className="font-medium">ชานนท์ ทวี</div >
                            <div className="hidden text-sm text-muted-foreground md:inline">
                              chanon.t@example.com
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            คดีฉ้อโกง SMEs
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            2024-07-27
                          </TableCell>
                          <TableCell className="text-right">
                             <Button size="sm">ดูใบสมัคร</Button>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
                <TabsContent value="open_tickets">
                 <Card>
                  <CardHeader className="px-7">
                    <CardTitle>Ticket ช่วยเหลือที่เปิดอยู่</CardTitle>
                    <CardDescription>
                      ตอบกลับคำขอความช่วยเหลือจากลูกค้าและทนายความ
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ผู้ใช้</TableHead>
                          <TableHead className="hidden sm:table-cell">
                            หัวข้อ
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            วันที่
                          </TableHead>
                          <TableHead className="text-right">การดำเนินการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>
                            <div className="font-medium">สมหญิง ใจดี</div >
                            <div className="hidden text-sm text-muted-foreground md:inline">
                              TICKET-5891A
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                             <Badge variant="destructive">ด่วน</Badge> ปัญหาการชำระเงิน
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            2024-07-29
                          </TableCell>
                          <TableCell className="text-right">
                             <Button size="sm">ดู Ticket</Button>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          <div>
            <Card
              className="overflow-hidden" x-chunk="dashboard-05-chunk-4"
            >
              <CardHeader className="flex flex-row items-start bg-muted/50">
                <div className="grid gap-0.5">
                  <CardTitle className="group flex items-center gap-2 text-lg">
                    จัดการแคมเปญโฆษณา
                  </CardTitle>
                  <CardDescription>
                    ตรวจสอบประสิทธิภาพและจัดการเนื้อหาสปอนเซอร์
                  </CardDescription>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-8 gap-1">
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span className="lg:sr-only xl:not-sr-only xl:whitespace-nowrap">
                      โฆษณาใหม่
                    </span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 text-sm">
                 <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ลูกค้าโฆษณา</TableHead>
                      <TableHead className="text-right">จำนวนคลิก</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <div className="font-medium">สำนักงานกฎหมาย ชัยชนะ</div>
                      </TableCell>
                      <TableCell className="text-right">1,204</TableCell>
                    </TableRow>
                     <TableRow>
                      <TableCell>
                        <div className="font-medium">Legal Link and Partners</div>
                      </TableCell>
                      <TableCell className="text-right">893</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}

    