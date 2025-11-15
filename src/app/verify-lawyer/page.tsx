
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Search, ShieldCheck, ShieldAlert, Loader2, FileCheck2 } from 'lucide-react';
import Image from 'next/image';
import { getLawyerById } from '@/lib/data';
import type { LawyerProfile } from '@/lib/types';

export default function VerifyLawyerPage() {
  const [licenseNumber, setLicenseNumber] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'found' | 'not_found' | 'error' | null>(null);
  const [verifiedLawyer, setVerifiedLawyer] = useState<LawyerProfile | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setLicenseNumber(''); // Clear license number if a file is uploaded
    }
  };

  const handleVerify = async () => {
    if (!licenseNumber && !uploadedFile) return;

    setIsVerifying(true);
    setVerificationResult(null);
    setVerifiedLawyer(null);

    // Simulate API call and verification logic
    setTimeout(async () => {
      try {
        // Simulate logic: if input is '12345/2550', we find a specific lawyer.
        // In a real scenario, this would be an API call to a database.
        if (licenseNumber === '12345/2550' || uploadedFile) {
          const lawyer = await getLawyerById('1'); // Get a mock lawyer
          if (lawyer) {
            setVerifiedLawyer(lawyer);
            setVerificationResult('found');
          } else {
            setVerificationResult('not_found');
          }
        } else {
          setVerificationResult('not_found');
        }
      } catch (error) {
        setVerificationResult('error');
      } finally {
        setIsVerifying(false);
      }
    }, 1500);
  };
  
  const ResultCard = () => {
      if (!verificationResult) return null;

      switch(verificationResult) {
          case 'found':
              if (!verifiedLawyer) return null;
              return (
                  <Card className="border-green-500 bg-green-50/50">
                      <CardHeader className="text-center">
                          <ShieldCheck className="w-12 h-12 mx-auto text-green-600"/>
                          <CardTitle className="text-green-800">ตรวจสอบพบข้อมูล</CardTitle>
                          <CardDescription>ทนายความนี้ได้รับการยืนยันในระบบ Lawlane</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col items-center text-center">
                          <Image
                            src={verifiedLawyer.imageUrl}
                            alt={verifiedLawyer.name}
                            width={100}
                            height={100}
                            className="rounded-full border-4 border-white shadow-lg"
                           />
                          <p className="font-bold text-xl mt-4">{verifiedLawyer.name}</p>
                          <p className="text-muted-foreground">เลขที่ใบอนุญาต: 12345/2550 (ข้อมูลจำลอง)</p>
                          <p className="text-primary font-semibold mt-1">{verifiedLawyer.specialty.join(', ')}</p>
                      </CardContent>
                  </Card>
              );
          case 'not_found':
              return (
                   <Card className="border-yellow-500 bg-yellow-50/50">
                      <CardHeader className="text-center">
                          <ShieldAlert className="w-12 h-12 mx-auto text-yellow-600"/>
                          <CardTitle className="text-yellow-800">ไม่พบข้อมูล</CardTitle>
                          <CardDescription>ไม่พบข้อมูลทนายความตามข้อมูลที่ระบุ<br/>กรุณาตรวจสอบความถูกต้อง หรือติดต่อเจ้าหน้าที่</CardDescription>
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
              <div className="space-y-2">
                <Label htmlFor="license-number">เลขใบอนุญาตว่าความ</Label>
                <Input
                  id="license-number"
                  placeholder="เช่น 12345/2550"
                  value={licenseNumber}
                  onChange={(e) => {
                    setLicenseNumber(e.target.value);
                    if(uploadedFile) setUploadedFile(null);
                  }}
                  disabled={isVerifying || !!uploadedFile}
                />
              </div>

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
                <Label>อัปโหลดรูปภาพบัตรทนายความ (จำลอง)</Label>
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
                    <Input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept="image/png, image/jpeg"/>
                </div>
              </div>
              
              <Button onClick={handleVerify} className="w-full" size="lg" disabled={isVerifying || (!licenseNumber && !uploadedFile)}>
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
                  <Loader2 className="w-8 h-8 mx-auto animate-spin mb-2"/>
                  <p>กำลังตรวจสอบข้อมูลจากสภาทนายความ (จำลอง)...</p>
              </div>
          )}

          <ResultCard />

        </div>
      </div>
    </div>
  );
}
