

import type { LawyerProfile, ImagePlaceholder } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { Article, Case, UpcomingAppointment, Document, ReportedTicket, LawyerAppointmentRequest, LawyerCase, UrgentJob } from '@/lib/types';


const getImageUrl = (id: string) => PlaceHolderImages.find(img => img.id === id)?.imageUrl ?? '';
const getImageHint = (id: string) => PlaceHolderImages.find(img => img.id === id)?.imageHint ?? '';

export const mockLawyers: LawyerProfile[] = [
  {
    id: '1',
    userId: 'LAWYER_USER_ID_1', // Changed to be distinct
    name: 'นายสมชาย กฎหมายดี',
    status: 'approved',
    description: 'ผู้เชี่ยวชาญด้านคดีฉ้อโกงและสัญญาสำหรับ SMEs ประสบการณ์กว่า 15 ปีในการว่าความและให้คำปรึกษา',
    specialty: ['คดีฉ้อโกง SMEs', 'คดีแพ่งและพาณิชย์'],
    imageUrl: getImageUrl('lawyer-1'),
    imageHint: getImageHint('lawyer-1'),
  },
  {
    id: '2',
    userId: 'LAWYER_USER_ID_2',
    name: 'นางสาวสมศรี ยุติธรรม',
    status: 'approved',
    description: 'ทนายความหญิงที่มุ่งเน้นการแก้ปัญหาข้อพิพาททางธุรกิจด้วยการเจรจาไกล่เกลี่ยและการฟ้องร้อง',
    specialty: ['คดีแพ่งและพาณิชย์', 'การผิดสัญญา'],
    imageUrl: getImageUrl('lawyer-2'),
    imageHint: getImageHint('lawyer-2'),
  },
  {
    id: '3',
    userId: 'LAWYER_USER_ID_3',
    name: 'นายวิชัย ชนะคดี',
    status: 'approved',
    description: 'มีประสบการณ์สูงในการจัดการคดีฉ้อโกงที่ซับซ้อนและข้อพิพาททางการค้าระหว่างประเทศ',
    specialty: ['คดีฉ้อโกง SMEs'],
    imageUrl: getImageUrl('lawyer-3'),
    imageHint: getImageHint('lawyer-3'),
  },
  {
    id: '4',
    userId: 'LAWYER_USER_ID_4',
    name: 'นางสาวมานี มีสัตย์',
    status: 'approved',
    description: 'เชี่ยวชาญด้านกฎหมายคุ้มครองผู้บริโภคและการเรียกร้องค่าเสียหายจากสัญญาที่ไม่เป็นธรรม',
    specialty: ['คดีแพ่งและพาณิชย์'],
    imageUrl: getImageUrl('lawyer-4'),
    imageHint: getImageHint('lawyer-4'),
  },
  {
    id: '5',
    userId: 'LAWYER_USER_ID_5',
    name: 'นายเก่งกาจ รักความถูกต้อง',
    status: 'approved',
    description: 'ให้คำปรึกษาเชิงรุกเพื่อป้องกันปัญหาทางกฎหมายสำหรับธุรกิจ SMEs และสตาร์ทอัพ',
    specialty: ['คดีฉ้อโกง SMEs', 'การผิดสัญญา'],
    imageUrl: getImageUrl('lawyer-5'),
    imageHint: getImageHint('lawyer-5'),
  },
];

export async function getApprovedLawyers(): Promise<LawyerProfile[]> {
  // In a real app, this would fetch from Firestore
  // e.g., await db.collection('lawyerProfiles').where('status', '==', 'approved').get();
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(mockLawyers.filter(l => l.status === 'approved'));
    }, 500); // Simulate network delay
  });
}

export async function getLawyerById(id: string): Promise<LawyerProfile | undefined> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(mockLawyers.find(l => l.id === id));
    }, 200);
  });
}

