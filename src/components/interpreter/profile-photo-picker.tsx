'use client';

/**
 * เลือกรูปโปรไฟล์ล่าม — อัปโหลดขึ้น storage สาธารณะ (profile-images) แล้วคืน URL
 * server action ฝั่งบันทึกโปรไฟล์รับเฉพาะ URL จาก host ของเรา (safeImageUrl)
 */

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { uploadToFirebasePublic } from '@/app/actions/upload';
import profileImg from '@/pic/profile-lawyer.jpg';

const MAX_MB = 5;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

export function ProfilePhotoPicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
    const t = useTranslations('ForInterpreters');
    const { toast } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        if (!ACCEPT.includes(file.type)) return toast({ variant: 'destructive', title: t('photoTypeError') });
        if (file.size > MAX_MB * 1024 * 1024) return toast({ variant: 'destructive', title: t('photoSizeError', { mb: MAX_MB }) });
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            onChange(await uploadToFirebasePublic(fd, 'profile-images'));
        } catch {
            toast({ variant: 'destructive', title: t('photoUploadError') });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex items-center gap-5">
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="relative h-24 w-24 flex-shrink-0 rounded-full overflow-hidden border-4 border-white shadow-md bg-slate-100 group"
                aria-label={t('profilePhoto')}
                disabled={uploading}
            >
                <Image src={value || profileImg} alt="" fill sizes="96px" className="object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                </span>
                {uploading && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </span>
                )}
            </button>
            <div className="space-y-1">
                <p className="font-medium text-sm">{t('profilePhoto')}</p>
                <p className="text-xs text-muted-foreground">{t('photoHint', { mb: MAX_MB })}</p>
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
                    <Camera className="w-4 h-4 mr-2" /> {value ? t('changePhoto') : t('choosePhoto')}
                </Button>
            </div>
            <input
                ref={inputRef}
                type="file"
                accept={ACCEPT.join(',')}
                className="sr-only"
                onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
            />
        </div>
    );
}
