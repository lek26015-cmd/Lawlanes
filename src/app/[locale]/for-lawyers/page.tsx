'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { uploadToFirebasePublic, uploadToFirebaseSecure } from '@/app/actions/upload-secure';
import { motion, AnimatePresence } from 'framer-motion';

import { TurnstileWidget } from '@/components/turnstile-widget';
import { validateTurnstile } from '@/app/actions/turnstile';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, ArrowLeft, Check, User, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { THAI_PROVINCES } from '@/lib/thai-provinces';
import { X } from 'lucide-react';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/lib/constants';
import { formatPhoneNumber, formatBankAccount } from '@/lib/utils';
import Image from 'next/image';

import bblLogo from '@/pic/logo-bank/กรุงเทพ.png';
import kbankLogo from '@/pic/logo-bank/กสิกร.png';
import ktbLogo from '@/pic/logo-bank/กรุงไทย.png';
import scbLogo from '@/pic/logo-bank/ไทยพาณิช.png';
import bayLogo from '@/pic/logo-bank/กรุงศรี.png';
import ttbLogo from '@/pic/logo-bank/ttb.png';
import gsbLogo from '@/pic/logo-bank/ออมสิน.png';
import baacLogo from '@/pic/logo-bank/ธนาคาร ธกส.png';
import cimbLogo from '@/pic/logo-bank/Cimb.png';
import uobLogo from '@/pic/logo-bank/UOB.png';
import tiscoLogo from '@/pic/logo-bank/ทิสโก้.png';
import ibankLogo from '@/pic/logo-bank/ธนาคารอิสลาม.png';
import ghbLogo from '@/pic/logo-bank/ธอส.png';
import kkpLogo from '@/pic/logo-bank/เกียรตินาคิน.png';
import lhLogo from '@/pic/logo-bank/แลนด์แลนด์เฮ้าท์ .png';
import icbcLogo from '@/pic/logo-bank/ICBC.png';
import bocLogo from '@/pic/logo-bank/ธนาคารแห่งประเทศจีน.png';
import lawyerCoverImg from '@/pic/lawyer-cover.jpg';

const specialties = [
  'คดีฉ้อโกง SMEs',
  'คดีแพ่งและพาณิชย์',
  'การผิดสัญญา',
  'ทรัพย์สินทางปัญญา',
  'กฎหมายแรงงาน',
  'อสังหาริมทรัพย์',
];