export const mockArticles: Article[] = [
    {
      id: 'article-0',
      slug: 'future-of-work-summary',
      title: 'สรุปเนื้อหาน่าสนใจในเซสชัน Future of Work by JobThai ในงาน WORK LIFE FESTIVAL 2025',
      description: 'สรุปประเด็นสำคัญจากเซสชันสุดพิเศษ ที่จะช่วยให้องค์กรและ HR ปรับตัวและเตรียมพร้อมสำหรับอนาคตการทำงานที่เปลี่ยนแปลงไป...',
      category: 'ภาพรวม',
      imageUrl: getImageUrl('article-0'),
      imageHint: 'conference stage',
      content: `สรุปประเด็นสำคัญจากเซสชัน Future of Work by JobThai ในงาน WORK LIFE FESTIVAL 2025 ที่จะช่วยให้องค์กรและ HR ปรับตัวและเตรียมพร้อมสำหรับอนาคตการทำงานที่เปลี่ยนแปลงไป...`,
    },
    {
      id: 'article-1',
      slug: '5-things-to-know-before-signing-employment-contract',
      title: '5 สิ่งต้องรู้ก่อนเซ็นสัญญาจ้างงาน',
      description: 'สัญญาจ้างงานเป็นเอกสารสำคัญที่มีผลผูกพันทางกฎหมายระหว่างนายจ้างและลูกจ้าง การทำความเข้าใจ...',
      category: 'สัญญาจ้างงาน',
      imageUrl: getImageUrl('article-1'),
      imageHint: getImageHint('article-1'),
      content: `
สัญญาจ้างงานเป็นเอกสารสำคัญที่มีผลผูกพันทางกฎหมายระหว่างนายจ้างและลูกจ้าง การทำความเข้าใจองค์ประกอบต่างๆ ในสัญญาอย่างละเอียดก่อนลงนามจึงเป็นสิ่งจำเป็นอย่างยิ่ง เพื่อป้องกันปัญหาที่อาจเกิดขึ้นในอนาคต บทความนี้จะสรุป 5 ประเด็นหลักที่ต้องตรวจสอบให้ถี่ถ้วนก่อนเซ็นสัญญาจ้างงาน

**1. ขอบเขตงานและความรับผิดชอบ (Job Scope and Responsibilities)**
ตรวจสอบให้แน่ใจว่าสัญญาได้ระบุตำแหน่งงาน ขอบเขตความรับผิดชอบ และหน้าที่ที่ต้องปฏิบัติไว้อย่างชัดเจน เพื่อให้คุณเข้าใจว่าบริษัทคาดหวังอะไรจากคุณ และป้องกันการถูกมอบหมายงานนอกเหนือจากที่ตกลงกันไว้โดยไม่มีค่าตอบแทนเพิ่มเติม

**2. อัตราค่าจ้างและสวัสดิการ (Salary and Benefits)**
รายละเอียดเกี่ยวกับอัตราค่าจ้าง, รอบการจ่ายเงิน, ค่าล่วงเวลา (OT), โบนัส และสวัสดิการอื่นๆ เช่น ประกันสังคม, ประกันสุขภาพ, กองทุนสำรองเลี้ยงชีพ ควรถูกระบุไว้อย่างชัดเจน ตรวจสอบตัวเลขและเงื่อนไขการได้รับสวัสดิการต่างๆ ให้ถูกต้องครบถ้วน

**3. วันและเวลาทำงาน (Working Hours)**
สัญญาต้องระบุวันทำงานปกติ (เช่น จันทร์-ศุกร์), เวลาเข้า-ออกงาน, และเวลาพักอย่างชัดเจน รวมถึงเงื่อนไขการทำงานล่วงเวลาและการทำงานในวันหยุด เพื่อให้คุณทราบถึงข้อผูกมัดด้านเวลาและสามารถวางแผนชีวิตส่วนตัวได้

**4. เงื่อนไขการลา (Leave Policies)**
ทำความเข้าใจเกี่ยวกับสิทธิ์ในการลาประเภทต่างๆ ทั้งลาป่วย, ลากิจ, ลาพักร้อน ว่ามีจำนวนวันเท่าไหร่ต่อปี และมีเงื่อนไขในการขอลาอย่างไรบ้าง เช่น ต้องแจ้งล่วงหน้ากี่วัน หรือต้องใช้เอกสารอะไรประกอบ

**5. เงื่อนไขการเลิกจ้าง (Termination Clause)**
นี่คือส่วนที่สำคัญที่สุดส่วนหนึ่งของสัญญา อ่านและทำความเข้าใจเงื่อนไขที่ทั้งฝ่ายนายจ้างและลูกจ้างสามารถบอกเลิกสัญญาได้ ระยะเวลาที่ต้องบอกกล่าวล่วงหน้า (Notice Period) และค่าชดเชยที่จะได้รับในกรณีต่างๆ เพื่อรักษาสิทธิ์ของตัวเองหากเกิดการเลิกจ้างขึ้น

การสละเวลาตรวจสอบรายละเอียดเหล่านี้อย่างรอบคอบ จะช่วยให้คุณเริ่มต้นการทำงานใหม่ได้อย่างสบายใจและลดความเสี่ยงจากข้อพิพาททางกฎหมายในอนาคตได้อย่างมาก
      `,
    },
    {
      id: 'article-2',
      slug: 'pdpa-for-sme',
      title: 'กฎหมาย PDPA สำหรับ SME ที่ต้องรู้',
      description: 'PDPA หรือ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล มีผลบังคับใช้แล้ว ธุรกิจ SME ต้องปรับตัวอย่างไรบ้าง...',
      category: 'คุ้มครองข้อมูลส่วนบุคคล',
      imageUrl: getImageUrl('article-2'),
      imageHint: getImageHint('article-2'),
      content: `
PDPA หรือ พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 เป็นกฎหมายที่มีความสำคัญอย่างยิ่งต่อผู้ประกอบการทุกคน โดยเฉพาะธุรกิจขนาดกลางและขนาดย่อม (SME) ที่อาจยังขาดความเข้าใจและแนวปฏิบัติที่ถูกต้องในการจัดการข้อมูลส่วนบุคคลของลูกค้าหรือพนักงาน ซึ่งอาจนำไปสู่ความเสี่ยงในการทำผิดกฎหมายโดยไม่รู้ตัว

**ข้อมูลส่วนบุคคลคืออะไร?**
ข้อมูลส่วนบุคคลหมายถึงข้อมูลใดๆ ที่สามารถใช้ระบุตัวตนของบุคคลนั้นได้ ทั้งทางตรงและทางอ้อม เช่น ชื่อ-นามสกุล, ที่อยู่, เบอร์โทรศัพท์, อีเมล, เลขบัตรประชาชน, ข้อมูลทางการเงิน, หรือแม้กระทั่งข้อมูลพฤติกรรมการใช้งานออนไลน์

**SME ต้องทำอะไรบ้าง?**
1.  **ขอความยินยอม (Consent):** ก่อนที่จะเก็บรวบรวม ใช้ หรือเปิดเผยข้อมูลส่วนบุคคลของใคร ต้องขอความยินยอมจากเจ้าของข้อมูลอย่างชัดเจนและแจ้งวัตถุประสงค์ให้ทราบ
2.  **มีนโยบายความเป็นส่วนตัว (Privacy Policy):** จัดทำเอกสารนโยบายความเป็นส่วนตัวเพื่อแจ้งให้เจ้าของข้อมูลทราบว่าบริษัทจะเก็บข้อมูลอะไรบ้าง, นำไปใช้อย่างไร, เก็บไว้นานแค่ไหน, และมีมาตรการรักษาความปลอดภัยอย่างไร
3.  **จัดให้มีมาตรการรักษาความปลอดภัย:** ต้องมีมาตรการที่เหมาะสมทั้งในทางเทคนิคและทางกายภาพเพื่อป้องกันการเข้าถึงข้อมูลโดยไม่ได้รับอนุญาต
4.  **เคารพสิทธิของเจ้าของข้อมูล:** เจ้าของข้อมูลมีสิทธิ์ในการเข้าถึง, แก้ไข, หรือขอลบข้อมูลของตนเองได้ ธุรกิจต้องเตรียมช่องทางและกระบวนการเพื่อรองรับคำขอดังกล่าว

การไม่ปฏิบัติตาม PDPA อาจมีโทษทั้งทางแพ่ง ทางอาญา และทางปกครอง ซึ่งมีค่าปรับที่สูงมาก การลงทุนในการวางระบบให้ถูกต้องตามกฎหมายจึงเป็นการลงทุนที่คุ้มค่าเพื่อความยั่งยืนของธุรกิจในระยะยาว
      `,
    },
    {
      id: 'article-3',
      slug: 'trademark-registration',
      title: 'การจดทะเบียนเครื่องหมายการค้า สำคัญอย่างไร?',
      description: 'เครื่องหมายการค้าเปรียบเสมือนหน้าตาของธุรกิจ การจดทะเบียนจึงเป็นสิ่งสำคัญเพื่อป้องกันการลอกเลียนแบบ...',
      category: 'ทรัพย์สินทางปัญญา',
      imageUrl: getImageUrl('article-3'),
      imageHint: getImageHint('article-3'),
      content: `
เครื่องหมายการค้า (Trademark) ไม่ว่าจะเป็นชื่อแบรนด์, โลโก้, หรือสโลแกน เปรียบเสมือน "หน้าตา" และสินทรัพย์ที่สำคัญอย่างหนึ่งของธุรกิจที่ช่วยสร้างการจดจำและแยกแยะสินค้าหรือบริการของคุณออกจากคู่แข่ง การจดทะเบียนเครื่องหมายการค้าจึงไม่ใช่แค่เรื่องทางกฎหมาย แต่เป็นกลยุทธ์ทางธุรกิจที่สำคัญอย่างยิ่ง

**ทำไมต้องจดทะเบียนเครื่องหมายการค้า?**

1.  **ได้รับสิทธิ์แต่เพียงผู้เดียว (Exclusive Rights):** การจดทะเบียนจะทำให้คุณเป็นเจ้าของเครื่องหมายการค้านั้นอย่างสมบูรณ์ตามกฎหมาย คุณมีสิทธิ์แต่เพียงผู้เดียวในการใช้เครื่องหมายการค้านี้กับสินค้าหรือบริการที่ได้จดทะเบียนไว้
2.  **ป้องกันการลอกเลียนแบบ:** หากมีผู้อื่นนำเครื่องหมายการค้าของคุณไปใช้หรือลอกเลียนจนทำให้ผู้บริโภคสับสน คุณสามารถดำเนินการทางกฎหมายเพื่อหยุดการกระทำดังกล่าวและเรียกร้องค่าเสียหายได้
3.  **สร้างมูลค่าเพิ่มให้กับธุรกิจ:** เครื่องหมายการค้าที่จดทะเบียนแล้วถือเป็นทรัพย์สินทางปัญญาที่สามารถซื้อขาย, โอนสิทธิ์, หรืออนุญาตให้ผู้อื่นใช้ (Licensing) เพื่อสร้างรายได้ได้
4.  **สร้างความน่าเชื่อถือ:** การมีสัญลักษณ์ ® (Registered) ต่อท้ายโลโก้ ช่วยสร้างความมั่นใจและความน่าเชื่อถือให้กับลูกค้าและคู่ค้า ว่าแบรนด์ของคุณได้รับการคุ้มครองทางกฎหมาย

**ขั้นตอนการจดทะเบียนโดยสรุป**
การจดทะเบียนต้องยื่นคำขอต่อกรมทรัพย์สินทางปัญญา โดยต้องตรวจสอบก่อนว่าเครื่องหมายการค้าของคุณไม่ซ้ำหรือคล้ายกับของผู้อื่นที่จดทะเบียนไว้แล้ว และต้องไม่มีลักษณะต้องห้ามตามกฎหมาย กระบวนการทั้งหมดอาจใช้เวลาหลายเดือนจนถึงเป็นปี แต่ความคุ้มครองที่ได้รับนั้นมีค่ายิ่งกว่า

ดังนั้น หากคุณจริงจังกับการสร้างแบรนด์ การจดทะเบียนเครื่องหมายการค้าคือหนึ่งในสิ่งแรกๆ ที่ควรทำเพื่อปกป้องธุรกิจของคุณในระยะยาว
      `,
    },
    {
      id: 'article-4',
      slug: 'resume-tips-for-hr',
      title: 'เป็นผู้สมัครที่เข้าตา ด้วย 3 สิ่งที่ HR ให้ความสำคัญใน Resume',
      description: 'อยากให้ Resume ของคุณโดดเด่นและเป็นที่น่าสนใจของ HR? ลองมาดู 3 สิ่งสำคัญที่ HR มองหาใน Resume...',
      category: 'อยากรู้ไหม',
      imageUrl: getImageUrl('article-4'),
      imageHint: 'resume document',
      content: 'อยากให้ Resume ของคุณโดดเด่นและเป็นที่น่าสนใจของ HR? ลองมาดู 3 สิ่งสำคัญที่ HR มองหาใน Resume...'
    },
    {
      id: 'article-5',
      slug: 'employee-benefits-discount',
      title: 'แนะนำบริษัทที่มีสวัสดิการซื้อสินค้าและบริการในราคาพนักงาน',
      description: 'สวัสดิการดีๆ ไม่ได้มีแค่โบนัสหรือประกันสุขภาพ แต่ยังรวมถึงส่วนลดสินค้าและบริการต่างๆ...',
      category: 'หางาน',
      imageUrl: getImageUrl('article-5'),
      imageHint: 'clothing rack'
    },
    {
      id: 'article-6',
      slug: 'keynote-recap',
      title: 'เก็บตกบรรยากาศและ Keynote ที่น่าสนใจใน...',
      description: 'สรุปบรรยากาศงานและประเด็นสำคัญจาก Keynote speaker ที่คุณไม่ควรพลาด...',
      category: 'ภาพรวม',
      imageUrl: getImageUrl('article-6'),
      imageHint: 'conference event'
    },
    {
      id: 'article-7',
      slug: '9-warning-signs-applicant',
      title: '9 สัญญาณที่กำลังบอกว่าผู้สมัครคนนี้อาจไม่ใช่คนที่ควรรับเข้า...',
      description: 'การเลือกคนที่ "ใช่" เข้ามาทำงานในองค์กรเป็นเรื่องสำคัญ มาดูสัญญาณเตือนที่ HR ควรสังเกต...',
      category: 'หากมีสัญญาณเตือนเหล่านี้',
      imageUrl: getImageUrl('article-7'),
      imageHint: 'job interview'
    },
    {
      id: 'article-8',
      slug: 'thailand-marketing-day',
      title: 'สรุปประเด็นน่าสนใจจากงาน Thailand Marketing Day...',
      description: 'อัปเดตเทรนด์การตลาดยุคใหม่จากงาน Thailand Marketing Day ที่นักการตลาดไม่ควรพลาด',
      category: 'ภาพรวม',
      imageUrl: getImageUrl('article-8'),
      imageHint: 'marketing event'
    },
    {
      id: 'article-9',
      slug: 'mental-health-benefits',
      title: 'แนะนำบริษัทที่มีสวัสดิการเกี่ยวกับสุขภาพจิตของพนักงาน',
      description: 'สุขภาพจิตที่ดีของพนักงานคือหัวใจสำคัญขององค์กร มาดูกันว่ามีบริษัทไหนบ้างที่ให้ความสำคัญกับเรื่องนี้',
      category: 'บริษัทที่มีสวัสดิการด้านสุขภาพจิต',
      imageUrl: getImageUrl('article-9'),
      imageHint: 'support group'
    }
  ];

