'use client'

import * as React from 'react'
import { useFirebase } from '@/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { CheckCircle2, ChevronRight, ChevronLeft, Users, Send } from 'lucide-react'

const SECTIONS = [
  { title: 'ข้อมูลทั่วไปของผู้ตอบ', questions: [1, 1.1, 2, 3] },
  { title: 'Pain Point & พฤติกรรมผู้ใช้', questions: [4, 5, 6, 7] },
  { title: 'ความเชื่อมั่น & การยอมรับ AI', questions: [8, 9, 10, 11] },
  { title: 'Solution Fit', questions: [12, 13, 14, 15] },
  { title: 'Revenue & การจ่ายเงิน', questions: [16, 17, 18, 19] },
  { title: 'แบรนด์ & การสื่อสาร', questions: [20, 21, 22, 23] },
  { title: 'Open-ended Questions', questions: [24, 25, 26, 27, 28] },
]

type Q = {
  id: number
  text: string
  type: 'radio' | 'checkbox' | 'text' | 'scale'
  options?: string[]
  scaleMin?: string
  scaleMax?: string
}

const QUESTIONS: Q[] = [
  { id: 1, text: 'ปัจจุบันคุณอยู่ในกลุ่มใดมากที่สุด', type: 'radio', options: ['รับราชการ','เจ้าของธุรกิจ / SME','Startup Founder','ฟรีแลนซ์','พนักงานบริษัท','นักศึกษา','อื่น ๆ'] },
  { id: 1.1, text: 'อายุเท่าไหร่', type: 'radio', options: ['20-25','26-30','31-35','36-40','41-45','46-50','50 ปีขึ้นไป'] },
  { id: 2, text: 'คุณเคยมีปัญหาหรือจำเป็นต้องใช้บริการด้านกฎหมายหรือไม่', type: 'radio', options: ['เคย','ไม่เคย','ไม่แน่ใจ'] },
  { id: 3, text: 'ปัญหาด้านกฎหมายที่คุณเคยพบหรือกังวลมากที่สุดคืออะไร', type: 'checkbox', options: ['สัญญา / เอกสาร','ปัญหาหนี้ / การเงิน','ปัญหาการทำงาน','ปัญหาครอบครัว','ปัญหาเช่าบ้าน / อสังหา','ถูกโกงออนไลน์ / Cyber Crime','การเริ่มธุรกิจ / จดบริษัท','คดีผู้บริโภค','อื่น ๆ'] },
  { id: 4, text: 'เวลาคุณมีปัญหาด้านกฎหมาย สิ่งที่ยากที่สุดคืออะไร', type: 'checkbox', options: ['ไม่รู้จะเริ่มต้นยังไง','อ่านกฎหมายไม่เข้าใจ','ค่าทนายแพง','ไม่รู้จะเชื่อใคร','กลัวโดนหลอก','ใช้เวลานาน','กลัวเรื่องจะใหญ่ขึ้น','ไม่มั่นใจว่าปัญหาตัวเองร้ายแรงไหม','อื่น ๆ'] },
  { id: 5, text: 'เวลามีปัญหากฎหมาย คุณมักทำอะไรเป็นอย่างแรก', type: 'radio', options: ['Search Google','ถามเพื่อน / คนรู้จัก','ปรึกษาทนายโดยตรง','ถามใน Facebook Group / Pantip','ใช้ ChatGPT / AI','ปล่อยผ่าน','อื่น ๆ'] },
  { id: 6, text: 'สิ่งที่ทำให้คุณ "หงุดหงิด" มากที่สุดจากวิธีที่ใช้อยู่ตอนนี้คืออะไร', type: 'checkbox', options: ['ข้อมูลเยอะเกินไป','ข้อมูลขัดแย้งกัน','ไม่รู้ว่าข้อมูลถูกไหม','หาทนายที่ไว้ใจยาก','ราคาไม่ชัดเจน','ใช้เวลานาน','คุยยาก / ภาษาเข้าใจยาก','อื่น ๆ'] },
  { id: 7, text: 'คุณรู้สึกเครียดกับปัญหากฎหมายมากแค่ไหน', type: 'scale', scaleMin: '1 = ไม่เครียดเลย', scaleMax: '5 = เครียดมาก' },
  { id: 8, text: 'อะไรทำให้คุณ "เชื่อถือ" แพลตฟอร์มกฎหมายออนไลน์', type: 'checkbox', options: ['มีทนายตัวจริงตรวจสอบ','มีรีวิวจากผู้ใช้จริง','ราคาชัดเจน','ภาษาที่เข้าใจง่าย','มีองค์กรหรือพาร์ทเนอร์น่าเชื่อถือ','ตอบเร็ว','ระบบดูปลอดภัย','อื่น ๆ'] },
  { id: 9, text: 'คุณเชื่อมั่นให้ AI ช่วยด้านกฎหมายหรือไม่', type: 'radio', options: ['เชื่อมั่น','ไม่เชื่อมั่น','ถ้ามีทนายตรวจสอบเพิ่มเติมจะโอเค'] },
  { id: 10, text: 'คุณโอเคให้ AI ช่วยเรื่องอะไรได้บ้าง', type: 'checkbox', options: ['อธิบายกฎหมายง่าย ๆ','แนะนำขั้นตอนเบื้องต้น','ช่วยหาทนายที่เหมาะสม','ช่วยร่างเอกสารเบื้องต้น','ตรวจสัญญาเบื้องต้น','ตอบคำถามทั่วไป','ไม่อยากใช้ AI เรื่องกฎหมายเลย'] },
  { id: 11, text: 'อะไรทำให้คุณ "ไม่กล้า" ใช้ AI ด้านกฎหมาย', type: 'checkbox', options: ['กลัวข้อมูลผิด','กลัวข้อมูลส่วนตัวรั่ว','เรื่องกฎหมายเป็นเรื่องละเอียดอ่อน','ยังเชื่อมนุษย์มากกว่า','ไม่เข้าใจ AI','อื่น ๆ'] },
  { id: 12, text: 'บริการไหนที่คุณคิดว่า "มีประโยชน์ที่สุด"', type: 'checkbox', options: ['AI ถาม–ตอบกฎหมาย','Match ทนาย','ตรวจสัญญา','ปรึกษาทนายออนไลน์','Template เอกสาร','ประเมินค่าใช้จ่ายคดี','คอนเทนต์ให้ความรู้กฎหมาย','อื่น ๆ'] },
  { id: 13, text: 'เวลามีปัญหา คุณอยากได้ความช่วยเหลืออะไร "เป็นอย่างแรก"', type: 'radio', options: ['รู้ว่าปัญหาร้ายแรงไหม','รู้ว่าควรทำอะไรต่อ','รู้ค่าใช้จ่าย','ได้คุยกับผู้เชี่ยวชาญ','เข้าใจสิทธิของตัวเอง','มีคนช่วยอธิบายง่าย ๆ','อื่น ๆ'] },
  { id: 14, text: 'คุณคาดหวังให้ระบบตอบกลับเร็วแค่ไหน', type: 'radio', options: ['ทันที','ภายใน 1 ชั่วโมง','ภายใน 1 วัน','ภายใน 3 วัน','ไม่รีบ'] },
  { id: 15, text: 'อะไรจะทำให้คุณเลือกใช้แพลตฟอร์มนี้ แทนการไปหาทนายตรง', type: 'checkbox', options: ['ราคาถูกกว่า','ใช้ง่ายกว่า','ตอบเร็วกว่า','เข้าใจง่ายกว่า','เปรียบเทียบทนายได้','มี AI ช่วยก่อน','ราคาโปร่งใส','อื่น ๆ'] },
  { id: 16, text: 'คุณยินดีจ่ายเงินเพื่อบริการกฎหมายออนไลน์หรือไม่', type: 'radio', options: ['ยินดี','ไม่ยินดี','แล้วแต่บริการ'] },
  { id: 17, text: 'รูปแบบการจ่ายเงินที่คุณโอเคมากที่สุดคือ', type: 'radio', options: ['จ่ายต่อครั้ง','จ่ายต่อคำถาม','สมัครสมาชิก','ฟรีก่อน แล้วจ่ายตอนคุยทนาย','จ่ายเมื่อจ้างทนายสำเร็จ','ไม่อยากจ่าย'] },
  { id: 18, text: 'ถ้าเป็นคำปรึกษาเบื้องต้นออนไลน์ คุณโอเคจ่ายประมาณเท่าไหร่', type: 'radio', options: ['ฟรีเท่านั้น','ต่ำกว่า 100 บาท','100–300 บาท','301–500 บาท','501–1,000 บาท','มากกว่า 1,000 บาท'] },
  { id: 19, text: 'อะไรทำให้คุณ "ยอมจ่ายแพงขึ้น"', type: 'checkbox', options: ['ทนายตรวจสอบจริง','ตอบเร็ว','ความเป็นส่วนตัว','มีเอกสารสรุป','Follow-up ต่อเนื่อง','มีชื่อเสียง / ความน่าเชื่อถือ'] },
  { id: 20, text: 'เมื่อพูดถึง "กฎหมาย" คุณรู้สึกว่าเป็นเรื่องแบบไหน', type: 'checkbox', options: ['น่ากลัว','ซับซ้อน','ราคาแพง','ทางการเกินไป','จำเป็น','ไกลตัว','น่าเชื่อถือ','อื่น ๆ'] },
  { id: 21, text: 'คุณอยากให้แบรนด์กฎหมายสื่อสารแบบไหน', type: 'radio', options: ['มืออาชีพจริงจัง','เป็นมิตร เข้าใจง่าย','ทันสมัย Tech-driven','อบอุ่น เข้าถึงง่าย','ตรงไปตรงมา'] },
  { id: 22, text: 'ประโยคไหนทำให้คุณสนใจมากที่สุด', type: 'radio', options: ['"เข้าใจกฎหมายได้ในไม่กี่นาที"','"หาทนายที่เหมาะกับคุณได้ง่ายขึ้น"','"เรื่องกฎหมายไม่ควรเป็นเรื่องยาก"','"AI + ผู้เชี่ยวชาญ ช่วยคุณตัดสินใจ"','"เริ่มต้นจัดการปัญหากฎหมายอย่างมั่นใจ"'] },
  { id: 23, text: 'อะไรทำให้คุณ "จำแบรนด์" และอยากแนะนำต่อ', type: 'checkbox', options: ['ใช้ง่าย','ดูน่าเชื่อถือ','ราคาเข้าถึงได้','ดีไซน์ดี','ภาษาง่าย','รีวิวดี','ตอบเร็ว','มีคนใช้จริงเยอะ'] },
  { id: 24, text: 'เล่าประสบการณ์ปัญหาด้านกฎหมายที่คุณเคยเจอหรือกังวล', type: 'text' },
  { id: 25, text: 'ช่วงไหนที่คุณรู้สึก "ลำบากที่สุด" กับปัญหานั้น', type: 'text' },
  { id: 26, text: 'ตอนนั้นคุณอยากให้มีบริการหรือความช่วยเหลือแบบไหน', type: 'text' },
  { id: 27, text: 'อะไรจะทำให้คุณรู้สึก "ปลอดภัย" ในการใช้แพลตฟอร์มกฎหมายออนไลน์', type: 'text' },
  { id: 28, text: 'ถ้ามีแพลตฟอร์มกฎหมายออนไลน์แบบนี้ คุณอยากให้มีอะไรเพิ่มเติมอีกบ้าง', type: 'text' },
]

