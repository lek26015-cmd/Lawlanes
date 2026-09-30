import { ArrowLeft } from 'lucide-react';
import { Link } from '@/navigation';
import { checkLawyerFeature } from '@/lib/lawyer-plan-access';
import { LawyerProLocked } from '@/components/lawyer/lawyer-pro-locked';

// ขึ้นกับสิทธิ์ของแพลน (aiAssistant) — แอดมินปรับได้ ดู lib/lawyer-entitlements
// หน้านี้เต็มจอ (LawyerShell ไม่ใส่ sidebar) หน้าล็อกจึงต้องมีทางกลับแดชบอร์ดเอง
export const dynamic = 'force-dynamic';

export default async function Layout({ children }: { children: React.ReactNode }) {
    const access = await checkLawyerFeature('aiAssistant');
    if (access.status === 'ok') return <>{children}</>;
    return (
        <div className="h-dvh overflow-y-auto bg-slate-50 dark:bg-background p-4 md:p-8">
            <Link href="/lawyer-dashboard" className="inline-flex items-center gap-1.5 mb-6 text-sm font-medium text-slate-500 hover:text-slate-900">
                <ArrowLeft className="w-4 h-4" />กลับแดชบอร์ด
            </Link>
            <div className="max-w-2xl mx-auto">
                <LawyerProLocked status={access.status} feature="ผู้ช่วย AI งานคดี" />
            </div>
        </div>
    );
}