export async function getAllArticles(): Promise<Article[]> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(mockArticles);
    }, 200); // Simulate network delay
  });
}

export async function getArticleBySlug(slug: string): Promise<Article | undefined> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(mockArticles.find(a => a.slug === slug));
    }, 200);
  });
}

// Mock data for Dashboard
const mockCases: Case[] = [
  {
    id: 'case-001',
    title: 'ตรวจสอบสัญญาเช่าคอนโด',
    lawyer: { id: '2', name: 'นางสาวสมศรี ยุติธรรม', imageUrl: '', imageHint: '' },
    lastMessage: 'สถานะ: รอทนายส่งใบเสนอราคา | ส่งเมื่อ: 24 ต.ค. 2567',
    lastMessageTimestamp: '',
    status: 'active',
    hasNewMessage: false,
    color: 'blue'
  },
  {
    id: 'case-002',
    title: 'จดทะเบียนบริษัท ลอว์เลน จำกัด',
    lawyer: { id: '3', name: 'นายวิชัย ชนะคดี', imageUrl: '', imageHint: '' },
    lastMessage: 'สถานะ: ทนายกำลังเตรียมเอกสาร | ส่งเมื่อ: 23 ต.ค. 2567',
    lastMessageTimestamp: '',
    status: 'active',
    hasNewMessage: false,
    color: 'yellow'
  },
  {
    id: 'case-003',
    title: 'คดีมรดก',
    lawyer: { id: '1', name: 'นายสมชาย กฎหมายดี', imageUrl: '', imageHint: '' },
    lastMessage: 'เสร็จสิ้นเมื่อ: 20 ต.ค. 2567',
    lastMessageTimestamp: '',
    status: 'closed',
    hasNewMessage: false,
    color: 'blue'
  },
];

