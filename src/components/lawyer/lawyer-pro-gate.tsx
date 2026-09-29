import 'server-only';

import { checkLawyerFeature } from '@/lib/lawyer-plan-access';
import { LAWYER_FEATURE_LABEL, type LawyerFeature } from '@/lib/lawyer-entitlements';
import { LawyerProLocked } from '@/components/lawyer/lawyer-pro-locked';

/**
 * ใช้ใน layout.tsx ของหน้าที่ขึ้นกับสิทธิ์ของแพลน — เช็คที่ server ก่อน render จึงไม่มีจังหวะที่ข้อมูลโผล่
 * ด่านของข้อมูลจริงอยู่ที่ server action แต่ละตัว (requireLawyerFeature / checkLawyerFeature)
 */
export default async function LawyerProGate({ feature, children }: { feature: LawyerFeature; children: React.ReactNode }) {
    const access = await checkLawyerFeature(feature);
    if (access.status === 'ok') return <>{children}</>;
    return <LawyerProLocked status={access.status} feature={LAWYER_FEATURE_LABEL[feature]} />;
}
