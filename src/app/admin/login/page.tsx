
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { useFirebase } from '@/firebase';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Loader2, Gavel } from 'lucide-react';
import Logo from '@/components/logo';

const formSchema = z.object({
  email: z.string().email({ message: 'รูปแบบอีเมลไม่ถูกต้อง' }),
  password: z.string().min(1, { message: 'กรุณากรอกรหัสผ่าน' }),
});

export default function AdminLoginPage() {
  const router = useRouter();
  const { auth, firestore } = useFirebase();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth) {
      toast({
        variant: 'destructive',
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถเชื่อมต่อกับระบบยืนยันตัวตนได้',
      });
      return;
    }
    setIsLoading(true);
    try {
      // In a real app, you should also verify the user's role (admin) after login.
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({
        title: 'เข้าสู่ระบบสำเร็จ',
        description: 'กำลังนำคุณไปยังแดชบอร์ดผู้ดูแลระบบ...',
      });
      // The layout will handle the redirect after auth state changes.

    } catch (error: any) {
      console.error(error);
      let errorMessage = 'เกิดข้อผิดพลาดที่ไม่รู้จัก';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
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
    if (!auth || !firestore) return;
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);

      // The admin layout will handle role verification and document creation
      toast({
        title: 'เข้าสู่ระบบด้วย Google สำเร็จ',
        description: 'กำลังตรวจสอบสิทธิ์และนำคุณไปยังแดชบอร์ด...',
      });

    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      toast({
        variant: 'destructive',
        title: 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ',
        description: error.message || 'เกิดข้อผิดพลาดบางอย่าง',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  }


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="container mx-auto flex justify-center p-4">
        <Card className="w-full max-w-md shadow-xl bg-gray-800/50 border-gray-700">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center text-white">
              <Gavel className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-bold font-headline pt-4">
              Administrator Login
            </CardTitle>
            <CardDescription className="text-gray-400">
              สำหรับผู้ดูแลระบบ Lawslane เท่านั้น
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full bg-white text-black hover:bg-gray-200" onClick={handleGoogleSignIn} disabled={isGoogleLoading || isLoading}>
              {isGoogleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                  <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512S0 403.3 0 261.8 106.5 11.8 244 11.8c67.7 0 130.4 27.2 175.2 73.4l-72.2 67.7C324.9 123.7 286.8 102 244 102c-88.6 0-160.2 72.3-160.2 161.8s71.6 161.8 160.2 161.8c94.9 0 133-66.3 137.4-101.4H244V261.8h244z"></path>
                </svg>
              )}
              เข้าสู่ระบบด้วย Google
            </Button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-600" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-gray-800/50 px-2 text-gray-400">
                  หรือ
                </span>
              </div>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">อีเมล</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="admin@lawslane.com"
                          {...field}
                          disabled={isLoading}
                          className="bg-gray-700 border-gray-600 text-white"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">รหัสผ่าน</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="********"
                          {...field}
                          disabled={isLoading}
                          className="bg-gray-700 border-gray-600 text-white"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  เข้าสู่ระบบ
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