const mockAppointments: UpcomingAppointment[] = [
  {
    id: 'appt-001',
    lawyer: {
        name: 'ทนายสมชาย ก.',
        imageUrl: getImageUrl('lawyer-1'),
        imageHint: getImageHint('lawyer-1'),
    },
    date: new Date(new Date().setDate(new Date().getDate() + 3)),
    description: 'ปรึกษาคดีมรดก',
    time: '10:00 น.'
  }
];

const mockTickets: ReportedTicket[] = [
  {
    id: 'TICKET-5891A',
    caseId: 'case-001',
    lawyerId: '2',
    caseTitle: 'ตรวจสอบสัญญาเช่าคอนโด',
    problemType: 'ทนายตอบช้า',
    status: 'pending',
    reportedAt: new Date(new Date().setDate(new Date().getDate() - 1)),
  }
];

export async function getDashboardData(): Promise<{ cases: Case[], appointments: UpcomingAppointment[], tickets: ReportedTicket[] }> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        cases: mockCases,
        appointments: mockAppointments,
        tickets: mockTickets,
      });
    }, 500);
  });
}

// Mock data for Lawyer Dashboard
const mockNewRequests: LawyerAppointmentRequest[] = [
    {
        id: 'req-001',
        clientName: 'คุณสมหญิง ใจดี',
        caseTitle: 'ปรึกษาเรื่องสัญญาจ้าง',
        description: 'ต้องการให้ทนายความช่วยตรวจสอบร่างสัญญาจ้างพนักงานตำแหน่งผู้จัดการฝ่ายการตลาด มีประเด็นเรื่องขอบเขตการทำงานและเงื่อนไขการเลิกจ้างที่ต้องการคำแนะนำด่วน',
        requestedAt: new Date(new Date().setHours(new Date().getHours() - 2)),
    },
    {
        id: 'req-002',
        clientName: 'บริษัท เติบโต จำกัด',
        caseTitle: 'ขอคำปรึกษาด้าน PDPA',
        description: 'บริษัทกำลังจะเปิดตัวแอปพลิเคชันใหม่ ต้องการปรึกษาแนวทางการเก็บข้อมูลผู้ใช้งานให้สอดคล้องกับกฎหมาย PDPA',
        requestedAt: new Date(new Date().setDate(new Date().getDate() - 1)),
    }
];

