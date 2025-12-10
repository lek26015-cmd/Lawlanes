
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
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/lib/constants';
import { compressImageToBase64 } from '@/lib/image-utils';
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
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];

      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({
          variant: "destructive",
          title: "ไฟล์มีขนาดใหญ่เกินไป",
          description: `กรุณาอัปโหลดไฟล์ขนาดไม่เกิน ${MAX_FILE_SIZE_MB}MB`
        });
        event.target.value = ''; // Reset input
        return;
      }

      setter(file);
    }
  };

  async function uploadFileWithFallback(file: File, path: string): Promise<string> {
    try {
      if (!storage) throw new Error("Storage not initialized");

      // Create a timeout promise
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Upload timed out")), 5000)
      );

      const storageRef = ref(storage, path);
      const uploadPromise = uploadBytes(storageRef, file);

      // Race between upload and timeout
      const snapshot = await Promise.race([uploadPromise, timeout]) as any;

      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.warn(`Storage upload failed or timed out for ${path}, falling back to Base64:`, error);
      try {
        // Fallback to Base64
        return await compressImageToBase64(file);
      } catch (compressError) {
        console.error("Base64 compression failed:", compressError);
        throw error; // Throw original error if fallback also fails
      }
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("Starting submission...");
    if (!auth || !firestore || !storage) {
      console.error("Firebase services missing");
      toast({
        variant: 'destructive',
        title: 'ระบบยังไม่พร้อม',
        description: 'กำลังเชื่อมต่อกับ Firebase กรุณารอสักครู่แล้วลองใหม่',
      });
      return;
    }
    if (!idCardFile || !licenseFile) {
      toast({ variant: 'destructive', title: 'ข้อมูลไม่ครบ', description: 'กรุณาอัปโหลดไฟล์ให้ครบถ้วน' });
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create user in Firebase Auth
      console.log("Step 1: Creating User...");
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;
      console.log("Step 1 Done: User created with UID:", user.uid);

      // Force token refresh
      console.log("Step 1.5: Refreshing Token...");
      await user.getIdToken(true);

      // 2. Update user profile in Firebase Auth
      console.log("Step 2: Updating Profile...");
      await updateProfile(user, { displayName: values.name });

      // 3. Upload Files
      console.log("Step 3: Uploading Files...");
      const idCardUrl = await uploadFileWithFallback(idCardFile, `lawyer-documents/${user.uid}/id-card`);
      console.log("Step 3.1: ID Card Uploaded");
      const licenseUrl = await uploadFileWithFallback(licenseFile, `lawyer-documents/${user.uid}/license`);
      console.log("Step 3.2: License Uploaded");

      // 4. Create user profile document in Firestore (users collection)
      console.log("Step 4: Creating User Doc...");
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

      try {
        await setDoc(userDocRef, userProfileData);
        console.log("Step 4 Done: User Doc Created");
      } catch (e: any) {
        console.error("Error creating user doc:", e);
        throw new Error("สร้างข้อมูลผู้ใช้ไม่สำเร็จ (Users): " + e.message);
      }

      // 5. Create lawyer profile document in Firestore (lawyerProfiles collection)
      console.log("Step 5: Creating Lawyer Profile...");
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

      try {
        await setDoc(lawyerProfileRef, lawyerProfileData);
        console.log("Step 5 Done: Lawyer Profile Created");
      } catch (e: any) {
        console.error("Error creating lawyer profile:", e);
        throw new Error("สร้างข้อมูลทนายความไม่สำเร็จ (LawyerProfiles): " + e.message);
      }

      console.log("Step 6: Success! Signing out...");
      toast({
        title: 'สมัครเข้าร่วมสำเร็จ',
        description: 'เราได้รับใบสมัครของคุณแล้ว และจะติดต่อกลับหลังจากตรวจสอบข้อมูลเรียบร้อย',
      });

      await signOut(auth);
      console.log("Step 7: Redirecting...");
      router.push(`/`);

    } catch (error: any) {
      console.error(error);
      let errorMessage = 'เกิดข้อผิดพลาดที่ไม่รู้จัก: ' + (error.message || error.code || JSON.stringify(error));
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
              <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
                console.error("Form Validation Errors:", errors);
                toast({
                  variant: "destructive",
                  title: "กรุณากรอกข้อมูลให้ครบถ้วน",
                  description: "มีบางช่องที่ยังไม่ได้กรอก หรือกรอกไม่ถูกต้อง (ดูสีแดงในฟอร์ม)",
                });
              })} className="space-y-6">

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
                      <div className="flex gap-2">
                        {/* Day */}
                        <Select
                          value={field.value ? field.value.getDate().toString() : undefined}
                          onValueChange={(value) => {
                            const current = field.value || new Date();
                            const newDate = new Date(current.getFullYear(), current.getMonth(), parseInt(value));
                            field.onChange(newDate);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-[80px]">
                              <SelectValue placeholder="วัน" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                              <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Month */}
                        <Select
                          value={field.value ? field.value.getMonth().toString() : undefined}
                          onValueChange={(value) => {
                            const current = field.value || new Date();
                            const newDate = new Date(current.getFullYear(), parseInt(value), current.getDate());
                            field.onChange(newDate);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="เดือน" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[
                              "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
                              "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
                            ].map((month, index) => (
                              <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Year */}
                        <Select
                          value={field.value ? field.value.getFullYear().toString() : undefined}
                          onValueChange={(value) => {
                            const current = field.value || new Date();
                            const newDate = new Date(parseInt(value), current.getMonth(), current.getDate());
                            field.onChange(newDate);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-[100px]">
                              <SelectValue placeholder="ปี" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                              <SelectItem key={year} value={year.toString()}>{year + 543}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <FormMessage />
                    </FormItem>
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
