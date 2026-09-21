'use client';

import * as React from 'react';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Link } from '@/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import Image from 'next/image';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCcw } from 'lucide-react';
import Logo from '@/components/logo';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TurnstileWidget } from '@/components/turnstile-widget';
import { validateTurnstile } from '@/app/actions/turnstile';
import { setupTestAccounts } from '@/app/actions/seed-actions';
import { useTranslations } from 'next-intl';

// schema ต้องสร้างในคอมโพเนนต์เพราะข้อความ error ต้องแปลตาม locale
const buildFormSchema = (t: (key: string) => string) => z.object({
    email: z.string().email({ message: t('validation.emailInvalid') }),
    password: z.string().min(1, { message: t('validation.passwordRequired') }),
});

function LoginPageContent() {
    const t = useTranslations('LoginPage');
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get('redirect') || searchParams.get('redirectTo');
    const { auth, firestore } = useFirebase();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isLineLoading, setIsLineLoading] = useState(false);

    const [turnstileToken, setTurnstileToken] = useState<string>('');
    const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    // Flag to prevent double-execution in StrictMode
    const hasAttemptedLineAutoLogin = React.useRef(false);

    React.useEffect(() => {
        const hasLiffState = searchParams.has('liff.state');
        const hasCode = searchParams.has('code');
        
        if ((hasLiffState || hasCode) && !hasAttemptedLineAutoLogin.current) {
            // alert("[DEBUG] Redirect detected (liff.state or code). Triggering handleLineSignIn...");
            hasAttemptedLineAutoLogin.current = true;
            handleLineSignIn();
        }
    }, [searchParams]);

    const handleForgotPassword = async () => {
        if (!resetEmail) {
            toast({
                variant: 'destructive',
                title: t('validation.emailRequired'),
                description: t('reset.missingEmail'),
            });
            return;
        }

        setIsResetting(true);
        try {
            import('@/app/actions/auth').then(({ sendCustomPasswordResetEmailV2 }) => {
                sendCustomPasswordResetEmailV2(resetEmail).then((res) => {
                    if (res.success) {
                        toast({
                            title: t('reset.sentTitle'),
                            description: t('reset.sentDesc'),
                        });
                        setIsForgotPasswordOpen(false);
                        setResetEmail('');
                    } else {
                        toast({
                            variant: 'destructive',
                            title: t('error.generic'),
                            description: res.error || t('error.sendFailed'),
                        });
                    }
                });
            });
        } catch (error: any) {
            console.error(error);
            let errorMessage = t('reset.failedTitle');
            if (error.code === 'auth/user-not-found') {
                errorMessage = t('reset.notFound');
            }
            toast({
                variant: 'destructive',
                title: t('error.generic'),
                description: errorMessage,
            });
        } finally {
            setIsResetting(false);
        }
    };

    const formSchema = React.useMemo(() => buildFormSchema(t), [t]);
    const form = useForm<z.infer<ReturnType<typeof buildFormSchema>>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    async function onSubmit(values: z.infer<ReturnType<typeof buildFormSchema>>) {
        if (!auth || !firestore) return;
        setIsLoading(true);
        try {
            if (!turnstileToken) {
                throw new Error(t('error.turnstileRequired'));
            }

            const validation = await validateTurnstile(turnstileToken);
            if (!validation.success) {
                throw new Error(t('error.turnstileFailed'));
            }

            const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
            const user = userCredential.user;

            const idToken = await user.getIdToken();
            const sessionRes = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken, redirect: redirectUrl }),
            });

            if (!sessionRes.ok) {
                const errorData = await sessionRes.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || `Session creation failed with status: ${sessionRes.status}`);
            }

            const { suggestedRedirect } = await sessionRes.json();

            if (suggestedRedirect.startsWith('http')) {
                window.location.href = suggestedRedirect;
            } else {
                router.push(suggestedRedirect);
            }
        } catch (error: any) {
            console.error(error);
            let errorMessage = t('error.unknown');
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessage = t('error.badCredentials');
            } else if (error.message) {
                errorMessage = error.message;
            }
            toast({
                variant: 'destructive',
                title: t('error.loginFailed'),
                description: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    }

    async function handleGoogleSignIn() {
        if (!auth || !firestore) {
            toast({
                variant: 'destructive',
                title: t('error.generic'),
                description: t('error.authUnavailable'),
            });
            return;
        }
        setIsGoogleLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });

            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            const idToken = await user.getIdToken();
            const sessionRes = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken, redirect: redirectUrl }),
            });

            if (!sessionRes.ok) {
                const errorData = await sessionRes.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || `Google session sync failed (Status: ${sessionRes.status})`);
            }

            const { suggestedRedirect } = await sessionRes.json();

            toast({
                title: t('google.successTitle'),
                description: t('google.redirecting'),
            });

            if (suggestedRedirect.startsWith('http')) {
                window.location.href = suggestedRedirect;
            } else {
                router.push(suggestedRedirect);
            }

        } catch (error: any) {
            console.error("Google Sign-In Error:", error);
            let errorMessage = t('google.errorTitle');

            if (error.code === 'auth/popup-blocked') {
                errorMessage = t('google.popupBlocked');
            } else if (error.code === 'auth/popup-closed-by-user') {
                errorMessage = t('google.popupClosed');
            } else if (error.code === 'auth/cancelled-popup-request') {
                errorMessage = t('google.popupCancelled');
            } else if (error.code === 'auth/unauthorized-domain') {
                errorMessage = t('google.unauthorizedDomain');
            } else if (error.message) {
                errorMessage = `${errorMessage}: ${error.message}`;
            }

            toast({
                variant: 'destructive',
                title: t('google.failedTitle'),
                description: errorMessage,
            });
        } finally {
            setIsGoogleLoading(false);
        }
    }

    async function handleLineSignIn() {
        setIsLineLoading(true);
        try {
            const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
            
            if (liffId) {
                // Mobile debugging: alert the LIFF ID to ensure Vercel updated correctly
                if (typeof window !== 'undefined') {
                   // Mobile debugging removed
                }

                // Ensure LIFF is imported properly
                const liff = (await import('@line/liff')).default;

                try {
                    await liff.init({ liffId });
                } catch (initErr: any) {
                    console.error("LIFF Init Error:", initErr);
                    let errMsg = initErr.message || '';
                    if (errMsg.includes('fetch') || errMsg.includes('Load failed')) {
                        throw new Error(`${t('line.blocked')} (${errMsg})`);
                    }
                    throw new Error(`LIFF Init Failed: ${errMsg}`);
                }

                const loggedIn = liff.isLoggedIn();
                
                if (!loggedIn) {
                    const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                    const redirectUri = window.location.origin + window.location.pathname;
                    
                    if (isMobile) {
                        liff.login({ redirectUri });
                    } else {
                        liff.login({ redirectUri });
                    }
                    return; 
                }

                // Already logged in via LIFF
                const accessToken = liff.getAccessToken();
                const idToken = liff.getIDToken();

                if (!accessToken) {
                    throw new Error('No LINE access token');
                }

                let lineRes;
                try {
                    lineRes = await fetch('/api/auth/line', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ accessToken, idToken }),
                    });
                } catch (fetchErr: any) {
                    console.error("Fetch to /api/auth/line failed totally:", fetchErr);
                    throw new Error(`${t('line.fetchFailed')}: ${fetchErr.message}`);
                }

                if (!lineRes.ok) {
                    const errorResponse = await lineRes.json().catch(() => ({}));
                    throw new Error(errorResponse.error || `LINE authentication failed with status: ${lineRes.status}`);
                }

                const lineContentType = lineRes.headers.get('content-type');
                if (!lineContentType || !lineContentType.includes('application/json')) {
                    throw new Error('Unexpected response from authentication server');
                }

                const { customToken } = await lineRes.json();

                if (auth) {
                    const { signInWithCustomToken } = await import('firebase/auth');
                    let userCredential;
                    try {
                        userCredential = await signInWithCustomToken(auth, customToken);
                    } catch (fbErr: any) {
                        alert("Firebase Auth Error: " + fbErr.message);
                        throw new Error(`${t('line.authFailed')}: ${fbErr.message}`);
                    }

                    // Create server-side session
                    try {
                        const firebaseIdToken = await userCredential.user.getIdToken();
                        const sessionRes = await fetch('/api/auth/session', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ idToken: firebaseIdToken, redirect: redirectUrl }),
                        });
                        
                        if (!sessionRes.ok) {
                            const errorData = await sessionRes.json().catch(() => ({}));
                            alert("Session Error: " + (errorData.error || errorData.message || sessionRes.status));
                            throw new Error(errorData.error || errorData.message || `${t('line.sessionFailed')} (Status: ${sessionRes.status})`);
                        }

                        const { suggestedRedirect } = await sessionRes.json();

                        toast({
                            title: t('line.successTitle'),
                            description: t('google.redirecting'),
                        });

                        // Ensure we redirect to the correct locale if possible, 
                        // or just use suggestedRedirect which will be handled by middleware.
                        // Hard reload is safer in incognito mode.
                        setTimeout(() => {
                            window.location.href = suggestedRedirect;
                        }, 800);
                    } catch (sessionErr: any) {
                        console.error("Session creation error:", sessionErr);
                        throw new Error(`${t('line.serverError')}: ${sessionErr.message}`);
                    }
                }
            } else {
                // No LIFF ID configured
                throw new Error(t('line.notConfigured'));
            }
        } catch (error: any) {
            console.error('LINE Sign-In Error:', error);
            toast({
                variant: 'destructive',
                title: t('line.failedTitle'),
                description: error.message || t('error.tryAgain'),
            });
        } finally {
            setIsLineLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4 lg:p-8">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 bg-white rounded-2xl overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.08)] border border-slate-100"
            >
                {/* Left Column: Visual Branding */}
                <div className="relative hidden lg:flex flex-col bg-[#0B3979] text-white p-12 overflow-hidden">
                    {/* Portal Indicator Badge */}
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                        className="absolute top-8 right-8 z-20 px-6 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-xl"
                    >
                        <span className="text-xl font-black font-headline tracking-wider text-blue-300">
                            {t('hero.badge')}
                        </span>
                    </motion.div>

                    {/* Background Image */}
                    <div className="absolute inset-0 z-0">
                        <Image 
                            src="/images/login-lawslane-2.jpeg" 
                            alt="Lawslane Background" 
                            fill
                            className="object-cover object-center opacity-90"
                            sizes="50vw"
                            priority
                        />
                        {/* Overlay Gradient for Text Legibility */}
                        <div className="absolute inset-0 bg-gradient-to-b from-[#0B3979]/60 via-[#0B3979]/20 to-[#0B3979]/80" />
                    </div>

                    {/* Decorative Background Glows */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl -mr-32 -mt-32 z-1" />
                    
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center gap-3">
                            <Logo href="/" variant="color" className="brightness-0 invert h-10 w-auto" />
                        </div>
                        
                        <div className="flex-1" />

                        <div className="space-y-4 pb-12">
                            <motion.h1 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="text-4xl font-black font-headline leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                            >
                                {t('hero.title')}<br />
                                <span className="text-blue-300">{t('hero.subtitle')}</span>
                            </motion.h1>
                            <motion.p 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.1 }}
                                className="text-blue-50 text-lg leading-relaxed max-w-sm drop-shadow-lg font-medium"
                            >
                                {t('hero.description')}
                            </motion.p>
                        </div>
                        
                        <div className="pt-8 border-t border-white/10 text-sm text-blue-100/50 drop-shadow-md">
                            © {new Date().getFullYear()} Lawslane. Trusted by legal professionals.
                        </div>
                    </div>
                </div>

                {/* Right Column: Form */}
                <div className="p-8 lg:p-14 flex flex-col justify-center bg-white">
                    <div className="max-w-[400px] mx-auto w-full space-y-8">
                        <div className="lg:hidden flex justify-center mb-8">
                            <Logo href="/" variant="color" />
                        </div>

                        <div className="space-y-2 text-center lg:text-left">
                            <h2 className="text-3xl font-black font-headline text-slate-900">
                                {t('form.title')}
                            </h2>
                            <p className="text-slate-500">
                                {t('form.welcome')}
                            </p>
                        </div>

                        <Tabs defaultValue="customer" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-100 rounded-xl p-1 mb-8">
                                <TabsTrigger value="customer" asChild className="h-full rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#0B3979] data-[state=active]:shadow-sm font-bold transition-all">
                                    <Link href={`/login`}>{t('form.tabClient')}</Link>
                                </TabsTrigger>
                                <TabsTrigger value="lawyer" asChild className="h-full rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#0B3979] data-[state=active]:shadow-sm font-bold transition-all">
                                    <Link href={`/lawyer-login`}>{t('form.tabLawyer')}</Link>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" className="h-12 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-bold transition-all shadow-sm" onClick={handleGoogleSignIn} disabled={isGoogleLoading || isLoading}>
                                {isGoogleLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-[#0B3979]" />
                                ) : (
                                    <>
                                        <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                            <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512S0 403.3 0 261.8 106.5 11.8 244 11.8c67.7 0 130.4 27.2 175.2 73.4l-72.2 67.7C324.9 123.7 286.8 102 244 102c-88.6 0-160.2 72.3-160.2 161.8s71.6 161.8 160.2 161.8c94.9 0 133-66.3 137.4-101.4H244V261.8h244z"></path>
                                        </svg>
                                        Google
                                    </>
                                )}
                            </Button>

                            <Button variant="outline" className="h-12 rounded-xl border-[#06C755]/20 text-[#06C755] hover:bg-[#06C755]/10 font-bold transition-all shadow-sm" onClick={handleLineSignIn} disabled={isLineLoading || isLoading || isGoogleLoading}>
                                {isLineLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                                        </svg>
                                        LINE
                                    </>
                                )}
                            </Button>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-slate-100" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase tracking-widest text-slate-400">
                                <span className="bg-white px-4">{t('form.orEmail')}</span>
                            </div>
                        </div>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <FormLabel className="text-sm font-bold text-slate-700">{t('form.email')}</FormLabel>
                                            <FormControl>
                                                <Input placeholder="name@example.com" {...field} disabled={isLoading || isGoogleLoading} className="h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <FormLabel className="text-sm font-bold text-slate-700">{t('form.password')}</FormLabel>
                                                <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="link" className="p-0 h-auto font-bold text-xs text-slate-400 hover:text-[#0B3979]">
                                                            {t('form.forgotPassword')}
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="rounded-2xl border-none shadow-2xl">
                                                        <DialogHeader>
                                                            <DialogTitle className="text-2xl font-black font-headline text-[#0B3979]">{t('reset.title')}</DialogTitle>
                                                            <DialogDescription className="text-slate-500">
                                                                {t('reset.description')}
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <div className="py-4">
                                                            <div className="space-y-2">
                                                                <Label htmlFor="reset-email" className="font-bold">{t('reset.emailLabel')}</Label>
                                                                <Input
                                                                    id="reset-email"
                                                                    placeholder="name@example.com"
                                                                    value={resetEmail}
                                                                    onChange={(e) => setResetEmail(e.target.value)}
                                                                    className="h-12 rounded-xl bg-slate-50 border-slate-100"
                                                                />
                                                            </div>
                                                        </div>
                                                        <DialogFooter className="gap-3">
                                                            <Button variant="ghost" onClick={() => setIsForgotPasswordOpen(false)} disabled={isResetting} className="rounded-xl font-bold">{t('reset.cancel')}</Button>
                                                            <Button onClick={handleForgotPassword} disabled={isResetting} className="bg-[#0B3979] hover:bg-slate-900 text-white rounded-xl font-bold px-6">
                                                                {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                                {t('reset.submit')}
                              </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                            <FormControl>
                                                <Input type="password" placeholder="********" {...field} disabled={isLoading || isGoogleLoading} className="h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                
                                <div className="pt-2">
                                    <TurnstileWidget onVerify={setTurnstileToken} />
                                </div>

                                <Button type="submit" className="w-full h-14 rounded-xl text-lg font-black bg-[#0B3979] hover:bg-slate-900 shadow-xl shadow-blue-900/10 transition-all active:scale-[0.98] border-none text-white" disabled={isLoading || isGoogleLoading}>
                                    {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                                    {t('form.submit')}
                                </Button>
                            </form>
                        </Form>

                        <div className="text-center pt-4 space-y-4">
                            <p className="text-slate-500 text-sm">
                                {t('form.noAccount')}{' '}
                                <Link href="/signup" className="text-[#0B3979] font-black hover:underline decoration-2 underline-offset-4">
                                    {t('form.signupHere')}
                                </Link>
                            </p>

                            {/* Dev Helper Action Button */}
                            {process.env.NODE_ENV !== 'production' && (
                                <div className="pt-8 border-t border-slate-100">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-[10px] text-slate-400 font-bold uppercase transition-all hover:text-blue-600 hover:bg-blue-50"
                                        onClick={async () => {
                                            const res = await setupTestAccounts();
                                            if (res.success) {
                                                toast({ title: 'Initialize Success', description: 'บัญชีทดสอบใน Firebase Auth/Firestore พร้อมใช้งานแล้ว!' });
                                            } else {
                                                toast({ variant: 'destructive', title: 'Initialize Failed', description: res.error });
                                            }
                                        }}
                                    >
                                        <RefreshCcw className="mr-2 h-3 w-3" />
                                        Initialize Dev Accounts
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export function LoginContent() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F4F6F9]"><Loader2 className="animate-spin text-primary" /></div>}>
            <LoginPageContent />
        </Suspense>
    );
}
