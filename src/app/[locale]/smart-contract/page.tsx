import { SmartContractGenerator } from '@/components/forms/smart-contract-generator';

export default function SmartContractPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-6xl mx-auto mb-8 text-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">สร้างสัญญาอัจฉริยะ (Smart Contract)</h1>
        <p className="text-slate-600">กรอกข้อมูลเบื้องต้นเพื่อสร้างร่างสัญญาและนำไปให้ทนายความผู้เชี่ยวชาญตรวจสอบ</p>
      </div>
      <SmartContractGenerator />
    </div>
  );
}
