'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export function SmeContactForm() {
    const { firestore } = useFirebase();
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        company: '',
        email: '',
        tel: '',
        message: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore) return;

        setIsLoading(true);
        setError(null);
        try {
            await addDoc(collection(firestore, 'sme_inquiries'), {
                ...formData,
                status: 'new',
                createdAt: serverTimestamp(),
            });
            setIsSuccess(true);
        } catch (error) {
            console.error("Error submitting form:", error);
            setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <Card className="shadow-xl border-none h-full flex items-center justify-center bg-green-50">
                <CardContent className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-green-800">ส่งข้อมูลสำเร็จ!</h3>
                    <p className="text-green-700 max-w-xs mx-auto">
                        ขอบคุณที่สนใจบริการของเรา ทีมงาน Lawlanes จะติดต่อกลับไปยังคุณ {formData.name} โดยเร็วที่สุดครับ
                    </p>
                    <Button variant="outline" onClick={() => setIsSuccess(false)} className="mt-4">
                        ส่งข้อความเพิ่ม
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-xl border-none">
            <CardHeader>
                <CardTitle className="text-2xl">แบบฟอร์มติดต่อสอบถาม</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-md flex items-center gap-2 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">ชื่อผู้ติดต่อ <span className="text-red-500">*</span></Label>
                            <Input
                                id="name"
                                placeholder="ชื่อ-นามสกุล"
                                required
                                value={formData.name}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="company">ชื่อบริษัท</Label>
                            <Input
                                id="company"
                                placeholder="ชื่อบริษัทของคุณ"
                                value={formData.company}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">อีเมล <span className="text-red-500">*</span></Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@company.com"
                            required
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="tel">เบอร์โทรศัพท์ <span className="text-red-500">*</span></Label>
                        <Input
                            id="tel"
                            type="tel"
                            placeholder="08x-xxx-xxxx"
                            required
                            value={formData.tel}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="message">รายละเอียดที่ต้องการปรึกษา</Label>
                        <Textarea
                            id="message"
                            placeholder="เล่าปัญหาหรือบริการที่ต้องการ..."
                            className="min-h-[120px]"
                            value={formData.message}
                            onChange={handleChange}
                        />
                    </div>
                    <Button type="submit" className="w-full text-lg h-12" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังส่งข้อมูล...
                            </>
                        ) : (
                            'ส่งข้อความ'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
