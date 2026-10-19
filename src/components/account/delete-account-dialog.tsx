'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { signOut } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import {
    AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { DELETE_CONFIRM_PHRASE } from '@/lib/account-deletion';
import { checkAccountDeletionAction, deleteMyAccountAction } from '@/app/actions/account-deletion-actions';

type Check = { canDelete: boolean; needsReauth: boolean; blockers: string[] };

/** ปุ่ม + หน้าต่างลบบัญชี: ตรวจงานค้าง → ต้องล็อกอินใหม่ภายใน 15 นาที → พิมพ์คำยืนยัน → ลบ */
export function DeleteAccountDialog() {
    const t = useTranslations('Account');
    const locale = useLocale();
    const { auth } = useFirebase();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [check, setCheck] = useState<Check | null>(null);
    const [phrase, setPhrase] = useState('');
    const [deleting, setDeleting] = useState(false);

    const onOpenChange = async (next: boolean) => {
        setOpen(next);
        setPhrase('');
        if (!next) return;
        setCheck(null);
        try {
            setCheck(await checkAccountDeletionAction());
        } catch {
            setCheck({ canDelete: false, needsReauth: false, blockers: [t('deleteCheckFailed')] });
        }
    };

    const signOutAndGo = async (href: string) => {
        try { await fetch('/api/auth/session', { method: 'DELETE' }); } catch { /* ignore */ }
        if (auth) await signOut(auth).catch(() => undefined);
        window.location.href = href;
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await deleteMyAccountAction(phrase);
            if (res.ok) {
                toast({ title: t('deleteDone') });
                await signOutAndGo(`/${locale}`);
                return;
            }
            if (res.reason === 'reauth') setCheck((c) => (c ? { ...c, needsReauth: true } : c));
            else if (res.reason === 'blocked') setCheck({ canDelete: false, needsReauth: false, blockers: res.blockers || [] });
            else toast({ variant: 'destructive', title: t('deleteFailed') });
        } finally {
            setDeleting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" className="rounded-full">{t('deleteMyAccount')}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('deleteConfirmTitle')}</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <p>{t('deleteConfirmSubtitle')}</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>{t('deleteWhatRemoved')}</li>
                                <li>{t('deleteWhatKept')}</li>
                            </ul>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {!check ? (
                    <div className="flex justify-center py-4"><Loader2 className="animate-spin" /></div>
                ) : check.blockers.length > 0 ? (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 space-y-1">
                        <p className="font-semibold">{t('deleteBlockedTitle')}</p>
                        <ul className="list-disc pl-5">{check.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
                    </div>
                ) : check.needsReauth ? (
                    <div className="rounded-xl bg-slate-50 border p-4 text-sm space-y-3">
                        <p>{t('deleteReauth')}</p>
                        <Button variant="outline" className="rounded-full" onClick={() => signOutAndGo(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/account`)}`)}>
                            {t('deleteReauthButton')}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <label htmlFor="delete-phrase" className="text-sm font-medium">
                            {t('deleteTypeToConfirm', { phrase: DELETE_CONFIRM_PHRASE })}
                        </label>
                        <Input id="delete-phrase" value={phrase} autoComplete="off" onChange={(e) => setPhrase(e.target.value)} />
                    </div>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>{t('cancel')}</AlertDialogCancel>
                    {check?.canDelete && !check.needsReauth && (
                        <Button
                            variant="destructive"
                            disabled={deleting || phrase.trim() !== DELETE_CONFIRM_PHRASE}
                            onClick={handleDelete}
                        >
                            {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {t('confirmDelete')}
                        </Button>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