export default function SurveyPublicPage() {
  const { firestore } = useFirebase()
  const [currentSection, setCurrentSection] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<string, string | string[]>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

  const section = SECTIONS[currentSection]
  const questions = section.questions.map(id => QUESTIONS.find(q => q.id === id)!)

  const key = (id: number) => String(id)

  const setRadio = (qId: number, val: string) => {
    setAnswers(prev => ({ ...prev, [key(qId)]: val }))
  }

  const toggleCheckbox = (qId: number, val: string) => {
    setAnswers(prev => {
      const k = key(qId)
      const curr = (prev[k] as string[]) || []
      return { ...prev, [k]: curr.includes(val) ? curr.filter(v => v !== val) : [...curr, val] }
    })
  }

  const setText = (qId: number, val: string) => {
    setAnswers(prev => ({ ...prev, [key(qId)]: val }))
  }

  const canGoNext = () => {
    return questions.every(q => {
      const a = answers[key(q.id)]
      if (q.type === 'text') return true
      if (q.type === 'radio' || q.type === 'scale') return !!a
      if (q.type === 'checkbox') return Array.isArray(a) && a.length > 0
      return true
    })
  }

  const handleSubmit = async () => {
    if (!firestore) return
    setSubmitting(true)
    try {
      await addDoc(collection(firestore, 'survey_public_responses'), {
        answers,
        createdAt: serverTimestamp(),
      })
      setSubmitted(true)
    } catch (e) {
      console.error('Submit error:', e)
    } finally {
      setSubmitting(false)
    }
  }

  const next = () => {
    if (currentSection < SECTIONS.length - 1) setCurrentSection(s => s + 1)
    else handleSubmit()
  }

  const prev = () => { if (currentSection > 0) setCurrentSection(s => s - 1) }

  const progress = ((currentSection + 1) / SECTIONS.length) * 100

  const formatQLabel = (id: number) => {
    if (id === 1.1) return '1.1'
    return String(id)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-lg w-full text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">ขอบคุณที่ร่วมตอบแบบสอบถาม!</h2>
          <p className="text-slate-500">ข้อมูลของคุณจะช่วยให้เราพัฒนาแพลตฟอร์มที่ตอบโจทย์ประชาชนมากยิ่งขึ้น</p>
          <a href="/" className="inline-flex items-center gap-2 bg-[#0B3979] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#082a5a] transition-colors">
            กลับหน้าหลัก
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0B3979] to-[#1a5276] text-white py-10 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-teal-400/15 blur-[80px] rounded-full" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-emerald-400/10 blur-[80px] rounded-full" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Users className="h-8 w-8 text-emerald-200" />
            <h1 className="text-2xl md:text-3xl font-bold">แบบสอบถามสำหรับบุคคลทั่วไป</h1>
          </div>
          <p className="text-blue-200 max-w-xl mx-auto text-sm">ช่วยให้เราเข้าใจความต้องการของคุณ เพื่อสร้างแพลตฟอร์มกฎหมายที่ทุกคนเข้าถึงได้</p>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-2xl -mt-6 relative z-10">
        {/* Progress */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6">
          <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
            <span>Section {currentSection + 1} / {SECTIONS.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#0B3979] to-teal-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Section Card */}
        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 space-y-8">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-3 py-1 rounded-full">Section {currentSection + 1}</span>
            <h2 className="text-xl font-bold text-slate-800 mt-3">{section.title}</h2>
          </div>

          {questions.map((q) => (
            <div key={q.id} className="space-y-3">
              <p className="font-semibold text-slate-700">
                <span className="text-teal-600 mr-2">{formatQLabel(q.id)}.</span>{q.text}
              </p>

              {q.type === 'radio' && q.options?.map(opt => (
                <label key={opt} onClick={() => setRadio(q.id, opt)} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${answers[key(q.id)] === opt ? 'border-teal-500 bg-teal-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${answers[key(q.id)] === opt ? 'border-teal-500' : 'border-slate-300'}`}>
                    {answers[key(q.id)] === opt && <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />}
                  </div>
                  <span className="text-sm text-slate-700">{opt}</span>
                </label>
              ))}

              {q.type === 'checkbox' && q.options?.map(opt => {
                const checked = ((answers[key(q.id)] as string[]) || []).includes(opt)
                return (
                  <label key={opt} onClick={() => toggleCheckbox(q.id, opt)} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'border-teal-500 bg-teal-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'border-teal-500 bg-teal-500' : 'border-slate-300'}`}>
                      {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-sm text-slate-700">{opt}</span>
                  </label>
                )
              })}

              {q.type === 'scale' && (
                <div className="space-y-3">
                  <div className="flex justify-between text-xs text-slate-400 px-1">
                    <span>{q.scaleMin}</span>
                    <span>{q.scaleMax}</span>
                  </div>
                  <div className="flex gap-3">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setRadio(q.id, String(n))}
                        className={`flex-1 py-4 rounded-xl border-2 text-lg font-bold transition-all ${answers[key(q.id)] === String(n) ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md scale-105' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {q.type === 'text' && (
                <textarea
                  className="w-full border border-slate-200 rounded-xl p-4 text-sm text-slate-700 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none transition-all resize-none min-h-[100px] bg-slate-50 focus:bg-white"
                  placeholder="พิมพ์คำตอบของคุณที่นี่..."
                  value={(answers[key(q.id)] as string) || ''}
                  onChange={e => setText(q.id, e.target.value)}
                />
              )}
            </div>
          ))}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            <button
              onClick={prev}
              disabled={currentSection === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="h-4 w-4" /> ก่อนหน้า
            </button>

            <button
              onClick={next}
              disabled={!canGoNext() || submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0B3979] hover:bg-[#082a5a] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
              {submitting ? 'กำลังส่ง...' : currentSection === SECTIONS.length - 1 ? (
                <><Send className="h-4 w-4" /> ส่งแบบสอบถาม</>
              ) : (
                <>ถัดไป <ChevronRight className="h-4 w-4" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
