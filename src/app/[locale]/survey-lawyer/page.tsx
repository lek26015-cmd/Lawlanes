'use client'

import * as React from 'react'
import { useFirebase } from '@/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { CheckCircle2, ChevronRight, ChevronLeft, Scale, Send } from 'lucide-react'

const SECTIONS = [
  { title: 'ข้อมูลทั่วไปของผู้ตอบ', questions: [1, 2, 3, 4] },
  { title: 'Pain Point & พฤติกรรมผู้ใช้', questions: [5, 6, 7] },
  { title: 'ความเชื่อมั่น & การยอมรับ AI', questions: [8, 9, 10] },
  { title: 'Solution Fit', questions: [11, 12] },
  { title: 'Revenue & การจ่ายเงิน', questions: [13, 14, 15] },
  { title: 'แบรนด์ & การสื่อสาร', questions: [16, 17] },
  { title: 'Open-ended Questions', questions: [18, 19, 20, 21, 22] },
]

type Q = { id: number; text: string; type: 'radio' | 'checkbox' | 'text'; options?: string[]; stopIf?: string }

const QUESTIONS: Q[] = [
  { id: 1, text: 'ปัจจุบันคุณอยู่ในกลุ่มใดมากที่สุด', type: 'radio', options: ['ทนายความฟรีแลนซ์','ทนายความบริษัท','ทนายความในสำนักงานกฎหมาย','ทนายความพาร์ทไทม์ (ทำอาชีพอื่นไปด้วย)','ทนายความใหม่','อื่น ๆ'] },
  { id: 2, text: 'อายุเท่าไหร่', type: 'radio', options: ['20-25','26-30','31-35','36-40','41-45','46-50','50 ปีขึ้นไป'] },
  { id: 3, text: 'คุณเคยใช้ หรือคิดจะใช้ AI มาช่วยงานด้านกฎหมายของคุณหรือไม่', type: 'radio', options: ['เคย','ไม่เคย'], stopIf: 'ไม่เคย' },
  { id: 4, text: 'คุณมักใช้ AI เพื่อแก้ปัญหาอะไร', type: 'checkbox', options: ['ทำสัญญา','จัดการเอกสาร','หาฎีกา','หาบทบัญญัติ หรือมาตรามาปรับใช้กับคดี','อื่น ๆ'] },
  { id: 5, text: 'คุณมีปัญหาในการใช้ AI ไหม', type: 'checkbox', options: ['ไม่มี','ไม่รู้จะเริ่มต้นคำสั่งยังไง','AI ไม่เข้าใจกฎหมาย','ไม่รู้จะเชื่อได้ไหม','อื่น ๆ'] },
  { id: 6, text: 'เวลามีปัญหากฎหมาย คุณมักหาข้อมูลจากอะไรเป็นอย่างแรก', type: 'radio', options: ['Search Google','ปรึกษาทนายความท่านอื่นโดยตรง','ใช้ ChatGPT / AI','เปิดหนังสือ','อื่น ๆ'] },
  { id: 7, text: 'สิ่งที่ทำให้คุณ "หงุดหงิด" มากที่สุดจากวิธีที่ใช้อยู่ตอนนี้คืออะไร', type: 'checkbox', options: ['ข้อมูลแต่ละที่ไม่เหมือนกัน','ข้อมูลขัดแย้งกัน','ไม่รู้ว่าข้อมูลถูกไหม','หาทนายที่ไว้ใจยาก','คุยยาก','อื่น ๆ'] },
  { id: 8, text: 'อะไรทำให้คุณ "เชื่อถือ" AI', type: 'checkbox', options: ['มีผู้ใช้งานเยอะ','มีรีวิวจากผู้ใช้จริง','ภาษาที่เข้าใจง่าย','มีองค์กรหรือพาร์ทเนอร์น่าเชื่อถือ','ตอบเร็ว','อื่น ๆ'] },
  { id: 9, text: 'คุณให้ AI ช่วยเรื่องอะไรได้บ้าง', type: 'checkbox', options: ['ช่วยอธิบายกฎหมาย','แนะนำขั้นตอนที่เหมาะสม','ช่วยหากฎหมายที่เหมาะสม','ช่วยร่างเอกสารเบื้องต้น','ตรวจสอบเอกสารเบื้องต้น','อื่น ๆ'] },
  { id: 10, text: 'อะไรทำให้คุณ "ไม่เชื่อถือ" ใช้ AI ด้านกฎหมาย', type: 'checkbox', options: ['กลัวข้อมูลผิด','กลัวข้อมูลรั่ว','เรื่องกฎหมายเป็นเรื่องละเอียดอ่อน','ยังเชื่อมนุษย์มากกว่า','ไม่เข้าใจ AI','อื่น ๆ'] },
  { id: 11, text: 'บริการไหนที่คุณคิดว่า "มีประโยชน์ที่สุด"', type: 'checkbox', options: ['AI ถาม–ตอบกฎหมาย','Match ทนาย','ตรวจสัญญา','ปรึกษาทนายความผ่านแพลตฟอร์ม','Template เอกสาร','ประเมินค่าใช้จ่ายคดี','คอนเทนต์ให้ความรู้กฎหมาย','อื่น ๆ'] },
  { id: 12, text: 'อะไรจะทำให้คุณเลือกเข้ามาเป็นทนายความในแพลตฟอร์มนี้', type: 'checkbox', options: ['เก็บค่าบริการแพลตฟอร์มถูกกว่า','ใช้ง่ายกว่า','มี AI ช่วย','อื่น ๆ'] },
  { id: 13, text: 'คุณยินดีจ่ายเงินเพื่อบริการ AI กฎหมายไทยหรือไม่', type: 'radio', options: ['ยินดี','ไม่ยินดี','แล้วแต่บริการ'] },
  { id: 14, text: 'หากคุณได้ลูกความจากแพลตฟอร์มนี้คุณยินดีจะถูกหักค่าบริการแพลตฟอร์มหรือไม่', type: 'radio', options: ['ยินดี','ไม่ยินดี'] },
  { id: 15, text: 'ถ้ามีลูกความมาปรึกษากับคุณ คุณจะคิดค่าปรึกษาประมาณเท่าไหร่', type: 'radio', options: ['ฟรีเท่านั้น','ต่ำกว่า 100 บาท','100–300 บาท','301–500 บาท','501–1,000 บาท','มากกว่า 1,000 บาท'] },
  { id: 16, text: 'คุณอยากให้แบรนด์กฎหมายสื่อสารแบบไหน', type: 'radio', options: ['มืออาชีพจริงจัง','เป็นมิตร เข้าใจง่าย','ทันสมัย Tech-driven','อบอุ่น เข้าถึงง่าย','ตรงไปตรงมา'] },
  { id: 17, text: 'อะไรทำให้คุณ "จำแบรนด์" และอยากแนะนำต่อ', type: 'checkbox', options: ['ใช้ง่าย','ดูน่าเชื่อถือ','ราคาเข้าถึงได้','ดีไซน์ดี','ภาษาง่าย','รีวิวดี','มีคนใช้จริงเยอะ'] },
  { id: 18, text: 'อะไรทำให้คุณ เชิญชวนทนายความด้วยกันมาสมัครบริการบนแพลตฟอร์ม', type: 'text' },
  { id: 19, text: 'อะไรทำให้คุณ เชิญชวนลูกความของคุณมาใช้บริการบนแพลตฟอร์ม', type: 'text' },
  { id: 20, text: 'ตอนนั้นคุณอยากให้มีบริการหรือความช่วยเหลือแบบไหน', type: 'text' },
  { id: 21, text: 'อะไรจะทำให้คุณรู้สึก "ปลอดภัย" ในการใช้แพลตฟอร์มกฎหมายออนไลน์', type: 'text' },
  { id: 22, text: 'ถ้ามีแพลตฟอร์มกฎหมายออนไลน์แบบนี้ คุณอยากให้มีอะไรเพิ่มเติมอีกบ้าง', type: 'text' },
]

