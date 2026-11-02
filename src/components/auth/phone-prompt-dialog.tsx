'use client';

import * as React from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useTranslations } from 'next-intl';
import { Loader2, Phone } from 'lucide-react';
import { useFirebase, useUser } from '@/firebase';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatPhoneNumber } from '@/lib/utils';

// กด "ไว้ทีหลัง" แล้วไม่ถามซ้ำจนกว่าจะปิดแท็บ — เปิดเว็บรอบหน้าถามใหม่จนกว่าจะกรอก
const SKIP_KEY = 'lawslane_phone_prompt_skipped';
// บันทึกเบอร์สำเร็จแล้วไม่ถามอีกในเบราว์เซอร์นี้ — กันเด้งซ้ำตอนเปลี่ยนหน้าแม้อ่านเอกสารได้ค่าไม่ตรง
const SAVED_KEY_PREFIX = 'lawslane_phone_saved:';

function hasSavedLocally(uid: string) {
    try {
        return localStorage.getItem(SAVED_KEY_PREFIX + uid) === '1';
    } catch {
        return false;
    }
}

function markSavedLocally(uid: string) {
    try {
        localStorage.setItem(SAVED_KEY_PREFIX + uid, '1');
    } catch {
        // localStorage ใช้ไม่ได้ — พึ่งเอกสาร users อย่างเดียว
    }
}

/**
 * ลูกค้าที่เข้าสู่ระบบด้วย Google / LINE ไม่ได้ผ่านฟอร์มที่มีช่องเบอร์โทร —
 * ถ้า users/{uid} ยังไม่มี phone ให้เด้งถามแล้วบันทึกลง Firestore (หลังบ้าน /customers อ่านฟิลด์นี้)
 *
 * เข้าด้วยปุ่ม Google ในหน้า "เข้าสู่ระบบ" ครั้งแรกจะยังไม่มีเอกสาร users (มีแค่ปุ่มในหน้าสมัครที่สร้าง)
 * จึงสร้างโปรไฟล์ลูกค้าให้ครบตอนบันทึกเบอร์ — ฟิลด์เดียวกับ signup-content
 */
