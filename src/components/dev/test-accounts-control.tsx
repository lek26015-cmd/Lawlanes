'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Bot, LogIn, Loader2, UserPlus, ShieldCheck, RefreshCcw, User, UserCheck } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { setDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { setupTestAccounts } from '@/app/actions/seed-actions';

export function TestAccountsControl() {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSettingUp, setIsSettingUp] = useState(false);
    const { auth, firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();

    // Only show in non-production or if forced
    const isDev = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_TEST_CONTROLS === 'true';

    useEffect(() => {
        // Toggle shortcut: Alt + J or Cmd + J
        const handleKeyDown = (e: KeyboardEvent) => {
            const isJumpKey = e.key.toLowerCase() === 'j';
            const isModifier = e.altKey || e.metaKey || e.ctrlKey;
            
            if (isModifier && isJumpKey) {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (!isDev) return null;

    const testLawyer = {
        email: 'lawyer-test@lawslane.com',
        password: 'lawslane1234',
    };

    const handleLogin = async (email: string, pass: string, redirect: string = '/dashboard') => {
        if (!auth) return;
        setIsLoading(true);
        try {
            // Ensure persistence is set
            await setPersistence(auth, browserLocalPersistence);
            
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            // Sync with backend session
            const idToken = await user.getIdToken();
            const sessionRes = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken, redirect }),
            });

            if (!sessionRes.ok) throw new Error('Session creation failed');
            
            const { suggestedRedirect } = await sessionRes.json();
            
            toast({
                title: 'เข้าสู่ระบบสำเร็จ',
                description: `ยินดีต้อนรับ ${email}`,
            });

            // Redirect and hard refresh to ensure middleware/layout updates
            window.location.href = suggestedRedirect || redirect;
        } catch (error: any) {
            console.error('Test login failed:', error);
            
            // If user not found or invalid credential, suggest setting up
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                toast({
                    variant: 'destructive',
                    title: 'ไม่พบบัญชีหรือรหัสไม่ถูกต้อง',
                    description: 'กรุณากดปุ่มรีเฟรช ↻ เพื่อตั้งค่ารหัสผ่านบัญชีทดสอบก่อน',
                });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'ข้อผิดพลาด',
                    description: error.message,
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateNewClient = async () => {
        if (!auth || !firestore) return;
        setIsLoading(true);
        try {
            const randomId = Math.floor(1000 + Math.random() * 9000);
            const email = `test-client-${randomId}@lawslane.com`;
            const password = 'lawslane1234';
            
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Create user document
            await setDoc(doc(firestore, 'users', user.uid), {
                email,
                name: `ลูกความทดสอบ #${randomId}`,
                role: 'user',
                createdAt: serverTimestamp(),
            });

            const idToken = await user.getIdToken();
            await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken, redirect: '/account' }),
            });

            toast({ title: 'สร้างบัญชีลูกความสำเร็จ', description: email });
            window.location.href = '/account';
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'สร้างบัญชีล้มเหลว', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetupData = async () => {
        setIsSettingUp(true);
        try {
            const res = await setupTestAccounts();
            if (res.success) {
                toast({ title: 'เตรียมข้อมูลสำเร็จ', description: 'บัญชีทดสอบใน Firestore พร้อมใช้งานแล้ว' });
            } else {
                throw new Error(res.error);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'เตรียมข้อมูลล้มเหลว', description: error.message });
        } finally {
            setIsSettingUp(false);
        }
    };

    return (
        <>
            {/* Float Button */}
            <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="fixed bottom-6 right-6 z-[100]"
            >
                <Button 
                    onClick={() => setIsOpen(!isOpen)}
                    className={`
                        w-14 h-14 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] 
                        flex items-center justify-center border-2 border-white/20
                        ${isOpen ? 'bg-rose-500 rotate-90' : 'bg-slate-900'}
                        transition-all duration-300
                    `}
                >
                    {isOpen ? <span className="text-xl font-bold text-white">✕</span> : <Bot className="text-white h-7 w-7" />}
                </Button>
            </motion.div>

            {/* Control Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9, x: 20 }}
                        animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9, x: 20 }}
                        className="fixed bottom-24 right-6 z-[100] w-[380px] h-auto"
                    >
                        <Card className="overflow-hidden border-none shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white/95 backdrop-blur-md rounded-[2.5rem]">
                            <CardHeader className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 pb-8">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/20 rounded-xl border border-white/10">
                                            <ShieldCheck className="h-6 w-6 text-blue-400" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl font-black font-headline tracking-tight">
                                                Test Control
                                            </CardTitle>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                                Internal Development Tools
                                            </p>
                                        </div>
                                    </div>
                                    <RefreshCcw 
                                        className={`h-5 w-5 text-slate-500 cursor-pointer hover:text-white transition-all ${isSettingUp ? 'animate-spin' : ''}`}
                                        onClick={handleSetupData}
                                    />
                                </div>
                            </CardHeader>

                            <CardContent className="p-6 -mt-6">
                                <div className="bg-white rounded-3xl p-5 space-y-6 shadow-sm border border-slate-100">
                                    
                                    {/* Section 1: Create New */}
                                    <div className="space-y-3">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">
                                            Quick Onboarding
                                        </label>
                                        <Button 
                                            variant="outline" 
                                            onClick={handleCreateNewClient}
                                            disabled={isLoading}
                                            className="w-full h-16 rounded-2xl border-dashed border-2 border-slate-200 bg-slate-50/50 hover:bg-blue-50 hover:border-blue-200 transition-all group p-0 overflow-hidden"
                                        >
                                            <div className="flex items-center px-4 w-full">
                                                <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-500 group-hover:text-white transition-all">
                                                    <UserPlus className="h-5 w-5" />
                                                </div>
                                                <div className="ml-4 text-left">
                                                    <div className="text-sm font-black text-slate-900 leading-tight">สร้างบัญชีลูกความใหม่</div>
                                                    <div className="text-[10px] text-slate-500 font-medium tracking-tight">Auto-signup & Direct login</div>
                                                </div>
                                            </div>
                                        </Button>
                                    </div>

                                    <div className="h-px bg-slate-100" />

                                    {/* Section 2: Preset Logins */}
                                    <div className="space-y-3">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">
                                            Test Preset Login
                                        </label>
                                        
                                        {/* Lawyer Test */}
                                        <Button 
                                            onClick={() => handleLogin(testLawyer.email, testLawyer.password, '/lawyer-dashboard')}
                                            disabled={isLoading}
                                            className="w-full h-16 rounded-2xl bg-[#0B3979] hover:bg-slate-900 shadow-lg shadow-blue-900/10 transition-all p-0 overflow-hidden"
                                        >
                                            <div className="flex items-center px-4 w-full">
                                                <div className="p-3 bg-white/10 rounded-xl text-white">
                                                    <UserCheck className="h-5 w-5" />
                                                </div>
                                                <div className="ml-4 text-left">
                                                    <div className="text-sm font-black text-white leading-tight">เข้าสู่ระบบในนามทนาย</div>
                                                    <div className="text-[10px] text-blue-200/60 font-medium tracking-tight truncate max-w-[200px]">
                                                        {testLawyer.email}
                                                    </div>
                                                </div>
                                                <div className="ml-auto">
                                                    <LogIn className="h-4 w-4 text-white/50" />
                                                </div>
                                            </div>
                                        </Button>

                                        {/* Client Test (Static) */}
                                        <Button 
                                            variant="outline"
                                            onClick={() => handleLogin('client-test@lawslane.com', 'lawslane1234', '/account')}
                                            disabled={isLoading}
                                            className="w-full h-16 rounded-2xl border-slate-200 hover:border-slate-900 hover:bg-slate-50 transition-all p-0 overflow-hidden"
                                        >
                                            <div className="flex items-center px-4 w-full">
                                                <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
                                                    <User className="h-5 w-5" />
                                                </div>
                                                <div className="ml-4 text-left">
                                                    <div className="text-sm font-black text-slate-900 leading-tight">เข้าสู่ระบบลูกความคงที่</div>
                                                    <div className="text-[10px] text-slate-400 font-medium tracking-tight">client-test@lawslane.com</div>
                                                </div>
                                            </div>
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>

                            <CardFooter className="bg-slate-50 p-4 border-t border-slate-100">
                                <div className="w-full text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                        Lawslane Dev Framework • v0.1.5
                                    </p>
                                </div>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
