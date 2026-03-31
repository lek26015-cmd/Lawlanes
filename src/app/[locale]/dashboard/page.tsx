
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Briefcase, FileText, Loader2, Search, MessageSquare, Building, FileUp, HelpCircle, CheckCircle, User, Ticket, FileSignature, Camera, CreditCard, Clock, ShieldCheck, FileDown, Receipt } from 'lucide-react';
import type { Case, UpcomingAppointment, ReportedTicket } from '@/lib/types';
import { format } from 'date-fns';
import { th, enUS, zhCN } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/firebase';
import { getProblemTypeKey } from '@/lib/problem-types';
import { useTranslations, useLocale } from 'next-intl';
import { getUserDashboardData } from '@/app/actions/dashboard-actions';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    const t = useTranslations('Dashboard');
    const tHelp = useTranslations('Help');
    const locale = useLocale();

    const [cases, setCases] = useState<Case[]>([]);
    const [appointments, setAppointments] = useState<UpcomingAppointment[]>([]);
    const [tickets, setTickets] = useState<ReportedTicket[]>([]);
    const [capDeals, setCapDeals] = useState<any[]>([]);
    const [bookOrders, setBookOrders] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const dateLocale = locale === 'th' ? th : locale === 'zh' ? zhCN : enUS;

    useEffect(() => {
        if (isUserLoading) {
            setIsLoading(true);
            return;
        }
        if (!user) {
            router.push('/login');
            return;
        }

        async function fetchData() {
            setIsLoading(true);
            if (user?.uid) {
                try {
                    const data = await getUserDashboardData(user.uid);
                    setCases(data.cases);
                    setAppointments(data.appointments);
                    setTickets(data.tickets);

                    if (data.capDeals) {
                        setCapDeals(data.capDeals);
                    }
                    if (data.bookOrders) {
                        setBookOrders(data.bookOrders);
                    }
                    if (data.invoices) {
                        setInvoices(data.invoices);
                    }
                } catch (error) {
                    console.error("Error fetching dashboard data:", error);
                    setCases([]);
                    setAppointments([]);
                    setTickets([]);
                    setCapDeals([]);
                    setBookOrders([]);
                    setInvoices([]);
                }
            } else {
                setCases([]);
                setAppointments([]);
                setTickets([]);
                setCapDeals([]);
                setBookOrders([]);
                setInvoices([]);
            }
            setIsLoading(false);
        }
        fetchData();
    }, [isUserLoading, user, router, locale]); // Removed firestore from dependencies

    if (isUserLoading || isLoading || !user) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    const activeCases = cases.filter(c => c.status === 'active' || c.status === 'pending_payment' || c.status === 'rejected' || c.status === 'approved' || c.status === 'pending');
    const closedCases = cases.filter(c => c.status === 'closed');

    // Filter appointments (show all, including pending_payment)
    const visibleAppointments = appointments;

    const caseColors: { [key: string]: string } = {
        blue: 'border-l-4 border-blue-500',
        yellow: 'border-l-4 border-yellow-500',
        gray: 'border-l-4 border-gray-400',
        red: 'border-l-4 border-red-500',
    };

    const quickServices = [
        { icon: <Search />, text: t('findLawyer'), href: `/${locale}/lawyers` },
        { icon: <MessageSquare />, text: t('bookConsultation'), href: `/${locale}/lawyers` },
        { icon: <User />, text: t('managePersonalInfo'), href: `/${locale}/account` },
    ];

    return (
        <div className="bg-gray-100/50">
            <div className="container mx-auto px-4 md:px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Upcoming Appointments */}
                        <Card className="rounded-3xl shadow-sm border-none">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 font-bold">
                                    <Calendar className="w-5 h-5" />
                                    {t('upcomingAppointments')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {visibleAppointments.length > 0 ? (
                                    <div className="space-y-4">
                                        {visibleAppointments.map((appt) => (
                                            <div key={appt.id} className="flex items-center justify-between p-4 rounded-3xl bg-green-50 border border-green-200">
                                                <div>
                                                    <p className="font-semibold text-green-900 flex items-center gap-2">
                                                        {appt.description || t('defaultAppointmentDescription')}
                                                        {appt.status === 'pending' && (
                                                            <Badge variant="outline" className="text-yellow-700 border-yellow-600 bg-yellow-50">
                                                                รอทนายตอบรับ
                                                            </Badge>
                                                        )}
                                                        {appt.status === 'pending_payment' && (
                                                            <Badge variant="outline" className="text-red-700 border-red-600 bg-red-50">
                                                                รอชำระเงิน
                                                            </Badge>
                                                        )}
                                                    </p>
                                                    <p className="text-sm text-green-700">
                                                        {t('appointmentWith')}: {appt.lawyer.name} | {t('date')}: {format(appt.date, 'dd MMM yyyy', { locale: dateLocale })} | {t('time')}: {appt.time}
                                                    </p>
                                                </div>
                                                <Button asChild size="sm" className="bg-foreground hover:bg-foreground/90 text-background rounded-full">
                                                    <Link href={`/${locale}/appointment/${appt.id}`}>{t('viewDetails')}</Link>
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Calendar className="mx-auto h-10 w-10 mb-2" />
                                        <p>{t('noAppointments')}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Ongoing Cases */}
                        <Card className="rounded-3xl shadow-sm border-none">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 font-bold">
                                    <Briefcase className="w-5 h-5" />
                                    {t('ongoingCases')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {activeCases.length > 0 ? (
                                    <div className="space-y-3">
                                        {activeCases
                                            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                                            .map((caseItem) => (
                                                <Link href={caseItem.status === 'rejected' ? '#' : `/${locale}/chat/${caseItem.id}?lawyerId=${caseItem.lawyer.id}`} key={caseItem.id} className={caseItem.status === 'rejected' ? 'cursor-default' : ''}>
                                                    <div className={`flex items-center justify-between p-4 rounded-3xl bg-card ${caseItem.status === 'rejected' ? caseColors['red'] : caseColors['blue']}`}>
                                                        <div>
                                                            <p className="font-semibold flex items-center gap-2 flex-wrap">
                                                                {caseItem.title || t('defaultCaseTitle')}
                                                                <span className="font-mono text-xs text-muted-foreground">({caseItem.id})</span>
                                                                {caseItem.status === 'pending_payment' && (
                                                                    <Badge variant="outline" className="text-yellow-600 border-yellow-600 bg-yellow-50">
                                                                        รอตรวจสอบสลิป
                                                                    </Badge>
                                                                )}
                                                                {caseItem.status === 'rejected' && (
                                                                    <Badge variant="destructive">
                                                                        คำขอถูกปฏิเสธ
                                                                    </Badge>
                                                                )}
                                                            </p>
                                                            {caseItem.status === 'rejected' && caseItem.rejectReason && (
                                                                <p className="text-sm text-red-600 mt-1">
                                                                    เหตุผล: {caseItem.rejectReason}
                                                                </p>
                                                            )}
                                                            <p className="text-sm text-muted-foreground">{caseItem.lastMessage}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {caseItem.hasNewMessage && (
                                                                <span className="flex h-3 w-3 rounded-full bg-red-600 animate-pulse" />
                                                            )}
                                                            {caseItem.status !== 'rejected' && (
                                                                <Button size="sm" className="bg-foreground hover:bg-foreground/90 text-background rounded-full">{t('viewDetails')}</Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Link>
                                            ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Briefcase className="mx-auto h-10 w-10 mb-2" />
                                        <p>{t('noActiveCases') || "ยังไม่มีรายการปรึกษา"}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Closed Cases */}
                        {closedCases.length > 0 && (
                            <Card className="rounded-3xl shadow-sm border-none">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 font-bold">
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                        {t('closedCases')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {closedCases.map((caseItem) => (
                                            <Link href={`/${locale}/chat/${caseItem.id}?lawyerId=${caseItem.lawyer.id}&status=closed`} key={caseItem.id}>
                                                <div className={`flex items-center justify-between p-4 rounded-3xl bg-gray-50 ${caseColors.gray}`}>
                                                    <div>
                                                        <p className="font-semibold">{caseItem.title || t('defaultCaseTitle')} <span className="font-mono text-xs text-muted-foreground">({caseItem.id})</span></p>
                                                        <p className="text-sm text-muted-foreground">{caseItem.lastMessage}</p>
                                                    </div>
                                                    <Badge variant="outline">{t('viewHistory')}</Badge>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}


                        {/* Cap Deal - Recent Contracts */}
                        <Card className="rounded-3xl shadow-sm border-none">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 font-bold">
                                    <FileSignature className="w-5 h-5" />
                                    แคปดีล — สัญญาล่าสุด
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {capDeals.length > 0 ? (
                                    <div className="space-y-3">
                                        {capDeals.map((deal: any) => (
                                            <Link href={`https://capdeal.lawslane.com/${locale}/contract/${deal.id}`} key={deal.id} target="_blank">
                                                <div className="flex items-center justify-between p-4 rounded-3xl bg-blue-50 border border-blue-100 hover:bg-blue-100/50 transition-colors">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-blue-900 truncate flex items-center gap-2">
                                                            {deal.title || 'สัญญาจ้างทำของ'}
                                                            <Badge variant="outline" className={`text-xs ${deal.status === 'signed' ? 'text-green-700 border-green-600 bg-green-50' :
                                                                deal.status === 'draft' ? 'text-slate-600 border-slate-400 bg-slate-50' :
                                                                    'text-blue-700 border-blue-600 bg-blue-50'
                                                                }`}>
                                                                {deal.status === 'signed' ? 'เซ็นแล้ว' : deal.status === 'draft' ? 'ร่าง' : deal.status === 'pending' ? 'อยากเซ็น' : deal.status}
                                                            </Badge>
                                                        </p>
                                                        <p className="text-sm text-blue-700 truncate">
                                                            {deal.task ? `งาน: ${deal.task.substring(0, 50)}${deal.task.length > 50 ? '...' : ''}` : 'ไม่มีรายละเอียด'}
                                                            {deal.price ? ` | ราคา: ${Number(deal.price).toLocaleString()} บาท` : ''}
                                                        </p>
                                                    </div>
                                                    <Button size="sm" className="bg-foreground hover:bg-foreground/90 text-background rounded-full ml-3 shrink-0">ดูสัญญา</Button>
                                                </div>
                                            </Link>
                                        ))}
                                        <div className="text-center pt-2">
                                            <Link href={`https://capdeal.lawslane.com/${locale}/services/contracts/screenshot`} target="_blank">
                                                <Button variant="outline" className="rounded-full">
                                                    <Camera className="w-4 h-4 mr-2" />
                                                    สร้างสัญญาใหม่
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <FileSignature className="mx-auto h-10 w-10 mb-2" />
                                        <p>ยังไม่มีสัญญาที่สร้างจากแคปดีล</p>
                                        <Link href={`https://capdeal.lawslane.com/${locale}/services/contracts/screenshot`} target="_blank">
                                            <Button className="mt-4 rounded-full">
                                                <Camera className="w-4 h-4 mr-2" />
                                                เริ่มแคปแล้วดีลเลย!
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Book Orders Section */}
                        <Card className="rounded-3xl shadow-sm border-none">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 font-bold">
                                    <FileText className="w-5 h-5" />
                                    รายการสั่งซื้อหนังสือ
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {bookOrders.length > 0 ? (
                                    <div className="space-y-3">
                                        {bookOrders.map((order: any) => (
                                            <div key={order.id} className="flex items-center justify-between p-4 rounded-3xl bg-slate-50 border border-slate-100">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-slate-900 truncate flex items-center gap-2">
                                                        ออเดอร์ #{order.id.substring(0, 8)}
                                                        <Badge variant="outline" className={cn(
                                                            "text-xs",
                                                            order.status === 'delivered' ? 'text-green-700 border-green-600 bg-green-50' :
                                                                order.status === 'shipped' ? 'text-blue-700 border-blue-600 bg-blue-50' :
                                                                    order.status === 'cancelled' ? 'text-red-700 border-red-600 bg-red-50' :
                                                                        'text-yellow-700 border-yellow-600 bg-yellow-50'
                                                        )}>
                                                            {order.status === 'pending' ? 'รอตรวจสอบ' :
                                                                order.status === 'paid' ? 'ชำระเงินแล้ว' :
                                                                    order.status === 'shipped' ? 'กำลังจัดส่ง' :
                                                                        order.status === 'delivered' ? 'ส่งสำเร็จ' :
                                                                            order.status === 'cancelled' ? 'ยกเลิก' : order.status}
                                                        </Badge>
                                                    </p>
                                                    <p className="text-sm text-slate-500 truncate">
                                                        {order.items?.length > 0 ? order.items.map((item: any) => item.title).join(', ') : 'ไม่มีรายการพิมพ์'}
                                                        {` | ยอดรวม: ${Number(order.totalAmount).toLocaleString()} บาท`}
                                                    </p>
                                                </div>
                                                <Button asChild size="sm" className="bg-foreground hover:bg-foreground/90 text-background rounded-full ml-3 shrink-0">
                                                    <Link href={`/${locale}/books/tracking`}>ติดตามสถานะ</Link>
                                                </Button>
                                            </div>
                                        ))}
                                        <div className="text-center pt-2">
                                            <Button variant="link" asChild className="text-primary font-bold">
                                                <Link href={`/${locale}/books/tracking`}>ดูทั้งหมด</Link>
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <FileText className="mx-auto h-10 w-10 mb-2" />
                                        <p>ยังไม่มีประวัติการสั่งซื้อหนังสือ</p>
                                        <Button asChild className="mt-4 rounded-full">
                                            <Link href={`/${locale}/books`}>ไปที่ร้านค้า</Link>
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>


                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-1 space-y-6">
                        <Card className="rounded-3xl shadow-sm border-none">
                            <CardContent className="pt-6 flex flex-col items-center text-center">
                                <Avatar className="w-20 h-20 mb-4">
                                    <AvatarImage src={user.photoURL || "https://picsum.photos/seed/user-avatar/100/100"} />
                                    <AvatarFallback>{user.displayName?.charAt(0) || user.email?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <p className="font-semibold text-lg">{user.displayName || user.email}</p>
                                <p className="text-sm text-muted-foreground mb-4">{user.email}</p>
                                <Link href={`/${locale}/account`} className="w-full">
                                    <Button variant="outline" className="w-full rounded-full">{t('manageAccount')}</Button>
                                </Link>
                            </CardContent>
                        </Card>

                        <Card className="rounded-3xl shadow-sm border-none">
                            <CardHeader>
                                <CardTitle className="font-bold">{t('quickServices')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {quickServices.map((service, index) => (
                                    <Link href={service.href} key={index} passHref>
                                        <Button variant="outline" className="w-full justify-start h-16 text-lg pl-6 rounded-full border-gray-200 bg-gray-50/50 hover:bg-gray-100 hover:text-primary shadow-sm hover:shadow-md transition-all">
                                            {service.icon} <span className="ml-2">{service.text}</span>
                                        </Button>
                                    </Link>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Reported Tickets */}
                        {tickets.length > 0 && (
                            <Card className="rounded-3xl shadow-sm border-none">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 font-bold">
                                        <Ticket className="w-5 h-5 text-destructive" />
                                        {t('reportedTickets')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {tickets.map((ticket) => {
                                            const problemTypeKey = getProblemTypeKey(ticket.problemType);
                                            const localizedProblemType = problemTypeKey ? tHelp(`problemTypes.${problemTypeKey}`) : ticket.problemType;

                                            return (
                                                <Link href={`/${locale}/support/${ticket.id}`} key={ticket.id}>
                                                    <div className={`flex items-center justify-between p-4 rounded-3xl border cursor-pointer transition-colors ${ticket.status === 'resolved' ? 'bg-green-50 border-green-200 hover:bg-green-100/50' : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100/50'}`}>
                                                        <div>
                                                            <p className={`font-semibold ${ticket.status === 'resolved' ? 'text-green-900' : 'text-yellow-900'}`}>
                                                                {ticket.caseTitle} <span className={`font-mono text-xs ${ticket.status === 'resolved' ? 'text-green-700' : 'text-yellow-700'}`}>({ticket.caseId})</span>
                                                            </p>
                                                            <p className={`text-sm ${ticket.status === 'resolved' ? 'text-green-800' : 'text-yellow-800'}`}>
                                                                {t('issueType')}: {localizedProblemType} | {t('sentAt')}: {format(ticket.reportedAt, 'dd MMM yyyy', { locale: dateLocale })}
                                                            </p>
                                                        </div>
                                                        {ticket.status === 'resolved' ? (
                                                            <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">{t('resolved')}</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="border-yellow-600 text-yellow-700 bg-transparent">{t('pending')}</Badge>
                                                        )}
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Payments & Invoices Section */}
                        <Card className="rounded-3xl shadow-sm border-none overflow-hidden bg-white">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 font-bold text-lg">
                                    <div className="p-1.5 bg-blue-50 rounded-lg">
                                        <CreditCard className="w-4 h-4 text-blue-600" />
                                    </div>
                                    {t('paymentsAndInvoices') || 'ชำระเงินและใบเสร็จ'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {invoices.length > 0 ? (
                                    <div className="space-y-3">
                                        {invoices.map((inv) => (
                                            <div key={inv.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-blue-50/50 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">#{inv.id.substring(0, 8)}</p>
                                                        <p className="font-bold text-slate-700 text-sm truncate max-w-[140px]">{inv.description || 'ค่าดำเนินคดี'}</p>
                                                    </div>
                                                    <Badge variant="outline" className={cn(
                                                        "rounded-full px-2 py-0 font-bold text-[9px] uppercase tracking-wider shrink-0",
                                                        inv.status === 'paid' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                                        "bg-amber-50 text-amber-700 border-amber-200"
                                                    )}>
                                                        {inv.status === 'paid' ? (locale === 'th' ? 'ชำระแล้ว' : 'Paid') : (locale === 'th' ? 'รอชำระ' : 'Pending')}
                                                    </Badge>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <p className="font-bold text-blue-600 text-base">฿{inv.amount.toLocaleString()}</p>
                                                        <p className="text-[9px] text-slate-400">ครบกำหนด: {format(new Date(inv.dueDate), 'dd MMM yyyy', { locale: dateLocale })}</p>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-slate-400 hover:text-blue-600">
                                                            <FileDown className="w-3.5 h-3.5" />
                                                        </Button>
                                                        {inv.status !== 'paid' && (
                                                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-3 h-7 text-[10px] font-bold">
                                                                {t('payNow') || 'ชำระเงิน'}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        <Receipt className="mx-auto h-8 w-8 opacity-20 mb-2" />
                                        <p className="text-xs">ยังไม่มีรายการแจ้งหนี้</p>
                                    </div>
                                )}
                                
                                <div className="text-center pt-1 border-t border-slate-50 mt-2">
                                    <Link href={`/${locale}/support`} className="text-[9px] text-slate-400 hover:text-blue-600 hover:underline font-medium">
                                        มีปัญหาเรื่องการเงิน? ติดต่อเรา
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-3xl shadow-sm border-none">
                            <CardHeader>
                                <CardTitle className="font-bold">{t('help')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Link href={`/${locale}/help`} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
                                    <HelpCircle className="mr-2" /> {t('helpCenter')}
                                </Link>
                                <Link href="#" className="flex items-center text-sm text-muted-foreground hover:text-foreground">
                                    <MessageSquare className="mr-2" /> {t('contactSupport')}
                                </Link>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
