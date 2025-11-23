
'use client'

import * as React from 'react'
import {
  ChevronLeft,
  Upload,
  Info,
  PlusCircle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useFirebase } from '@/firebase'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { errorEmitter, FirestorePermissionError } from '@/firebase'

export default function AdminArticleCreatePage() {
  const router = useRouter()
  const { toast } = useToast()
  const { firestore } = useFirebase();

  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [content, setContent] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [authorName, setAuthorName] = React.useState('ทีมงาน Lawlanes');
  const [isSaving, setIsSaving] = React.useState(false);

  const [categories, setCategories] = React.useState(['กฎหมายแรงงาน', 'กฎหมายธุรกิจ', 'ทรัพย์สินทางปัญญา', 'คดีฉ้อโกง', 'กฎหมายแพ่ง']);
  const [newCategory, setNewCategory] = React.useState('');


  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    // Auto-generate slug from title (simple version)
    const newSlug = newTitle.toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-');
    setSlug(newSlug);
  }

  const handleSaveChanges = () => {
    if (!firestore) return;
    if (!title || !slug || !content || !category) {
        toast({
            variant: "destructive",
            title: "ข้อมูลไม่ครบถ้วน",
            description: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน: หัวข้อ, slug, เนื้อหา, และหมวดหมู่",
        });
        return;
    }
    setIsSaving(true);

    const newArticle = {
        title,
        slug,
        description,
        content,
        category,
        authorName,
        imageUrl: `https://picsum.photos/seed/${slug}/600/400`,
        imageHint: 'legal article',
        publishedAt: serverTimestamp(),
    };

    const articlesCollection = collection(firestore, 'articles');
    
    addDoc(articlesCollection, newArticle).then(() => {
        toast({
            title: "สร้างบทความสำเร็จ",
            description: `บทความใหม่ "${title}" ได้ถูกเพิ่มเข้าสู่ระบบแล้ว`,
        })
        router.push('/admin/content');
    }).catch(error => {
        const permissionError = new FirestorePermissionError({
            path: 'articles',
            operation: 'create',
            requestResourceData: newArticle,
        });
        errorEmitter.emit('permission-error', permissionError);
    }).finally(() => {
        setIsSaving(false);
    });
  }
  
  const handleAddNewCategory = () => {
    if (newCategory && !categories.includes(newCategory)) {
        setCategories(prev => [...prev, newCategory]);
        setCategory(newCategory); // Auto-select the new category
        setNewCategory('');
        toast({
            title: 'เพิ่มหมวดหมู่สำเร็จ',
            description: `หมวดหมู่ "${newCategory}" ได้ถูกเพิ่มในรายการแล้ว`,
        });
    } else {
        toast({
            variant: 'destructive',
            title: 'ไม่สามารถเพิ่มหมวดหมู่ได้',
            description: 'อาจเป็นเพราะช่องว่างหรือมีหมวดหมู่นี้อยู่แล้ว',
        })
    }
  }


  return (
      <main className="flex-1 p-4 sm:px-6 sm:py-0 md:p-8">
        <div className="mx-auto grid max-w-3xl flex-1 auto-rows-max gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/content">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={isSaving}>
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">กลับ</span>
                </Button>
            </Link>
            <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
              สร้างบทความใหม่
            </h1>
            <div className="hidden items-center gap-2 md:ml-auto md:flex">
              <Link href="/admin/content">
                <Button variant="outline" size="sm" disabled={isSaving}>
                    ยกเลิก
                </Button>
              </Link>
              <Button size="sm" onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกบทความ'}
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_250px] lg:grid-cols-3 lg:gap-8">
            <div className="grid auto-rows-max items-start gap-4 lg:col-span-2 lg:gap-8">
                <Card>
                    <CardHeader>
                    <CardTitle>เนื้อหาบทความ</CardTitle>
                    <CardDescription>
                        กรอกเนื้อหาหลักและรูปภาพสำหรับบทความใหม่
                    </CardDescription>
                    </CardHeader>
                    <CardContent>
                    <div className="grid gap-6">
                        <div className="grid gap-3">
                            <Label htmlFor="title">หัวข้อบทความ (H1)</Label>
                            <Input
                                id="title"
                                type="text"
                                className="w-full"
                                value={title}
                                onChange={handleTitleChange}
                                placeholder="เช่น 5 สิ่งต้องรู้ก่อนเซ็นสัญญา..."
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="picture">รูปภาพหน้าปก</Label>
                            <div className="flex items-center gap-4">
                                <div className="aspect-video w-48 rounded-md object-contain bg-muted border flex items-center justify-center">
                                    <span className="text-muted-foreground text-xs">Preview</span>
                                </div>
                                <Button variant="outline">
                                <Upload className="h-4 w-4 mr-2"/>
                                อัปโหลดรูป (จำลอง)
                                </Button>
                            </div>
                        </div>
                         <div className="grid gap-3">
                            <Label htmlFor="content">เนื้อหาบทความ</Label>
                            <Textarea
                                id="content"
                                placeholder="เนื้อหาฉบับเต็มของบทความ..."
                                rows={15}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                            />
                        </div>
                    </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Search Engine Optimization (SEO)</CardTitle>
                        <CardDescription>
                            ปรับแต่งการแสดงผลบนหน้าการค้นหาของ Google
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6">
                         <div className="grid gap-3">
                            <Label htmlFor="slug">Slug (URL Path)</Label>
                            <Input
                                id="slug"
                                type="text"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                placeholder="เช่น 5-things-before-signing"
                            />
                             <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
                                <Info className="h-4 w-4 !text-blue-600" />
                                <AlertDescription>
                                    Slug จะถูกสร้างจากหัวข้อโดยอัตโนมัติ แต่สามารถแก้ไขได้ ควรใช้ภาษาอังกฤษและคั่นด้วย -
                                </AlertDescription>
                            </Alert>
                        </div>
                         <div className="grid gap-3">
                            <Label htmlFor="meta-title">Meta Title</Label>
                            <Input
                                id="meta-title"
                                type="text"
                                placeholder="หัวข้อที่จะแสดงบน Google"
                                value={title}
                                readOnly
                            />
                        </div>
                         <div className="grid gap-3">
                            <Label htmlFor="meta-description">Meta Description</Label>
                            <Textarea
                                id="meta-description"
                                placeholder="คำอธิบายสั้นๆ ที่จะแสดงในผลการค้นหา (ไม่เกิน 160 ตัวอักษร)"
                                rows={3}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </CardContent>
                 </Card>
            </div>
            <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
                 <Card>
                    <CardHeader>
                        <CardTitle>การจัดหมวดหมู่</CardTitle>
                    </CardHeader>
                    <CardContent>
                       <div className="grid gap-6">
                         <div className="grid gap-3">
                            <Label htmlFor="category">หมวดหมู่</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger id="category">
                                    <SelectValue placeholder="เลือกหมวดหมู่" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="grid gap-3">
                            <Label htmlFor="new-category">เพิ่มหมวดหมู่ใหม่</Label>
                            <div className="flex gap-2">
                                <Input 
                                    id="new-category" 
                                    placeholder="เช่น กฎหมายครอบครัว"
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                />
                                <Button variant="outline" size="icon" onClick={handleAddNewCategory}>
                                    <PlusCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                       </div>
                    </CardContent>
                 </Card>
            </div>
          </div>

           <div className="flex items-center justify-end gap-2 md:hidden">
              <Link href="/admin/content">
                <Button variant="outline" size="sm" disabled={isSaving}>
                    ยกเลิก
                </Button>
              </Link>
              <Button size="sm" onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกบทความ'}
              </Button>
            </div>
        </div>
      </main>
  )
}