const mockLawyerCases: LawyerCase[] = [
    { id: 'lcase-001', title: 'คดีฉ้อโกงออนไลน์', clientName: 'คุณมานี', clientId: 'CLIENT_ID_1', status: 'กำลังดำเนินการ', lastUpdate: '2 วันที่แล้ว', hasNewMessage: true },
    { id: 'lcase-002', title: 'ปัญหาข้อพิพาทที่ดิน', clientName: 'คุณวิชัย', clientId: 'CLIENT_ID_2', status: 'กำลังดำเนินการ', lastUpdate: '5 ชั่วโมงที่แล้ว', hasNewMessage: false },
    { id: 'lcase-003', title: 'ร่างสัญญาแฟรนไชส์', clientName: 'ร้านชานมไข่มุก', clientId: 'CLIENT_ID_3', status: 'เสร็จสิ้น', lastUpdate: '15 ต.ค. 2567', hasNewMessage: false },
];

export async function getLawyerDashboardData(): Promise<{ newRequests: LawyerAppointmentRequest[], activeCases: LawyerCase[], completedCases: LawyerCase[] }> {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                newRequests: mockNewRequests,
                activeCases: mockLawyerCases.filter(c => c.status === 'กำลังดำเนินการ'),
                completedCases: mockLawyerCases.filter(c => c.status === 'เสร็จสิ้น'),
            });
        }, 500);
    });
}