export function PhonePromptDialog() {
    const t = useTranslations('PhonePrompt');
    const { firestore } = useFirebase();
    const { user } = useUser();
    const { toast } = useToast();

    const [open, setOpen] = React.useState(false);
    const [hasProfile, setHasProfile] = React.useState(true);
    const [phone, setPhone] = React.useState('');
    const [error, setError] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        if (!user || !firestore) {
            setOpen(false);
            return;
        }
        if (hasSavedLocally(user.uid)) return;
        try {
            if (sessionStorage.getItem(SKIP_KEY) === user.uid) return;
        } catch {
            // sessionStorage ใช้ไม่ได้ (โหมดส่วนตัวบางเบราว์เซอร์) — ถามตามปกติ
        }

        let cancelled = false;
        (async () => {
            try {
                // แอดมิน / ทนาย ไม่ใช่ลูกค้า — เอกสาร users ของบัญชีพวกนี้อาจยังไม่มีหรือไม่มี role
                // (เช่นบัญชีแอดมินที่มีโปรไฟล์ทนายซ่อน) จึงต้องเช็กจาก claims / lawyerProfiles ด้วย
                const { claims } = await user.getIdTokenResult();
                if (cancelled || claims.admin === true || claims.role === 'admin') return;

                const [snap, lawyerSnap] = await Promise.all([
                    getDoc(doc(firestore, 'users', user.uid)),
                    getDoc(doc(firestore, 'lawyerProfiles', user.uid)).catch(() => null),
                ]);
                if (cancelled || lawyerSnap?.exists()) return;
                const data = snap.exists() ? snap.data() : null;

                const isGoogle = user.providerData.some((p) => p.providerId === 'google.com');
                // LINE เข้าด้วย custom token → providerData ว่าง ดูจากเอกสาร users แทน (api/auth/line)
                const isLine = user.uid.startsWith('line_') || !!data?.lineUserId || data?.provider === 'line';
                const isCustomer = !data || !data.role || data.role === 'customer';

                if (String(data?.phone || '').trim()) {
                    markSavedLocally(user.uid);
                    return;
                }
                if ((isGoogle || isLine) && isCustomer) {
                    setHasProfile(!!data);
                    setOpen(true);
                }
            } catch (err) {
                console.error('PhonePrompt: failed to read profile', err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user, firestore]);

    const handleSkip = () => {
        try {
            if (user) sessionStorage.setItem(SKIP_KEY, user.uid);
        } catch {
            // ไม่เป็นไร — แค่ปิดไว้รอบนี้
        }
        setOpen(false);
    };

    const handleSave = async () => {
        if (!user || !firestore) return;
        const digits = phone.replace(/\D/g, '');
        if (!/^0\d{9}$/.test(digits)) {
            setError(t('invalid'));
            return;
        }

        setIsSaving(true);
        setError('');
        try {
            const userRef = doc(firestore, 'users', user.uid);
            const formatted = formatPhoneNumber(digits);
            // เอกสารอาจถูกสร้างระหว่างที่ป็อปอัปเปิดอยู่ (เช่นปุ่ม Google ในหน้าสมัคร) — เช็กใหม่ตอนบันทึก
            // ไม่งั้นสร้างทับเอกสารที่มีอยู่แล้ว rules จะปฏิเสธทั้งก้อน
            const exists = hasProfile || (await getDoc(userRef)).exists();
            if (exists) {
                await setDoc(userRef, { phone: formatted, updatedAt: serverTimestamp() }, { merge: true });
            } else {
                const name = (user.displayName || '').trim();
                await setDoc(userRef, {
                    uid: user.uid,
                    name,
                    nameLower: name.toLowerCase(),
                    email: user.email || '',
                    phone: formatted,
                    avatar: user.photoURL || '',
                    role: 'customer',
                    status: 'active',
                    registeredAt: serverTimestamp(),
                    createdAt: serverTimestamp(),
                    // ใต้ปุ่ม Google ในหน้าเข้าสู่ระบบมีข้อความยอมรับข้อกำหนด/นโยบาย (socialConsent)
                    termsAccepted: true,
                    termsAcceptedAt: serverTimestamp(),
                });
            }

            // อ่านกลับจากเซิร์ฟเวอร์เพื่อยืนยันว่าบันทึกจริง ไม่ใช่แค่ค้างในแคชฝั่ง client
            const saved = await getDoc(userRef);
            if (saved.data()?.phone !== formatted) {
                throw new Error('phone not persisted');
            }

            markSavedLocally(user.uid);
            toast({ title: t('savedTitle'), description: t('savedDesc') });
            setOpen(false);
        } catch (err) {
            console.error('PhonePrompt: failed to save phone', err);
            toast({ variant: 'destructive', title: t('failedTitle'), description: t('failedDesc') });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next && !isSaving) handleSkip(); }}>
            <DialogContent
                className="rounded-2xl border-none shadow-2xl sm:max-w-md"
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#0B3979] sm:mx-0">
                        <Phone className="h-6 w-6" />
                    </div>
                    <DialogTitle className="text-2xl font-black font-headline text-[#0B3979]">{t('title')}</DialogTitle>
                    <DialogDescription className="text-slate-500">{t('description')}</DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-2 py-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSave();
                    }}
                >
                    <Label htmlFor="prompt-phone" className="font-bold">{t('label')}</Label>
                    <Input
                        id="prompt-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder="081-234-5678"
                        value={phone}
                        onChange={(e) => {
                            setPhone(formatPhoneNumber(e.target.value));
                            if (error) setError('');
                        }}
                        disabled={isSaving}
                        className="h-12 rounded-xl bg-slate-50 border-slate-100 text-base"
                    />
                    {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                </form>
                <DialogFooter className="gap-3">
                    <Button variant="ghost" onClick={handleSkip} disabled={isSaving} className="rounded-xl font-bold">
                        {t('later')}
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-[#0B3979] hover:bg-slate-900 text-white rounded-xl font-bold px-6">
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
