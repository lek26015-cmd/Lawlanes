'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react';
import Image from 'next/image';
import searchImg from '@/pic/lawslane-search.webp';
import logoWhite from '@/pic/logo-lawslane-transparent-white.png';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, ShieldCheck, Loader2, ArrowLeft, FileText, AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from '@/navigation';
import { searchApprovedLawyersAction } from '@/app/actions/lawyer-directory-actions';
import { searchRegistryAction } from '@/app/actions/verify-registry-actions';
import { useTranslations, useLocale } from 'next-intl';
import VerifyResultCard, { type VerifyResult } from '@/components/verify-result-card';
import { VerifyNoticeDialog } from './verify-notice-dialog';

// ช่องทางตรวจสอบทางการ (สภาทนายความในพระบรมราชูปถัมภ์)
const LAWYERS_COUNCIL_URL = 'https://www.lawyerscouncil.or.th/';

// ไม่ใช้ useSearchParams — ทำให้ทั้งหน้าหลุดเป็น client render (HTML ที่ Google เห็นเหลือแค่ fallback)
// อ่าน ?licenseNumber= จาก window หลัง mount แทน
// verifiedLawyers อ่านผ่าน server action/server component เท่านั้น (rules ปิด list จาก browser)
// จำนวนรายชื่อ + วันที่อัปเดตล่าสุดคำนวณที่ server แล้วส่งมาเป็น props
// heading (h1 + คำอธิบาย) มาจาก server page — วางใน hero เดียวกับฟอร์มค้นหา แบบ hero หน้าแรก
export function VerifyLawyerClient({ registryCount, lastUpdatedIso, heading }: { registryCount: number; lastUpdatedIso: string | null; heading: ReactNode }) {
    const [licenseNumberFromQuery, setLicenseNumberFromQuery] = useState<string | null>(null);
    const t = useTranslations('VerifyLawyer');
    const locale = useLocale();

    const [lastUpdated, setLastUpdated] = useState<string>('');

    // จัดรูปวันที่ฝั่ง browser (ตาม timezone ผู้ใช้) — ก่อน mount แสดง "กำลังโหลด..."
    useEffect(() => {
        if (!lastUpdatedIso) {
            setLastUpdated(t('lastUpdatedToday'));
            return;
        }
        const dateLocale = locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'th-TH';
        const formattedDate = new Date(lastUpdatedIso).toLocaleDateString(dateLocale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
        setLastUpdated(`${t('lastUpdated')} ${formattedDate}`);
    }, [lastUpdatedIso, t, locale]);

    const [licenseNumber, setLicenseNumber] = useState('');
    const [lawyerName, setLawyerName] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [results, setResults] = useState<VerifyResult[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const lawyerCount = registryCount;
    const resultsRef = useRef<HTMLDivElement>(null);

    // ฟอร์มอยู่ใน hero — ค้นหาเสร็จเลื่อนลงไปที่ผลลัพธ์ (มือถือ hero สูงจนผลอยู่นอกจอ)
    useEffect(() => {
        if (hasSearched) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [hasSearched]);

    useEffect(() => {
        const fromQuery = new URLSearchParams(window.location.search).get('licenseNumber');
        if (fromQuery) {
            setLicenseNumber(fromQuery);
            setLicenseNumberFromQuery(fromQuery);
        }
    }, []);

    useEffect(() => {
        if (licenseNumberFromQuery) {
            handleVerify(licenseNumberFromQuery, '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [licenseNumberFromQuery]);

    const handleVerify = async (licenseInput: string = licenseNumber, nameInput: string = lawyerName) => {
        if (!licenseInput && !nameInput) return;

        setIsVerifying(true);
        setResults([]);
        setHasSearched(false);

        try {
            const search = licenseInput
                ? { licenseNumber: licenseInput.trim() }
                : { name: nameInput.trim() };
            const [profileMatches, registryMatches] = await Promise.all([
                searchApprovedLawyersAction(search),
                searchRegistryAction(search),
            ]);

            const foundResults: VerifyResult[] = [];
            const seenLicenseNumbers = new Set<string>();

            // ทนายที่ลงทะเบียนกับ Lawslane
            profileMatches.forEach(data => {
                if (data.licenseNumber) seenLicenseNumbers.add(data.licenseNumber);
                foundResults.push({
                    id: data.id,
                    name: data.name,
                    licenseNumber: data.licenseNumber,
                    status: 'active',
                    province: data.serviceProvinces?.[0] || undefined,
                    isOnLawslane: true,
                    lawslaneProfileId: data.id,
                    imageUrl: data.imageUrl,
                    specialty: data.specialty,
                    source: 'both',
                });
            });

            // รายชื่อจากทะเบียน/ประกาศที่ยังไม่อยู่ใน Lawslane
            // ไม่มีเลขใบอนุญาต → กันซ้ำด้วย doc id (server กันซ้ำระหว่างคำค้นให้แล้ว)
            registryMatches.forEach(data => {
                if (data.licenseNumber && seenLicenseNumbers.has(data.licenseNumber)) return;
                if (data.licenseNumber) seenLicenseNumbers.add(data.licenseNumber);
                foundResults.push({
                    id: data.id,
                    name: `${data.firstName} ${data.lastName}`,
                    licenseNumber: data.licenseNumber,
                    status: (data.status || 'active') as VerifyResult['status'],
                    province: data.province || undefined,
                    announcementDate: data.announcementDate || undefined,
                    sourceUrl: data.sourceUrl || undefined,
                    isOnLawslane: false,
                    source: 'registry',
                });
            });

            // Sort: Lawslane lawyers first
            foundResults.sort((a, b) => {
                if (a.isOnLawslane && !b.isOnLawslane) return -1;
                if (!a.isOnLawslane && b.isOnLawslane) return 1;
                return 0;
            });

            setResults(foundResults);
            setHasSearched(true);
        } catch (error) {
            console.error("Verification error:", error);
            setResults([]);
            setHasSearched(true);
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <>
            {/* หน้าที่มี ?licenseNumber= เป็นผลค้นหารายคน — ไม่ให้ index (middleware ส่ง X-Robots-Tag ด้วย) */}
            {licenseNumberFromQuery && <meta name="robots" content="noindex, follow" />}

            <VerifyNoticeDialog />

            {/* Hero — แบบหน้าแรก: bg-slate-900 เต็มความกว้าง ขอบล่างโค้ง · ภาพเป็นพื้นหลัง (opacity-80) ให้ข้อความทับได้บางส่วน
                ภาพ + หัวเรื่อง + ฟอร์มค้นหาเป็นส่วนเดียวกัน */}
            <section className="relative w-full bg-slate-900 text-white rounded-b-[60px] md:rounded-b-[80px] overflow-hidden">
                {/* จอใหญ่: ภาพชิดล่างซ้าย กว้างเกินครึ่งจอ — คอลัมน์ข้อความด้านขวาทับขอบภาพ */}
                <div className="hidden lg:block absolute inset-0 pointer-events-none">
                    <div className="relative w-full h-full max-w-screen-2xl mx-auto">
                        {/* ภาพแนวนอน (850×527) — กว้าง 75% ชิดบนระดับเดียวกับหัวเรื่อง (hero สูงตามฟอร์ม ถ้าชิดล่างคนในภาพจะตกขอบ)
                            ฝั่งขวา (แล็ปท็อป) ลอดใต้คอลัมน์ข้อความ · ขอบขวาและขอบล่างจางเข้าพื้นด้วย mask */}
                        <div className="absolute top-10 left-[1%] w-[75%] aspect-[850/640] opacity-80 [mask-image:linear-gradient(to_right,black_50%,transparent_85%),linear-gradient(to_bottom,black_70%,transparent)] [mask-composite:intersect]">
                            {/* โลโก้ Lawslane หลังคนในภาพ เฟดลงล่าง แบบภาพ hero หน้าแรก */}
                            <div className="absolute left-[22%] top-0 h-[80%] aspect-[711/994] opacity-50 [mask-image:linear-gradient(to_bottom,black_35%,transparent_85%)]">
                                <Image src={logoWhite} alt="" fill sizes="400px" className="object-contain" />
                            </div>
                            {/* คนในภาพชิดล่างของกล่อง — เว้นด้านบนให้โลโก้โผล่เหนือไหล่
                                unoptimized: ไฟล์ต้นฉบับกว้างแค่ 850px ไม่ให้ next/image บีบซ้ำ (q75) จนแตกกว่าเดิม */}
                            <div className="absolute inset-x-0 bottom-0 aspect-[850/527]">
                                <Image
                                    src={searchImg}
                                    alt=""
                                    fill
                                    priority
                                    sizes="85vw"
                                    unoptimized
                                    className="object-contain"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* มือถือ/ไอแพด: ภาพอยู่ด้านบนเป็นพื้นหลัง ข้อความเลื่อนขึ้นมาทับขอบล่างภาพ */}
                <div className="lg:hidden absolute top-10 inset-x-0 pointer-events-none opacity-80">
                    <div className="relative mx-auto w-full max-w-[680px] aspect-[850/640]">
                        {/* โลโก้ Lawslane หลังคนในภาพ เฟดลงล่าง แบบภาพ hero หน้าแรก */}
                        <div className="absolute left-[22%] top-0 h-[80%] aspect-[711/994] opacity-50 [mask-image:linear-gradient(to_bottom,black_35%,transparent_85%)]">
                            <Image src={logoWhite} alt="" fill sizes="50vw" className="object-contain" />
                        </div>
                        <div className="absolute inset-x-0 bottom-0 aspect-[850/527]">
                            <Image
                                src={searchImg}
                                alt=""
                                fill
                                priority
                                sizes="100vw"
                                unoptimized
                                className="object-contain"
                            />
                        </div>
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-900 to-transparent" />
                    </div>
                </div>

                <div className="relative z-10 px-4 md:px-12 lg:px-20 max-w-screen-2xl mx-auto pt-6 md:pt-8">
                    <Link href="/" className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {t('backToHome')}
                    </Link>

                    <div className="grid lg:grid-cols-2 gap-8 items-start pt-56 sm:pt-80 lg:pt-0">
                        {/* ช่องว่างฝั่งภาพบนจอใหญ่ */}
                        <div className="hidden lg:block h-1" />

                        <div className="pb-16 md:pb-24 lg:pt-12 lg:pb-28 space-y-6">
                            <div className="space-y-4 text-center lg:text-left">
                                {heading}
                                {lawyerCount > 0 && (
                                    <p className="text-sm text-gray-400 font-medium">
                                        {t('totalRegistryCount', { count: lawyerCount.toLocaleString() })}
                                    </p>
                                )}
                            </div>

                            <div className="max-w-lg mx-auto lg:mx-0">
                            <Card className="shadow-xl rounded-2xl border-none overflow-hidden bg-white">
                                <CardContent className="space-y-5 p-6 md:p-8">
                                    <div className="space-y-5">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="license-number" className="text-sm font-bold text-[#0B3979]">{t('licenseNumberLabel')}</Label>
                                            <div className="relative">
                                                <Input
                                                    id="license-number"
                                                    placeholder={t('licenseNumberPlaceholder')}
                                                    value={licenseNumber}
                                                    onChange={(e) => setLicenseNumber(e.target.value)}
                                                    disabled={isVerifying}
                                                    className="h-11 text-sm pl-10 rounded-xl border-slate-200 bg-[#F8FAFC] focus:bg-white transition-all"
                                                />
                                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center">
                                                <span className="w-full border-t border-slate-200" />
                                            </div>
                                            <div className="relative flex justify-center text-xs">
                                                <span className="bg-white px-3 text-slate-400">
                                                    {t('or')}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="lawyer-name" className="text-sm font-bold text-[#0B3979]">{t('lawyerNameLabel')}</Label>
                                            <div className="relative">
                                                <Input
                                                    id="lawyer-name"
                                                    placeholder={t('lawyerNamePlaceholder')}
                                                    value={lawyerName}
                                                    onChange={(e) => setLawyerName(e.target.value)}
                                                    disabled={isVerifying}
                                                    className="h-11 text-sm pl-10 rounded-xl border-slate-200 bg-white"
                                                />
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            </div>
                                            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1 pl-1">
                                                💡 {t('searchByNameTip')}
                                            </p>
                                        </div>

                                        <Button
                                            onClick={() => handleVerify()}
                                            className="w-full h-11 rounded-full text-base font-semibold bg-[#0B3979] hover:bg-[#082a5a] text-white shadow-lg shadow-blue-900/20 transition-all"
                                            size="lg"
                                            disabled={isVerifying || (!licenseNumber && !lawyerName)}
                                        >
                                            {isVerifying ? (
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            ) : (
                                                <Search className="mr-2 h-5 w-5" />
                                            )}
                                            {t('verifyButton')}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* CTA: Browse registered lawyers */}
                            <Link href="/lawyers" className="block mt-6 group">
                                <div className="relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 p-5 hover:bg-white/15 transition-all duration-300 hover:scale-[1.02]">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                                    <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                                    <div className="relative flex items-center gap-4">
                                        <div className="flex-shrink-0 w-11 h-11 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                            <ShieldCheck className="w-6 h-6 text-emerald-300" />
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <p className="text-white font-semibold text-sm leading-snug">{t('ctaBrowseLawyers')}</p>
                                            <p className="text-blue-200 text-xs mt-0.5">{t('ctaBrowseSubtitle')}</p>
                                        </div>
                                        <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                                            <ArrowLeft className="w-4 h-4 text-white rotate-180 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div ref={resultsRef} className="max-w-6xl mx-auto px-4 md:px-8 pt-10 scroll-mt-24">
            {/* Loading State */}
            {isVerifying && (
                <div className="max-w-2xl mx-auto text-center text-muted-foreground bg-white p-6 rounded-2xl shadow-lg mb-8">
                    <Loader2 className="w-10 h-10 mx-auto animate-spin mb-4 text-[#0B3979]" />
                    <p className="text-lg">{t('verifying')}</p>
                </div>
            )}

            {/* Results Section */}
            {hasSearched && !isVerifying && (
                <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {results.length > 0 ? (
                        <>
                            {/* Search Again + Result Count */}
                            <div className="flex items-center justify-between px-1 mb-2">
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <ShieldCheck className="w-4 h-4" />
                                    <span>{t('resultSummary', { count: results.length })}</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setHasSearched(false); setResults([]); setLicenseNumber(''); setLawyerName(''); }}
                                    className="rounded-full text-sm gap-2 border-slate-200 hover:bg-blue-50 hover:text-[#0B3979]"
                                >
                                    <Search className="w-3.5 h-3.5" />
                                    {t('searchAgain')}
                                </Button>
                            </div>

                            {/* Result Cards */}
                            {results.map((result, index) => (
                                <div key={result.id} style={{ animationDelay: `${index * 100}ms` }}>
                                    <VerifyResultCard result={result} />
                                </div>
                            ))}
                        </>
                    ) : (
                        /* Not Found State */
                        <Card className="rounded-2xl border-none shadow-lg overflow-hidden">
                            <CardContent className="p-8 text-center">
                                <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <AlertCircle className="w-10 h-10" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-2">{t('resultNotFound.title')}</h3>
                                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                                    {t('resultNotFound.description')}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <Button asChild className="h-12 rounded-full bg-[#0B3979] hover:bg-[#082a5a] text-white px-8">
                                        <a href={LAWYERS_COUNCIL_URL} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                            {t('resultNotFound.officialButton')}
                                        </a>
                                    </Button>
                                    <Button
                                        onClick={() => { setHasSearched(false); setLicenseNumber(''); setLawyerName(''); }}
                                        className="h-12 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 px-8"
                                    >
                                        {t('resultNotFound.closeButton')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Footer Info */}
            <div className="max-w-2xl mx-auto mt-10 pb-8">
                <div className="flex items-center justify-center space-x-4 text-slate-400 text-sm">
                    <div className="flex items-center">
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        {t('dataSource')}
                    </div>
                    <div className="w-1 h-1 bg-slate-300 rounded-full" />
                    <div>{lastUpdated || t('loading')}</div>
                </div>
            </div>
            </div>
        </>
    );
}
