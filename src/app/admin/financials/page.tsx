
'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DollarSign,
  TrendingUp,
  HandCoins,
  CheckCircle,
  Clock,
  Eye,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'revenue' | 'fee' | 'payout';
  status: 'completed' | 'pending';
};

type SlipVerificationItem = {
  id: string;
  type: 'Appointment' | 'Chat';
  userName: string;
  lawyerName: string;
  amount: number;
  submittedAt: Date;
  collectionName: 'appointments' | 'chats';
  slipUrl?: string;
};

export default function AdminFinancialsPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState('overview');
  const [slipVerifications, setSlipVerifications] = React.useState<
    SlipVerificationItem[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const fetchPendingPayments = React.useCallback(async () => {
    if (!firestore) return;
    setIsLoading(true);

    try {
      const appointmentsRef = collection(firestore, 'appointments');
      const chatsRef = collection(firestore, 'chats');

      const appointmentQuery = query(
        appointmentsRef,
        where('status', '==', 'pending_payment')
      );
      const chatQuery = query(
        chatsRef,
        where('status', '==', 'pending_payment')
      );

      const [appointmentSnapshot, chatSnapshot] = await Promise.all([
        getDocs(appointmentQuery),
        getDocs(chatQuery),
      ]);

      const pending: SlipVerificationItem[] = [];

      // Helper to fetch user name
      const getUserName = async (uid: string) => {
        try {
          const userDoc = await getDocs(query(collection(firestore, 'users'), where('uid', '==', uid)));
          if (!userDoc.empty) return userDoc.docs[0].data().name;
          return 'Unknown User';
        } catch (e) { return 'Unknown User'; }
      };

      // Helper to fetch lawyer name
      const getLawyerName = async (lawyerId: string) => {
        try {
          const lawyerDoc = await getDocs(query(collection(firestore, 'lawyerProfiles'), where('id', '==', lawyerId)));
          if (!lawyerDoc.empty) return lawyerDoc.docs[0].data().name;
          return 'Unknown Lawyer';
        } catch (e) { return 'Unknown Lawyer'; }
      }


      for (const d of appointmentSnapshot.docs) {
        const data = d.data();
        const userName = await getUserName(data.userId);
        pending.push({
          id: d.id,
          type: 'Appointment',
          userName: userName,
          lawyerName: data.lawyerName,
          amount: 3500,
          submittedAt: data.createdAt?.toDate() || new Date(),
          collectionName: 'appointments',
          slipUrl: data.slipUrl
        });
      }

      for (const d of chatSnapshot.docs) {
        const data = d.data();
        // Chat participants: [userId, lawyerUserId]
        // We need to find which one is the customer. Usually the creator.
        // But here we saved userId explicitly in my previous step.
        const userId = data.userId || data.participants[0];
        const lawyerId = data.lawyerId;

        const userName = await getUserName(userId);
        const lawyerName = lawyerId ? await getLawyerName(lawyerId) : 'Unknown Lawyer';

        pending.push({
          id: d.id,
          type: 'Chat',
          userName: userName,
          lawyerName: lawyerName,
          amount: 500,
          submittedAt: data.createdAt?.toDate() || new Date(),
          collectionName: 'chats',
          slipUrl: data.slipUrl
        });
      }

      setSlipVerifications(pending.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()));
    } catch (error) {
      console.error('Error fetching pending payments:', error);
      toast({
        variant: 'destructive',
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถดึงข้อมูลรายการรอตรวจสอบได้',
      });
    } finally {
      setIsLoading(false);
    }
  }, [firestore, toast]);

  React.useEffect(() => {
    if (activeTab === 'verification') {
      fetchPendingPayments();
    }
  }, [activeTab, fetchPendingPayments]);

  const handleApprovePayment = async (item: SlipVerificationItem) => {
    if (!firestore) return;

    const docRef = doc(firestore, item.collectionName, item.id);
    const newStatus =
      item.collectionName === 'appointments' ? 'pending' : 'active';

    try {
      await updateDoc(docRef, { status: newStatus });
      toast({
        title: 'อนุมัติสำเร็จ',
        description: `รายการของ ${item.userName} ได้รับการอนุมัติแล้ว`,
      });
      // Refetch the list after approval
      fetchPendingPayments();
    } catch (error) {
      console.error('Error approving payment:', error);
      toast({
        variant: 'destructive',
        title: 'อนุมัติไม่สำเร็จ',
        description: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ',
      });
    }
  };

  const totalServiceValue = 1259345;
  const platformRevenueThisMonth = 18802.5;
  const platformTotalRevenue = totalServiceValue * 0.15;
  const monthlyData = [
    { month: 'เม.ย.', total: 52500 },
    { month: 'พ.ค.', total: 63000 },
    { month: 'มิ.ย.', total: 102000 },
    { month: 'ก.ค.', total: platformRevenueThisMonth },
  ];

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>ภาพรวมการเงิน</CardTitle>
          <CardDescription>
            สรุปธุรกรรม รายได้ และรายการที่ต้องดำเนินการทั้งหมด
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            defaultValue="overview"
            value={activeTab}
            onValueChange={setActiveTab}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
              <TabsTrigger value="verification" className="relative">
                ตรวจสอบสลิป
                {slipVerifications.length > 0 && activeTab !== 'verification' && (
                  <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs">
                    {slipVerifications.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="transactions">รายการธุรกรรม</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      ยอดค่าบริการรวม
                    </CardTitle>
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      ฿
                      {totalServiceValue.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <CardDescription>มูลค่าธุรกรรมทั้งหมดในระบบ</CardDescription>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      รายได้แพลตฟอร์ม (เดือนนี้)
                    </CardTitle>
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      ฿
                      {platformRevenueThisMonth.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <CardDescription>
                      ส่วนแบ่งรายได้ในเดือนปัจจุบัน
                    </CardDescription>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      รายได้แพลตฟอร์ม (ทั้งหมด)
                    </CardTitle>
                    <HandCoins className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      ฿
                      {platformTotalRevenue.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <CardDescription>
                      ส่วนแบ่งรายได้ทั้งหมดของแพลตฟอร์ม
                    </CardDescription>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>สถิติรายได้แพลตฟอร์มรายเดือน</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="month"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) =>
                          `฿${new Intl.NumberFormat('en-US', {
                            notation: 'compact',
                            compactDisplay: 'short',
                          }).format(value as number)}`
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: 'var(--radius)',
                        }}
                        cursor={{ fill: 'hsl(var(--accent))' }}
                        formatter={(value: number) => [
                          value.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          }),
                          'รายได้',
                        ]}
                      />
                      <Bar
                        dataKey="total"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="verification">
              <Card>
                <CardHeader>
                  <CardTitle>รายการรอตรวจสอบสลิป</CardTitle>
                  <CardDescription>
                    ตรวจสอบและอนุมัติรายการที่ลูกค้าชำระเงินโดยการโอน
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>วันที่แจ้ง</TableHead>
                        <TableHead>ลูกค้า</TableHead>
                        <TableHead>สำหรับ</TableHead>
                        <TableHead>ทนายความ</TableHead>
                        <TableHead>ยอดเงิน</TableHead>
                        <TableHead className="text-right">
                          การดำเนินการ
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center">
                            กำลังโหลด...
                          </TableCell>
                        </TableRow>
                      ) : slipVerifications.length > 0 ? (
                        slipVerifications.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              {format(item.submittedAt, 'd MMM yyyy, HH:mm', {
                                locale: th,
                              })}
                            </TableCell>
                            <TableCell>{item.userName}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.type}</Badge>
                            </TableCell>
                            <TableCell>{item.lawyerName}</TableCell>
                            <TableCell>
                              ฿{item.amount.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button variant="outline" size="sm" onClick={() => item.slipUrl && window.open(item.slipUrl, '_blank')} disabled={!item.slipUrl}>
                                <Eye className="mr-1 h-3 w-3" /> ดูสลิป
                              </Button>
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprovePayment(item)}>
                                <CheckCircle className="mr-1 h-3 w-3" /> อนุมัติ
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center">
                            ไม่มีรายการรอตรวจสอบ
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions">
              <p className="text-muted-foreground">ส่วนนี้กำลังอยู่ในระหว่างการพัฒนา จะแสดงรายการธุรกรรมทั้งหมด</p>
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
