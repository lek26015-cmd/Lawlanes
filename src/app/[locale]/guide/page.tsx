'use client';

import { useTranslations, useLocale } from 'next-intl';
import { 
  BookOpen, 
  ShieldCheck, 
  CreditCard, 
  MessageSquare, 
  UserPlus, 
  CheckCircle2, 
  Scale, 
  ChevronRight, 
  Building2, 
  FileText, 
  Bot,
  Search,
  Calendar,
  Lock,
  LayoutDashboard,
  Wallet,
  Milestone
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function UserGuidePage() {
  const t = useTranslations('Footer'); // Borrowing some translations if needed
  const h = useTranslations('Help');
  const locale = useLocale();

  const clientFeatures = [
    {
      title: "AI Advisor & LAlin",
      icon: <Bot className="h-6 w-6 text-blue-500" />,
      description: "ปรึกษากับ AI อัจฉริยะ (LAlin) เพื่อประเมินข้อกฎหมายเบื้องต้นได้ตลอด 24 ชม. ระบบจะช่วยวิเคราะห์ประเด็นและแนะนำประเภททนายที่เหมาะสมกับคดีของคุณ",
      steps: ["เข้าที่หน้า AI Advisor", "อธิบายเหตุการณ์หรืออัปโหลดรูปภาพแชท", "รับบทวิเคราะห์เบื้องต้นและคำแนะนำ"]
    },
    {
      title: "การค้นหาและจองนัดหมายทนาย",
      icon: <Search className="h-6 w-6 text-indigo-500" />,
      description: "เลือกทนายความที่เชี่ยวชาญจากทั่วประเทศ ตรวจสอบประวัติ รีวิว และเรตติ้ง เพื่อความมั่นใจก่อนตัดสินใจจองนัดเพื่อรับคำปรึกษาจริงแบบตัวต่อตัว",
      steps: ["กดเมนู 'ค้นหาทนาย'", "กรองความเชี่ยวชาญหรือพื้นที่", "เลือกทนายและกด 'จองนัดหมาย' ในเวลาที่สะดวก"]
    },
    {
      title: "Online Legal Case Room",
      icon: <LayoutDashboard className="h-6 w-6 text-emerald-500" />,
      description: "เมื่อเปิดเคส คุณจะเข้าสู่ห้องดำเนินการคดี ซึ่งเป็นพื้นที่ทำงานส่วนตัวระหว่างคุณและลูกความ สามารถติดตามความคืบหน้าของคดีผ่าน Visual Roadmap ได้ทันที",
      steps: ["เข้าสู่ 'แดชบอร์ดลูกความ'", "เลือกเคสที่ต้องการติดตาม", "ดูสถานะปัจจุบันและขั้นตอนถัดไปที่ต้องดำเนินการ"]
    },
    {
      title: "Legal Vault (คลังเอกสารปลอดภัย)",
      icon: <Lock className="h-6 w-6 text-red-500" />,
      description: "พื้นที่จัดเก็บเอกสารสำคัญสำหรับคดีความของคุณ โดยมีการเข้ารหัสความปลอดภัยระดับสูงสุด ทั้งทนายและลูกความสามารถอัปโหลดและแชร์พยานหลักฐานกันได้ในจุดเดียว",
      steps: ["เข้าสู่ Vault ในห้องเคส", "อัปโหลดเอกสารหลักฐาน", "เข้าถึงได้ทุกที่ทุกเวลาตลอดจนสิ้นสุดคดี"]
    },
    {
      title: "ระบบ Escrow & การเงิน",
      icon: <ShieldCheck className="h-6 w-6 text-amber-500" />,
      description: "มั่นใจได้ว่าเงินของคุณจะปลอดภัย ระบบ Escrow จะถือเงินมัดจำไว้จนกว่าการทำงานจะสำเร็จ และมีการตรวจสอบสลิปอัตโนมัติ (SlipOK) เพื่อความรวดเร็ว",
      steps: ["โอนเงินผ่านระบบ QR Code", "แนบสลิปเพื่อตรวจสอบอัตโนมัติ", "เงินจะถูกโอนให้ทนายเมื่อคุณกดยืนยันว่างานสำเร็จแล้วเท่านั้น"]
    }
  ];

  const lawyerFeatures = [
    {
      title: "Dashboard & Case Tracking",
      icon: <Milestone className="h-6 w-6 text-blue-600" />,
      description: "รับงานและจัดการเคสทั้งหมดได้อย่างเป็นระบบ ติดตามลูกความใหม่ๆ และดูภาพรวมการปรึกษาที่เกิดขึ้นในแต่ละวันผ่านหน้าแอนะล็อกกลาง",
      steps: ["จัดการคำขอปรึกษาใหม่", "อัปเกรดสถานะ Roadmap ให้ลูกความเห็น", "ปิดเคสเมื่อจบหน้างาน"]
    },
    {
      title: "Financials & Withdrawal",
      icon: <Wallet className="h-6 w-6 text-purple-600" />,
      description: "ตรวจสอบรายได้สะสม รายได้ที่ถอนได้ และประวัติการทำธุรกรรมทั้งหมด ระบบจะแสดงยอดเงินที่ผ่านการตรวจสอบสลิปจากลูกความแล้วอย่างรัดกุม",
      steps: ["ดูยอดเงินในกระเป๋า", "ระบุเลขบัญชีธนาคารเพื่อถอนเงิน", "รอการอนุมัติการโอนจากแอดมินกลาง"]
    },
    {
      title: "การจัดการโปรไฟล์เกียรติประวัติ",
      icon: <FileText className="h-6 w-6 text-gray-600" />,
      description: "อัปเดตความเชี่ยวชาญ วุฒิการศึกษา และเลขที่ใบอนุญาต เพื่อสร้างความน่าเชื่อถือให้กับลูกความที่กำลังมองหาที่ปรึกษามืออาชีพ",
      steps: ["แก้ไขประวัติย่อ (Bio)", "อัปโหลดใบอนุญาต", "ระบุพื้นที่ให้บริการและเรตราคาเริ่มต้น"]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-16 animate-in fade-in slide-in-from-top duration-700">
          <BookOpen className="h-14 w-14 text-indigo-600 mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
            คู่มือการใช้งาน Lawslane
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            ทุกสิ่งที่คุณจำเป็นต้องรู้เพื่อเริ่มต้นใช้งานแพลตฟอร์มกฎหมายยุคใหม่ 
            ไม่ว่าคุณจะเป็นลูกความที่ต้องการความช่วยเหลือ หรือทนายความมืออาชีพ
          </p>
        </div>

        {/* User Choice Tabs */}
        <Tabs defaultValue="client" className="w-full">
          <div className="flex justify-center mb-12">
            <TabsList className="grid w-full max-col grid-cols-2 bg-indigo-50 p-1 rounded-full shadow-inner max-w-md">
              <TabsTrigger 
                value="client" 
                className="rounded-full py-3 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md transition-all font-semibold"
              >
                สำหรับลูกความ (Client)
              </TabsTrigger>
              <TabsTrigger 
                value="lawyer"
                className="rounded-full py-3 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md transition-all font-semibold"
              >
                สำหรับทนายความ (Lawyer)
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="client" className="animate-in fade-in slide-in-from-bottom duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {clientFeatures.map((feature, idx) => (
                <Card key={idx} className="border-none shadow-xl hover:shadow-2xl transition-shadow group overflow-hidden bg-white/80 backdrop-blur-sm">
                  <div className="h-2 w-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardHeader>
                    <div className="p-3 w-fit rounded-2xl bg-slate-100 mb-4 group-hover:bg-indigo-50 transition-colors">
                      {feature.icon}
                    </div>
                    <CardTitle className="text-xl text-slate-900">{feature.title}</CardTitle>
                    <CardDescription className="text-slate-500 leading-relaxed pt-2">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {feature.steps.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-2 text-sm text-slate-700">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-1 flex-shrink-0" />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Call to action for Clients */}
            <div className="mt-16 bg-white rounded-3xl p-8 md:p-12 shadow-2xl border border-indigo-50 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="relative z-10 flex-1">
                <h3 className="text-3xl font-bold text-slate-900 mb-4">พร้อมเริ่มปรึกษาคดีหรือยัง?</h3>
                <p className="text-slate-600 text-lg mb-0 max-w-xl">
                  ไม่ว่าจะเป็นปัญหาเรื่องที่ดิน มรดก SME หรือคดีความทั่วไป ทนายความของเราพร้อมให้ความช่วยเหลืออย่างมืออาชีพ
                </p>
              </div>
              <div className="relative z-10 flex flex-col sm:flex-row gap-4">
                <a href={`/${locale}/lawyers`} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 flex items-center justify-center">
                  ค้นหาทนาย <ChevronRight className="ml-2 h-5 w-5" />
                </a>
              </div>
              {/* Background accent */}
              <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50" />
            </div>
          </TabsContent>

          <TabsContent value="lawyer" className="animate-in fade-in slide-in-from-bottom duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {lawyerFeatures.map((feature, idx) => (
                <Card key={idx} className="border-none shadow-xl hover:shadow-2xl transition-shadow group overflow-hidden bg-white/80 backdrop-blur-sm">
                  <div className="h-2 w-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardHeader>
                    <div className="p-3 w-fit rounded-2xl bg-slate-100 mb-4 group-hover:bg-blue-50 transition-colors">
                      {feature.icon}
                    </div>
                    <CardTitle className="text-xl text-slate-900">{feature.title}</CardTitle>
                    <CardDescription className="text-slate-500 leading-relaxed pt-2">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {feature.steps.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-2 text-sm text-slate-700">
                          <CheckCircle2 className="h-4 w-4 text-blue-500 mt-1 flex-shrink-0" />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Call to action for Lawyers */}
            <div className="mt-16 bg-slate-900 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
               <div className="relative z-10 flex-1">
                <h3 className="text-3xl font-bold text-white mb-4">ขยายฐานลูกความไปกับเรา</h3>
                <p className="text-slate-300 text-lg mb-0 max-w-xl">
                  ลงทะเบียนเป็นทนายความพาร์ทเนอร์เพื่อเข้าถึงลูกความที่ต้องการที่ปรึกษา และใช้เครื่องมือจัดการคดีที่ทันสมัยที่สุด
                </p>
              </div>
              <div className="relative z-10 flex flex-col sm:flex-row gap-4">
                <a href={`/${locale}/for-lawyers`} className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-bold hover:bg-slate-100 transition-all shadow-lg flex items-center justify-center">
                  ร่วมกับเรา <Building2 className="ml-2 h-5 w-5" />
                </a>
              </div>
              {/* Background accent */}
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-900 rounded-full blur-3xl opacity-30" />
            </div>
          </TabsContent>
        </Tabs>

        {/* FAQ Section */}
        <div className="mt-24 max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">คำถามที่พบบ่อย (FAQ)</h2>
            <p className="text-slate-500 mt-2">รวมคำแนะนำเบื้องต้นสำหรับตอบข้อสงสัยที่พบบ่อย</p>
          </div>
          
          <Accordion type="single" collapsible className="w-full space-y-4">
            <AccordionItem value="item-1" className="bg-white px-6 rounded-2xl shadow-sm border-none">
              <AccordionTrigger className="text-lg font-semibold py-6 hover:no-underline hover:text-indigo-600 transition-colors text-left">
                1. เงินที่ชำระผ่านระบบปลอดภัยแค่ไหน?
              </AccordionTrigger>
              <AccordionContent className="pb-6 text-slate-600 leading-relaxed text-base">
                Lawslane ใช้ระบบ Escrow ชนกันการเงิน โดยเงินจะอยู่ในการดูแลของแพลตฟอร์มคนกลาง และจะโอนให้ทนายความเมื่อลูกความกดยืนยันว่าได้รับคำปรึกษาหรือทำงานสำเร็จแล้วเท่านั้น หากมีปัญหาคุณสามารถแจ้ง 'ลูกความสัมพันธ์' เพื่อประสานงานได้ทันที
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-white px-6 rounded-2xl shadow-sm border-none">
              <AccordionTrigger className="text-lg font-semibold py-6 hover:no-underline hover:text-indigo-600 transition-colors text-left">
                2. AI Advisor ให้คำปรึกษาแทนทนายจริงได้หรือไม่?
              </AccordionTrigger>
              <AccordionContent className="pb-6 text-slate-600 leading-relaxed text-base">
                AI (LAlin) ออกแบบมาเพื่อเป็น "ผู้ช่วยด่านแรก" ในการวิเคราะห์ประเด็นกฎหมายจากเอกสารหรือข้อมูลที่คุณให้ เพื่อให้คุณเข้าใจสถานการณ์เบื้องต้น แต่ **ไม่ใช่คำปรึกษาทางกฎหมายอย่างเป็นทางการ** เราแนะนำให้คุณนัดหมายทนายความผู้เชี่ยวชาญจากระบบของเราเพื่อดำเนินการทางกฎหมายที่แม่นยำ
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-white px-6 rounded-2xl shadow-sm border-none">
              <AccordionTrigger className="text-lg font-semibold py-6 hover:no-underline hover:text-indigo-600 transition-colors text-left">
                3. หากต้องการถอนเงิน (สำหรับทนาย) ต้องทำอย่างไร?
              </AccordionTrigger>
              <AccordionContent className="pb-6 text-slate-600 leading-relaxed text-base">
                ทนายความสามารถแจ้งถอนเงินได้จากเมนู 'การเงิน' ในแดชบอร์ด โดยระบบจะตรวจสอบยอดเงินที่เป็นสถานะ Ready to Withdraw (เคสที่ปิดแล้ว) และแอดมินจะทำการโอนเงินเข้าบัญชีธนาคารที่คุณผูกไว้ภายใน 1-3 วันทำการ
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Support Section */}
        <div className="mt-24 text-center pb-12">
          <div className="inline-flex items-center justify-center p-2 rounded-full bg-indigo-50 text-indigo-700 font-medium text-sm mb-6 px-4">
            <MessageSquare className="h-4 w-4 mr-2" /> ต้องการความช่วยเหลือเพิ่มเติม?
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">ติดต่อทีมงานซัพพอร์ตลูกความ</h3>
          <p className="text-slate-600 mb-8 max-w-2xl mx-auto italic">
            ทีมงานของเราพร้อมให้บริการประสานงานและตอบคำถามการใช้งานระบบทาง Line Official: @Lawslane หรือทางหน้า Help Center ของเรา
          </p>
          <div className="flex justify-center gap-4">
             <a href={`/${locale}/help`} className="text-indigo-600 border border-indigo-600 px-6 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition-all">
              ไปยังศูนย์ช่วยเหลือ
             </a>
          </div>
        </div>
      </div>
    </div>
  );
}