const banks = [
  { name: "ธนาคารกรุงเทพ", logo: bblLogo, color: "#1e4598" },
  { name: "ธนาคารกสิกรไทย", logo: kbankLogo, color: "#138f2d" },
  { name: "ธนาคารกรุงไทย", logo: ktbLogo, color: "#1ba5e1" },
  { name: "ธนาคารไทยพาณิชย์", logo: scbLogo, color: "#4e2e7f" },
  { name: "ธนาคารกรุงศรีอยุธยา", logo: bayLogo, color: "#fec43b" },
  { name: "ธนาคารทหารไทยธนชาต", logo: ttbLogo, color: "#102a4d" },
  { name: "ธนาคารออมสิน", logo: gsbLogo, color: "#eb198d" },
  { name: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร", logo: baacLogo, color: "#4b9b1d" },
  { name: "ธนาคารซีไอเอ็มบี ไทย", logo: cimbLogo, color: "#7e2f36" },
  { name: "ธนาคารยูโอบี", logo: uobLogo, color: "#0b3979" },
  { name: "ธนาคารทิสโก้", logo: tiscoLogo, color: "#1a4d8d" },
  { name: "ธนาคารอิสลามแห่งประเทศไทย", logo: ibankLogo, color: "#164134" },
  { name: "ธนาคารอาคารสงเคราะห์", logo: ghbLogo, color: "#f58523" },
  { name: "ธนาคารเกียรตินาคินภัทร", logo: kkpLogo, color: "#6e5a9c" },
  { name: "ธนาคารแลนด์ แอนด์ เฮ้าส์", logo: lhLogo, color: "#6d6e71" },
  { name: "ธนาคารไอซีบีซี (ไทย)", logo: icbcLogo, color: "#c4161c" },
  { name: "ธนาคารแห่งประเทศจีน (ไทย)", logo: bocLogo, color: "#b40026" },
];

const formSchema = z.object({
  name: z.string().min(2, { message: 'ชื่อ-นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร' }),
  email: z.string().email({ message: 'รูปแบบอีเมลไม่ถูกต้อง' }),
  password: z.string().min(6, { message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }),
  phone: z.string().min(9, { message: 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง' }),
  dob: z.date({ required_error: 'กรุณาเลือกวันเกิด' }),
  gender: z.string({ required_error: 'กรุณาเลือกเพศ' }),
  licenseNumber: z.string().min(1, { message: 'กรุณากรอกเลขใบอนุญาต' }),
  education: z.string().min(1, { message: 'กรุณากรอกข้อมูลการศึกษา' }),
  experience: z.string().min(1, { message: 'กรุณากรอกประสบการณ์ทำงาน' }),
  address: z.string().min(1, { message: 'กรุณากรอกที่อยู่' }),
  serviceProvinces: z.string().min(1, { message: 'กรุณากรอกจังหวัดที่ให้บริการ' }),
  bankName: z.string({ required_error: 'กรุณาเลือกธนาคาร' }),
  bankAccountName: z.string().min(1, { message: 'กรุณากรอกชื่อบัญชี' }),
  bankAccountNumber: z.string().min(1, { message: 'กรุณากรอกเลขบัญชีธนาคาร' }),
  lineId: z.string().optional(),
  specialties: z.array(z.string()).refine(value => value.some(item => item), {
    message: 'กรุณาเลือกความเชี่ยวชาญอย่างน้อย 1 อย่าง',
  }),
  terms: z.boolean().refine(val => val === true, {
    message: 'กรุณายอมรับนโยบายความเป็นส่วนตัว',
  }),
}).refine((data) => data.bankAccountName === data.name, {
  message: "ชื่อบัญชีธนาคารต้องตรงกับชื่อ-นามสกุลผู้สมัคร",
  path: ["bankAccountName"],
});

import { useRef } from 'react';

export default function ForLawyersPage() {
  const router = useRouter();
  const { auth, firestore } = useFirebase();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [customOptions, setCustomOptions] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [showWelcome, setShowWelcome] = useState(true);
  const totalSteps = 4;
  const isSubmittingRef = useRef(false);

  const getFieldsForStep = (step: number): (keyof z.infer<typeof formSchema>)[] => {
    switch (step) {
      case 1: return ['name', 'phone', 'email', 'password', 'dob', 'gender', 'address'];
      case 2: return ['education', 'experience', 'licenseNumber', 'serviceProvinces', 'specialties'];
      case 3: return ['bankName', 'bankAccountName', 'bankAccountNumber'];
      case 4: return ['terms'];
      default: return [];
    }
  };

  const nextStep = async () => {
    const fields = getFieldsForStep(currentStep);
    const isValid = await form.trigger(fields);
    
    if (isValid) {
      // Custom validation for file uploads on step 4
      if (currentStep === 4 && (!idCardFile || !licenseFile)) {
        toast({ variant: 'destructive', title: 'ข้อมูลไม่ครบ', description: 'กรุณาอัปโหลดไฟล์บัตรประชาชนและใบอนุญาตทนายความ' });
        return;
      }
      
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        toast({
            variant: "destructive",
            title: "ข้อมูลไม่ถูกต้อง",
            description: "กรุณาตรวจสอบข้อมูลในส่วนนี้ก่อนไปขั้นตอนถัดไป",
        });
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddCustomSpecialty = (field: any) => {
    if (!customSpecialty.trim()) return;
    if (specialties.includes(customSpecialty) || customOptions.includes(customSpecialty)) {
      toast({
        title: "มีข้อมูลนี้อยู่แล้ว",
        description: "ความเชี่ยวชาญนี้มีอยู่ในรายการแล้ว",
        variant: "destructive"
      });
      return;
    }

    setCustomOptions([...customOptions, customSpecialty]);
    field.onChange([...(field.value || []), customSpecialty]);
    setCustomSpecialty('');
  };

  const benefits = [
    {
      icon: <Check className="text-green-500" />,
      text: 'เข้าถึงกลุ่มลูกความ SME และบุคคลทั่วไปที่ต้องการความช่วยเหลือทางกฎหมาย',
    },
    {
      icon: <Check className="text-green-500" />,
      text: 'ระบบจัดการเคสและนัดหมายออนไลน์ที่ใช้งานง่าย',
    },
    {
      icon: <Check className="text-green-500" />,
      text: 'เพิ่มความน่าเชื่อถือและสร้างโปรไฟล์มืออาชีพของคุณ',
    },
    {
      icon: <Check className="text-green-500" />,
      text: 'มีทีมงานคอยให้ความช่วยเหลือและสนับสนุน',
    },
  ];

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      phone: '',
      gender: undefined,
      education: '',
      experience: '',
      licenseNumber: '',
      address: '',
      serviceProvinces: '',
      bankName: undefined,
      bankAccountName: '',
      bankAccountNumber: '',
      lineId: '',
      specialties: [],
      terms: false,
    },
  });

  const handleFileChange = (setter: React.Dispatch<React.SetStateAction<File | null>>, isProfileImage: boolean = false) => (event: React.ChangeEvent<HTMLInputElement>) => {
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

      // Create preview for profile image
      if (isProfileImage) {
        const previewUrl = URL.createObjectURL(file);
        setProfileImagePreview(previewUrl);
      }
    }
  };

  async function uploadFileToPublicStorageWrapper(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    return await uploadToFirebasePublic(formData, 'profile-images');
  }

  async function uploadFileSecureWrapper(file: File, folder: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    return await uploadToFirebaseSecure(formData, folder);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    if (!auth || !firestore) {
      toast({
        variant: 'destructive',
        title: 'ระบบยังไม่พร้อม',
        description: 'กำลังเชื่อมต่อกับ Firebase กรุณารอสักครู่แล้วลองใหม่',
      });
      isSubmittingRef.current = false;
      return;
    }
    if (!idCardFile || !licenseFile) {
      toast({ variant: 'destructive', title: 'ข้อมูลไม่ครบ', description: 'กรุณาอัปโหลดไฟล์ให้ครบถ้วน' });
      isSubmittingRef.current = false;
      return;
    }

    setIsLoading(true);

    try {
      if (!turnstileToken) {
        throw new Error('กรุณายืนยันตัวตนผ่าน Cloudflare Turnstile');
      }

      const validation = await validateTurnstile(turnstileToken);
      if (!validation.success) {
        throw new Error('การยืนยันตัวตนล้มเหลว กรุณาลองใหม่');
      }

      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      // Force token refresh
      await user.getIdToken(true);

      // 2. Update user profile in Firebase Auth
      await updateProfile(user, { displayName: values.name });

      // Send Custom Email Verification
      import('@/app/actions/auth').then(({ sendCustomVerificationEmail }) => {
        sendCustomVerificationEmail(values.email, values.name).then((res) => {
          if (res.success) console.log("Custom verification email sent");
          else console.error("Error sending custom verification email:", res.error);
        });
      });

      // 3. Upload Files - SENSITIVE DATA GOES TO SECURE STORAGE
      const idCardUrl = await uploadFileSecureWrapper(idCardFile, `lawyer_documents/${user.uid}`);
      const licenseUrl = await uploadFileSecureWrapper(licenseFile, `lawyer_documents/${user.uid}`);

      // 3.1 Upload Profile Image (optional)
      let profileImageUrl = '';
      if (profileImageFile) {
        profileImageUrl = await uploadFileToPublicStorageWrapper(profileImageFile);
      }

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
        termsAccepted: true,
        termsAcceptedAt: serverTimestamp(),
      };

      await setDoc(userDocRef, userProfileData);

      // 5. Create lawyer profile document in Firestore (lawyerProfiles collection)
      const lawyerProfileRef = doc(firestore, 'lawyerProfiles', user.uid);
      const lawyerProfileData = {
        userId: user.uid,
        name: values.name,
        email: values.email,
        phone: values.phone,
        dob: values.dob,
        gender: values.gender,
        education: values.education,
        experience: values.experience,
        licenseNumber: values.licenseNumber,
        address: values.address,
        serviceProvinces: values.serviceProvinces.split(',').map(s => s.trim()),
        bankName: values.bankName,
        bankAccountName: values.bankAccountName,
        bankAccountNumber: values.bankAccountNumber,
        lineId: values.lineId,
        specialty: values.specialties,
        status: 'pending',
        description: '',
        imageUrl: profileImageUrl,
        imageHint: 'professional lawyer',
        idCardUrl: idCardUrl,
        licenseUrl: licenseUrl,
        joinedAt: serverTimestamp(),
      };

      await setDoc(lawyerProfileRef, lawyerProfileData);

      // 6. Add to Verified Lawyers Registry (Auto-add)
      try {
        // Sanitize license number for use as document ID (replace / with -)
        const docId = values.licenseNumber.replace(/\//g, '-');
        const verifiedLawyerRef = doc(firestore, 'verifiedLawyers', docId);
        const verifiedLawyerData = {
          licenseNumber: values.licenseNumber,
          firstName: values.name.split(' ')[0],
          lastName: values.name.split(' ').slice(1).join(' ') || '',
          status: 'pending',
          registeredDate: new Date().toISOString(),
          province: values.serviceProvinces.split(',')[0]?.trim() || values.address,
          updatedAt: serverTimestamp()
        };
        await setDoc(verifiedLawyerRef, verifiedLawyerData);
      } catch (err) {
        console.error("Error adding to verified registry:", err);
        // Don't fail the whole registration if this optional step fails
      }

      // Create Admin Notification
      try {
        await addDoc(collection(firestore, 'notifications'), {
          type: 'lawyer_registration',
          title: 'ทนายความใหม่',
          message: `มีทนายความใหม่สมัครสมาชิก: ${values.name}`,
          createdAt: serverTimestamp(),
          read: false,
          recipient: 'admin',
          link: `/admin/lawyers/${user.uid}`,
          relatedId: user.uid
        });

        // 7. Send Real-time Notification to Admin
        const { notifyAdminNewLawyerAction } = await import('@/app/actions/notification-actions');
        notifyAdminNewLawyerAction(values.name, values.email).catch(e => 
          console.error("Async admin notification error:", e)
        );
      } catch (e) {
        console.error("Error creating notification:", e);
      }

      toast({
        title: 'สมัครเข้าร่วมสำเร็จ',
        description: 'กรุณาตรวจสอบอีเมลเพื่อยืนยันตัวตน และรอเจ้าหน้าที่ตรวจสอบข้อมูล',
      });

      await signOut(auth);
      router.push(`/registration-success`);

    } catch (error: any) {
      console.error(error);

      // Rollback: If user was created but subsequent steps failed, delete the user to prevent "Email already in use" on retry
      if (auth.currentUser && error.code !== 'auth/email-already-in-use') {
        try {
          await auth.currentUser.delete();
          console.log("Rolled back: Deleted zombie auth user due to registration failure.");
        } catch (deleteErr) {
          console.error("Failed to rollback auth user:", deleteErr);
        }
      }

      let errorMessage = 'เกิดข้อผิดพลาดที่ไม่รู้จัก';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น หรือเข้าสู่ระบบ';
      } else if (error.message) {
        // Translate common errors
        if (error.message.includes("File too large")) errorMessage = "ไฟล์มีขนาดใหญ่เกินไป";
        else errorMessage = error.message;
      }
      toast({
        variant: 'destructive',
        title: 'การสมัครไม่สำเร็จ',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }

  return (
    <>
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="mb-8">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            กลับไปหน้าแรก
          </Link>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left Column: Marketing Content */}
          <div className="space-y-6 lg:sticky lg:top-24">
            <div className="relative h-64 w-full rounded-3xl overflow-hidden mb-6">
              <Image
                src={lawyerCoverImg}
                alt="Thai Lawyer"
                fill
                className="object-cover"
              />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground font-headline">
              เข้าร่วมเป็นส่วนหนึ่งของ Lawslane
            </h1>
            <p className="text-lg text-muted-foreground">
              ขยายฐานลูกความและพัฒนาการทำงานของคุณไปกับแพลตฟอร์มกฎหมายสำหรับยุคดิจิทัล
              เรากำลังมองหาทนายความผู้มีความสามารถและมุ่งมั่นที่จะมอบบริการที่ดีที่สุดเพื่อเข้าร่วมเครือข่ายของเรา
            </p>
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0">{benefit.icon}</div>
                  <p className="text-foreground/90">{benefit.text}</p>
                </div>
              ))}
            </div>
            <div className="pt-6 hidden lg:block">
              <Button asChild size="lg" variant="outline" className="w-full md:w-auto rounded-full">
                <Link href="/lawyer-login">เข้าสู่ระบบสำหรับทนายที่มีบัญชีแล้ว</Link>
              </Button>
            </div>

            <div className="p-6 bg-primary/5 rounded-[32px] border border-primary/10 space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
                    <FileText className="w-5 h-5" />
                    เอกสารที่ต้องเตรียม
                </h3>
                <p className="text-sm text-muted-foreground">เพื่อให้การสมัครเป็นไปอย่างรวดเร็ว กรุณาเตรียมเอกสารดังต่อไปนี้</p>
                <Button 
                    variant="outline" 
                    className="w-full rounded-2xl h-12 border-primary/20 bg-white/50 hover:bg-primary/5 font-bold"
                    onClick={() => setShowWelcome(true)}
                >
                    ดูรายการเอกสารทั้งหมด
                </Button>
            </div>

          </div>

          {/* Right Column: Signup Form */}
          <div className="relative">
            <Card className="shadow-2xl border-none rounded-[40px] overflow-hidden bg-white/80 backdrop-blur-xl dark:bg-slate-900/80">
              <CardHeader className="text-center pt-10 pb-6">
                <div className="flex justify-center mb-8">
                    <div className="flex items-center gap-2 max-w-md w-full px-4">
                        {[1, 2, 3, 4].map((step) => (
                            <div key={step} className="flex-1 flex flex-col items-center gap-2">
                                <div 
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 shadow-lg ${
                                        currentStep === step 
                                            ? 'bg-primary text-white ring-4 ring-primary/20 scale-110' 
                                            : currentStep > step 
                                                ? 'bg-green-500 text-white' 
                                                : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                                    }`}
                                >
                                    {currentStep > step ? <Check className="w-5 h-5" /> : step}
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${currentStep === step ? 'text-primary' : 'text-slate-400'}`}>
                                    {step === 1 ? 'Personal' : step === 2 ? 'Professional' : step === 3 ? 'Bank' : 'Verification'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <CardTitle className="text-3xl font-bold font-headline bg-gradient-to-br from-slate-900 to-slate-500 bg-clip-text text-transparent dark:from-white dark:to-slate-400">
                  {currentStep === 1 ? 'ข้อมูลพื้นฐาน' : currentStep === 2 ? 'ข้อมูลวิชาชีพ' : currentStep === 3 ? 'ข้อมูลการรับเงิน' : 'ยืนยันตัวตน'}
                </CardTitle>
                <CardDescription className="text-base">
                  {currentStep === 1 ? 'กรอกข้อมูลส่วนตัวเพื่อเริ่มต้นสร้างบัญชี' : currentStep === 2 ? 'ระบุความเชี่ยวชาญและประสบการณ์ของคุณ' : currentStep === 3 ? 'ข้อมูลสำหรับการรับค่าบริการเมื่อเสร็จสิ้นงาน' : 'อัปโหลดเอกสารสำคัญเพื่อตรวจสอบความถูกต้อง'}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-8 pb-10">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
                    toast({
                      variant: "destructive",
                      title: "กรุณากรอกข้อมูลให้ครบถ้วน",
                      description: "มีบางช่องที่ยังไม่ได้กรอก หรือกรอกไม่ถูกต้อง (ดูสีแดงในฟอร์ม)",
                    });
                  })} className="space-y-8">

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="space-y-6"
                        >
                            {currentStep === 1 && (
                                <>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 gap-4">
                                            <FormField control={form.control} name="name" render={({ field }) => (
                                                <FormItem><FormLabel className="font-bold">ชื่อ-นามสกุล (ตามบัตรประชาชน)</FormLabel><FormControl><Input {...field} className="rounded-2xl h-12 px-5 border-slate-200 focus:ring-primary/20" placeholder="นาย สมชาย ใจดี" /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={form.control} name="phone" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-bold">เบอร์โทรศัพท์</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                            placeholder="0812345678"
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/[^0-9]/g, '');
                                                                field.onChange(value);
                                                            }}
                                                            maxLength={10}
                                                            className="rounded-2xl h-12 px-5 border-slate-200"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="dob" render={({ field }) => (
                                                <FormItem className="flex flex-col"><FormLabel className="font-bold">วันเกิด</FormLabel>
                                                    <div className="flex gap-2">
                                                        <Select value={field.value ? field.value.getDate().toString() : undefined} onValueChange={(value) => {
                                                            const current = field.value || new Date();
                                                            const newDate = new Date(current.getFullYear(), current.getMonth(), parseInt(value));
                                                            field.onChange(newDate);
                                                        }}>
                                                            <FormControl><SelectTrigger className="rounded-2xl h-12"><SelectValue placeholder="วัน" /></SelectTrigger></FormControl>
                                                            <SelectContent>{Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (<SelectItem key={day} value={day.toString()}>{day}</SelectItem>))}</SelectContent>
                                                        </Select>
                                                        <Select value={field.value ? field.value.getMonth().toString() : undefined} onValueChange={(value) => {
                                                            const current = field.value || new Date();
                                                            const newDate = new Date(current.getFullYear(), parseInt(value), current.getDate());
                                                            field.onChange(newDate);
                                                        }}>
                                                            <FormControl><SelectTrigger className="flex-1 rounded-2xl h-12"><SelectValue placeholder="เดือน" /></SelectTrigger></FormControl>
                                                            <SelectContent>{["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."].map((month, index) => (<SelectItem key={index} value={index.toString()}>{month}</SelectItem>))}</SelectContent>
                                                        </Select>
                                                        <Select value={field.value ? field.value.getFullYear().toString() : undefined} onValueChange={(value) => {
                                                            const current = field.value || new Date();
                                                            const newDate = new Date(parseInt(value), current.getMonth(), current.getDate());
                                                            field.onChange(newDate);
                                                        }}>
                                                            <FormControl><SelectTrigger className="rounded-2xl h-12"><SelectValue placeholder="ปี" /></SelectTrigger></FormControl>
                                                            <SelectContent>{Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - i).map((year) => (<SelectItem key={year} value={year.toString()}>{year + 543}</SelectItem>))}</SelectContent>
                                                        </Select>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={form.control} name="gender" render={({ field }) => (
                                                <FormItem><FormLabel className="font-bold">เพศ</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl><SelectTrigger className="rounded-2xl h-12 px-5"><SelectValue placeholder="เลือกเพศ" /></SelectTrigger></FormControl>
                                                        <SelectContent><SelectItem value="ชาย">ชาย</SelectItem><SelectItem value="หญิง">หญิง</SelectItem><SelectItem value="อื่นๆ">อื่นๆ</SelectItem></SelectContent>
                                                    </Select>
                                                    <FormMessage /></FormItem>
                                            )} />
                                        </div>

                                        <FormField control={form.control} name="address" render={({ field }) => (
                                            <FormItem><FormLabel className="font-bold">ที่อยู่ติดต่อ</FormLabel><FormControl><Input {...field} className="rounded-2xl h-12 px-5" placeholder="บ้านเลขที่, ถนน, ตำบล..." /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="email" render={({ field }) => (
                                                <FormItem><FormLabel className="font-bold">อีเมล (ใช้เข้าสู่ระบบ)</FormLabel><FormControl><Input placeholder="name@example.com" {...field} className="rounded-2xl h-12 px-5" /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={form.control} name="password" render={({ field }) => (
                                                <FormItem><FormLabel className="font-bold">รหัสผ่าน</FormLabel><FormControl><Input type="password" placeholder="รหัสผ่าน 6 หลักขึ้นไป" {...field} className="rounded-2xl h-12 px-5" /></FormControl><FormMessage /></FormItem>
                                            )} />
                                        </div>
                                    </div>
                                </>
                            )}

                            {currentStep === 2 && (
                                <>
                                    <div className="space-y-4">
                                        <FormField control={form.control} name="education" render={({ field }) => (
                                            <FormItem><FormLabel className="font-bold text-slate-700 dark:text-slate-200">ประวัติการศึกษา</FormLabel><FormControl><Input {...field} className="rounded-2xl h-12 px-5" placeholder="น.บ. (เกียรตินิยม), มหาวิทยาลัย..." /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="experience" render={({ field }) => (
                                            <FormItem><FormLabel className="font-bold text-slate-700 dark:text-slate-200">ประสบการณ์ทำงานหลัก</FormLabel><FormControl><Input {...field} className="rounded-2xl h-12 px-5" placeholder="ความเชี่ยวชาญพิเศษ, จำนวนปีที่ปฏิบัติงาน..." /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="licenseNumber" render={({ field }) => (
                                            <FormItem><FormLabel className="font-bold text-slate-700 dark:text-slate-200">เลขที่ใบอนุญาตว่าความ</FormLabel><FormControl><Input {...field} className="rounded-2xl h-12 px-5" placeholder="XX/XXXX" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        
                                        <FormField control={form.control} name="serviceProvinces" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-slate-700 dark:text-slate-200">จังหวัดที่ให้บริการ</FormLabel>
                                                <div className="space-y-3">
                                                    <Select onValueChange={(value) => {
                                                        const currentProvinces = field.value ? field.value.split(',').map(s => s.trim()).filter(s => s) : [];
                                                        if (!currentProvinces.includes(value)) {
                                                            const newProvinces = [...currentProvinces, value];
                                                            field.onChange(newProvinces.join(','));
                                                        }
                                                    }}>
                                                        <FormControl><SelectTrigger className="rounded-2xl h-12 px-5"><SelectValue placeholder="เลือกจังหวัด" /></SelectTrigger></FormControl>
                                                        <SelectContent className="max-h-[300px]">
                                                            {THAI_PROVINCES.map((region) => (
                                                                <SelectGroup key={region.region}>
                                                                    <SelectLabel className="font-bold px-4 py-2 bg-slate-50 dark:bg-slate-800">{region.region}</SelectLabel>
                                                                    {region.provinces.map((province) => (<SelectItem key={province} value={province}>{province}</SelectItem>))}
                                                                </SelectGroup>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <div className="flex flex-wrap gap-2">
                                                        {field.value ? field.value.split(',').map(s => s.trim()).filter(s => s).map((province) => (
                                                            <Badge key={province} variant="secondary" className="pl-3 pr-1 py-1 rounded-full bg-primary/5 text-primary border-primary/10 flex items-center gap-1 font-bold">
                                                                {province}
                                                                <button type="button" onClick={() => {
                                                                    const currentProvinces = field.value.split(',').map(s => s.trim()).filter(s => s);
                                                                    field.onChange(currentProvinces.filter(p => p !== province).join(','));
                                                                }} className="hover:bg-primary/10 rounded-full p-0.5 transition-colors"><X className="h-3.5 w-3.5" /></button>
                                                            </Badge>
                                                        )) : <span className="text-xs text-muted-foreground italic">ยังไม่ได้ระบุจังหวัด</span>}
                                                    </div>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )} />

                                        <FormField control={form.control} name="specialties" render={() => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-slate-700 dark:text-slate-200">ความเชี่ยวชาญเฉพาะทาง</FormLabel>
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                    {specialties.map((item) => (
                                                        <FormField key={item} control={form.control} name="specialties" render={({ field }) => (
                                                            <FormItem className={`flex flex-row items-center space-x-3 space-y-0 p-3 rounded-2xl border transition-all duration-300 ${field.value?.includes(item) ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-slate-50/50 border-slate-100'}`}>
                                                                <FormControl><Checkbox checked={field.value?.includes(item)} onCheckedChange={(checked) => checked ? field.onChange([...field.value, item]) : field.onChange(field.value?.filter((v: string) => v !== item))} /></FormControl>
                                                                <FormLabel className="font-medium text-sm cursor-pointer">{item}</FormLabel>
                                                            </FormItem>
                                                        )} />
                                                    ))}
                                                    {customOptions.map((item) => (
                                                        <FormField key={item} control={form.control} name="specialties" render={({ field }) => (
                                                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 bg-blue-50/50 border border-blue-100 rounded-2xl group relative">
                                                                <FormControl><Checkbox checked={field.value?.includes(item)} onCheckedChange={(checked) => checked ? field.onChange([...field.value, item]) : field.onChange(field.value?.filter((v: string) => v !== item))} /></FormControl>
                                                                <FormLabel className="font-medium text-sm pr-6">{item}</FormLabel>
                                                                <button type="button" onClick={() => {
                                                                    setCustomOptions(customOptions.filter(opt => opt !== item));
                                                                    field.onChange(field.value?.filter((v: string) => v !== item));
                                                                }} className="absolute right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-4 w-4" /></button>
                                                            </FormItem>
                                                        )} />
                                                    ))}
                                                </div>
                                                <div className="flex gap-2 mt-4">
                                                    <Input placeholder="ระบุความเชี่ยวชาญอื่นเพิ่มเติม..." value={customSpecialty} onChange={(e) => setCustomSpecialty(e.target.value)} className="rounded-2xl h-11 px-5" 
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                if (!customSpecialty.trim()) return;
                                                                if (specialties.includes(customSpecialty) || customOptions.includes(customSpecialty)) return;
                                                                setCustomOptions([...customOptions, customSpecialty]);
                                                                form.setValue('specialties', [...(form.getValues('specialties') || []), customSpecialty]);
                                                                setCustomSpecialty('');
                                                            }
                                                        }}
                                                    />
                                                    <Button type="button" variant="outline" onClick={() => {
                                                        if (!customSpecialty.trim()) return;
                                                        if (specialties.includes(customSpecialty) || customOptions.includes(customSpecialty)) return;
                                                        setCustomOptions([...customOptions, customSpecialty]);
                                                        form.setValue('specialties', [...(form.getValues('specialties') || []), customSpecialty]);
                                                        setCustomSpecialty('');
                                                    }} className="rounded-2xl px-6">เพิ่ม</Button>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>
                                </>
                            )}

                            {currentStep === 3 && (
                                <div className="space-y-6">
                                    <FormField control={form.control} name="bankName" render={({ field }) => (
                                        <FormItem><FormLabel className="font-bold">เลือกธนาคาร</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger className="rounded-2xl h-16 px-5 border-slate-200"><SelectValue placeholder="ค้นหาและเลือกธนาคาร" /></SelectTrigger></FormControl>
                                                <SelectContent className="max-h-[350px]">
                                                    {banks.map(bank => (
                                                        <SelectItem key={bank.name} value={bank.name} className="py-3">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 relative rounded-xl overflow-hidden border bg-white flex items-center justify-center p-1 shadow-sm">
                                                                    <Image src={bank.logo} alt={bank.name} className="object-contain" fill />
                                                                </div>
                                                                <span className="font-bold text-slate-700 dark:text-slate-200">{bank.name}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="bankAccountName" render={({ field }) => (
                                        <FormItem><FormLabel className="font-bold">ชื่อบัญชีธนาคาร</FormLabel>
                                            <FormControl><Input {...field} className="rounded-2xl h-12 px-5 border-slate-200" placeholder="ชื่อต้องตรงกับชื่อผู้สมัคร" /></FormControl>
                                            <CardDescription className="px-1 italic text-slate-500">หมายเหตุ: ชื่อบัญชีต้องตรงกับชื่อผู้สมัครเพื่อให้การเบิกจ่ายรวดเร็ว</CardDescription>
                                            <FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="bankAccountNumber" render={({ field }) => (
                                        <FormItem><FormLabel className="font-bold">หมายเลขบัญชี</FormLabel>
                                            <FormControl><Input {...field} onChange={(e) => field.onChange(formatBankAccount(e.target.value))} maxLength={14} className="rounded-2xl h-12 px-5 border-slate-200" placeholder="000-0-00000-0" /></FormControl>
                                            <FormMessage /></FormItem>
                                    )} />
                                    
                                    <FormField control={form.control} name="lineId" render={({ field }) => (
                                        <FormItem><FormLabel className="font-bold">ID LINE (ใช้สำหรับการติดต่อเร่งด่วน)</FormLabel>
                                            <FormControl><Input {...field} className="rounded-2xl h-12 px-5 border-slate-200" placeholder="@username" /></FormControl>
                                            <FormMessage /></FormItem>
                                    )} />
                                </div>
                            )}

                            {currentStep === 4 && (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="space-y-4">
                                            <Label className="font-bold text-lg text-slate-800 dark:text-white">รูปโปรไฟล์เพื่อสร้างความน่าเชื่อถือ</Label>
                                            <div className="flex flex-col items-center gap-6 p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[32px] bg-slate-50/50 dark:bg-slate-800/30">
                                                {profileImagePreview ? (
                                                    <div className="relative w-40 h-40 rounded-full overflow-hidden ring-8 ring-white dark:ring-slate-900 shadow-2xl">
                                                        <Image src={profileImagePreview} alt="Preview" fill className="object-cover" />
                                                        <button 
                                                            type="button" 
                                                            onClick={() => { setProfileImageFile(null); setProfileImagePreview(null); }}
                                                            className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
                                                        >
                                                            <X className="w-8 h-8 text-white" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="w-32 h-32 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                                                        <User className="w-16 h-16" />
                                                    </div>
                                                )}
                                                <div className="text-center">
                                                    <p className="text-sm font-medium text-slate-500 mb-4">แนะนำ: รูปถ่ายหน้าตรง พื้นหลังเรียบ เพื่อความเป็นมืออาชีพ</p>
                                                    <Input id="profile-image-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange(setProfileImageFile, true)} />
                                                    <Button type="button" variant="outline" className="rounded-full px-8 h-12 border-primary text-primary hover:bg-primary/5" onClick={() => document.getElementById('profile-image-upload')?.click()}>
                                                        {profileImagePreview ? 'เปลี่ยนรูปภาพ' : 'เลือกไฟล์รูปภาพ'}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-3">
                                                <Label className="font-bold">ไฟล์บัตรประชาชน</Label>
                                                <div className={`p-5 border-2 border-dashed rounded-3xl transition-all ${idCardFile ? 'border-green-500/30 bg-green-50/20' : 'border-slate-200 bg-slate-50/30'}`}>
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${idCardFile ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                                                            <FileText className="w-5 h-5" />
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-600 truncate flex-grow">{idCardFile ? idCardFile.name : 'ยังไม่ได้แนบไฟล์'}</span>
                                                    </div>
                                                    <Input id="id-card-upload" type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange(setIdCardFile)} />
                                                    <Button type="button" variant="outline" className="w-full rounded-2xl h-11" onClick={() => document.getElementById('id-card-upload')?.click()}>เลือกไฟล์</Button>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="font-bold">ไฟล์ใบอนุญาตทนายความ</Label>
                                                <div className={`p-5 border-2 border-dashed rounded-3xl transition-all ${licenseFile ? 'border-green-500/30 bg-green-50/20' : 'border-slate-200 bg-slate-50/30'}`}>
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${licenseFile ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                                                            <FileText className="w-5 h-5" />
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-600 truncate flex-grow">{licenseFile ? licenseFile.name : 'ยังไม่ได้แนบไฟล์'}</span>
                                                    </div>
                                                    <Input id="license-upload" type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange(setLicenseFile)} />
                                                    <Button type="button" variant="outline" className="w-full rounded-2xl h-11" onClick={() => document.getElementById('license-upload')?.click()}>เลือกไฟล์</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="terms"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-[24px] border border-slate-200 p-6 bg-slate-50/50">
                                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-1" /></FormControl>
                                                <div className="space-y-1">
                                                    <FormLabel className="text-sm leading-relaxed text-slate-600">
                                                        ข้าพเจ้ายอมรับ <Link href="/privacy" className="text-primary font-bold hover:underline">นโยบายความเป็นส่วนตัว</Link> และ <Link href="/terms" className="text-primary font-bold hover:underline">ข้อกำหนดการใช้งาน</Link> ของ Lawslane และยืนยันว่าข้อมูลทั้งหมดเป็นความจริง
                                                    </FormLabel>
                                                    <FormMessage />
                                                </div>
                                            </FormItem>
                                        )}
                                    />

                                    <div className="flex justify-center">
                                        <TurnstileWidget onVerify={setTurnstileToken} />
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    <div className="flex gap-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                        {currentStep > 1 && (
                            <Button 
                                type="button" 
                                variant="outline" 
                                className="h-14 flex-1 rounded-full text-slate-600 font-bold hover:bg-slate-50" 
                                onClick={prevStep}
                                disabled={isLoading}
                            >
                                ย้อนกลับ
                            </Button>
                        )}
                        
                        {currentStep < totalSteps ? (
                            <Button 
                                type="button" 
                                className="h-14 flex-1 rounded-full font-bold shadow-lg shadow-primary/20" 
                                onClick={nextStep}
                            >
                                ถัดไป
                            </Button>
                        ) : (
                            <Button 
                                type="submit" 
                                className="h-14 flex-1 rounded-full font-bold shadow-lg shadow-primary/30 text-lg" 
                                disabled={isLoading}
                            >
                                {isLoading && <Loader2 className="mr-3 h-5 w-5 animate-spin" />}
                                ยืนยันการส่งใบสมัคร
                            </Button>
                        )}
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <div className="mt-8 lg:hidden text-center">
              <Link href="/lawyer-login" className="text-primary font-bold hover:underline text-sm">
                เข้าสู่ระบบสำหรับทนายที่มีบัญชีแล้ว
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="max-w-[420px] !rounded-[48px] sm:!rounded-[48px] border-none shadow-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-xl">
            <div className="relative h-24 bg-primary flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-foreground opacity-20" />
                <div className="absolute -top-12 -left-12 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                <FileText className="w-10 h-10 text-white relative z-10" />
            </div>
            
            <div className="p-6 space-y-5">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold font-headline text-slate-900 text-center">
                        เตรียมเอกสารให้พร้อม
                    </DialogTitle>
                    <DialogDescription className="text-center text-slate-600 text-sm">
                        กรุณาเตรียมเอกสารดังต่อไปนี้ให้พร้อม<br />ก่อนเริ่มกรอกข้อมูลสมัคร
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3">
                    {[
                        { title: "บัตรประชาชน", icon: <User className="w-4 h-4" /> },
                        { title: "ใบอนุญาตทนายความ", icon: <FileText className="w-4 h-4" /> },
                        { title: "รูปถ่ายโปรไฟล์", icon: <User className="w-4 h-4" /> },
                        { title: "บัญชีธนาคาร", icon: <Info className="w-4 h-4" /> }
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-[20px] bg-slate-50 border border-slate-100 hover:border-primary/20 transition-all">
                            <div className="w-10 h-10 rounded-[16px] bg-white shadow-sm flex items-center justify-center text-primary border border-slate-50">
                                {item.icon}
                            </div>
                            <p className="font-bold text-slate-800 text-sm">{item.title}</p>
                        </div>
                    ))}
                </div>

                <div className="p-4 rounded-[20px] bg-amber-50/50 border border-amber-100 flex gap-2">
                    <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-800 leading-tight">
                        <strong>ข้อแนะนำ:</strong> ไฟล์ภาพหรือ PDF ขนาดไม่เกิน 5MB ต่อไฟล์
                    </p>
                </div>

                <DialogFooter className="pt-2">
                    <Button 
                        onClick={() => setShowWelcome(false)} 
                        className="w-full h-12 rounded-full font-bold shadow-lg shadow-primary/20"
                    >
                        เริ่มสมัครสมาชิก
                    </Button>
                </DialogFooter>
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}
