

'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getLawyerById } from '@/lib/data';
import type { LawyerProfile } from '@/lib/types';
import { useFirebase, useUser } from '@/firebase';
// import { useUser } from '@/firebase/auth/use-user';
import { ChatBox } from '@/components/chat/chat-box';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileText, Check, Upload, Scale, Ticket, Briefcase, User as UserIcon, DollarSign, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { doc, getDoc } from 'firebase/firestore';

function ChatPageContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const chatId = params.id as string;
    const lawyerId = searchParams.get('lawyerId');
    const clientId = searchParams.get('clientId'); // For lawyer's view
    const status = searchParams.get('status');
    const view = searchParams.get('view');
    const additionalFeeRequested = searchParams.get('additionalFeeRequested');

    const [lawyer, setLawyer] = useState<LawyerProfile | null>(null);
    const [client, setClient] = useState<{ id: string, name: string, imageUrl: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [files, setFiles] = useState<{ name: string, size: number }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const isCompleted = status === 'closed';
    const isLawyerView = view === 'lawyer';
    const [isChatDisabled, setIsChatDisabled] = useState(isCompleted);

    // Review state (for user view)
    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState("");

    const { auth, firestore } = useFirebase();
    const { user } = useUser();

    const initialFee = 3500;
    const additionalFee = 1500;
    const totalFee = initialFee + additionalFee;

    useEffect(() => {
        if (!firestore) return;
        const db = firestore; // Capture non-null firestore
        async function fetchData() {
            setIsLoading(true);
            if (lawyerId) {
                const lawyerData = await getLawyerById(db, lawyerId);
                setLawyer(lawyerData || null);
            }
            if (isLawyerView && clientId) {
                const userDoc = await getDoc(doc(db, 'users', clientId));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setClient({ id: clientId, name: userData.name, imageUrl: userData.avatar || '' });
                }
            }
            setIsLoading(false);
        }
        fetchData();
    }, [lawyerId, clientId, isLawyerView, firestore]);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

        if (file.size > MAX_FILE_SIZE) {
            toast({
                variant: "destructive",
                title: "ไฟล์มีขนาดใหญ่เกินไป",
                description: `กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน ${MAX_FILE_SIZE / 1024 / 1024}MB`,
            });
            return;
        }

        setFiles(prevFiles => [...prevFiles, { name: file.name, size: file.size }]);
        toast({
            title: "อัปโหลดไฟล์สำเร็จ (จำลอง)",
            description: `ไฟล์ "${file.name}" ถูกเพิ่มในรายการแล้ว`,
        });

        // Reset file input
        if (event.target) {
            event.target.value = '';
        }
    };

    const handleConfirmRelease = () => {
        setIsChatDisabled(true);
        toast({
            title: "ดำเนินการสำเร็จ",
            description: "เคสเสร็จสมบูรณ์แล้ว กำลังนำคุณไปยังหน้าให้คะแนน...",
        });

        router.push(`/review/${chatId}?lawyerId=${lawyerId}`);
    };

    const handleApproveAdditionalFee = () => {
        toast({
            title: "อนุมัติสำเร็จ",
            description: "ระบบกำลังนำคุณไปหน้าชำระเงินส่วนต่าง (จำลอง)",
        });
        // In real app, would redirect to payment page with correct amount
        router.push(`/payment?lawyerId=${lawyerId}&fee=${additionalFee}`);
    };

    const handleSubmitReview = () => {
        if (rating === 0) {
            toast({
                variant: "destructive",
                title: "กรุณาให้คะแนน",
                description: "โปรดเลือกดาวเพื่อให้คะแนนความพึงพอใจ",
            });
            return;
        }
        console.log({ chatId, lawyerId, rating, reviewText });
        toast({
            title: "ส่งรีวิวสำเร็จ",
            description: "ขอบคุณสำหรับความคิดเห็นของคุณ!",
        });
        router.push('/dashboard');
    };

    if (isLoading) {
        return <div>Loading chat...</div>
    }

    const chatPartner = isLawyerView ? client : lawyer;
    if (!chatPartner || !user || !firestore) {
        return <div>Unable to load chat. Missing information.</div>
    }

    const otherUser = {
        name: isLawyerView ? (client?.name ?? 'Client') : (lawyer?.name ?? 'Lawyer'),
        userId: isLawyerView ? (client?.id ?? '') : (lawyer?.userId ?? ''),
        imageUrl: isLawyerView ? (client?.imageUrl ?? "https://picsum.photos/seed/user-avatar/100/100") : (lawyer?.imageUrl ?? ''),
    };


    return (
        <div className="container mx-auto px-4 md:px-6 py-8">
            <div className="mb-4">
                <Link href={isLawyerView ? "/lawyer-dashboard" : "/dashboard"} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    กลับไปที่แดชบอร์ด
                </Link>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <ChatBox firestore={firestore} currentUser={user} otherUser={otherUser} chatId={chatId} isDisabled={isChatDisabled} isLawyerView={isLawyerView} />
                </div>
                <div className="lg:col-span-1 space-y-6">
                    {isLawyerView ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Briefcase className="w-5 h-5" />
                                    ข้อมูลเคส
                                </CardTitle>
                                <CardDescription>เคส: คดีมรดก</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm">
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40">
                                    <Avatar>
                                        <AvatarImage src={otherUser.imageUrl} />
                                        <AvatarFallback>{otherUser.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold text-muted-foreground">ลูกค้า</p>
                                        <p className="font-bold text-foreground">{otherUser.name}</p>
                                    </div>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">สถานะเคส:</span>
                                    <Badge variant={isCompleted ? "secondary" : (additionalFeeRequested ? "destructive" : "default")}>
                                        {isCompleted ? 'เสร็จสิ้น' : (additionalFeeRequested ? 'รออนุมัติค่าใช้จ่าย' : 'กำลังดำเนินการ')}
                                    </Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">ค่าบริการเริ่มต้น:</span>
                                    <span className="font-semibold">฿{initialFee.toLocaleString()}</span>
                                </div>
                                {additionalFeeRequested && (
                                    <div className="flex justify-between font-bold text-lg">
                                        <span className="text-muted-foreground">ค่าบริการรวม:</span>
                                        <span className="text-foreground">฿{totalFee.toLocaleString()}</span>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter>
                                {isCompleted ? (
                                    <Button disabled className="w-full">เคสนี้เสร็จสิ้นแล้ว</Button>
                                ) : (
                                    <Button variant="outline" className="w-full" asChild>
                                        <Link href={`/lawyer-dashboard/close-case/${chatId}?clientName=${client?.name}`}>
                                            ส่งสรุปและปิดเคส
                                        </Link>
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ) : isCompleted ? ( // User view, completed
                        <Card>
                            <CardHeader>
                                <CardTitle>ให้คะแนนและรีวิว</CardTitle>
                                <CardDescription>เคสนี้เสร็จสิ้นแล้ว โปรดให้คะแนนการบริการของคุณ</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2 rounded-lg border p-4">
                                    <Label className="font-semibold text-center block">คะแนนความพึงพอใจ</Label>
                                    <div className="flex items-center justify-center gap-3">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button key={star} onClick={() => setRating(star)} className="focus:outline-none">
                                                <Scale className={`w-8 h-8 cursor-pointer transition-all duration-150 ease-in-out ${rating >= star ? 'text-yellow-500 fill-yellow-500/20 scale-110' : 'text-gray-300 hover:text-yellow-500/50 hover:scale-105'}`} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="review-text">ความคิดเห็นเพิ่มเติม</Label>
                                    <Textarea
                                        id="review-text"
                                        placeholder="เล่าประสบการณ์ของคุณ..."
                                        value={reviewText}
                                        onChange={(e) => setReviewText(e.target.value)}
                                        rows={4}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleSubmitReview} className="w-full" disabled={rating === 0}>
                                    ส่งรีวิว
                                </Button>
                            </CardFooter>
                        </Card>
                    ) : additionalFeeRequested ? ( // User view, additional fee requested
                        <Card className="border-primary shadow-lg">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <DollarSign className="w-6 h-6 text-primary" />
                                    อนุมัติค่าบริการเพิ่มเติม
                                </CardTitle>
                                <CardDescription>ทนายความได้ส่งสรุปเคสและมีการเรียกเก็บค่าบริการเพิ่มเติม</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2 rounded-lg border p-4 bg-secondary/50">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">ค่าบริการเดิมใน Escrow:</span>
                                        <span>฿{initialFee.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">ขอเบิกเพิ่มเติม:</span>
                                        <span>฿{additionalFee.toLocaleString()}</span>
                                    </div>
                                    <hr className="my-2" />
                                    <div className="flex justify-between font-bold text-lg">
                                        <span>ยอดรวมใหม่:</span>
                                        <span>฿{totalFee.toLocaleString()}</span>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground text-center">คุณต้องชำระส่วนต่างจำนวน ฿{additionalFee.toLocaleString()} เพื่อดำเนินการต่อ</p>
                            </CardContent>
                            <CardFooter className="flex-col gap-2">
                                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleApproveAdditionalFee}>
                                    อนุมัติและชำระส่วนต่าง
                                </Button>
                                <Button variant="ghost" className="w-full text-destructive">ปฏิเสธและรายงานปัญหา</Button>
                            </CardFooter>
                        </Card>
                    ) : ( // User view, active
                        <Card>
                            <CardHeader>
                                <CardTitle>สถานะ Escrow</CardTitle>
                                <CardDescription className="flex items-center gap-2 pt-1">
                                    <Ticket className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm">Ticket ID: {chatId}</span>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="text-center">
                                <p className="text-muted-foreground">เงินของคุณถูกพักไว้ที่ Lawlane</p>
                                <p className="text-4xl font-bold my-2">฿3,500</p>
                                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                                    เงินจะถูกโอนให้ทนายเมื่อคุณกดยืนยันว่างานเสร็จสิ้น
                                </p>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white">
                                            <Check className="mr-2 h-4 w-4" /> ยืนยันและปล่อยเงินให้ทนาย
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>ยืนยันการจบเคส?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                เมื่อคุณยืนยันและปล่อยเงินให้ทนายแล้ว การสนทนาในเคสนี้จะสิ้นสุดลงและคุณจะไม่สามารถส่งข้อความได้อีก คุณแน่ใจหรือไม่ที่จะดำเนินการต่อ?
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleConfirmRelease} className="bg-foreground text-background hover:bg-foreground/90">ยืนยัน</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <Link href={`/help?ticketId=${chatId}`}>
                                    <Button variant="link" className="text-muted-foreground text-xs mt-2">
                                        <AlertTriangle className="mr-1 h-3 w-3" /> รายงานปัญหา
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>เอกสารในคดี</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="space-y-2 text-sm">
                                    {files.length === 0 && (
                                        <p className="text-center text-muted-foreground text-xs py-4">ยังไม่มีเอกสาร</p>
                                    )}
                                    {files.map((file, index) => (
                                        <div key={index} className="flex justify-between items-center p-2 rounded-md hover:bg-gray-100">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                                <span className="truncate" title={file.name}>{file.name}</span>
                                            </div>
                                            <span className="text-muted-foreground text-xs flex-shrink-0">
                                                {(file.size / 1024 / 1024).toFixed(2)}MB
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <Button onClick={handleUploadClick} className="w-full" disabled={isChatDisabled}>
                                    <Upload className="mr-2 h-4 w-4" /> อัปโหลดไฟล์
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}


export default function ChatPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ChatPageContent />
        </Suspense>
    )
}