// Mock data for Urgent Jobs advertisement section
export const mockUrgentJobs: UrgentJob[] = [
  { id: 'job1', companyName: 'บริษัท เค.เลเซอร์ เทคโนโลยี (ไทยแลนด์) จำกัด', description: 'เปิดรับสมัครพนักงานหลายตำแหน่ง ดูรายละเอียดเพิ่มเติม Click', logoUrl: getImageUrl('ad-logo-1'), logoHint: getImageHint('ad-logo-1') },
  { id: 'job2', companyName: 'บริษัท ไท้เส กรุ๊ป จำกัด', description: 'เปิดรับสมัครพนักงานด่วน! ดูรายละเอียดเพิ่มเติม Click!', logoUrl: getImageUrl('ad-logo-2'), logoHint: getImageHint('ad-logo-2') },
  { id: 'job3', companyName: 'บริษัท พี.เจ.ชลบุรี พาราวู้ด จำกัด', description: 'เปิดรับสมัครพนักงานหลายตำแหน่ง สนใจ Click!', logoUrl: getImageUrl('ad-logo-3'), logoHint: getImageHint('ad-logo-3') },
  { id: 'job4', companyName: 'Global Asia Pacific Co.,Ltd.', description: 'เปิดรับ Sales Executive ดูรายละเอียดเพิ่มเติม Click!!', logoUrl: getImageUrl('ad-logo-4'), logoHint: getImageHint('ad-logo-4') },
  { id: 'job5', companyName: 'บริษัท ปัญจวัฒนาพลาสติก จำกัด (มหาชน)', description: 'เปิดรับสมัคร วิศวกร และ ช่างเทคนิค หลายอัตรา เพื่อรองรับการขยายกำลังการผลิต สนใจ Click!', logoUrl: getImageUrl('ad-logo-5'), logoHint: getImageHint('ad-logo-5') },
  { id: 'job6', companyName: 'GDT MARKETING AND RETAIL CO.,LTD', description: 'ด่วน! รับสมัคร พนักงานไลฟ์สดขายสินค้า รายได้ดี 12,000-30,000+++ (รวมค่าคอมมิชชั่น) สนใจ Click!', logoUrl: getImageUrl('ad-logo-6'), logoHint: getImageHint('ad-logo-6') },
];

export async function getUrgentJobs(): Promise<UrgentJob[]> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(mockUrgentJobs);
    }, 100);
  });
}

    