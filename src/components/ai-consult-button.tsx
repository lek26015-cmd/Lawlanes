'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';

export default function AiConsultButton() {
    const router = useRouter();
    const t = useTranslations('HomePage.aiAnalysis');

    return (
        <Button
            size="lg"
            variant="outline"
            className="bg-transparent text-white border-white hover:bg-white/10 hover:text-white text-lg"
            onClick={() => router.push('/ai')}
        >
            {t('consultButton')}
        </Button>
    );
}
