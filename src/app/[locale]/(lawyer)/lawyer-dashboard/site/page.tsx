'use client';

import { Globe } from 'lucide-react';
import LawyerPageHeader from '@/components/lawyer/lawyer-page-header';
import LandingPageEditor from '@/components/lawyer/landing-page-editor';

export default function LawyerSitePage() {
    return (
        <div className="space-y-6">
            <LawyerPageHeader
                icon={Globe}
                title="หน้าเว็บส่วนตัว"
                description="สร้างหน้าแนะนำตัวที่ lawslane.com/p/ชื่อของคุณ ไว้แชร์ใน LINE, Facebook หรือนามบัตร"
            />
            <LandingPageEditor />
        </div>
    );
}
