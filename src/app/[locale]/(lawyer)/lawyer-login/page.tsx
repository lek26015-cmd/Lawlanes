'use client'

import { Suspense, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
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
import { Loader2 } from 'lucide-react';
import Logo from '@/components/logo';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TurnstileWidget } from '@/components/turnstile-widget';
import { validateTurnstile } from '@/app/actions/turnstile';
// import { Locale } from '@/../i18n.config'; // Removed unused import

const formSchema = z.object({
  email: z.string().email({ message: 'รูปแบบอีเมลไม่ถูกต้อง' }),
  password: z.string().min(1, { message: 'กรุณากรอกรหัสผ่าน' }),
});

export default function LawyerLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6F9]">
        <Loader2 className="w-10 h-10 animate-spin text-[#0B3979]" />
      </div>
    }>
      <LawyerLoginForm />
    </Suspense>
  );
}

function LawyerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');
  // const params = useParams(); // Removed lang param
  // const lang = params.lang as Locale; // Removed lang param
  const { auth } = useFirebase();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');

  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

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
      // Use custom server action for password reset
      import('@/app/actions/auth').then(({ sendCustomPasswordResetEmailV2 }) => {
        sendCustomPasswordResetEmailV2(resetEmail).then((res) => {
          if (res.success) {
            toast({
              title: 'ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว',
              description: 'กรุณาตรวจสอบกล่องจดหมายของคุณ และอย่าลืมเช็คในโฟลเดอร์ขยะ (Spam/Junk) หากไม่พบอีเมล',
            });
            setIsForgotPasswordOpen(false);
            setResetEmail(''); // Clear email on success
          } else {
            toast({
              variant: 'destructive',
              title: 'เกิดข้อผิดพลาด',
              description: res.error || 'ไม่สามารถส่งอีเมลได้',
            });
          }
        }).catch((err) => { // Catch errors from sendCustomPasswordResetEmail promise
          console.error(err);
          toast({
            variant: 'destructive',
            title: 'เกิดข้อผิดพลาด',
            description: 'ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้',
          });
        });
      }).catch((err) => { // Catch errors from dynamic import
        console.error(err);
        toast({
          variant: 'destructive',
          title: 'เกิดข้อผิดพลาด',
          description: 'ไม่สามารถโหลดฟังก์ชันรีเซ็ตรหัสผ่านได้',
        });
      });
    } catch (error: any) {
      console.error(error);
      let errorMessage = 'ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้';
      // The specific Firebase error codes are now handled by the server action
      // and returned in res.error. This catch block is for unexpected client-side errors.
      if (error.message) {
        errorMessage = error.message;
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

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth) return;
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

      // Create server-side session cookie
      const idToken = await user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      toast({
        title: 'เข้าสู่ระบบสำเร็จ',
        description: 'กำลังนำคุณไปยังแดชบอร์ดทนายความ...',
      });
      const target = redirectUrl || '/lawyer-dashboard';
      if (target.startsWith('http')) {
        window.location.href = target;
      } else {
        router.push(target);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[2.5rem] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.08)] border border-slate-100"
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
              สำหรับทนายความ
            </span>
          </motion.div>

          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/images/login-lawslane.png"
              alt="Lawslane Background"
              fill
              className="object-cover object-center opacity-90"
              sizes="50vw"
              priority
            />
            {/* Overlay Gradient for Text Legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0B3979]/60 via-[#0B3979]/20 to-[#0B3979]/80" />
          </div>

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
                ยกระดับประสิทธิภาพ<br />
                <span className="text-blue-300">ของทนายความยุคใหม่</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-blue-50 text-lg leading-relaxed max-w-sm drop-shadow-lg font-medium"
              >
                จัดการคดีความและสื่อสารกับลูกความได้อย่างมืออาชีพ พร้อมระบบหลังบ้านที่ทรงพลัง
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
                เข้าสู่ระบบทนายความ
              </h2>
              <p className="text-slate-500 text-sm italic">
                เฉพาะที่ปรึกษากฎหมายที่ลงทะเบียนแล้ว
              </p>
            </div>

            <Tabs defaultValue="lawyer" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-100 rounded-xl p-1 mb-8">
                <TabsTrigger value="customer" asChild className="h-full rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#0B3979] data-[state=active]:shadow-sm font-bold transition-all">
                  <Link href={`/login`}>ลูกความ</Link>
                </TabsTrigger>
                <TabsTrigger value="lawyer" asChild className="h-full rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#0B3979] data-[state=active]:shadow-sm font-bold transition-all">
                  <Link href={`/lawyer-login`}>ทนายความ</Link>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm font-bold text-slate-700">อีเมลทนายความ</FormLabel>
                      <FormControl>
                        <Input placeholder="name@example.com" {...field} disabled={isLoading} className="h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base" />
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
                        <FormLabel className="text-sm font-bold text-slate-700">รหัสผ่าน</FormLabel>
                        <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
                          <DialogTrigger asChild>
                            <Button variant="link" className="p-0 h-auto font-bold text-xs text-slate-400 hover:text-[#0B3979]">
                              ลืมรหัสผ่าน?
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-3xl border-none shadow-2xl">
                            <DialogHeader>
                              <DialogTitle className="text-2xl font-black font-headline text-[#0B3979]">ลืมรหัสผ่าน?</DialogTitle>
                              <DialogDescription className="text-slate-500">
                                กรอกอีเมลของคุณเพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                              <div className="space-y-2">
                                <Label htmlFor="reset-email" className="font-bold">อีเมล</Label>
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
                              <Button variant="ghost" onClick={() => setIsForgotPasswordOpen(false)} disabled={isResetting} className="rounded-xl font-bold">ยกเลิก</Button>
                              <Button onClick={handleForgotPassword} disabled={isResetting} className="bg-[#0B3979] hover:bg-slate-900 text-white rounded-xl font-bold px-6">
                                {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                ส่งลิงก์รีเซ็ต
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <FormControl>
                        <Input type="password" placeholder="********" {...field} disabled={isLoading} className="h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white transition-all text-base" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-2">
                  <TurnstileWidget onVerify={setTurnstileToken} />
                </div>

                <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-black bg-[#0B3979] hover:bg-slate-900 shadow-xl shadow-blue-900/10 transition-all active:scale-[0.98] border-none text-white border-none" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  เข้าสู่ระบบ
                </Button>
              </form>
            </Form>

            <div className="text-center pt-8 border-t border-slate-50">
              <p className="text-slate-500 text-sm">
                ยังไม่มีบัญชีทนายความ?{' '}
                <Link href="/for-lawyers" className="text-[#0B3979] font-black hover:underline decoration-2 underline-offset-4">
                  สมัครสมาชิกที่นี่
                </Link>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
