
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Briefcase, 
  User, 
  FileText, 
  Plus, 
  CheckCircle2, 
  Info,
  ChevronRight,
  Loader2,
  Sparkles,
  DollarSign,
  ScrollText
} from 'lucide-react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardFooter,
  CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { createManualCaseAction } from '@/app/actions/lawyer-actions';
import { Copy, Check, ExternalLink } from 'lucide-react';

export default function NewCasePage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>}>
      <NewCaseForm />
    </Suspense>
  );
}

function NewCaseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdChatId, setCreatedChatId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [category, setCategory] = useState<string>('civil');
  
  // States for chat import and form fields
  const [showImportBox, setShowImportBox] = useState(false);
  const [importedTitle, setImportedTitle] = useState('');
  const [importedSummary, setImportedSummary] = useState('');
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [client, setClient] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientTaxId, setClientTaxId] = useState('');
  const [showInstallments, setShowInstallments] = useState(false);
  const [step, setStep] = useState(1);
  const [contractText, setContractText] = useState('');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [installments, setInstallments] = useState([
    { description: 'งวดที่ 1: เมื่อเริ่มงาน', amount: '' },
    { description: 'งวดที่ 2: เมื่อส่งมอบงาน', amount: '' }
  ]);

  const addInstallment = () => {
    setInstallments([...installments, { description: `งวดที่ ${installments.length + 1}: `, amount: '' }]);
  };

  const updateInstallment = (index: number, field: 'description' | 'amount', value: string) => {
    const newInstallments = [...installments];
    newInstallments[index][field] = value;
    setInstallments(newInstallments);
  };
  
  // Handle Query Params
  useEffect(() => {
    const clientId = searchParams.get('clientId');
    const chatId = searchParams.get('chatId');

    if (clientId) {
      const mockClientMapping: Record<string, string> = {
        'W S9 w 7 y s N Y U a j N s B Y Z 6 C 7 n 2 A f e 9 H 3': 'c1',
        'cli-1': 'c1',
        'cli-2': 'c2',
        'cli-3': 'c3'
      };
      
      const mappedId = mockClientMapping[clientId] || 'c1';
      setClient(mappedId);
      
      if (chatId) {
        setImportedTitle('ข้อพิพาท (นำเข้าจากแชทล่าสุด)');
        setImportedSummary('สรุปข้อมูลจากแชท: ลูกความต้องการปรึกษาเร่งด่วนเกี่ยวกับคดีและเอกสารที่แนบมา...');
        setShowImportBox(true);
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate data processing
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Generate Draft Contract
    const finalClientName = clientName || 'ลูกความผู้ว่าจ้าง';
    const totalFee = (document.getElementById('total-fee') as HTMLInputElement)?.value || '0';
    
    const draft = `สัญญาว่าจ้างทนายความ

โครงการ: ${title}

คู่สัญญา:
ลูกความ (ผู้ว่าจ้าง): ${finalClientName}
${clientAddress ? `ที่อยู่: ${clientAddress}\n` : ''}${clientTaxId ? `เลขประจำตัวผู้เสียภาษี: ${clientTaxId}\n` : ''}
ทนายความ (ผู้รับจ้าง): ทนายความ Lawslane

1. ขอบเขตงาน (Description):
${description || 'ตามที่ระบุในรายละเอียดคดี'}

2. ระยะเวลาดำเนินการ (Timeline):
ประมาณ ${document.querySelector('[value="3-6"]') ? '3-6 เดือน' : 'ตามที่ตกลง'} โดยมีการอัปเดตงานทุกๆ เดือน

3. ค่าจ้างและเงื่อนไขการชำระเงิน (Fees):
ค่าจ้างรวมทั้งสิ้นจำนวน ${totalFee} บาท (ไม่รวมภาษีมูลค่าเพิ่ม) 
${showInstallments ? `โดยแบ่งชำระเป็นดังนี้:\n${installments.map((inst, i) => `- งวดที่ ${i+1}: ${inst.description} จำนวน ${inst.amount} บาท`).join('\n')}` : 'โดยชำระงวดเดียวเมื่อเริ่มงาน'}

4. นโยบายการดำเนินงาน:
ทนายความจะดำเนินการด้วยความระมัดระวังและรักษาผลประโยชน์ของลูกความอย่างเต็มความสามารถ...

ลงชื่อ......................................... (ผู้ว่าจ้าง)
ลงชื่อ......................................... (ผู้รับจ้าง)`;

    setContractText(draft);
    setStep(2);
    setIsSubmitting(false);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmContract = async () => {
    if (!user) return;
    setIsFinalizing(true);
    
    try {
      const totalFee = (document.getElementById('total-fee') as HTMLInputElement)?.value || '0';
      const result = await createManualCaseAction(user.uid, {
        title: title,
        description: description,
        category: category,
        amount: parseFloat(totalFee),
        installments: showInstallments ? installments : [],
        clientInfo: {
          name: clientName,
          address: clientAddress,
          taxId: clientTaxId
        }
      });

      if (result.success && result.chatId) {
        setCreatedChatId(result.chatId);
        toast({
          title: "สร้างคดีสำเร็จ!",
          description: "คุณสามารถคัดลอกลิงก์ชำระเงินส่งให้ลูกความได้ทันที",
        });
      } else {
        throw new Error(result.error || 'Failed to create case');
      }
    } catch (error) {
      console.error("Error creating case:", error);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถสร้างคดีได้ กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  const paymentLink = typeof window !== 'undefined' ? `${window.location.origin}/payment?chatId=${createdChatId}&lawyerId=${user?.uid}&type=case` : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(paymentLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast({ title: "คัดลอกลิงก์แล้ว!" });
  };

  if (createdChatId) {
    return (
      <div className="bg-slate-50 min-h-screen pb-20">
        <div className="container mx-auto max-w-2xl px-4 py-20">
          <Card className="shadow-2xl border-none rounded-3xl overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="h-3 bg-green-500"></div>
            <CardHeader className="text-center pt-10">
              <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <CardTitle className="text-3xl font-black text-slate-900 uppercase italic">สร้างคดีสำเร็จ!</CardTitle>
              <CardDescription className="text-lg">คดี "{title}" ถูกบันทึกเข้าระบบเรียบร้อยแล้ว</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-10 pb-10">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <p className="font-bold text-slate-700 flex items-center gap-2">
                   <DollarSign className="w-5 h-5 text-blue-600" /> ลิงก์สำหรับส่งให้ลูกความเพื่อชำระเงิน:
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-500 break-all h-auto min-h-[48px] flex items-center">
                    {paymentLink}
                  </div>
                  <Button 
                    onClick={copyToClipboard}
                    className="shrink-0 w-12 h-12 rounded-xl bg-blue-600 hover:bg-blue-700"
                  >
                    {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </Button>
                </div>
                <p className="text-xs text-slate-400 italic">
                  * ลูกความต้องเข้าสู่ระบบก่อนดำเนินการชำระเงินเพื่อความปลอดภัย
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  className="h-12 rounded-2xl font-bold border-slate-200"
                  onClick={() => router.push('/lawyer-dashboard/pipeline')}
                >
                  กลับไปหน้า Pipeline
                </Button>
                <Button 
                  className="h-12 rounded-2xl font-bold bg-slate-900 hover:bg-slate-800 flex items-center gap-2"
                  onClick={() => window.open(paymentLink, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" /> ดูหน้าการชำระเงิน
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Navigation */}
        <div className="flex items-center gap-2 mb-8 text-sm text-slate-500">
          <Link href="/lawyer-dashboard/pipeline" className="flex items-center gap-1.5 hover:text-blue-600 transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            กลับไปหน้า Pipeline
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 font-headline italic tracking-tight uppercase flex items-center gap-3">
             <Plus className="w-8 h-8 text-blue-600" /> เปิดเคสใหม่
          </h1>
          <p className="text-slate-500 mt-2">กรอกข้อมูลเบื้องต้นเพื่อเริ่มต้นการจัดการคดีในรูปแบบ Pipeline</p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSubmit}>
            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start mb-8">
              
              {/* Left Column: Case & Client Info */}
              <div className="space-y-6">
                {/* Step 1: Basic Information */}
                <Card className="shadow-sm border-slate-200 rounded-3xl overflow-hidden min-h-[300px]">
                  <div className="h-2 bg-blue-600"></div>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Info className="w-5 h-5 text-blue-500" /> ข้อมูลพื้นฐานของคดี
                    </CardTitle>
                    <CardDescription>ระบุชื่อคดีและประเภทคดีเพื่อให้ง่ายต่อการติดตาม</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="font-bold text-slate-700">ชื่อคดี / หัวข้อเรื่อง</Label>
                      <Input 
                        id="title" 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="เช่น คดีผิดสัญญาจ้าง, จัดการมรดกวงศ์สว่าง" 
                        required 
                        className="rounded-2xl h-11 border-slate-200 focus:ring-blue-500/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description" className="font-bold text-slate-700">รายละเอียดงาน / ขอบเขตงาน</Label>
                      <Textarea 
                        id="description" 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="ระบุขอบเขตงานและรายละเอียดสำคัญของคดี..." 
                        className="rounded-2xl border-slate-200 min-h-[120px]"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category" className="font-bold text-slate-700">ประเภทคดี</Label>
                        <Select 
                          required 
                          value={category} 
                          onValueChange={setCategory}
                        >
                          <SelectTrigger className="rounded-2xl h-11 border-slate-200">
                            <SelectValue placeholder="เลือกประเภท..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="civil">คดีแพ่ง</SelectItem>
                            <SelectItem value="criminal">คดีอาญา</SelectItem>
                            <SelectItem value="family">คดีครอบครัว</SelectItem>
                            <SelectItem value="labor">คดีแรงงาน</SelectItem>
                            <SelectItem value="other">อื่นๆ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priority" className="font-bold text-slate-700">ลำดับความสำคัญ</Label>
                        <Select defaultValue="normal">
                          <SelectTrigger className="rounded-2xl h-11 border-slate-200">
                            <SelectValue placeholder="เลือกลำดับ..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">ปกติ</SelectItem>
                            <SelectItem value="normal">ปานกลาง</SelectItem>
                            <SelectItem value="high">เร่งด่วน</SelectItem>
                            <SelectItem value="critical">เร่งด่วนที่สุด</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Step 2: Client Selection */}
                <Card className="shadow-sm border-slate-200 rounded-3xl min-h-[220px]">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-500" /> ข้อมูลลูกความ
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="client" className="font-bold text-slate-700">เลือกลูกความจากรายการ</Label>
                      <Select 
                        required 
                        value={client}
                        onValueChange={(val) => {
                          setClient(val);
                          const titles: Record<string, string> = {
                            'c1': 'ข้อพิพาทมรดกที่ดิน',
                            'c2': 'ร่างสัญญาจ้างก่อสร้างเฟส 2',
                            'c3': 'คดีแพ่ง: คืนเงินกู้',
                            'test': 'คดีผิดสัญญาเช่าอาคารพาณิชย์ (เคสจำลอง)'
                          };
                        const summaries: Record<string, string> = {
                          'c1': 'ลูกความต้องการปรึกษาเรื่องการแบ่งมรดกที่ดินที่ไม่ได้ทำพินัยกรรมไว้ โดยมีทายาททั้งหมด 5 คน...',
                          'c2': 'การร่างสัญญาสำหรับโครงการพักอาศัยใหม่ โดยเน้นเรื่องงวดงานและค่าปรับในกรณีล่าช้า...',
                          'c3': 'ลูกความถูกกู้ยืมเงินไปจำนวน 500,000 บาท มีสัญญากู้ยืมชัดเจน แต่ผู้กู้ไม่ยอมคืนตามกำหนด...',
                          'test': 'ลูกความเบี้ยวค่าเช่าอาคารพาณิชย์ย่านสาทรมาแล้ว 3 เดือน รวมมูลค่า 150,000 บาท ต้องการบอกเลิกสัญญาและขับไล่ พร้อมเรียกค่าเสียหายเพิ่มเติม...'
                        };
                          
                        if (val !== 'new' && val !== '') {
                          setImportedTitle(titles[val] || '');
                          setImportedSummary(summaries[val] || '');
                          
                          if (val === 'test') {
                            setClientName('บจก. พรอพเพอร์ตี้พลัส (สำนักงานใหญ่)');
                            setClientAddress('999 อาคารสาทรทาวเวอร์ ชั้น 45 ถนนสาทรใต้ แขวงยานนาวา เขตสาทร กรุงเทพฯ 10120');
                            setClientTaxId('0105560001234');
                            // Specifically for test case, pre-enable installments
                            setShowInstallments(true);
                            setInstallments([
                              { description: 'ค่าวิชาชีพงวดแรก (เริ่มงาน)', amount: '20000' },
                              { description: 'ค่าวิชาชีพงวดที่ 2 (ยื่นฟ้อง)', amount: '15000' },
                              { description: 'ค่าวิชาชีพงวดสุดท้าย (ศาลมีคำพิพากษา)', amount: '15000' }
                            ]);
                          } else {
                            setClientName(val === 'c1' ? 'คุณมานี รักดี' : val === 'c2' ? 'บจก. ก่อสร้างดี' : val === 'c3' ? 'คุณสมศํกดิ์ มั่นคง' : '');
                            setClientAddress(val === 'c1' ? '123/45 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900' : val === 'c2' ? 'บจก. ก่อสร้างดี สาขาใหญ่ 88/1 ถนนรัชดาภิเษก กรุงเทพฯ 10400' : '');
                            setClientTaxId(val === 'c2' ? '0105560000001' : '');
                          }
                          setShowImportBox(true);
                        } else {
                          setClientName('');
                          setClientAddress('');
                          setClientTaxId('');
                          setShowImportBox(false);
                        }
                        }}
                      >
                        <SelectTrigger className="rounded-2xl h-11 border-slate-200">
                          <SelectValue placeholder="ค้นหาชื่อลูกความ..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="c1">คุณมานี รักดี</SelectItem>
                          <SelectItem value="c2">บจก. ก่อสร้างดี</SelectItem>
                          <SelectItem value="c3">คุณสมศํกดิ์ มั่นคง</SelectItem>
                          <SelectItem value="test" className="text-blue-600 font-bold">⭐ จำลองเคสเต็มลูป (Full Test)</SelectItem>
                          <SelectItem value="new">+ เพิ่มชื่อลูกความใหม่</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {client !== '' && (
                      <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                          <Label htmlFor="client-name" className="font-bold text-slate-700 text-sm">ชื่อผู้ว่าจ้าง (สำหรับสัญญา/ใบแจ้งหนี้)</Label>
                          <Input 
                            id="client-name" 
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            placeholder="ชื่อ-นามสกุล หรือ ชื่อบริษัท" 
                            className="rounded-xl h-10 border-slate-200 text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="client-address" className="font-bold text-slate-700 text-sm">ที่อยู่</Label>
                          <Textarea 
                            id="client-address" 
                            value={clientAddress}
                            onChange={(e) => setClientAddress(e.target.value)}
                            placeholder="ระบุที่อยู่เพื่อใช้ออกใบแจ้งหนี้..." 
                            className="rounded-xl border-slate-200 min-h-[80px] text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="client-tax" className="font-bold text-slate-700 text-sm">เลขประจำตัวผู้เสียภาษี (ถ้ามี)</Label>
                          <Input 
                            id="client-tax" 
                            value={clientTaxId}
                            onChange={(e) => setClientTaxId(e.target.value)}
                            placeholder="เช่น 01055XXXXXXXX" 
                            className="rounded-xl h-10 border-slate-200 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {showImportBox && (
                      <div className="mt-4 p-4 rounded-2xl bg-blue-50 border border-blue-100 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
                            <Sparkles className="w-4 h-4" /> รับข้อมูลต่อจากแชทล่าสุด
                          </div>
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 text-xs font-bold text-blue-600 hover:bg-blue-100 rounded-lg"
                            onClick={() => {
                              setTitle(importedTitle);
                              setDescription(importedSummary);
                              setNotes(importedSummary);
                              toast({ title: "นำเข้าข้อมูลสำเร็จ", description: "ระบบได้เติมข้อมูลจากแชทลงในฟอร์มให้แล้ว" });
                            }}
                          >
                            ใช้ข้อมูลนี้
                          </Button>
                        </div>
                        <div className="text-xs text-blue-600/80 line-clamp-2">
                          <strong>หัวข้อ:</strong> {importedTitle}<br/>
                          <strong>สรุป:</strong> {importedSummary}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Financials & Timeline */}
              <div className="space-y-6">
                {/* Step 3: Timeline & Financials */}
                <Card className="shadow-sm border-slate-200 rounded-3xl overflow-hidden min-h-[300px]">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-blue-500" /> การเงินและระยะเวลา
                    </CardTitle>
                    <CardDescription>กำหนดงงบประมาณและกรอบเวลาในการดำเนินงาน</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="font-bold text-slate-700">ระยะเวลาคดีโดยประมาณ</Label>
                        <Select defaultValue="3-6">
                          <SelectTrigger className="rounded-2xl h-11 border-slate-200">
                            <SelectValue placeholder="ระบุระยะเวลา..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1-3">1-3 เดือน</SelectItem>
                            <SelectItem value="3-6">3-6 เดือน</SelectItem>
                            <SelectItem value="6-12">6-12 เดือน</SelectItem>
                            <SelectItem value="12+">1 ปีขึ้นไป</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold text-slate-700">กำหนดส่งความคืบหน้า</Label>
                        <Select defaultValue="monthly">
                          <SelectTrigger className="rounded-2xl h-11 border-slate-200">
                            <SelectValue placeholder="ระบุความถี่..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">ทุกสัปดาห์</SelectItem>
                            <SelectItem value="biweekly">ทุก 2 สัปดาห์</SelectItem>
                            <SelectItem value="monthly">ทุกเดือน</SelectItem>
                            <SelectItem value="milestone">ตามหัวข้อการปฏิบัติงาน</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="total-fee" className="font-bold text-slate-700">ค่าจ้างรวม (บาท)</Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">฿</span>
                        <Input 
                          id="total-fee" 
                          type="number"
                          placeholder="เช่น 50,000" 
                          className="rounded-2xl h-11 border-slate-200 pl-8"
                        />
                      </div>
                    </div>

                    <div className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="font-bold text-slate-700">แบ่งชำระเป็นงวด</Label>
                          <p className="text-xs text-slate-500 text-balance">เปิดใช้งานหากต้องการให้นัดชำระมากกว่า 1 ครั้ง</p>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          className={`h-8 w-14 p-1 rounded-full border-2 border-slate-200 transition-colors ${showInstallments ? 'bg-blue-600 border-blue-600' : 'bg-slate-200'}`}
                          onClick={() => setShowInstallments(!showInstallments)}
                        >
                          <div className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${showInstallments ? 'translate-x-6' : 'translate-x-0'}`} />
                        </Button>
                      </div>

                      {showInstallments && (
                        <div className="space-y-4 pt-4 border-t border-slate-200 animate-in fade-in slide-in-from-top-2">
                          <div className="space-y-3">
                            <div className="grid grid-cols-12 gap-2 items-center text-xs font-bold text-slate-500 uppercase">
                              <div className="col-span-1 text-center">งวด</div>
                              <div className="col-span-7">รายละเอียดงวดงาน</div>
                              <div className="col-span-4 text-right">จำนวนเงิน</div>
                            </div>
                            {installments.map((inst, index) => (
                              <div key={index} className="grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-1 text-center font-bold text-slate-400">#{index + 1}</div>
                                <div className="col-span-7">
                                  <Input 
                                    value={inst.description}
                                    onChange={(e) => updateInstallment(index, 'description', e.target.value)}
                                    placeholder="รายละเอียดงวดงาน" 
                                    className="rounded-xl h-10 border-slate-200 text-sm"
                                  />
                                </div>
                                <div className="col-span-4 relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">฿</span>
                                  <Input 
                                    type="number" 
                                    value={inst.amount}
                                    onChange={(e) => updateInstallment(index, 'amount', e.target.value)}
                                    placeholder="0" 
                                    className="rounded-xl h-10 border-slate-200 pl-6 text-sm text-right"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            className="w-full rounded-xl border-dashed border-slate-300 text-slate-500 h-9"
                            onClick={addInstallment}
                          >
                            <Plus className="w-3 h-3 mr-1" /> เพิ่มงวดเงิน
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Step 4: Notes & Details */}
                <Card className="shadow-sm border-slate-200 rounded-3xl min-h-[220px]">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-blue-500" /> รายละเอียดเพิ่มเติม
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="milestone" className="font-bold text-slate-700">เป้าหมายแรกที่จะดำเนินการ</Label>
                      <Input 
                        id="milestone" 
                        placeholder="เช่น รวบรวมหลักฐานและร่างคำฟ้อง" 
                        className="rounded-2xl h-11 border-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes" className="font-bold text-slate-700">บันทึกเพิ่มเติม (สำหรับทนาย)</Label>
                      <Textarea 
                        id="notes" 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="ระบุรายละเอียดสำคัญที่ต้องการจดบันทึกไว้..." 
                        className="rounded-2xl border-slate-200 min-h-[100px]"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Full Width Submit Area */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mt-8">
              <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1 h-12 rounded-2xl font-bold border-slate-200"
                  onClick={() => router.back()}
                >
                  ยกเลิก
                </Button>
                <Button 
                  type="submit" 
                  className="flex-[2] h-12 rounded-2xl font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังตรวจสอบ...
                    </>
                  ) : (
                    'สร้างสัญญาการจ้างงาน'
                  )}
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <ScrollText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">ตรวจสอบสัญญาการจ้างงาน</h2>
                  <p className="text-sm text-slate-500">คุณสามารถแก้ไขข้อความในสัญญาให้ถูกต้องก่อนส่งให้ลูกความ</p>
                </div>
              </div>
              <Button variant="ghost" className="text-slate-500" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-2" /> กลับไปแก้ไขข้อมูล
              </Button>
            </div>

            <Card className="shadow-lg border-blue-100 rounded-3xl overflow-hidden mb-8">
              <CardContent className="p-0">
                <Textarea 
                  value={contractText}
                  onChange={(e) => setContractText(e.target.value)}
                  className="min-h-[600px] border-none focus-visible:ring-0 p-8 font-mono text-sm leading-relaxed bg-white"
                />
              </CardContent>
            </Card>

            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 mb-8">
              <div className="flex gap-4 items-start">
                <div className="p-2 bg-blue-100 rounded-xl text-blue-600 mt-1">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-blue-900">เมื่อกดยืนยันส่งสัญญา:</h4>
                  <ul className="text-sm text-blue-800/80 mt-1 space-y-1 list-disc list-inside">
                    <li>ระบบจะแปลงเนื้อหานี้เป็นไฟล์ PDF ที่เป็นสากล</li>
                    <li>ส่ง PDF ไปทางอีเมลและแชทของลูกความโดยอัตโนมัติ</li>
                    <li>สร้างใบแจ้งหนี้ (Invoice) ตามงวดเงินที่ระบุ และส่งให้ลูกความพร้อมกัน</li>
                    <li>แจ้งเตือนให้คุณทราบทันทีเมื่อลูกความชำระเงินเข้ามา</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto">
              <Button 
                variant="outline" 
                className="flex-1 h-12 rounded-2xl font-bold"
                onClick={() => setStep(1)}
              >
                แก้ไขข้อมูลใหม่
              </Button>
              <Button 
                className="flex-[2] h-12 rounded-2xl font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
                onClick={handleConfirmContract}
                disabled={isFinalizing}
              >
                {isFinalizing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังส่ง PDF & ใบแจ้งหนี้...
                  </>
                ) : (
                  'ยืนยันส่งสัญญาและใบแจ้งหนี้'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
