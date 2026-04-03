
'use client'

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Briefcase, FileSignature, DollarSign, Info, Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { closeCaseAction, cancelCaseAction, getCaseDetailsAction } from '@/app/actions/lawyer-case-actions';
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


function CloseCasePageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const caseId = params.id as string;
  const clientName = searchParams.get('clientName') || 'ลูกความ';
  const lawyerId = searchParams.get('lawyerId');
  const clientId = searchParams.get('clientId');
  
  const [summary, setSummary] = useState('');
  const [finalFee, setFinalFee] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isLoadingCase, setIsLoadingCase] = useState(true);
  const [caseData, setCaseData] = useState<any>(null);

  // Fetch real case data from Firestore
  useEffect(() => {
    async function fetchCase() {
      setIsLoadingCase(true);
      try {
        const result = await getCaseDetailsAction(caseId);
        if (result.success && result.data) {
          setCaseData(result.data);
          setFinalFee(String(result.data.amount || 0));
        }
      } catch (error) {
        console.error("Error fetching case:", error);
      } finally {
        setIsLoadingCase(false);
      }
    }
    fetchCase();
  }, [caseId]);

  const originalFee = caseData?.amount || 0;

  const handleSubmit = async () => {
    if (!summary.trim() || !finalFee.trim()) {
      toast({
        variant: 'destructive',
        title: 'ข้อมูลไม่ครบถ้วน',
        description: 'กรุณากรอกบทสรุปและค่าบริการสุดท้าย',
      });
      return;
    }

    if (!lawyerId) {
      toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: 'ไม่พบข้อมูลทนายความ' });
      return;
    }
    
    setIsSubmitting(true);

    try {
      const result = await closeCaseAction(caseId, {
        lawyerId,
        summary,
        finalFee: parseFloat(finalFee),
        originalFee,
      });

      if (!result.success) {
        toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: result.error });
        return;
      }

      const chatParams = new URLSearchParams();
      chatParams.set('lawyerId', lawyerId);
      if (clientId) chatParams.set('clientId', clientId);
      chatParams.set('view', 'lawyer');

      if (result.requiresApproval) {
        toast({
          title: 'ส่งคำขอค่าบริการเพิ่มเติมสำเร็จ',
          description: `ระบบได้ส่งคำขออนุมัติค่าบริการใหม่ให้ '${clientName}' แล้ว`,
        });
        chatParams.set('additionalFeeRequested', 'true');
      } else {
        toast({
          title: 'ส่งสรุปเคสสำเร็จ',
          description: `ได้ส่งสรุปและแจ้งปิดเคสสำหรับ ${caseId} เรียบร้อยแล้ว`,
        });
        chatParams.set('status', 'closed');
      }
      
      router.push(`/chat/${caseId}?${chatParams.toString()}`);
    } catch (error) {
      console.error("Error closing case:", error);
      toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถปิดเคสได้ กรุณาลองใหม่อีกครั้ง' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCancelCase = async () => {
    if (!lawyerId) return;
    setIsCancelling(true);

    try {
      const result = await cancelCaseAction(caseId, lawyerId);

      if (!result.success) {
        toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: result.error });
        return;
      }

      toast({
        title: 'ยกเลิกเคสสำเร็จ',
        description: result.refundAmount > 0 
          ? `เคส ${caseId} ถูกยกเลิกแล้ว ระบบจะดำเนินการคืนเงิน ฿${result.refundAmount.toLocaleString()} ให้ลูกความ`
          : `เคส ${caseId} ถูกยกเลิกเรียบร้อยแล้ว`,
      });
      router.push('/lawyer-dashboard');
    } catch (error) {
      console.error("Error cancelling case:", error);
      toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถยกเลิกเคสได้' });
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoadingCase) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-gray-100/50 min-h-screen">
      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <Link href={`/chat/${caseId}?lawyerId=${lawyerId}&clientId=${clientId}&view=lawyer`} className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              กลับไปที่ห้องแชท
            </Link>
            <h1 className="text-3xl font-bold font-headline">ส่งสรุปและปิดเคส</h1>
            <p className="text-muted-foreground">สรุปผลการให้คำปรึกษาและแจ้งค่าบริการสุดท้ายเพื่อปิดเคส</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Briefcase /> ข้อมูลเคส</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="font-semibold text-muted-foreground">รหัสเคส:</span>
                    <span className="font-mono">{caseId}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-semibold text-muted-foreground">ลูกความ:</span>
                    <span>{clientName}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="font-semibold text-muted-foreground">หัวข้อเคส:</span>
                    <span>{caseData?.caseTitle || 'ไม่ระบุ'}</span>
                </div>
                {caseData?.description && (
                  <div className="flex justify-between">
                    <span className="font-semibold text-muted-foreground">รายละเอียด:</span>
                    <span className="text-right max-w-[60%]">{caseData.description}</span>
                  </div>
                )}
                <div className="flex justify-between">
                    <span className="font-semibold text-muted-foreground">ค่าบริการที่ชำระแล้ว:</span>
                    <span className="font-bold text-green-600">฿{originalFee.toLocaleString()}</span>
                </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileSignature /> บทสรุปและคำแนะนำสุดท้าย</CardTitle>
                <CardDescription>กรอกรายละเอียดสรุปผลการให้คำปรึกษาและขั้นตอนต่อไป (ถ้ามี) เพื่อส่งให้ลูกความ</CardDescription>
            </CardHeader>
            <CardContent>
                <Textarea 
                    placeholder="เช่น จากการตรวจสอบเอกสารทั้งหมด พบว่า..."
                    rows={10}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><DollarSign /> ค่าบริการสุดท้าย</CardTitle>
                <CardDescription>ระบุยอดค่าบริการทั้งหมดสำหรับเคสนี้ (รวมค่าปรึกษาครั้งแรก)</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">฿</span>
                    <Input 
                        type="number"
                        placeholder={String(originalFee)}
                        value={finalFee}
                        onChange={(e) => setFinalFee(e.target.value)}
                        className="pl-10 text-lg font-bold"
                    />
                </div>
                 {parseFloat(finalFee) > originalFee && (
                    <Alert className="mt-4 border-blue-500 bg-blue-50 text-blue-800">
                        <Info className="h-4 w-4 !text-blue-600" />
                        <AlertTitle>แจ้งเพื่อทราบ</AlertTitle>
                        <AlertDescription>
                            ยอดเงินที่ระบุสูงกว่าค่าบริการเริ่มต้น (฿{originalFee.toLocaleString()}) ระบบจะส่งคำขอให้ลูกความอนุมัติค่าบริการส่วนต่าง ฿{(parseFloat(finalFee) - originalFee).toLocaleString()}
                        </AlertDescription>
                    </Alert>
                 )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive" 
                  size="lg"
                  disabled={isCancelling}
                >
                  {isCancelling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังยกเลิก...</> : 'ยกเลิกเคส (ไม่รับค่าบริการ)'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    ยืนยันการยกเลิกเคส
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    การยกเลิกเคสจะไม่สามารถย้อนกลับได้ {originalFee > 0 ? `ระบบจะทำการคืนเงิน ฿${originalFee.toLocaleString()} ให้ลูกความ` : ''} คุณแน่ใจหรือไม่?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ไม่ ยกเลิก</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleCancelCase}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    ยืนยัน ยกเลิกเคส
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button 
              size="lg" 
              onClick={handleSubmit} 
              disabled={isSubmitting || !summary.trim()}
            >
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังส่ง...</> : 'ยืนยันและส่งสรุปเพื่อปิดเคส'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CloseCasePage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
            <CloseCasePageContent />
        </Suspense>
    )
}
