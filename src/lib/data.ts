import type { LawyerProfile } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const getImageUrl = (id: string) => PlaceHolderImages.find(img => img.id === id)?.imageUrl ?? '';
const getImageHint = (id: string) => PlaceHolderImages.find(img => img.id === id)?.imageHint ?? '';

export const mockLawyers: LawyerProfile[] = [
  {
    id: '1',
    userId: 'user1',
    name: 'นายสมชาย กฎหมายดี',
    status: 'approved',
    description: 'ผู้เชี่ยวชาญด้านคดีฉ้อโกงและสัญญาสำหรับ SMEs ประสบการณ์กว่า 15 ปีในการว่าความและให้คำปรึกษา',
    specialty: ['คดีฉ้อโกง SMEs', 'คดีแพ่งและพาณิชย์'],
    imageUrl: getImageUrl('lawyer-1'),
    imageHint: getImageHint('lawyer-1'),
  },
  {
    id: '2',
    userId: 'user2',
    name: 'นางสาวสมศรี ยุติธรรม',
    status: 'approved',
    description: 'ทนายความหญิงที่มุ่งเน้นการแก้ปัญหาข้อพิพาททางธุรกิจด้วยการเจรจาไกล่เกลี่ยและการฟ้องร้อง',
    specialty: ['คดีแพ่งและพาณิชย์', 'การผิดสัญญา'],
    imageUrl: getImageUrl('lawyer-2'),
    imageHint: getImageHint('lawyer-2'),
  },
  {
    id: '3',
    userId: 'user3',
    name: 'นายวิชัย ชนะคดี',
    status: 'approved',
    description: 'มีประสบการณ์สูงในการจัดการคดีฉ้อโกงที่ซับซ้อนและข้อพิพาททางการค้าระหว่างประเทศ',
    specialty: ['คดีฉ้อโกง SMEs'],
    imageUrl: getImageUrl('lawyer-3'),
    imageHint: getImageHint('lawyer-3'),
  },
  {
    id: '4',
    userId: 'user4',
    name: 'นางสาวมานี มีสัตย์',
    status: 'approved',
    description: 'เชี่ยวชาญด้านกฎหมายคุ้มครองผู้บริโภคและการเรียกร้องค่าเสียหายจากสัญญาที่ไม่เป็นธรรม',
    specialty: ['คดีแพ่งและพาณิชย์'],
    imageUrl: getImageUrl('lawyer-4'),
    imageHint: getImageHint('lawyer-4'),
  },
  {
    id: '5',
    userId: 'user5',
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
