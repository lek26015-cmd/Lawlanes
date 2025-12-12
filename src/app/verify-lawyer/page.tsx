
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Search, ShieldCheck, ShieldAlert, Loader2, FileCheck2, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { getLawyerById } from '@/lib/data';
import type { LawyerProfile } from '@/lib/types';
import React from 'react';
import Link from 'next/link';
import { useFirebase } from '@/firebase';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs } from 'firebase/firestore';

function VerifyLawyerContent() {
  const searchParams = useSearchParams();
  const licenseNumberFromQuery = searchParams.get('licenseNumber');
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [licenseNumber, setLicenseNumber] = useState(licenseNumberFromQuery || '');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'found' | 'not_found' | 'error' | null>(null);
  const [verifiedLawyer, setVerifiedLawyer] = useState<LawyerProfile | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({
          variant: "destructive",
          title: "ไฟล์มีขนาดใหญ่เกินไป",
          description: `กรุณาอัปโหลดไฟล์ขนาดไม่เกิน ${MAX_FILE_SIZE_MB}MB`
        });
        event.target.value = ''; // Reset input
        return;
      }
      setUploadedFile(file);
      setLicenseNumber(''); // Clear license number if a file is uploaded
    }
  };

  useEffect(() => {
    if (licenseNumberFromQuery) {
      handleVerify(licenseNumberFromQuery);
    }
  }, [licenseNumberFromQuery]);

  const handleVerify = async (numberToVerify?: string) => {
    if (!firestore) return;
    const targetLicenseNumber = numberToVerify || licenseNumber;
    if (!targetLicenseNumber && !uploadedFile) return;

    setIsVerifying(true);
    setVerificationResult(null);
    setVerifiedLawyer(null);

    try {
      if (targetLicenseNumber) {
        // Query Firestore for lawyer with this license number
        const lawyersRef = collection(firestore, 'lawyerProfiles');
        const q = query(lawyersRef, where('licenseNumber', '==', targetLicenseNumber), where('status', '==', 'approved'));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const lawyerDoc = querySnapshot.docs[0];
          setVerifiedLawyer({ id: lawyerDoc.id, ...lawyerDoc.data() } as LawyerProfile);
          setVerificationResult('found');
        } else {
          setVerificationResult('not_found');
        }
      } else if (uploadedFile) {
        // For file upload, we can't easily "verify" against a DB without OCR or manual review.
        // For now, we'll show a message that it's sent for manual verification, or just keep it as a "search by ID" if we had OCR.
        // Since the user asked for "Real Data", and we don't have OCR, we should probably inform them.
        // However, to keep the flow working as a "Request", we might want to just say "Not Found" or handle it differently.
        // Let's assume for this feature, we only support Real Verification via License Number for now.
        // Or we can simulate a "Pending Manual Review" state.
        // Let's stick to License Number for real-time verification.
        toast({
          title: "ระบบตรวจสอบรูปภาพยังไม่เปิดให้บริการ",
          description: "กรุณาระบุเลขใบอนุญาตว่าความเพื่อตรวจสอบทันที",
        });
        setVerificationResult(null);
      }
    } catch (error) {
      console.error("Verification error:", error);
      setVerificationResult('error');
    } finally {
      setIsVerifying(false);
    }
  };

  const ResultCard = () => {
    if (!verificationResult) return null;

    switch (verificationResult) {
      case 'found':
        if (!verifiedLawyer) return null;
        return (
          <Card className="border-green-500 bg-green-50/50">
            <CardHeader className="text-center">
              <ShieldCheck className="w-12 h-12 mx-auto text-green-600" />
              <CardTitle className="text-green-800">ตรวจสอบพบข้อมูล</CardTitle>
              <CardDescription>ทนายความนี้ได้รับการยืนยันในระบบ Lawslane</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center text-center">
              <Image
                src={verifiedLawyer.imageUrl}
                alt={verifiedLawyer.name}
                width={100}
                height={100}
                className="rounded-full object-cover border-4 border-white shadow-lg"
              />
              <p className="font-bold text-xl mt-4">{verifiedLawyer.name}</p>
              <p className="text-muted-foreground">เลขที่ใบอนุญาต: {verifiedLawyer.licenseNumber}</p>
              <p className="text-primary font-semibold mt-1">{verifiedLawyer.specialty.join(', ')}</p>
              <Button asChild className="mt-4">
                <Link href={`/lawyers/${verifiedLawyer.id}`}>
                  ดูโปรไฟล์
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      case 'not_found':
        return (
          <Card className="border-yellow-500 bg-yellow-50/50">
            <CardHeader className="text-center">
              <ShieldAlert className="w-12 h-12 mx-auto text-yellow-600" />
              <CardTitle className="text-yellow-800">ไม่พบข้อมูล</CardTitle>
              <CardDescription>ไม่พบข้อมูลทนายความตามข้อมูลที่ระบุ<br />กรุณาตรวจสอบความถูกต้อง หรือติดต่อเจ้าหน้าที่</CardDescription>
            </CardHeader>
          </Card>
        );
      default:
        return null;
    }
  }

  return (
    <div className="bg-gray-50 min-h-[calc(100vh-160px)] py-12">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-2xl mx-auto space-y-8">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            กลับไปหน้าแรก
          </Link>
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl font-headline">
              ตรวจสอบสถานะทนายความ
            </h1>
            <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
              สร้างความมั่นใจโดยการตรวจสอบข้อมูลใบอนุญาตว่าความ
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>ระบุข้อมูลเพื่อตรวจสอบ</CardTitle>
              <CardDescription>กรอกเลขใบอนุญาตว่าความ หรืออัปโหลดรูปภาพบัตรทนายความ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerify();
                }}
              >
                <Label htmlFor="license-number">เลขใบอนุญาตว่าความ</Label>
                <Input
                  id="license-number"
                  placeholder="เช่น 12345/2550"
                  value={licenseNumber}
                  onChange={(e) => {
                    setLicenseNumber(e.target.value);
                    if (uploadedFile) setUploadedFile(null);
                  }}
                  disabled={isVerifying || !!uploadedFile}
                />
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    หรือ
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>อัปโหลดรูปภาพบัตรทนายความ</Label>
                <div
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  {uploadedFile ? (
                    <div className="text-center text-green-600 font-medium">
                      <FileCheck2 className="w-8 h-8 mx-auto mb-2" />
                      <p>{uploadedFile.name}</p>
                      <p className="text-xs text-muted-foreground">คลิกเพื่อเลือกไฟล์อื่น</p>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Upload className="w-8 h-8 mx-auto mb-2" />
                      <p>คลิกเพื่ออัปโหลด</p>
                      <p className="text-xs">PNG, JPG, JPEG</p>
                    </div>
                  )}
                  <Input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept="image/png, image/jpeg" />
                </div>
              </div>

              <Button onClick={() => handleVerify()} className="w-full" size="lg" disabled={isVerifying || (!licenseNumber && !uploadedFile)}>
                {isVerifying ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                ตรวจสอบข้อมูล
              </Button>
            </CardContent>
          </Card>

          {isVerifying && (
            <div className="text-center text-muted-foreground">
              <Loader2 className="w-8 h-8 mx-auto animate-spin mb-2" />
              <p>กำลังตรวจสอบข้อมูลจากสภาทนายความ (จำลอง)...</p>
            </div>
          )}

          <ResultCard />

        </div>
      </div>
    </div>
  );
}


export default function VerifyLawyerPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <VerifyLawyerContent />
    </React.Suspense>
  )
}
