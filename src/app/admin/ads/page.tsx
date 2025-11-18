
'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  File,
  ListFilter,
  MoreHorizontal,
  PlusCircle,
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
import Image from 'next/image';

const mockAds = [
    {
        id: "ad-001",
        title: "โปรโมตสำนักงานกฎหมายของคุณที่นี่",
        type: "Banner",
        status: "active",
        startDate: "2024-07-01",
        endDate: "2024-08-01",
        imageUrl: "https://images.unsplash.com/photo-1622465911368-72162f8da3e2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw0fHxjb21wYW55JTIwbG9nb3xlbnwwfHx8fDE3NjMyMjYxNTJ8MA&ixlib=rb-4.1.0&q=80&w=1080"
    },
     {
        id: "ad-002",
        title: "บริการด้านสัญญาครบวงจร",
        type: "Banner",
        status: "active",
        startDate: "2024-07-15",
        endDate: "2024-08-15",
        imageUrl: "https://images.unsplash.com/photo-1555529733-ba28d9c4587c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw4fHxjbG90aGluZyUyMHJhY2t8ZW58MHx8fHwxNzYzMjI1MDIzfDA&ixlib=rb-4.1.0&q=80&w=1080"
    },
    {
        id: "ad-003",
        title: "ปรึกษาด่วนกับ AI",
        type: "Banner",
        status: "draft",
        startDate: "2024-08-01",
        endDate: "2024-09-01",
        imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxfHxjb25mZXJlbmNlJTIwc3RhZ2V8ZW58MHx8fHwxNzYzMjI1MDIzfDA&ixlib=rb-4.1.0&q=80&w=1080"
    }
];

export default function AdminAdsPage() {
  return (
    <AdminLayout>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>จัดการโฆษณา</CardTitle>
                    <CardDescription>
                        จัดการแบนเนอร์และแคมเปญโฆษณาบนแพลตฟอร์ม
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="all">
                        <div className="flex items-center">
                            <TabsList>
                            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                            <TabsTrigger value="active">Active</TabsTrigger>
                            <TabsTrigger value="draft">Draft</TabsTrigger>
                            <TabsTrigger value="expired">Expired</TabsTrigger>
                            </TabsList>
                            <div className="ml-auto flex items-center gap-2">
                            <Button size="sm" variant="outline" className="h-8 gap-1">
                                <File className="h-3.5 w-3.5" />
                                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                Export
                                </span>
                            </Button>
                            <Button size="sm" className="h-8 gap-1">
                                <PlusCircle className="h-3.5 w-3.5" />
                                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                เพิ่มโฆษณาใหม่
                                </span>
                            </Button>
                            </div>
                        </div>
                        <TabsContent value="all">
                             <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead className="hidden w-[100px] sm:table-cell">
                                        รูปภาพ
                                    </TableHead>
                                    <TableHead>หัวข้อ</TableHead>
                                    <TableHead>สถานะ</TableHead>
                                    <TableHead className="hidden md:table-cell">
                                    วันที่เริ่ม
                                    </TableHead>
                                     <TableHead className="hidden md:table-cell">
                                    วันที่สิ้นสุด
                                    </TableHead>
                                    <TableHead>
                                    <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {mockAds.map((ad) => (
                                    <TableRow key={ad.id}>
                                        <TableCell className="hidden sm:table-cell">
                                            <Image
                                            alt={ad.title}
                                            className="aspect-square rounded-md object-cover"
                                            height="64"
                                            src={ad.imageUrl}
                                            width="64"
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {ad.title}
                                        </TableCell>
                                        <TableCell>
                                             <Badge variant={ad.status === 'active' ? 'secondary' : 'outline'}>{ad.status}</Badge>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {ad.startDate}
                                        </TableCell>
                                         <TableCell className="hidden md:table-cell">
                                            {ad.endDate}
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
                                                <span className="sr-only">Toggle menu</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem>แก้ไข</DropdownMenuItem>
                                                <DropdownMenuItem>ลบ</DropdownMenuItem>
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
                    <div className="text-xs text-muted-foreground">
                        แสดง <strong>{mockAds.length}</strong> จาก <strong>{mockAds.length}</strong> รายการ
                    </div>
                </CardFooter>
            </Card>
        </main>
    </AdminLayout>
  )
}
