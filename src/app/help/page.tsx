
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { HelpCircle } from "lucide-react"

export default function HelpPage() {

  const faqs = [
    {
      question: "ผู้ช่วย AI ด้านกฎหมายทำงานอย่างไร?",
      answer: "ผู้ช่วย AI ของเราได้รับการฝึกฝนให้วิเคราะห์ปัญหาทางกฎหมายเบื้องต้นจากข้อมูลที่คุณให้มา เพื่อประเมินสถานการณ์และแนะนำประเภทของทนายความที่มีความเชี่ยวชาญตรงกับปัญหาของคุณ อย่างไรก็ตาม คำแนะนำจาก AI เป็นเพียงการประเมินเบื้องต้นและไม่สามารถใช้แทนคำปรึกษาจากทนายความมืออาชีพได้"
    },
    {
      question: "ทนายความบนแพลตฟอร์ม Lawlane ได้รับการตรวจสอบหรือไม่?",
      answer: "ใช่ครับ ทนายความทุกคนที่เข้าร่วมกับเราจะต้องผ่านกระบวนการตรวจสอบคุณสมบัติอย่างเข้มงวด ทั้งใบอนุญาตว่าความ ประวัติการทำงาน และความเชี่ยวชาญเฉพาะทาง เพื่อให้คุณมั่นใจได้ว่าจะได้รับบริการจากผู้เชี่ยวชาญตัวจริง"
    },
    {
      question: "ขั้นตอนการจ้างทนายความผ่าน Lawlane เป็นอย่างไร?",
      answer: "คุณสามารถเริ่มต้นได้จากการใช้ AI วิเคราะห์ปัญหา, ค้นหาทนายความจากรายชื่อ, หรือนัดหมายเพื่อพูดคุยโดยตรง เมื่อคุณเลือกทนายที่ต้องการได้แล้ว คุณสามารถเปิดเคสและชำระเงินผ่านระบบ Escrow ของเราเพื่อเริ่มการทำงานได้ทันที"
    },
    {
      question: "ข้อมูลของฉันจะถูกเก็บเป็นความลับหรือไม่?",
      answer: "แน่นอนครับ เราให้ความสำคัญกับความเป็นส่วนตัวและความลับของลูกค้าสูงสุด ข้อมูลและการสนทนาทั้งหมดของคุณกับทนายความบนแพลตฟอร์มของเราจะถูกเข้ารหัสและเก็บรักษาเป็นความลับตามมาตรฐานสูงสุด คุณสามารถอ่านรายละเอียดเพิ่มเติมได้ในนโยบายความเป็นส่วนตัวของเรา"
    },
    {
      question: "ระบบชำระเงินแบบ Escrow คืออะไรและทำงานอย่างไร?",
      answer: "Escrow คือระบบที่ Lawlane ทำหน้าที่เป็นคนกลางในการถือเงินค่าบริการไว้ เงินของคุณจะยังคงปลอดภัยกับเรา และจะถูกโอนให้กับทนายความก็ต่อเมื่อคุณได้กดยืนยันว่างานเสร็จสิ้นและพึงพอใจกับบริการแล้วเท่านั้น วิธีนี้ช่วยสร้างความมั่นใจให้กับทั้งสองฝ่าย"
    },
    {
      question: "หากมีปัญหากับทนายความควรทำอย่างไร?",
      answer: "หากคุณพบปัญหาหรือมีความไม่พอใจในการบริการ คุณสามารถใช้ปุ่ม 'รายงานปัญหา' ในหน้าแชทของเคสนั้นๆ เพื่อติดต่อทีมงานสนับสนุนลูกค้าของเราได้ทันที เราจะรีบเข้ามาตรวจสอบและให้ความช่วยเหลือโดยเร็วที่สุด"
    }
  ];


  return (
    <div className="bg-white">
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <HelpCircle className="mx-auto h-12 w-12 text-foreground mb-4" />
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl font-headline text-foreground">
              ศูนย์ช่วยเหลือ (FAQ)
            </h1>
            <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
              คำถามที่พบบ่อยเกี่ยวกับการใช้งาน Lawlane
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
               <AccordionItem key={index} value={`item-${index + 1}`}>
                <AccordionTrigger className="text-lg font-semibold text-left hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  )
}