export default function SurveyLawyerPage() {
  const { firestore } = useFirebase()
  const [currentSection, setCurrentSection] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<number, string | string[]>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [stopped, setStopped] = React.useState(false)

  const section = SECTIONS[currentSection]
  const questions = section.questions.map(id => QUESTIONS.find(q => q.id === id)!)

  const setRadio = (qId: number, val: string) => {
    setAnswers(prev => ({ ...prev, [qId]: val }))
    const q = QUESTIONS.find(x => x.id === qId)
    if (q?.stopIf && val === q.stopIf) setStopped(true)
    else if (q?.stopIf) setStopped(false)
  }

  const toggleCheckbox = (qId: number, val: string) => {
    setAnswers(prev => {
      const curr = (prev[qId] as string[]) || []
      return { ...prev, [qId]: curr.includes(val) ? curr.filter(v => v !== val) : [...curr, val] }
    })
  }

  const setText = (qId: number, val: string) => {
    setAnswers(prev => ({ ...prev, [qId]: val }))
  }

  const canGoNext = () => {
    if (stopped) return true
    return questions.every(q => {
      const a = answers[q.id]
      if (q.type === 'text') return true
      if (q.type === 'radio') return !!a
      if (q.type === 'checkbox') return Array.isArray(a) && a.length > 0
      return true
    })
  }

  const handleSubmit = async () => {
    if (!firestore) return
    setSubmitting(true)
    try {
      await addDoc(collection(firestore, 'survey_lawyer_responses'), {
        answers,
        stoppedEarly: stopped,
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
    if (stopped) { handleSubmit(); return }
    if (currentSection < SECTIONS.length - 1) setCurrentSection(s => s + 1)
    else handleSubmit()
  }

  const prev = () => { if (currentSection > 0) setCurrentSection(s => s - 1) }

  const progress = ((currentSection + 1) / SECTIONS.length) * 100

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-lg w-full text-center space-y-6 animate-fade-in">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">ขอบคุณที่ร่วมตอบแบบสอบถาม!</h2>
          <p className="text-slate-500">ข้อมูลของคุณจะช่วยให้เราพัฒนาแพลตฟอร์มให้ตอบโจทย์ทนายความมากยิ่งขึ้น</p>
          <a href="/" className="inline-flex items-center gap-2 bg-[#0B3979] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#082a5a] transition-colors">
            กลับหน้าหลัก
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pb-20">
      {/* Header */}
      <div className="bg-[#0B3979] text-white py-10 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-blue-500/20 blur-[80px] rounded-full" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-cyan-500/15 blur-[80px] rounded-full" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Scale className="h-8 w-8 text-blue-200" />
            <h1 className="text-2xl md:text-3xl font-bold">แบบสอบถามสำหรับทนายความ</h1>
          </div>
          <p className="text-blue-200 max-w-xl mx-auto text-sm">ช่วยให้เราเข้าใจความต้องการของทนายความ เพื่อพัฒนาแพลตฟอร์มที่ตอบโจทย์ที่สุด</p>
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
            <div className="h-full bg-gradient-to-r from-[#0B3979] to-blue-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Section Card */}
        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 space-y-8">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">Section {currentSection + 1}</span>
            <h2 className="text-xl font-bold text-slate-800 mt-3">{section.title}</h2>
          </div>

          {questions.map((q, qi) => {
            // Hide questions after stop
            if (stopped && q.id > 3) return null

            return (
              <div key={q.id} className="space-y-3">
                <p className="font-semibold text-slate-700">
                  <span className="text-blue-500 mr-2">{q.id}.</span>{q.text}
                  {q.stopIf && <span className="text-xs text-slate-400 ml-2">(ถ้าตอบ &quot;{q.stopIf}&quot; สามารถหยุดได้)</span>}
                </p>

                {q.type === 'radio' && q.options?.map(opt => (
                  <label key={opt} onClick={() => setRadio(q.id, opt)} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${answers[q.id] === opt ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${answers[q.id] === opt ? 'border-blue-500' : 'border-slate-300'}`}>
                      {answers[q.id] === opt && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                    </div>
                    <span className="text-sm text-slate-700">{opt}</span>
                  </label>
                ))}

                {q.type === 'checkbox' && q.options?.map(opt => {
                  const checked = ((answers[q.id] as string[]) || []).includes(opt)
                  return (
                    <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                        {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span className="text-sm text-slate-700">{opt}</span>
                      <input type="checkbox" className="hidden" checked={checked} onChange={() => toggleCheckbox(q.id, opt)} />
                    </label>
                  )
                })}

                {q.type === 'text' && (
                  <textarea
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none min-h-[100px] bg-slate-50 focus:bg-white"
                    placeholder="พิมพ์คำตอบของคุณที่นี่..."
                    value={(answers[q.id] as string) || ''}
                    onChange={e => setText(q.id, e.target.value)}
                  />
                )}
              </div>
            )
          })}

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
              {submitting ? 'กำลังส่ง...' : stopped || currentSection === SECTIONS.length - 1 ? (
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
