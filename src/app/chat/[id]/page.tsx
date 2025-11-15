
'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getLawyerById } from '@/lib/data';
import type { LawyerProfile } from '@/lib/types';
import { useFirebase } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
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
import { AlertTriangle, FileText, Check, Upload, Scale } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

function ChatPageContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const chatId = params.id as string;
    const lawyerId = searchParams.get('lawyerId');
    const status = searchParams.get('status');
    
    const [lawyer, setLawyer] = useState<LawyerProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [files, setFiles] = useState<{ name: string, size: number }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    
    const isCompleted = status === 'closed';
    // Manage chat disabled state based on whether the case is completed from the start
    const [isChatDisabled, setIsChatDisabled] = useState(isCompleted);

    // Review state
    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState("");

    const { auth, firestore } = useFirebase();
    const { data: user } = useUser(auth);

    useEffect(() => {
        async function fetchLawyer() {
            if (!lawyerId) {
                setIsLoading(false);
                return;
            }
            const lawyerData = await getLawyerById(lawyerId);
            setLawyer(lawyerData || null);
            setIsLoading(false);
        }
        fetchLawyer();
    }, [lawyerId]);

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
        if(event.target) {
            event.target.value = '';
        }
    };
    
    const handleConfirmRelease = () => {
        setIsChatDisabled(true); // Disable chat on case completion
        toast({
            title: "ดำเนินการสำเร็จ",
            description: "เคสเสร็จสมบูรณ์แล้ว กำลังนำคุณไปยังหน้าให้คะแนน...",
        });
        
        // Navigate to the review page
        router.push(`/review/${chatId}?lawyerId=${lawyerId}`);
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
        // Optionally, disable the review form after submission
    };


    if (isLoading) {
        return <div>Loading chat...</div>
    }

    if (!lawyer || !user || !firestore) {
        return <div>Unable to load chat. Missing information.</div>
    }

    return (
        <div className="container mx-auto px-4 md:px-6 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <ChatBox firestore={firestore} currentUser={user} lawyer={lawyer} chatId={chatId} isDisabled={isChatDisabled} />
                </div>
                <div className="lg:col-span-1 space-y-6">
                    {isCompleted ? (
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
                                                <Scale className={`w-8 h-8 cursor-pointer transition-all duration-150 ease-in-out ${rating >= star ? 'text-primary fill-primary/20 scale-110' : 'text-gray-300 hover:text-primary/50 hover:scale-105'}`} />
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
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle>สถานะ Escrow</CardTitle>
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
                                <Button variant="link" className="text-muted-foreground text-xs mt-2">
                                    <AlertTriangle className="mr-1 h-3 w-3" /> รายงานปัญหา
                                </Button>
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

    