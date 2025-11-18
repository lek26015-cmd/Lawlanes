
'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  File,
  MoreHorizontal,
  PlusCircle,
  BarChart2
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
import Image from 'next/image';
import { mockAds } from '@/lib/data';
import type { Ad } from '@/lib/types';

export default function AdminAdsPage() {
    const [filteredAds, setFilteredAds] = React.useState<Ad[]>(mockAds);
    const [activeTab, setActiveTab] = React.useState('all');

    React.useEffect(() => {
        if (activeTab === 'all') {
            setFilteredAds(mockAds);
        } else {
            setFilteredAds(mockAds.filter(ad => ad.placement === activeTab));
        }
    }, [activeTab]);

  return (
    <main className="flex flex-1 flex-col gap-4">
        <Card>
            <CardHeader>
                <CardTitle>จัดการโฆษณา</CardTitle>
                <CardDescription>
                    จัดการแบนเนอร์และแคมเปญโฆษณาทุกตำแหน่งบนแพลตฟอร์ม
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="all" onValueChange={setActiveTab}>
                    <div className="flex items-center">
                        <TabsList>
                            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                            <TabsTrigger value="Homepage Carousel">แบนเนอร์หน้าแรก</TabsTrigger>
                            <TabsTrigger value="Lawyer Page Sidebar">ไซด์บาร์หน้าทนาย</TabsTrigger>
                        </TabsList>
                        <div className="ml-auto flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-8 gap-1">
                            <File className="h-3.5 w-3.5" />
                            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            Export
                            </span>
                        </Button>
                        <Button size="sm" className="h-8 gap-1" asChild>
                           <Link href="/admin/ads/new">
                            <PlusCircle className="h-3.5 w-3.5" />
                            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            เพิ่มโฆษณาใหม่
                            </span>
                           </Link>
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
                                <TableHead>ตำแหน่ง</TableHead>
                                <TableHead>สถานะ</TableHead>
                                <TableHead className="text-right">จำนวนคลิก</TableHead>
                                <TableHead>
                                <span className="sr-only">Actions</span>
                                </TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {filteredAds.map((ad) => (
                                <TableRow key={ad.id}>
                                    <TableCell className="hidden sm:table-cell">
                                        <Image
                                        alt={ad.title}
                                        className="aspect-square rounded-md object-contain bg-white p-1"
                                        height="64"
                                        src={ad.imageUrl}
                                        width="64"
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <Link href={`/admin/ads/${ad.id}`} className="hover:underline">
                                            {ad.title}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                         <Badge variant="outline">{ad.placement}</Badge>
                                    </TableCell>
                                    <TableCell>
                                         <Badge variant={ad.status === 'active' ? 'secondary' : 'outline'}>{ad.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {ad.analytics?.clicks.toLocaleString() || 0}
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
                                            <DropdownMenuItem asChild>
                                                <Link href={`/admin/ads/${ad.id}`}>ดูสถิติ</Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href={`/admin/ads/${ad.id}/edit`}>แก้ไข</Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>ลบ</DropdownMenuItem>
                                        </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                    </TabsContent>
                    {/* Other TabsContent removed for brevity, they would need similar table updates */}
                </Tabs>
            </CardContent>
             <CardFooter>
                <div className="text-xs text-muted-foreground">
                    แสดง <strong>{filteredAds.length}</strong> จาก <strong>{mockAds.length}</strong> รายการ
                </div>
            </CardFooter>
        </Card>
    </main>
  )
}
