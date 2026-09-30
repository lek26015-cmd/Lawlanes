'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useFirebase, useUser } from '@/firebase';
import { lawyerTier } from '@/lib/provider-plans';
import { customerGrantPlan } from '@/lib/customer-ai-plan';
import type { UserPlan } from '@/lib/plan-display';

/**
 * แพลนของผู้ใช้ที่ล็อกอินอยู่ ใช้แสดงวงสี/ป้ายรอบรูปโปรไฟล์ (แสดงผลเท่านั้น — สิทธิ์จริงเช็คที่ server)
 * มีโปรไฟล์ทนาย = แพลนทนาย ไม่งั้น = แพ็กเกจลูกค้า users.planGrants.lawslane — แบบเดียวกับ header
 */
export function useMyPlan(): UserPlan {
    const { firestore } = useFirebase();
    const { user } = useUser();
    const [plan, setPlan] = useState<UserPlan>('free');

    useEffect(() => {
        if (!user || !firestore) { setPlan('free'); return; }
        let cancelled = false;
        (async () => {
            try {
                const lawyerSnap = await getDoc(doc(firestore, 'lawyerProfiles', user.uid));
                if (lawyerSnap.exists()) {
                    if (!cancelled) setPlan(lawyerTier(lawyerSnap.data()));
                    return;
                }
                const userSnap = await getDoc(doc(firestore, 'users', user.uid));
                if (!cancelled) setPlan(customerGrantPlan(userSnap.get('planGrants')?.lawslane));
            } catch {
                if (!cancelled) setPlan('free');
            }
        })();
        return () => { cancelled = true; };
    }, [user, firestore]);

    return plan;
}
