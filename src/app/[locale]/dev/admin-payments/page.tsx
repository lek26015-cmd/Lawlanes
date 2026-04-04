'use client';

import React, { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { notifyPaymentCompletedAction } from '@/app/actions/chat-actions';
import { approvePaymentSlipAction } from '@/app/actions/admin-actions';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, AlertCircle, Eye, ExternalLink } from 'lucide-react';

export default function AdminPaymentsPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [pendingChats, setPendingChats] = useState<any[]>([]);
    const [pendingAppointments, setPendingAppointments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchPendingItems = async () => {
        if (!firestore) return;
        setIsLoading(true);
        try {
            // Fetch Chats
            const chatsQuery = query(collection(firestore, 'chats'), where('status', '==', 'pending_payment'));
            const chatsSnap = await getDocs(chatsQuery);
            setPendingChats(chatsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            // Fetch Appointments
            const aptQuery = query(collection(firestore, 'appointments'), where('status', '==', 'pending_payment'));
            const aptSnap = await getDocs(aptQuery);
            setPendingAppointments(aptSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingItems();
    }, [firestore]);

    const handleApprove = async (type: 'chat' | 'appointment', item: any) => {
        try {
            const res = await approvePaymentSlipAction({
                type,
                id: item.id,
                lawyerId: item.lawyerId || '',
                amount: item.amount || item.paidAmount || item.pendingPaymentDetails?.amount || 0,
                caseTitle: item.caseTitle || item.description,
            });

            if (res.success) {
                toast({ title: 'อนุมัติสลิปสำเร็จ', description: 'ระบบได้อัปเดตสถานะการชำระเงินและแจ้งเตือนทนายแล้ว' });
                fetchPendingItems();
            } else {
                toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: res.error });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }
    };

    if (isLoading) return <div className="p-10 text-center">กำลังโหลดข้อมูล...</div>;

    return (
        <div className="container mx-auto p-6 max-w-5xl">
            <h1 className="text-3xl font-bold mb-8">Admin Dashboard - การตรวจสอบสลิป</h1>
            
            <div className="grid md:grid-cols-2 gap-8">
                <div>
                    <h2 className="text-xl font-bold border-b pb-2 mb-4">ตั๋วสนทนา & คดีความ (Chats)</h2>
                    {pendingChats.length === 0 ? <p className="text-gray-500">ไม่มีรายการรอดำเนินการ</p> : null}
                    <div className="space-y-4">
                        {pendingChats.map(chat => (
                            <Card key={chat.id}>
                                <CardHeader className="py-3">
                                    <CardTitle className="text-base">{chat.caseTitle}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="text-sm">
                                        <p><strong>ผู้ชำระ:</strong> ลูกความ ID: {chat.userId || chat.clientId}</p>
                                        <p><strong>ยอดเงิน:</strong> ฿{(chat.amount || chat.pendingPaymentDetails?.amount || 0).toLocaleString()}</p>
                                        {chat.slipUrl && (
                                            <a href={chat.slipUrl} target="_blank" rel="noreferrer" className="text-blue-500 flex items-center gap-1 mt-2 hover:underline">
                                                <ExternalLink className="w-4 h-4" /> ดูสลิปโอนเงิน
                                            </a>
                                        )}
                                    </div>
                                    <Button onClick={() => handleApprove('chat', chat)} className="w-full bg-green-600 hover:bg-green-700">
                                        <CheckCircle className="mr-2 w-4 h-4" /> อนุมัติการชำระเงิน
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                <div>
                    <h2 className="text-xl font-bold border-b pb-2 mb-4">การนัดหมาย (Appointments)</h2>
                    {pendingAppointments.length === 0 ? <p className="text-gray-500">ไม่มีรายการรอดำเนินการ</p> : null}
                    <div className="space-y-4">
                        {pendingAppointments.map(apt => (
                            <Card key={apt.id}>
                                <CardHeader className="py-3">
                                    <CardTitle className="text-base">นัดทนาย: {apt.lawyerName}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="text-sm">
                                        <p><strong>ยอดเงิน:</strong> ฿{(apt.amount || 0).toLocaleString()}</p>
                                        <p><strong>วันที่:</strong> {apt.appointmentDate?.toDate ? apt.appointmentDate.toDate().toLocaleDateString() : 'N/A'}</p>
                                        {apt.slipUrl && (
                                            <a href={apt.slipUrl} target="_blank" rel="noreferrer" className="text-blue-500 flex items-center gap-1 mt-2 hover:underline">
                                                <ExternalLink className="w-4 h-4" /> ดูสลิปโอนเงิน
                                            </a>
                                        )}
                                    </div>
                                    <Button onClick={() => handleApprove('appointment', apt)} className="w-full bg-green-600 hover:bg-green-700">
                                        <CheckCircle className="mr-2 w-4 h-4" /> อนุมัติการชำระเงิน
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
