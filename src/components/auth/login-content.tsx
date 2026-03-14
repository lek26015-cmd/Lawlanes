'use client';

import * as React from 'react';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';

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
import { Loader2 } from 'lucide-react';
import Logo from '@/components/logo';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TurnstileWidget } from '@/components/turnstile-widget';
import { validateTurnstile } from '@/app/actions/turnstile';

const formSchema = z.object({
    email: z.string().email({ message: 'รูปแบบอีเมลไม่ถูกต้อง' }),
    password: z.string().min(1, { message: 'กรุณากรอกรหัสผ่าน' }),
});

function LoginPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get('redirect');
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
        if (searchParams.has('liff.state') && !hasAttemptedLineAutoLogin.current) {
            hasAttemptedLineAutoLogin.current = true;
            handleLineSignIn();
        }
    }, [searchParams]);

    const handleForgotPassword = async () => {
        if (!resetEmail) {
            toast({
                variant: 'destructive',
                title: 'กรุณากรอกอีเมล',
                description: 'โปรดระบุอีเมลที่ต้องการรีเซ็ตรหัสผ่าน',
            });
            return;
        }

        setIsResetting(true);
        try {
            import('@/app/actions/auth').then(({ sendCustomPasswordResetEmailV2 }) => {
                sendCustomPasswordResetEmailV2(resetEmail).then((res) => {
                    if (res.success) {
                        toast({
                            title: 'ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว',
                            description: 'กรุณาตรวจสอบกล่องจดหมายของคุณ และอย่าลืมเช็คในโฟลเดอร์ขยะ (Spam/Junk) หากไม่พบอีเมล',
                        });
                        setIsForgotPasswordOpen(false);
                        setResetEmail('');
                    } else {
                        toast({
                            variant: 'destructive',
                            title: 'เกิดข้อผิดพลาด',
                            description: res.error || 'ไม่สามารถส่งอีเมลได้',
                        });
                    }
                });
            });
        } catch (error: any) {
            console.error(error);
            let errorMessage = 'ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้';
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'ไม่พบอีเมลนี้ในระบบ';
            }
            toast({
                variant: 'destructive',
                title: 'เกิดข้อผิดพลาด',
                description: errorMessage,
            });
        } finally {
            setIsResetting(false);
        }
    };

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!auth || !firestore) return;
        setIsLoading(true);
        try {
            if (!turnstileToken) {
                throw new Error('กรุณายืนยันตัวตนผ่าน Cloudflare Turnstile');
            }

            const validation = await validateTurnstile(turnstileToken);
            if (!validation.success) {
                throw new Error('การยืนยันตัวตนล้มเหลว กรุณาลองใหม่');
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
                const errorData = await sessionRes.json().catch(() => ({ message: 'Session creation failed' }));
                throw new Error(errorData.message || 'ไม่สามารถสร้างเซสชันได้');
            }

            const { suggestedRedirect } = await sessionRes.json();

            if (suggestedRedirect.startsWith('http')) {
                window.location.href = suggestedRedirect;
            } else {
                router.push(suggestedRedirect);
            }
        } catch (error: any) {
            console.error(error);
            let errorMessage = 'เกิดข้อผิดพลาดที่ไม่รู้จัก';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessage = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
            } else if (error.message) {
                errorMessage = error.message;
            }
            toast({
                variant: 'destructive',
                title: 'เข้าสู่ระบบไม่สำเร็จ',
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
                title: 'เกิดข้อผิดพลาด',
                description: 'ไม่สามารถเชื่อมต่อกับระบบยืนยันตัวตนได้ กรุณารีเฟรชหน้าจอ',
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
                const errorData = await sessionRes.json().catch(() => ({ message: 'Google session sync failed' }));
                throw new Error(errorData.message || 'ไม่สามารถซิงค์เซสชัน Google ได้');
            }

            const { suggestedRedirect } = await sessionRes.json();

            toast({
                title: 'เข้าสู่ระบบด้วย Google สำเร็จ',
                description: 'กำลังนำคุณไปยังแดชบอร์ด...',
            });

            if (suggestedRedirect.startsWith('http')) {
                window.location.href = suggestedRedirect;
            } else {
                router.push(suggestedRedirect);
            }

        } catch (error: any) {
            console.error("Google Sign-In Error:", error);
            let errorMessage = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google';

            if (error.code === 'auth/popup-blocked') {
                errorMessage = 'เบราว์เซอร์ของคุณบล็อกป๊อปอัป กรุณาอนุญาตให้แสดงป๊อปอัปสำหรับเว็บไซต์นี้';
            } else if (error.code === 'auth/popup-closed-by-user') {
                errorMessage = 'คุณปิดหน้าต่างป๊อปอัปก่อนการเข้าสู่ระบบจะเสร็จสมบูรณ์';
            } else if (error.code === 'auth/cancelled-popup-request') {
                errorMessage = 'มีการร้องขอป๊อปอัปซ้อนกัน กรุณาลองใหม่อีกครั้ง';
            } else if (error.code === 'auth/unauthorized-domain') {
                errorMessage = 'โดเมนนี้ยังไม่ได้รับอนุญาตให้ใช้ Google Sign-In (กรุณาแจ้งผู้ดูแลระบบ)';
            } else if (error.message) {
                errorMessage = `${errorMessage}: ${error.message}`;
            }

            toast({
                variant: 'destructive',
                title: 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ',
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
                   alert("[DEBUG] Starting LINE Login with LIFF ID: " + liffId); 
                }

                // Ensure LIFF is imported properly
                const liff = (await import('@line/liff')).default;
                alert("[DEBUG] LIFF SDK Loaded");

                try {
                    await liff.init({ liffId });
                    alert("[DEBUG] LIFF Init SUCCESS");
                } catch (initErr: any) {
                    alert("[DEBUG] LIFF Init ERROR: " + initErr.message);
                    console.error("LIFF Init Error:", initErr);
                    let errMsg = initErr.message || '';
                    if (errMsg.includes('fetch') || errMsg.includes('Load failed')) {
                        throw new Error(`การเชื่อมต่อ LINE ถูกบล็อกโดยเบราว์เซอร์ (${errMsg})`);
                    }
                    throw new Error(`LIFF Init Failed: ${errMsg}`);
                }

                const loggedIn = liff.isLoggedIn();
                alert("[DEBUG] Is Logged In: " + loggedIn);
                
                if (!loggedIn) {
                    const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                    if (isMobile) {
                        const liffUrl = `https://liff.line.me/${liffId}`;
                        alert("[DEBUG] Mobile detected. Redirecting to: " + liffUrl);
                        window.location.href = liffUrl;
                    } else {
                        alert("[DEBUG] Desktop detected. Calling liff.login()");
                        liff.login({ redirectUri: window.location.href });
                    }
                    return; 
                }

                // Already logged in via LIFF
                alert("[DEBUG] ALREADY LOGGED IN. Fetching /api/auth/line...");
                const accessToken = liff.getAccessToken();
                const idToken = liff.getIDToken();

                if (!accessToken) {
                    alert("[DEBUG] Error: No access token found");
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
                    throw new Error(`การเชื่อมต่อเซิร์ฟเวอร์ล้มเหลว (Failed to fetch API): ${fetchErr.message}`);
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
                        throw new Error(`การยืนยันตัวตนล้มเหลว (Firebase Auth): ${fbErr.message}`);
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
                            const errorData = await sessionRes.json().catch(() => ({ message: 'Session creation failed' }));
                            alert("Session Error: " + errorData.message);
                            throw new Error(errorData.message || 'การสร้างเซสชันล้มเหลว');
                        }

                        const { suggestedRedirect } = await sessionRes.json();
                        // alert("Login Success! Redirecting to: " + suggestedRedirect);

                        toast({
                            title: 'เข้าสู่ระบบด้วย LINE สำเร็จ',
                            description: 'กำลังนำคุณไปยังแดชบอร์ด...',
                        });

                        if (suggestedRedirect.startsWith('http')) {
                            window.location.href = suggestedRedirect;
                        } else {
                            router.push(suggestedRedirect);
                        }
                    } catch (sessionErr: any) {
                        console.error("Session creation error:", sessionErr);
                        throw new Error(`ข้อผิดพลาดทางฝั่งเซิร์ฟเวอร์: ${sessionErr.message}`);
                    }
                }
            } else {
                // No LIFF ID configured
                throw new Error('LINE Login ยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ');
            }
        } catch (error: any) {
            console.error('LINE Sign-In Error:', error);
            toast({
                variant: 'destructive',
                title: 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ',
                description: error.message || 'กรุณาลองใหม่อีกครั้ง',
            });
        } finally {
            setIsLineLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F4F6F9]">
            <div className="container mx-auto flex justify-center p-4">
                <Card className="w-full max-w-[480px] shadow-2xl rounded-3xl border-none">
                    <CardHeader className="text-center space-y-6 pt-10 pb-0">
                        <div className="flex justify-center mb-2">
                            <Logo href="/" variant="color" />
                        </div>

                        <div className="px-6">
                            <Tabs defaultValue="customer" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 h-14 bg-slate-100 rounded-xl p-1">
                                    <TabsTrigger value="customer" asChild className="h-full rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm font-medium text-base transition-all">
                                        <Link href={`/login`}>ลูกค้า</Link>
                                    </TabsTrigger>
                                    <TabsTrigger value="lawyer" asChild className="h-full rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm font-medium text-base transition-all">
                                        <Link href={`/lawyer-login`}>ทนายความ</Link>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <div className="space-y-2">
                            <CardTitle className="text-3xl font-bold font-headline text-[#0B3979]">
                                เข้าสู่ระบบ
                            </CardTitle>
                            <CardDescription className="text-base text-slate-500">
                                ยินดีต้อนรับกลับสู่ Lawslane
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 pt-8 space-y-8">
                        <Button variant="outline" className="w-full h-12 rounded-full border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium text-base shadow-sm" onClick={handleGoogleSignIn} disabled={isGoogleLoading || isLoading}>
                            {isGoogleLoading ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                    <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512S0 403.3 0 261.8 106.5 11.8 244 11.8c67.7 0 130.4 27.2 175.2 73.4l-72.2 67.7C324.9 123.7 286.8 102 244 102c-88.6 0-160.2 72.3-160.2 161.8s71.6 161.8 160.2 161.8c94.9 0 133-66.3 137.4-101.4H244V261.8h244z"></path>
                                </svg>
                            )}
                            เข้าสู่ระบบด้วย Google
                        </Button>

                        <Button variant="outline" className="w-full h-12 rounded-full border-[#06C755] text-[#06C755] hover:bg-[#06C755] hover:text-white font-medium text-base shadow-sm transition-colors" onClick={handleLineSignIn} disabled={isLineLoading || isLoading || isGoogleLoading}>
                            {isLineLoading ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                                </svg>
                            )}
                            เข้าสู่ระบบด้วย LINE
                        </Button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-slate-200" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="bg-white px-4 text-slate-400">
                                    หรือเข้าสู่ระบบด้วยอีเมล
                                </span>
                            </div>
                        </div>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel className="text-base font-medium text-slate-700">อีเมล</FormLabel>
                                            <FormControl>
                                                <Input placeholder="name@example.com" {...field} disabled={isLoading || isGoogleLoading} className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all text-base" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel className="text-base font-medium text-slate-700">รหัสผ่าน</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="********" {...field} disabled={isLoading || isGoogleLoading} className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all text-base" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="flex justify-end">
                                    <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="link" className="px-0 font-normal text-sm text-slate-500 hover:text-[#0B3979]">
                                                ลืมรหัสผ่าน?
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>ลืมรหัสผ่าน?</DialogTitle>
                                                <DialogDescription>
                                                    กรอกอีเมลของคุณเพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="reset-email">อีเมล</Label>
                                                    <Input
                                                        id="reset-email"
                                                        placeholder="name@example.com"
                                                        value={resetEmail}
                                                        onChange={(e) => setResetEmail(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setIsForgotPasswordOpen(false)} disabled={isResetting}>ยกเลิก</Button>
                                                <Button onClick={handleForgotPassword} disabled={isResetting}>
                                                    {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                    ส่งลิงก์รีเซ็ต
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                                <TurnstileWidget onVerify={setTurnstileToken} />
                                <Button type="submit" className="w-full h-12 rounded-full text-lg font-semibold bg-[#0B3979] hover:bg-[#082a5a] shadow-lg shadow-blue-900/20" disabled={isLoading || isGoogleLoading}>
                                    {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                                    เข้าสู่ระบบ
                                </Button>
                            </form>
                        </Form>
                        <div className="text-center">
                            <p className="text-slate-500">
                                ยังไม่มีบัญชี?{' '}
                                <Link href={`/signup`} className="text-[#0B3979] font-semibold hover:underline decoration-2 underline-offset-4">
                                    สมัครสมาชิกที่นี่
                                </Link>
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
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
