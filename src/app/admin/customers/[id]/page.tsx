
'use client'

import * as React from 'react'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  File,
  Home,
  LineChart,
  ListFilter,
  MoreVertical,
  Package,
  Package2,
  PanelLeft,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  Users2,
  Briefcase,
  DollarSign,
  AlertCircle,
  Ticket
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import AdminLayout from '../../layout'

const mockCustomer = {
    id: "cus_001",
    name: "สมหญิง ใจดี",
    email: "somying.j@example.com",
    avatar: "https://picsum.photos/seed/user-avatar/100/100",
    registeredAt: "2024-06-15",
    status: "active",
    totalSpent: 12000,
    activeCases: 2,
    completedCases: 3,
};

const mockCases = [
    {
        id: "case-001",
        title: "ตรวจสอบสัญญาเช่าคอนโด",
        lawyer: "นางสาวสมศรี ยุติธรรม",
        fee: 3500,
        status: "กำลังดำเนินการ",
        createdAt: "2024-07-20"
    },
    {
        id: "case-002",
        title: "จดทะเบียนบริษัท",
        lawyer: "นายวิชัย ชนะคดี",
        fee: 5000,
        status: "กำลังดำเนินการ",
        createdAt: "2024-07-15"
    },
    {
        id: "case-003",
        title: "คดีมรดก",
        lawyer: "นายสมชาย กฎหมายดี",
        fee: 3500,
        status: "เสร็จสิ้น",
        createdAt: "2024-06-25"
    }
]

export default function AdminCustomerDetailPage() {
  const params = useParams()
  const { id } = params
  const [currentDate, setCurrentDate] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCurrentDate(new Date().toISOString());
  }, []);

  // In a real app, you would fetch customer data based on the id
  const customer = mockCustomer

  return (
    <AdminLayout>
      <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
        <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
           <div className="flex items-center gap-4">
            <Link href="/admin/customers">
              <Button variant="outline" size="icon" className="h-7 w-7">
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">กลับ</span>
              </Button>
            </Link>
            <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
              โปรไฟล์ลูกค้า
            </h1>
            <Badge variant={customer.status === 'active' ? 'secondary' : 'destructive'} className="ml-auto sm:ml-0">
              {customer.status === 'active' ? 'Active' : 'Suspended'}
            </Badge>
            <div className="hidden items-center gap-2 md:ml-auto md:flex">
              <Link href={`/admin/customers/${id}/edit`}>
                <Button variant="outline" size="sm">
                    แก้ไขข้อมูล
                </Button>
              </Link>
              <Button size="sm">ระงับบัญชี</Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Card x-chunk="dashboard-05-chunk-1">
              <CardHeader className="pb-2">
                <CardDescription>เคสทั้งหมด</CardDescription>
                <CardTitle className="text-4xl">{customer.activeCases + customer.completedCases}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">
                  {customer.activeCases} เคสกำลังดำเนินการ
                </div>
              </CardContent>
            </Card>
            <Card x-chunk="dashboard-05-chunk-2">
              <CardHeader className="pb-2">
                <CardDescription>ยอดใช้จ่ายรวม</CardDescription>
                <CardTitle className="text-4xl">฿{customer.totalSpent.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">
                  จาก {customer.completedCases} เคสที่เสร็จสิ้น
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>ประวัติเคส</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัสเคส</TableHead>
                    <TableHead>หัวข้อ</TableHead>
                    <TableHead>ทนายความ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>ค่าบริการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockCases.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>{c.id}</TableCell>
                      <TableCell>{c.title}</TableCell>
                      <TableCell>{c.lawyer}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'เสร็จสิ้น' ? 'secondary' : 'default'}>{c.status}</Badge>
                      </TableCell>
                      <TableCell>฿{c.fee.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card className="overflow-hidden" x-chunk="dashboard-05-chunk-4">
            <CardHeader className="flex flex-row items-start bg-muted/50">
              <div className="grid gap-0.5">
                <CardTitle className="group flex items-center gap-2 text-lg">
                  ข้อมูลลูกค้า
                </CardTitle>
                <CardDescription>
                  ลงทะเบียนเมื่อ: {customer.registeredAt}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6 text-sm">
              <div className="grid gap-3">
                <div className="font-semibold">รายละเอียด</div>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={customer.avatar} />
                    <AvatarFallback>{customer.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="grid gap-1">
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-muted-foreground">{customer.email}</p>
                  </div>
                </div>
                <Separator />
                <div className="font-semibold">หมายเหตุสำหรับแอดมิน</div>
                 <Textarea placeholder="เพิ่มหมายเหตุเกี่ยวกับลูกค้าคนนี้..." />
              </div>
            </CardContent>
            <CardFooter className="flex flex-row items-center border-t bg-muted/50 px-6 py-3">
              <div className="text-xs text-muted-foreground">
                {currentDate && <time dateTime={currentDate}>อัปเดตล่าสุดเมื่อสักครู่</time>}
              </div>
               <div className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="ghost">
                    บันทึก
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </main>
    </AdminLayout>
  )
}
