
'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ChevronLeft,
  Users,
  BarChart3,
  Calendar,
  Eye
} from 'lucide-react'
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
import { mockAds } from '@/lib/data'
import type { Ad } from '@/lib/types'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function AdminAdDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { id } = params

  const [ad, setAd] = React.useState<Ad | null>(null);

  React.useEffect(() => {
    const foundAd = mockAds.find(a => a.id === id);
    setAd(foundAd || null);
  }, [id]);

  if (!ad) {
    return <div>Loading...</div>
  }
  
  if (!ad.analytics) {
      return (
           <main className="grid flex-1 items-start gap-4">
                <div className="mx-auto grid max-w-[59rem] flex-1 auto-rows-max gap-4">
                    <p>No analytics data for this ad.</p>
                </div>
           </main>
      )
  }

  const genderData = [
    { name: 'ชาย', value: ad.analytics.gender.male, fill: 'var(--chart-1)' },
    { name: 'หญิง', value: ad.analytics.gender.female, fill: 'var(--chart-2)' },
    { name: 'อื่นๆ', value: ad.analytics.gender.other, fill: 'var(--chart-3)' },
  ]
  
  const ageData = [
    { name: '18-24', value: ad.analytics.age['18-24'], fill: 'var(--chart-1)' },
    { name: '25-34', value: ad.analytics.age['25-34'], fill: 'var(--chart-2)' },
    { name: '35-44', value: ad.analytics.age['35-44'], fill: 'var(--chart-3)' },
    { name: '45-54', value: ad.analytics.age['45-54'], fill: 'var(--chart-4)' },
    { name: '55+', value: ad.analytics.age['55+'], fill: 'var(--chart-5)' },
  ]

  return (
    <main className="grid flex-1 items-start gap-4">
        <div className="mx-auto grid w-full max-w-6xl flex-1 auto-rows-max gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/ads">
                <Button variant="outline" size="icon" className="h-7 w-7">
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">กลับ</span>
                </Button>
            </Link>
            <div className="flex-1">
                <h1 className="font-semibold text-xl md:text-2xl">{ad.title}</h1>
                <p className="text-sm text-muted-foreground">
                    สถิติและรายละเอียดของโฆษณา
                </p>
            </div>
            <div className="hidden items-center gap-2 md:ml-auto md:flex">
              <Link href={`/admin/ads/${id}/edit`}>
                <Button variant="outline" size="sm">
                    แก้ไข
                </Button>
              </Link>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">จำนวนคลิกทั้งหมด</CardTitle>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{ad.analytics.clicks.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">ในช่วง 30 วันที่ผ่านมา</p>
                </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
             <Card className="lg:col-span-4">
                <CardHeader>
                    <CardTitle>ภาพรวมโฆษณา</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6">
                    <Image
                        alt={ad.title}
                        className="aspect-video w-full rounded-md object-contain bg-white p-2 border"
                        height="300"
                        src={ad.imageUrl}
                        width="533"
                    />
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">สถานะ</p>
                            <Badge variant={ad.status === 'active' ? 'secondary' : 'outline'}>{ad.status}</Badge>
                        </div>
                        <div>
                            <p className="text-muted-foreground">ตำแหน่ง</p>
                            <p className="font-medium">{ad.placement}</p>
                        </div>
                         <div className="col-span-2">
                            <p className="text-muted-foreground">คำอธิบาย</p>
                            <p className="font-medium">{ad.description}</p>
                        </div>
                    </div>
                </CardContent>
             </Card>
             <Card className="lg:col-span-3">
                <CardHeader>
                    <CardTitle>สถิติผู้เข้าชม</CardTitle>
                    <CardDescription>
                        ข้อมูลประชากรของผู้ที่คลิกโฆษณา
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                     <div>
                        <h3 className="text-sm font-medium mb-2">แบ่งตามเพศ</h3>
                        <ResponsiveContainer width="100%" height={150}>
                            <BarChart data={genderData} layout="vertical" margin={{ left: -10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={50} />
                                <Tooltip cursor={{ fill: 'hsl(var(--accent))' }} />
                                <Bar dataKey="value" layout="vertical" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium mb-2">แบ่งตามอายุ</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={ageData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                dataKey="name"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{ fill: 'hsl(var(--accent))' }}/>
                                <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
             </Card>
          </div>
        </div>
    </main>
  )
}
