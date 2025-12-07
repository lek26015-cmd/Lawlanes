
'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, FileText, X } from 'lucide-react';
import Logo from '@/components/logo';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
// import { Locale } from '@/../i18n.config'; // Removed unused import

const specialties = [
  'คดีฉ้อโกง SMEs',
  'คดีแพ่งและพาณิชย์',
  'การผิดสัญญา',
  'ทรัพย์สินทางปัญญา',
  'กฎหมายแรงงาน',
  'อสังหาริมทรัพย์',
];

const bankNames = ["ธนาคารกรุงเทพ", "ธนาคารกสิกรไทย", "ธนาคารกรุงไทย", "ธนาคารไทยพาณิชย์", "ธนาคารกรุงศรีอยุธยา", "ธนาคารทหารไทยธนชาต", "ธนาคารออมสิน", "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร"];

const formSchema = z.object({
  name: z.string().min(2, { message: 'ชื่อ-นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร' }),
  email: z.string().email({ message: 'รูปแบบอีเมลไม่ถูกต้อง' }),
  password: z.string().min(6, { message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }),
  phone: z.string().min(9, { message: 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง' }),
  dob: z.date({ required_error: 'กรุณาเลือกวันเกิด' }),
  gender: z.string({ required_error: 'กรุณาเลือกเพศ' }),
  licenseNumber: z.string().min(1, { message: 'กรุณากรอกเลขใบอนุญาต' }),
  address: z.string().min(1, { message: 'กรุณากรอกที่อยู่' }),
  serviceProvinces: z.string().min(1, { message: 'กรุณากรอกจังหวัดที่ให้บริการ' }),
  bankName: z.string({ required_error: 'กรุณาเลือกธนาคาร' }),
  bankAccountNumber: z.string().min(1, { message: 'กรุณากรอกเลขบัญชีธนาคาร' }),
  lineId: z.string().optional(),
  specialties: z.array(z.string()).refine(value => value.some(item => item), {
    message: 'กรุณาเลือกความเชี่ยวชาญอย่างน้อย 1 อย่าง',
  }),
});


export default function LawyerSignupPage() {
  const router = useRouter();
  // const params = useParams(); // Removed lang param
  // const lang = params.lang as Locale; // Removed lang param
  const { auth, firestore, storage } = useFirebase();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      phone: '',
      gender: undefined,
      licenseNumber: '',
      address: '',
      serviceProvinces: '',
      bankName: undefined,
      bankAccountNumber: '',
      lineId: '',
      specialties: [],
    },
  });

  const handleFileChange = (setter: React.Dispatch<React.SetStateAction<File | null>>) => (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setter(event.target.files[0]);
    }
  };

  async function uploadFile(file: File, path: string): Promise<string> {
    if (!storage) throw new Error("Storage not initialized");
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    return getDownloadURL(snapshot.ref);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth || !firestore || !storage) return;
    if (!idCardFile || !licenseFile) {
      toast({
        variant: 'destructive',
        title: 'ข้อมูลไม่ครบถ้วน',
        description: 'กรุณาอัปโหลดไฟล์ บัตรประชาชน และ ใบอนุญาตทนายความ',
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

      // 3. Upload Files
      const idCardUrl = await uploadFile(idCardFile, `lawyer-documents/${user.uid}/id-card`);
      const licenseUrl = await uploadFile(licenseFile, `lawyer-documents/${user.uid}/license`);

      // 4. Create user profile document in Firestore (users collection)
      const userDocRef = doc(firestore, 'users', user.uid);
      const userProfileData = {
        uid: user.uid,
        name: values.name,
        email: values.email,
        phone: values.phone,
        role: 'lawyer',
        type: 'บุคคลทั่วไป',
        registeredAt: serverTimestamp(),
        status: 'active',
        avatar: '',
      };

      setDoc(userDocRef, userProfileData).catch(serverError => {
        const permissionError = new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'create',
          requestResourceData: userProfileData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });

      // 5. Create lawyer profile document in Firestore (lawyerProfiles collection)
      const lawyerProfileRef = doc(firestore, 'lawyerProfiles', user.uid);
      const lawyerProfileData = {
        userId: user.uid,
        name: values.name,
        email: values.email,
        phone: values.phone,
        dob: values.dob,
        gender: values.gender,
        licenseNumber: values.licenseNumber,
        address: values.address,
        serviceProvinces: values.serviceProvinces.split(',').map(s => s.trim()),
        bankName: values.bankName,
        bankAccountNumber: values.bankAccountNumber,
        lineId: values.lineId,
        specialty: values.specialties,
        status: 'pending',
        description: '',
        imageUrl: '',
        imageHint: 'professional lawyer',
        idCardUrl: idCardUrl,
        licenseUrl: licenseUrl,
        joinedAt: serverTimestamp(),
      };

      setDoc(lawyerProfileRef, lawyerProfileData).catch(serverError => {
        const permissionError = new FirestorePermissionError({
          path: lawyerProfileRef.path,
          operation: 'create',
          requestResourceData: lawyerProfileData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });

      toast({
        title: 'สมัครเข้าร่วมสำเร็จ',
        description: 'เราได้รับใบสมัครของคุณแล้ว และจะติดต่อกลับหลังจากตรวจสอบข้อมูลเรียบร้อย',
      });

      await signOut(auth);
      router.push(`/`);

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
        <Card className="w-full max-w-3xl shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <Logo href="/" />
            </div>
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

                <h3 className="text-lg font-semibold border-b pb-2">ข้อมูลส่วนตัว</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>ชื่อ-นามสกุล (ตามบัตรประชาชน)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>เบอร์โทรศัพท์</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="dob" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>วันเกิด</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "PPP") : <span>เลือกวันเกิด</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="gender" render={({ field }) => (
                    <FormItem><FormLabel>เพศ</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="เลือกเพศ" /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="ชาย">ชาย</SelectItem><SelectItem value="หญิง">หญิง</SelectItem><SelectItem value="อื่นๆ">อื่นๆ</SelectItem></SelectContent>
                      </Select>
                      <FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel>ที่อยู่ (ตามบัตรประชาชน)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lineId" render={({ field }) => (
                  <FormItem><FormLabel>Line ID (ถ้ามี)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <h3 className="text-lg font-semibold border-b pb-2 pt-4">ข้อมูลบัญชีผู้ใช้</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>อีเมล (สำหรับเข้าสู่ระบบ)</FormLabel><FormControl><Input placeholder="name@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>รหัสผ่าน</FormLabel><FormControl><Input type="password" placeholder="อย่างน้อย 6 ตัวอักษร" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <h3 className="text-lg font-semibold border-b pb-2 pt-4">ข้อมูลสำหรับวิชาชีพ</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="licenseNumber" render={({ field }) => (
                    <FormItem><FormLabel>เลขที่ใบอนุญาตว่าความ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="serviceProvinces" render={({ field }) => (
                    <FormItem><FormLabel>จังหวัดที่ให้บริการ (คั่นด้วยจุลภาค)</FormLabel><FormControl><Input placeholder="กรุงเทพ, นนทบุรี" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField
                  control={form.control}
                  name="specialties"
                  render={() => (
                    <FormItem>
                      <div className="mb-4"><FormLabel className="text-base">ความเชี่ยวชาญ (เลือกได้มากกว่า 1)</FormLabel></div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {specialties.map((item) => (
                          <FormField key={item} control={form.control} name="specialties"
                            render={({ field }) => (
                              <FormItem key={item} className="flex flex-row items-center space-x-3 space-y-0 p-3 bg-gray-100 rounded-md">
                                <FormControl><Checkbox checked={field.value?.includes(item)} onCheckedChange={(checked) => {
                                  return checked ? field.onChange([...field.value, item]) : field.onChange(field.value?.filter((value) => value !== item))
                                }} /></FormControl>
                                <FormLabel className="font-normal text-sm">{item}</FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <h3 className="text-lg font-semibold border-b pb-2 pt-4">ข้อมูลการรับเงิน</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="bankName" render={({ field }) => (
                    <FormItem><FormLabel>ธนาคาร</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="เลือกธนาคาร" /></SelectTrigger></FormControl>
                        <SelectContent>{bankNames.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="bankAccountNumber" render={({ field }) => (
                    <FormItem><FormLabel>เลขที่บัญชี</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <h3 className="text-lg font-semibold border-b pb-2 pt-4">เอกสารประกอบการสมัคร</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ไฟล์บัตรประชาชน</Label>
                    <div className="flex items-center gap-2 p-2 border rounded-md bg-gray-50">
                      <FileText className="h-5 w-5 text-gray-500 flex-shrink-0" />
                      <span className="text-sm text-gray-600 truncate flex-grow">{idCardFile ? idCardFile.name : 'ยังไม่ได้เลือกไฟล์'}</span>
                      <Input id="id-card-upload" type="file" className="hidden" onChange={handleFileChange(setIdCardFile)} />
                      <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('id-card-upload')?.click()}>เลือกไฟล์</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>ไฟล์ใบอนุญาตทนายความ</Label>
                    <div className="flex items-center gap-2 p-2 border rounded-md bg-gray-50">
                      <FileText className="h-5 w-5 text-gray-500 flex-shrink-0" />
                      <span className="text-sm text-gray-600 truncate flex-grow">{licenseFile ? licenseFile.name : 'ยังไม่ได้เลือกไฟล์'}</span>
                      <Input id="license-upload" type="file" className="hidden" onChange={handleFileChange(setLicenseFile)} />
                      <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('license-upload')?.click()}>เลือกไฟล์</Button>
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  ส่งใบสมัคร
                </Button>
              </form>
            </Form>
            <div className="mt-6 text-center text-sm">
              เป็นสมาชิกอยู่แล้ว?{' '}
              <Link href={`/lawyer-login`} className="underline hover:text-primary">
                เข้าสู่ระบบสำหรับทนาย
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
