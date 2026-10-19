import { cn } from '@/lib/utils';

/**
 * พื้นหลังคลื่นผ้าไหมโทนกรมท่า/ฟ้า สำหรับ hero พื้นเข้ม
 * วางเป็นลูกคนแรกของ section ที่เป็น `relative overflow-hidden` แล้วให้เนื้อหาอยู่ `relative z-10`
 * ใช้ CSS blur กับ SVG ทั้งก้อน (ลื่นกว่า feGaussianBlur บนมือถือ) และขยายเกินกรอบไว้ซ่อนขอบที่เบลอ
 */
export function SilkBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <svg
        className="absolute -left-[10%] -top-[10%] h-[120%] w-[120%] blur-2xl md:blur-3xl"
        viewBox="0 0 1440 800"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="silk-a" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1e3a8a" />
            <stop offset="0.55" stopColor="#0369a1" />
            <stop offset="1" stopColor="#1e40af" />
          </linearGradient>
          <linearGradient id="silk-b" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#0c4a6e" />
            <stop offset="1" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <path d="M0 360 C 260 220 480 500 800 360 S 1240 180 1440 300 L1440 0 L0 0Z" fill="#002f4b" opacity="0.7" />
        <path d="M0 560 C 280 400 560 640 880 480 S 1260 320 1440 420 L1440 800 L0 800Z" fill="url(#silk-a)" opacity="0.65" />
        <path d="M0 690 C 340 580 660 770 1000 600 S 1320 560 1440 620 L1440 800 L0 800Z" fill="url(#silk-b)" opacity="0.5" />
        <path d="M620 440 C 820 380 1020 470 1240 380" stroke="#7dd3fc" strokeWidth="40" fill="none" opacity="0.2" />
      </svg>
    </div>
  );
}
