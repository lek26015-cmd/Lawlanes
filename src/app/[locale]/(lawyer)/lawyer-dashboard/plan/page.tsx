'use client';

import { Suspense } from 'react';
import { Crown } from 'lucide-react';
import LawyerPageHeader from '@/components/lawyer/lawyer-page-header';
import { ProviderPlanPanel } from '@/components/plans/provider-plan-panel';

export default function LawyerPlanPage() {
    return (
        <>
            <LawyerPageHeader
                icon={Crown}
                title="แพลนสมาชิก"
                description="อัปเกรดเพื่อติดป้ายทนายแนะนำและขึ้นอันดับต้นในรายชื่อทนาย"
            />
            <Suspense fallback={null}>
                <ProviderPlanPanel kind="lawyer" />
            </Suspense>
        </>
    );
}
