'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, FileText, X } from 'lucide-react';
import Logo from '@/components/logo';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const specialties = [
  'คดีฉ้อโกง SMEs',
  'คดีแพ่งและพาณิชย์',
  'การผิดสัญญา',
  'ทรัพย์สินทางปัญญา',
  'กฎหมายแรงงาน',
  'อสังหาริมทรัพย์',
];

const formSchema = z.object({
  name: z.string().min(2, { message: 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร' }),
  licenseNumber: z.string().min(1, { message: 'กรุณากรอกเลขใบอนุญาต' }),
  email: z.string().email({ message: 'รูปแบบอีเมลไม่ถูกต้อง' }),
  password: z.string().min(6, { message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }),
  specialties: z.array(z.string()).refine(value => value.some(item => item), {
    message: 'กรุณาเลือกความเชี่ยวชาญอย่างน้อย 1 อย่าง',
  }),
});

export default function LawyerSignupPage() {
  const router = useRouter();
  const { auth, firestore } = useFirebase();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      licenseNumber: '',
      email: '',
      password: '',
      specialties: [],
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setUploadedFiles(prev => [...prev, ...Array.from(event.target.files!)]);
    }
  };

  const removeFile = (fileName: string) => {
    setUploadedFiles(prev => prev.filter(file => file.name !== fileName));
  };


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth || !firestore) return;
    if (uploadedFiles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'ข้อมูลไม่ครบถ้วน',
        description: 'กรุณาอัปโหลดเอกสารประกอบการสมัคร',
      });
      return;
    }
    
    setIsLoading(true);
    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      // 2. Update user profile in Firebase Auth
      await updateProfile(user, { displayName: values.name });

      // 3. Create user profile document in Firestore (users collection)
      const userDocRef = doc(firestore, 'users', user.uid);
      const userProfileData = {
        uid: user.uid,
        name: values.name,
        email: values.email,
        role: 'lawyer',
      };
      setDoc(userDocRef, userProfileData).catch(error => {
        const permissionError = new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'create',
          requestResourceData: userProfileData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
      
      // 4. Create lawyer profile document in Firestore (lawyerProfiles collection)
      const lawyerProfileRef = doc(firestore, 'lawyerProfiles', user.uid);
      const lawyerProfileData = {
        userId: user.uid,
        name: values.name,
        licenseNumber: values.licenseNumber,
        specialty: values.specialties,
        status: 'pending', // Initial status is pending review
        description: '', // Admin will fill this later
        imageUrl: '',
        joinedAt: serverTimestamp(),
      };
      setDoc(lawyerProfileRef, lawyerProfileData).catch(error => {
        const permissionError = new FirestorePermissionError({
          path: lawyerProfileRef.path,
          operation: 'create',
          requestResourceData: lawyerProfileData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
      
      // In a real app, you would upload files to Firebase Storage here.
      // For now, we just log them.
      console.log('Uploading files:', uploadedFiles.map(f => f.name));

      toast({
        title: 'สมัครเข้าร่วมสำเร็จ',
        description: 'เราได้รับใบสมัครของคุณแล้ว และจะติดต่อกลับหลังจากตรวจสอบข้อมูลเรียบร้อย',
      });
      
      // Sign out the user and redirect to a confirmation page or home page
      await signOut(auth);
      router.push('/');

    } catch (error: any) {
      console.error(error);
      let errorMessage = 'เกิดข้อผิดพลาดที่ไม่รู้จัก';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น';
      }
      toast({
        variant: 'destructive',
        title: 'การสมัครไม่สำเร็จ',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="container mx-auto flex justify-center py-8">
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader className="text-center space-y-4">
             <Link href="/" className="flex justify-center">
              <Logo />
            </Link>
            <CardTitle className="text-2xl font-bold font-headline">
              สมัครเข้าร่วมเป็นทนายความ
            </CardTitle>
            <CardDescription>
              กรอกข้อมูลเพื่อเข้าร่วมเครือข่ายทนายความคุณภาพกับ Lawlanes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>ชื่อ-นามสกุล (ตามใบอนุญาต)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                     <FormField control={form.control} name="licenseNumber" render={({ field }) => (
                        <FormItem><FormLabel>เลขที่ใบอนุญาตว่าความ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>อีเมล</FormLabel><FormControl><Input placeholder="name@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                     <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem><FormLabel>รหัสผ่าน</FormLabel><FormControl><Input type="password" placeholder="อย่างน้อย 6 ตัวอักษร" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>
                 <FormField
                  control={form.control}
                  name="specialties"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">ความเชี่ยวชาญ (เลือกได้มากกว่า 1)</FormLabel>
                      </div>
                       <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {specialties.map((item) => (
                          <FormField
                            key={item}
                            control={form.control}
                            name="specialties"
                            render={({ field }) => {
                              return (
                                <FormItem key={item} className="flex flex-row items-center space-x-3 space-y-0 p-3 bg-gray-100 rounded-md">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(item)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, item])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== item
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal text-sm">{item}</FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div>
                  <Label>เอกสารประกอบการสมัคร (ไฟล์ PDF หรือรูปภาพ)</Label>
                  <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10">
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-300" />
                      <div className="mt-4 flex text-sm leading-6 text-gray-600">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer rounded-md bg-white font-semibold text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 hover:text-primary/80"
                        >
                          <span>อัปโหลดไฟล์</span>
                          <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileChange} />
                        </label>
                        <p className="pl-1">หรือลากและวาง</p>
                      </div>
                      <p className="text-xs leading-5 text-gray-600">PNG, JPG, PDF ขนาดไม่เกิน 10MB ต่อไฟล์</p>
                    </div>
                  </div>
                   {uploadedFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium">ไฟล์ที่แนบ:</p>
                        {uploadedFiles.map(file => (
                            <div key={file.name} className="flex items-center justify-between p-2 bg-gray-100 rounded-md">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-gray-500" />
                                    <span className="text-sm">{file.name}</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(file.name)}>
                                    <X className="h-4 w-4 text-red-500"/>
                                </Button>
                            </div>
                        ))}
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  ส่งใบสมัคร
                </Button>
              </form>
            </Form>
            <div className="mt-6 text-center text-sm">
              เป็นสมาชิกอยู่แล้ว?{' '}
              <Link href="/login" className="underline hover:text-primary">
                เข้าสู่ระบบสำหรับทนาย
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
