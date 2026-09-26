import type { LegalDoc, LegalLocale } from './types';
import { COMPANY, CONTACT_EMAIL } from './meta';

const th = COMPANY.th;
const en = COMPANY.en;
const zh = COMPANY.zh;

export const PRIVACY: Record<LegalLocale, LegalDoc> = {
    th: {
        title: 'นโยบายความเป็นส่วนตัว',
        intro: [
            `นโยบายนี้อธิบายว่า ${th.name} ("**Lawslane**" หรือ "**เรา**") เก็บ ใช้ และเปิดเผยข้อมูลส่วนบุคคลของท่านอย่างไร เมื่อท่านใช้เว็บไซต์ lawslane.com และบริการที่เกี่ยวข้อง ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ("**PDPA**")`,
        ],
        sections: [
            {
                id: 'controller',
                title: 'ผู้ควบคุมข้อมูลส่วนบุคคล',
                blocks: [
                    {
                        ul: [
                            `ผู้ควบคุมข้อมูล: ${th.name} บุคคลธรรมดาผู้ดำเนินงาน Lawslane (ปัจจุบันยังไม่ได้จดทะเบียนเป็นนิติบุคคล)`,
                            `ที่อยู่สำหรับติดต่อ: ${th.address}`,
                            `ติดต่อเรื่องข้อมูลส่วนบุคคล: [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})`,
                        ],
                    },
                    { p: 'เมื่อลูกความส่งข้อมูลเรื่องคดีให้ทนายความ ทนายความเป็นผู้ควบคุมข้อมูลในส่วนที่ตนใช้ทำงานให้ลูกความด้วย และต้องดูแลข้อมูลนั้นตามกฎหมายและหน้าที่รักษาความลับของทนายความ' },
                    { p: '**เมื่อจดทะเบียนบริษัท:** นิติบุคคลที่จดทะเบียนจะเป็นผู้ควบคุมข้อมูลแทน และรับข้อมูลไปใช้ตามวัตถุประสงค์เดิมในนโยบายนี้เท่านั้น เราจะแจ้งท่านล่วงหน้าก่อนโอน ท่านขอปิดบัญชีและลบข้อมูลก่อนการโอนได้' },
                ],
            },
            {
                id: 'data',
                title: 'ข้อมูลที่เราเก็บ',
                blocks: [
                    {
                        table: {
                            head: ['กลุ่มผู้ใช้', 'ข้อมูล'],
                            rows: [
                                ['ผู้เข้าชมทุกคน', 'หมายเลข IP (ใช้จำกัดจำนวนคำขอและกันบอท) ภาษาที่เลือก ข้อมูลการทำงานของเว็บในเบราว์เซอร์ (ดู [นโยบายคุกกี้](/cookies)) และจำนวนการเข้าชมรวมรายเดือนซึ่งไม่ผูกกับตัวบุคคล'],
                                ['ลูกความ', 'ชื่อ อีเมล รหัสผ่าน (ระบบยืนยันตัวตนเก็บแบบเข้ารหัส เราไม่เห็นรหัสผ่าน) หรือข้อมูลโปรไฟล์จาก Google/LINE (ชื่อที่แสดง อีเมล รูปโปรไฟล์ LINE user ID) และวันเวลาที่ยอมรับข้อกำหนด'],
                                ['ทนายความ', 'ชื่อ อีเมล รหัสผ่าน เบอร์โทรศัพท์ วันเกิด เพศ ที่อยู่ LINE ID เลขใบอนุญาตทนายความ การศึกษา ประสบการณ์ ความเชี่ยวชาญ จังหวัดที่ให้บริการ รูปโปรไฟล์ **สำเนาบัตรประชาชนและสำเนาใบอนุญาตทนายความ** ข้อมูลบัญชีธนาคาร (ธนาคาร ชื่อบัญชี เลขบัญชี สำเนาหน้าสมุดบัญชี) และข้อมูลนิติบุคคล (ถ้ามี)'],
                                ['เคสและการสนทนา', 'ข้อความแชทระหว่างลูกความกับทนายความ ไฟล์แนบและพยานหลักฐาน รายละเอียดเคส นัดหมาย ใบเสนอราคา/งวดชำระ การแจ้งโอนและหลักฐานการโอนที่ลูกความแนบ และการยืนยันรับเงินของทนายความ'],
                                ['ล่าม/นักแปล', 'ชื่อ อีเมล เบอร์โทรศัพท์ LINE ID รูปโปรไฟล์ คำอธิบาย ภาษา บริการ ความเชี่ยวชาญ จังหวัด อัตราค่าบริการ ตารางเวลา **สำเนาบัตรประชาชนหรือหนังสือเดินทาง** เอกสารรับรองความสามารถ ข้อมูลบัญชีธนาคารสำหรับรับเงิน และวันเวลาที่ยอมรับข้อกำหนดและอัตรา GP'],
                                ['การจองล่าม/นักแปล', 'บริการที่จอง วันเวลา สถานที่ทำงาน (กรณีงานนอกสถานที่) หมายเหตุ เอกสารที่ส่งให้แปล ชื่อ เบอร์โทรศัพท์ และ LINE ของผู้จอง สลิปโอนเงินและผลการตรวจสลิป ราคา GP การคืนเงินและการโอนเงินให้ล่าม/นักแปล แชทกับล่าม/นักแปล (รวมข้อความต้นฉบับก่อนซ่อนช่องทางติดต่อ ซึ่งเก็บไว้ให้ทีมงานตรวจสอบ)'],
                                ['แพลนรายเดือน', 'ระดับแพลน สถานะ วันสิ้นรอบ และรหัสลูกค้า/การสมัครสมาชิกของ Stripe (ข้อมูลบัตรเก็บโดย Stripe เราไม่เห็นเลขบัตร)'],
                                ['รีวิว', 'คะแนน ข้อความรีวิว ชื่อที่แสดงและรูปของผู้รีวิว และเคสที่เกี่ยวข้อง'],
                                ['ติดต่อเรา', 'ข้อความและอีเมลที่ส่งถึงศูนย์ช่วยเหลือ'],
                                ['เครื่องมือ AI', 'คำถาม ข้อความ สัญญา หรือรูปภาพที่ท่านส่งให้ลลิน การค้นหาข้อกฎหมาย การวิเคราะห์สัญญา และการแปล'],
                            ],
                        },
                    },
                    { p: '**ข้อมูลอ่อนไหว:** เราไม่ขอข้อมูลอ่อนไหว แต่รายละเอียดคดีที่ท่านเล่าอาจมีข้อมูลประเภทนี้ เช่น ประวัติอาชญากรรมหรือสุขภาพ และสำเนาบัตรประชาชนบางรุ่นมีข้อมูลศาสนา เราประมวลผลข้อมูลเหล่านี้เท่าที่จำเป็นต่อการก่อตั้งสิทธิเรียกร้องหรือการใช้สิทธิทางกฎหมายของท่าน (PDPA มาตรา 26(4)) หรือตามความยินยอมโดยชัดแจ้งของท่าน ทนายความสามารถปิดทับข้อมูลศาสนาบนสำเนาบัตรก่อนอัปโหลดได้' },
                    { p: '**ข้อมูลที่เราไม่เก็บ:** เราไม่ใช้เครื่องมือวิเคราะห์พฤติกรรมหรือโฆษณาของบุคคลที่สาม และไม่เก็บประวัติบทสนทนากับลลินไว้ในบัญชีของท่าน (บทสนทนาอยู่ในหน้าเว็บจนกว่าท่านจะปิด)' },
                ],
            },
            {
                id: 'purposes',
                title: 'วัตถุประสงค์และฐานทางกฎหมาย',
                blocks: [
                    {
                        table: {
                            head: ['วัตถุประสงค์', 'ฐานทางกฎหมาย (PDPA)'],
                            rows: [
                                ['สร้างและดูแลบัญชี ยืนยันตัวตนตอนเข้าสู่ระบบ', 'จำเป็นเพื่อปฏิบัติตามสัญญา (มาตรา 24(3))'],
                                ['เชื่อมลูกความกับทนายความ ส่งข้อความ ไฟล์ นัดหมาย และแสดงบัญชีรับเงินของทนายความให้ลูกความในเคส', 'จำเป็นเพื่อปฏิบัติตามสัญญา (มาตรา 24(3))'],
                                ['ตรวจเลขใบอนุญาตและเอกสารของทนายความก่อนเปิดโปรไฟล์', 'ประโยชน์โดยชอบด้วยกฎหมายในการคุ้มครองลูกความจากผู้แอบอ้าง (มาตรา 24(5))'],
                                ['แสดงโปรไฟล์ทนายความและรีวิวต่อสาธารณะ', 'จำเป็นเพื่อปฏิบัติตามสัญญากับทนายความ (มาตรา 24(3)) และประโยชน์โดยชอบด้วยกฎหมาย (มาตรา 24(5))'],
                                ['รับชำระค่าจองล่าม/นักแปล ตรวจสลิป คืนเงิน และโอนเงินให้ล่าม/นักแปล', 'จำเป็นเพื่อปฏิบัติตามสัญญา (มาตรา 24(3))'],
                                ['เรียกเก็บเงินและจัดการแพลนรายเดือน', 'จำเป็นเพื่อปฏิบัติตามสัญญา (มาตรา 24(3))'],
                                ['ซ่อนช่องทางติดต่อในแชทกับล่าม/นักแปลก่อนชำระเงิน และเก็บข้อความต้นฉบับไว้ตรวจสอบกรณีมีข้อร้องเรียนหรือการชักชวนชำระนอกระบบ', 'ประโยชน์โดยชอบด้วยกฎหมายในการคุ้มครองผู้จองจากการฉ้อโกง (มาตรา 24(5))'],
                                ['ส่งอีเมลแจ้งเตือนเกี่ยวกับบัญชีและเคส', 'จำเป็นเพื่อปฏิบัติตามสัญญา (มาตรา 24(3))'],
                                ['ให้บริการเครื่องมือ AI', 'จำเป็นเพื่อปฏิบัติตามสัญญา (มาตรา 24(3)) เมื่อท่านเลือกใช้เครื่องมือนั้น'],
                                ['ป้องกันการฉ้อโกง สแปม และการโจมตีระบบ (จำกัดคำขอตาม IP ตรวจบอท)', 'ประโยชน์โดยชอบด้วยกฎหมาย (มาตรา 24(5))'],
                                ['ตอบคำถามและแก้ปัญหาที่ท่านแจ้ง', 'จำเป็นเพื่อปฏิบัติตามสัญญา (มาตรา 24(3)) หรือประโยชน์โดยชอบด้วยกฎหมาย (มาตรา 24(5))'],
                                ['ปฏิบัติตามคำสั่งของหน่วยงานรัฐหรือศาล', 'หน้าที่ตามกฎหมาย (มาตรา 24(6))'],
                            ],
                        },
                    },
                    { p: 'หากในอนาคตเราจะใช้ข้อมูลเพื่อการตลาดหรือวิเคราะห์พฤติกรรม เราจะขอความยินยอมจากท่านก่อน และท่านถอนความยินยอมได้ทุกเมื่อ' },
                ],
            },
            {
                id: 'sharing',
                title: 'การเปิดเผยข้อมูล',
                blocks: [
                    { p: 'เราไม่ขายข้อมูลส่วนบุคคล เราเปิดเผยข้อมูลเฉพาะกรณีต่อไปนี้:' },
                    {
                        ul: [
                            '**ทนายความที่ท่านติดต่อ** ได้รับข้อความ ไฟล์ และรายละเอียดเคสที่ท่านส่ง',
                            '**ล่าม/นักแปลที่ท่านจอง** ได้รับรายละเอียดงาน เอกสารที่ส่งให้แปล และข้อมูลติดต่อของท่านหลังชำระเงิน',
                            '**ลูกความในเคส** เห็นชื่อ รูป และบัญชีรับเงินของทนายความเจ้าของเคส',
                            '**สาธารณะ** เห็นข้อมูลโปรไฟล์ทนายความที่ได้รับอนุมัติ (ตามที่ระบุใน[ข้อกำหนดการใช้งาน](/terms)) และรีวิว',
                            '**ผู้ให้บริการที่ประมวลผลข้อมูลแทนเรา** ตามตารางด้านล่าง ภายใต้สัญญาหรือข้อตกลงการใช้บริการที่กำหนดให้ใช้ข้อมูลตามคำสั่งของเราเท่านั้น',
                            '**หน่วยงานรัฐหรือศาล** เมื่อกฎหมายกำหนด',
                        ],
                    },
                    {
                        table: {
                            head: ['ผู้ให้บริการ', 'ใช้ทำอะไร', 'ข้อมูลที่เกี่ยวข้อง'],
                            rows: [
                                ['Google Cloud / Firebase', 'ยืนยันตัวตน ฐานข้อมูล ที่เก็บไฟล์ เข้าสู่ระบบด้วย Google', 'ข้อมูลบัญชี เคส แชท ไฟล์ทั้งหมด'],
                                ['Google (Gemini API)', 'ประมวลผลเครื่องมือ AI', 'ข้อความ ไฟล์ และรูปที่ท่านส่งให้เครื่องมือ AI'],
                                ['SCB 10X (Typhoon)', 'โมเดล AI สำรองของลลิน และคำแนะนำกลยุทธ์คดีสำหรับทนายความ', 'คำถามและบทสนทนากับลลิน ชื่อเคสและขั้นตอนงาน'],
                                ['Cloudflare', 'ระบบแชท ค้นหาข้อกฎหมาย เก็บไฟล์และรูป คิวส่งการแจ้งเตือน รับอีเมล และ Turnstile กันบอท', 'ข้อความแชท (เข้ารหัสจากเบราว์เซอร์เมื่อรองรับ) คำค้น ไฟล์ อีเมลแจ้งเตือน IP'],
                                ['Stripe', 'รับชำระแพลนรายเดือนด้วยบัตร และจัดการการสมัครสมาชิก', 'อีเมล ชื่อ ข้อมูลบัตร (Stripe เก็บเอง) ประวัติการชำระ'],
                                ['SlipOK', 'ตรวจสลิปโอนเงินค่าจองล่าม/นักแปล', 'ข้อมูลจาก QR บนสลิป (ธนาคาร ชื่อบัญชีผู้โอน-ผู้รับ ยอดเงิน วันเวลา)'],
                                ['Resend', 'ส่งอีเมล', 'อีเมลและชื่อผู้รับ เนื้อหาการแจ้งเตือน'],
                                ['LINE', 'เข้าสู่ระบบด้วย LINE', 'LINE user ID ชื่อที่แสดง รูป อีเมล'],
                                ['Upstash', 'จำกัดจำนวนคำขอ', 'หมายเลข IP'],
                                ['Vercel', 'โฮสต์เว็บไซต์', 'ข้อมูลคำขอเว็บ (IP เบราว์เซอร์ หน้าที่เปิด)'],
                            ],
                        },
                    },
                ],
            },
            {
                id: 'transfer',
                title: 'การส่งข้อมูลไปต่างประเทศ',
                blocks: [
                    { p: 'ผู้ให้บริการข้างต้นส่วนใหญ่มีเซิร์ฟเวอร์อยู่นอกประเทศไทย เช่น สหรัฐอเมริกา สิงคโปร์ และประเทศอื่นที่ผู้ให้บริการใช้ เราส่งข้อมูลไปเท่าที่จำเป็นต่อการให้บริการตามสัญญากับท่าน (PDPA มาตรา 28(3)) และเลือกผู้ให้บริการที่มีมาตรการคุ้มครองข้อมูลตามมาตรฐานสากล' },
                ],
            },
            {
                id: 'security',
                title: 'การรักษาความปลอดภัย',
                blocks: [
                    {
                        ul: [
                            'จำกัดสิทธิ์การเข้าถึงข้อมูลด้วยกฎความปลอดภัยของฐานข้อมูลและที่เก็บไฟล์ เช่น ไฟล์แนบแชทเปิดได้เฉพาะคนในห้องแชท เอกสารยืนยันตัวตนของทนายความและล่าม/นักแปลเปิดได้เฉพาะเจ้าของและผู้ดูแลระบบ ข้อมูลติดต่อของผู้จองล่ามแยกเก็บในส่วนที่เข้าถึงได้จำกัด',
                            'รับส่งข้อมูลผ่าน HTTPS และเข้ารหัสข้อความแชทในเบราว์เซอร์เมื่ออุปกรณ์รองรับ',
                            'จำกัดการเข้าถึงหลังบ้านเฉพาะเจ้าหน้าที่ที่ได้รับอนุญาต',
                        ],
                    },
                    { p: 'ไม่มีระบบใดปลอดภัยได้ร้อยเปอร์เซ็นต์ หากเกิดเหตุละเมิดข้อมูลที่มีความเสี่ยงต่อท่าน เราจะแจ้งสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคลภายใน 72 ชั่วโมง และแจ้งท่านโดยไม่ชักช้าตามที่กฎหมายกำหนด' },
                ],
            },
            {
                id: 'retention',
                title: 'ระยะเวลาเก็บข้อมูล',
                blocks: [
                    {
                        ul: [
                            'ข้อมูลบัญชี เคส แชท และไฟล์ เก็บตลอดที่บัญชียังเปิดใช้',
                            'ข้อมูลการชำระเงิน การคืนเงิน และการโอนเงินให้ล่าม/นักแปล เก็บตามระยะเวลาที่กฎหมายบัญชีและภาษีกำหนด แม้ปิดบัญชีแล้ว',
                            `เมื่อปิดบัญชี เราจะลบหรือทำให้ข้อมูลไม่สามารถระบุตัวท่านได้ภายใน ${th.retentionDays} วัน ยกเว้นข้อมูลที่ต้องเก็บตามกฎหมาย หรือจำเป็นต่อการใช้สิทธิเรียกร้องตามกฎหมาย ซึ่งจะเก็บไม่เกินอายุความ`,
                            'ข้อความและไฟล์ที่ท่านส่งให้ทนายความ ทนายความอาจเก็บสำเนาไว้ตามหน้าที่วิชาชีพของทนายความเอง',
                            'รีวิวที่เผยแพร่แล้วอาจยังแสดงต่อหลังปิดบัญชี โดยไม่แสดงชื่อและรูปของท่าน',
                            'ข้อความที่ส่งให้เครื่องมือ AI บางส่วน (ไม่เกิน 500 ตัวอักษรแรก) เก็บไว้คู่กับคำตอบเป็นแคช เพื่อไม่ต้องประมวลผลคำถามเดิมซ้ำ แคชนี้ไม่ผูกกับบัญชีของท่าน',
                        ],
                    },
                ],
            },
            {
                id: 'rights',
                title: 'สิทธิของท่าน',
                blocks: [
                    { p: 'ภายใต้ PDPA ท่านมีสิทธิดังนี้:' },
                    {
                        ul: [
                            'ขอเข้าถึงและขอรับสำเนาข้อมูลของท่าน',
                            'ขอให้ส่งหรือโอนข้อมูลในรูปแบบที่อ่านได้ด้วยเครื่องมืออัตโนมัติ',
                            'ขอแก้ไขข้อมูลให้ถูกต้อง (ข้อมูลโปรไฟล์ส่วนใหญ่แก้ได้เองในหน้าบัญชี)',
                            'ขอลบหรือทำให้ข้อมูลไม่สามารถระบุตัวตนได้ รวมถึงขอปิดบัญชี',
                            'ขอให้ระงับการใช้ข้อมูล',
                            'คัดค้านการประมวลผลที่ใช้ฐานประโยชน์โดยชอบด้วยกฎหมาย',
                            'ถอนความยินยอม ในกรณีที่เราประมวลผลโดยอาศัยความยินยอม',
                            'ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.)',
                        ],
                    },
                    { p: `ส่งคำขอได้ที่ [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}) โดยใช้อีเมลที่ผูกกับบัญชี เราอาจขอข้อมูลเพิ่มเพื่อยืนยันตัวตน และจะตอบภายใน 30 วัน หากต้องปฏิเสธคำขอ เราจะแจ้งเหตุผลให้ทราบ` },
                ],
            },
            {
                id: 'minors',
                title: 'ผู้เยาว์',
                blocks: [
                    { p: 'บริการนี้ออกแบบมาสำหรับผู้ที่บรรลุนิติภาวะแล้ว หากผู้เยาว์ต้องการใช้บริการ ต้องได้รับความยินยอมจากผู้ใช้อำนาจปกครอง หากเราทราบว่าได้เก็บข้อมูลของผู้เยาว์โดยไม่มีความยินยอมดังกล่าว เราจะลบข้อมูลนั้น' },
                ],
            },
            {
                id: 'cookies',
                title: 'คุกกี้',
                blocks: [
                    { p: 'ปัจจุบันเราใช้เฉพาะคุกกี้และพื้นที่เก็บข้อมูลในเบราว์เซอร์ที่จำเป็นต่อการทำงานของเว็บไซต์ รายละเอียดอยู่ใน [นโยบายคุกกี้](/cookies)' },
                ],
            },
            {
                id: 'changes',
                title: 'การแก้ไขนโยบาย',
                blocks: [
                    { p: 'เราอาจปรับปรุงนโยบายนี้เมื่อบริการหรือกฎหมายเปลี่ยนไป และจะแสดงวันที่ปรับปรุงไว้ด้านบน หากเป็นการเปลี่ยนแปลงสำคัญ เช่น เก็บข้อมูลประเภทใหม่หรือใช้เพื่อวัตถุประสงค์ใหม่ เราจะแจ้งท่านก่อนมีผล และขอความยินยอมในกรณีที่กฎหมายกำหนด' },
                ],
            },
        ],
    },

    en: {
        title: 'Privacy Policy',
        intro: [
            `This policy explains how ${en.name} ("**Lawslane**", "**we**") collects, uses and discloses your personal data when you use lawslane.com and related services, under Thailand's Personal Data Protection Act B.E. 2562 (2019) ("**PDPA**").`,
        ],
        sections: [
            {
                id: 'controller',
                title: 'Data controller',
                blocks: [
                    {
                        ul: [
                            `Controller: ${en.name}, an individual operating Lawslane (not yet registered as a company)`,
                            `Contact address: ${en.address}`,
                            `Privacy contact: [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})`,
                        ],
                    },
                    { p: 'When a client sends case information to a lawyer, the lawyer is also a controller of the data they use to act for the client, and must handle it according to the law and their duty of confidentiality.' },
                    { p: '**When a company is registered:** the registered company will become the controller and will use the data only for the purposes in this policy. We will tell you before the transfer, and you may close your account and have your data deleted beforehand.' },
                ],
            },
            {
                id: 'data',
                title: 'Data we collect',
                blocks: [
                    {
                        table: {
                            head: ['Who', 'Data'],
                            rows: [
                                ['All visitors', 'IP address (for rate limiting and bot protection), chosen language, browser data the site needs to work (see the [Cookie Policy](/cookies)), and a monthly total page-view count that is not linked to anyone.'],
                                ['Clients', 'Name, email, password (stored hashed by the authentication service; we cannot see it) or your Google/LINE profile (display name, email, photo, LINE user ID), and when you accepted the Terms.'],
                                ['Lawyers', 'Name, email, password, phone, date of birth, gender, address, LINE ID, licence number, education, experience, specialties, provinces served, profile photo, **copies of your national ID card and lawyer\'s licence**, bank details (bank, account name and number, bank book copy) and company details if any.'],
                                ['Cases and chats', 'Messages between client and lawyer, attachments and evidence, case details, appointments, quotes and instalments, payment notices and transfer slips the client attaches, and the lawyer\'s confirmation of receipt.'],
                                ['Interpreters/translators', 'Name, email, phone, LINE ID, profile photo, description, languages, services, specialties, provinces, rates, schedule, **copy of national ID card or passport**, certificates, bank details for payouts, and when you accepted the Terms and the GP rate.'],
                                ['Interpreter bookings', "Service booked, date and time, work location (for on-site jobs), notes, documents sent for translation, the client's name, phone and LINE, transfer slip and slip check result, price, GP, refunds and payouts, and chat with the interpreter (including the original text before contact details were hidden, kept for our team to review)."],
                                ['Monthly plans', 'Plan tier, status, period end, and Stripe customer/subscription IDs (card details are held by Stripe; we never see the card number).'],
                                ['Reviews', 'Rating, review text, reviewer display name and photo, and the related case.'],
                                ['Contact', 'Messages and emails sent to our help center.'],
                                ['AI tools', 'Questions, text, contracts or images you send to Lalin, law search, contract analysis and translation.'],
                            ],
                        },
                    },
                    { p: '**Sensitive data:** we do not ask for sensitive data, but the case details you describe may include it, such as criminal records or health, and some Thai ID cards show religion. We process such data only as needed to establish or exercise your legal claims (PDPA s. 26(4)) or with your explicit consent. Lawyers may cover the religion field on their ID copy before uploading.' },
                    { p: '**What we do not collect:** we use no third-party analytics or advertising tools, and we do not store your Lalin conversations in your account (they stay in the page until you close it).' },
                ],
            },
            {
                id: 'purposes',
                title: 'Purposes and legal bases',
                blocks: [
                    {
                        table: {
                            head: ['Purpose', 'Legal basis (PDPA)'],
                            rows: [
                                ['Create and manage your account; authenticate you', 'Performance of contract (s. 24(3))'],
                                ['Connect clients with lawyers; deliver messages, files, appointments; show the lawyer\'s payment account to clients in the case', 'Performance of contract (s. 24(3))'],
                                ['Check lawyers\' licence numbers and documents before publishing a profile', 'Legitimate interest in protecting clients from impostors (s. 24(5))'],
                                ['Publish lawyer profiles and reviews', 'Performance of contract with the lawyer (s. 24(3)) and legitimate interest (s. 24(5))'],
                                ['Collect interpreter booking payments, check slips, refund, and pay out interpreters', 'Performance of contract (s. 24(3))'],
                                ['Bill and manage monthly plans', 'Performance of contract (s. 24(3))'],
                                ['Hide contact details in interpreter chat before payment, and keep the original text to review complaints or attempts to take payment off-platform', 'Legitimate interest in protecting clients from fraud (s. 24(5))'],
                                ['Send account and case notification emails', 'Performance of contract (s. 24(3))'],
                                ['Provide AI tools', 'Performance of contract (s. 24(3)) when you choose to use them'],
                                ['Prevent fraud, spam and attacks (IP rate limiting, bot checks)', 'Legitimate interest (s. 24(5))'],
                                ['Answer your questions and resolve issues', 'Performance of contract (s. 24(3)) or legitimate interest (s. 24(5))'],
                                ['Comply with orders from authorities or courts', 'Legal obligation (s. 24(6))'],
                            ],
                        },
                    },
                    { p: 'If we ever want to use your data for marketing or behavioural analytics, we will ask for your consent first, and you can withdraw it at any time.' },
                ],
            },
            {
                id: 'sharing',
                title: 'Disclosure',
                blocks: [
                    { p: 'We do not sell personal data. We disclose it only as follows:' },
                    {
                        ul: [
                            '**The lawyer you contact** receives the messages, files and case details you send.',
                            '**The interpreter/translator you book** receives the job details, documents sent for translation, and your contact details after payment.',
                            '**Clients in a case** see the case lawyer\'s name, photo and payment account.',
                            '**The public** sees approved lawyer profiles (as described in the [Terms of Service](/terms)) and reviews.',
                            '**Service providers processing data for us**, listed below, under contracts or service terms that limit them to our instructions.',
                            '**Authorities or courts** when required by law.',
                        ],
                    },
                    {
                        table: {
                            head: ['Provider', 'Used for', 'Data involved'],
                            rows: [
                                ['Google Cloud / Firebase', 'Authentication, database, file storage, Google sign-in', 'Account, case, chat and file data'],
                                ['Google (Gemini API)', 'Processing AI tools', 'Text, files and images you send to AI tools'],
                                ['SCB 10X (Typhoon)', 'Lalin\'s fallback AI model; case strategy suggestions for lawyers', 'Lalin questions and conversation; case and milestone titles'],
                                ['Cloudflare', 'Chat, law search, file and image storage, notification queue, inbound email, Turnstile bot protection', 'Chat messages (encrypted in the browser where supported), search queries, files, notification emails, IP'],
                                ['Stripe', 'Card payments and subscription management for monthly plans', 'Email, name, card details (held by Stripe), payment history'],
                                ['SlipOK', 'Checking transfer slips for interpreter bookings', 'Data from the slip QR code (banks, sender and recipient account names, amount, date and time)'],
                                ['Resend', 'Sending email', 'Recipient name and email, notification content'],
                                ['LINE', 'Sign in with LINE', 'LINE user ID, display name, photo, email'],
                                ['Upstash', 'Rate limiting', 'IP address'],
                                ['Vercel', 'Website hosting', 'Web request data (IP, browser, pages visited)'],
                            ],
                        },
                    },
                ],
            },
            {
                id: 'transfer',
                title: 'International transfers',
                blocks: [
                    { p: 'Most of these providers run servers outside Thailand, for example in the United States, Singapore and other countries they use. We transfer data only as needed to perform our contract with you (PDPA s. 28(3)) and choose providers with internationally recognised data protection measures.' },
                ],
            },
            {
                id: 'security',
                title: 'Security',
                blocks: [
                    {
                        ul: [
                            'Access is restricted by database and storage security rules; for example, chat attachments open only for members of that chat, and identity documents of lawyers and interpreters only for their owner and administrators. Interpreter clients\' contact details are stored separately with restricted access.',
                            'Data travels over HTTPS, and chat messages are encrypted in the browser where the device supports it.',
                            'Back-office access is limited to authorised staff.',
                        ],
                    },
                    { p: 'No system is completely secure. If a breach poses a risk to you, we will notify the Personal Data Protection Committee within 72 hours and inform you without undue delay as the law requires.' },
                ],
            },
            {
                id: 'retention',
                title: 'Retention',
                blocks: [
                    {
                        ul: [
                            'Account, case, chat and file data are kept while your account is open.',
                            'Records of payments, refunds and interpreter payouts are kept for the period required by accounting and tax law, even after account closure.',
                            `When you close your account we delete or anonymise your data within ${en.retentionDays} days, except data the law requires us to keep or that is needed to exercise legal claims, which we keep no longer than the limitation period.`,
                            'A lawyer may keep copies of messages and files you sent them under their own professional obligations.',
                            'Published reviews may remain after account closure, without your name or photo.',
                            'Part of what you send to AI tools (the first 500 characters at most) is stored with the answer as a cache so the same request need not be processed again. The cache is not linked to your account.',
                        ],
                    },
                ],
            },
            {
                id: 'rights',
                title: 'Your rights',
                blocks: [
                    { p: 'Under the PDPA you may:' },
                    {
                        ul: [
                            'access your data and obtain a copy;',
                            'receive or transfer your data in a machine-readable format;',
                            'correct your data (most profile data can be edited on your account page);',
                            'have your data deleted or anonymised, including closing your account;',
                            'restrict use of your data;',
                            'object to processing based on legitimate interest;',
                            'withdraw consent where processing is based on consent;',
                            'complain to the Office of the Personal Data Protection Committee (PDPC).',
                        ],
                    },
                    { p: `Send requests to [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}) from the email linked to your account. We may ask for more information to verify your identity and will respond within 30 days. If we must refuse, we will tell you why.` },
                ],
            },
            {
                id: 'minors',
                title: 'Minors',
                blocks: [
                    { p: 'The Service is designed for adults. Minors need the consent of a parent or guardian. If we learn we have collected a minor\'s data without that consent, we will delete it.' },
                ],
            },
            {
                id: 'cookies',
                title: 'Cookies',
                blocks: [
                    { p: 'We currently use only cookies and browser storage that the website needs to work. See the [Cookie Policy](/cookies).' },
                ],
            },
            {
                id: 'changes',
                title: 'Changes to this policy',
                blocks: [
                    { p: 'We may update this policy when the Service or the law changes, and will show the date above. For material changes, such as new types of data or new purposes, we will tell you before they take effect and ask for consent where the law requires.' },
                ],
            },
        ],
    },

    zh: {
        title: '隐私政策',
        intro: [
            `本政策说明 ${zh.name}（"**Lawslane**"或"**我们**"）在您使用 lawslane.com 及相关服务时，如何依据泰国《2019 年个人数据保护法》（"**PDPA**"）收集、使用和披露您的个人数据。`,
        ],
        sections: [
            {
                id: 'controller',
                title: '数据控制者',
                blocks: [
                    {
                        ul: [
                            `数据控制者：${zh.name}，运营 Lawslane 的自然人（目前尚未注册为公司）`,
                            `联系地址：${zh.address}`,
                            `隐私事务联系：[${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})`,
                        ],
                    },
                    { p: '委托人向律师发送案件信息后，律师对其为委托人工作所使用的数据同样是数据控制者，须依法律及律师保密义务处理。' },
                    { p: '**注册公司后：**注册的公司将成为数据控制者，并仅按本政策所述目的使用数据。我们会在转移前通知您，您可在此之前注销账户并删除数据。' },
                ],
            },
            {
                id: 'data',
                title: '我们收集的数据',
                blocks: [
                    {
                        table: {
                            head: ['用户类别', '数据'],
                            rows: [
                                ['所有访客', 'IP 地址（用于限制请求频率和防御机器人）、所选语言、网站运行所需的浏览器数据（见[Cookie 政策](/cookies)），以及不与个人关联的每月总浏览量。'],
                                ['委托人', '姓名、电子邮件、密码（由身份验证服务以哈希方式存储，我们无法看到），或 Google/LINE 资料（显示名称、电子邮件、头像、LINE 用户 ID），以及接受条款的时间。'],
                                ['律师', '姓名、电子邮件、密码、电话、出生日期、性别、地址、LINE ID、执照号、学历、经验、专业领域、服务府、头像、**身份证及律师执照复印件**、银行信息（银行、户名、账号、存折复印件）及公司信息（如有）。'],
                                ['案件与聊天', '委托人与律师之间的消息、附件和证据、案件详情、预约、报价和分期、委托人上传的付款通知和转账凭证，以及律师的收款确认。'],
                                ['口译/笔译员', '姓名、电子邮件、电话、LINE ID、头像、简介、语言、服务、专业领域、服务府、费率、日程、**身份证或护照复印件**、资格证书、收款银行信息，以及接受条款和 GP 费率的时间。'],
                                ['口译/笔译预约', '预约的服务、日期时间、工作地点（现场工作）、备注、需翻译的文件、预约方的姓名、电话和 LINE、转账凭证及核验结果、价格、GP、退款和向口译员的付款，以及与口译员的聊天（包括隐藏联系方式前的原文，供团队审核）。'],
                                ['月度方案', '方案级别、状态、周期结束日期，以及 Stripe 客户/订阅编号（银行卡信息由 Stripe 保存，我们看不到卡号）。'],
                                ['评价', '评分、评价内容、评价者的显示名称和头像，以及相关案件。'],
                                ['联系我们', '发送至帮助中心的消息和邮件。'],
                                ['AI 工具', '您发送给 Lalin、法律检索、合同分析和翻译的问题、文字、合同或图片。'],
                            ],
                        },
                    },
                    { p: '**敏感数据：**我们不要求提供敏感数据，但您描述的案件详情可能包含此类信息，例如犯罪记录或健康状况，部分泰国身份证上印有宗教信息。我们仅在建立或行使您的法律请求权所必需的范围内（PDPA 第 26(4) 条）或经您明示同意后处理这些数据。律师可在上传前遮盖身份证上的宗教栏。' },
                    { p: '**我们不收集的数据：**我们不使用任何第三方分析或广告工具，也不会将您与 Lalin 的对话保存到账户中（对话仅保留在页面中，直至您关闭）。' },
                ],
            },
            {
                id: 'purposes',
                title: '目的与法律依据',
                blocks: [
                    {
                        table: {
                            head: ['目的', '法律依据（PDPA）'],
                            rows: [
                                ['创建和管理账户，登录验证', '履行合同所必需（第 24(3) 条）'],
                                ['连接委托人与律师，传递消息、文件、预约，并向案件委托人显示律师收款账户', '履行合同所必需（第 24(3) 条）'],
                                ['在公开资料前审核律师执照号和文件', '保护委托人免受冒充者侵害的合法利益（第 24(5) 条）'],
                                ['公开律师资料和评价', '履行与律师的合同（第 24(3) 条）及合法利益（第 24(5) 条）'],
                                ['收取口译/笔译预约款项、核验凭证、退款及向口译员付款', '履行合同所必需（第 24(3) 条）'],
                                ['月度方案计费与管理', '履行合同所必需（第 24(3) 条）'],
                                ['付款前隐藏与口译员聊天中的联系方式，并保留原文以处理投诉或系统外付款的引导', '保护预约方免受欺诈的合法利益（第 24(5) 条）'],
                                ['发送账户和案件通知邮件', '履行合同所必需（第 24(3) 条）'],
                                ['提供 AI 工具', '您选择使用时，为履行合同所必需（第 24(3) 条）'],
                                ['防止欺诈、垃圾信息和攻击（按 IP 限流、机器人检测）', '合法利益（第 24(5) 条）'],
                                ['回答问题并处理您反映的问题', '履行合同（第 24(3) 条）或合法利益（第 24(5) 条）'],
                                ['遵守政府机关或法院的命令', '法定义务（第 24(6) 条）'],
                            ],
                        },
                    },
                    { p: '如将来需将数据用于营销或行为分析，我们会先征得您的同意，您可随时撤回。' },
                ],
            },
            {
                id: 'sharing',
                title: '数据披露',
                blocks: [
                    { p: '我们不出售个人数据，仅在以下情况下披露：' },
                    {
                        ul: [
                            '**您联系的律师**会收到您发送的消息、文件和案件详情。',
                            '**您预约的口译/笔译员**会收到工作详情、需翻译的文件，并在付款后收到您的联系方式。',
                            '**案件中的委托人**可看到该案律师的姓名、头像和收款账户。',
                            '**公众**可看到已审核律师的资料（见[服务条款](/terms)）和评价。',
                            '**代表我们处理数据的服务商**（见下表），其须依合同或服务条款仅按我们的指示使用数据。',
                            '**政府机关或法院**在法律要求时。',
                        ],
                    },
                    {
                        table: {
                            head: ['服务商', '用途', '涉及的数据'],
                            rows: [
                                ['Google Cloud / Firebase', '身份验证、数据库、文件存储、Google 登录', '账户、案件、聊天及文件数据'],
                                ['Google（Gemini API）', '处理 AI 工具', '您发送给 AI 工具的文字、文件和图片'],
                                ['SCB 10X（Typhoon）', 'Lalin 的备用 AI 模型；为律师提供案件策略建议', 'Lalin 的问题和对话；案件和阶段标题'],
                                ['Cloudflare', '聊天、法律检索、文件和图片存储、通知队列、接收邮件、Turnstile 机器人防护', '聊天消息（设备支持时在浏览器端加密）、检索词、文件、通知邮件、IP'],
                                ['Stripe', '月度方案的银行卡付款和订阅管理', '电子邮件、姓名、银行卡信息（由 Stripe 保存）、付款记录'],
                                ['SlipOK', '核验口译/笔译预约的转账凭证', '凭证二维码中的数据（银行、转出和收款户名、金额、日期时间）'],
                                ['Resend', '发送邮件', '收件人姓名和邮箱、通知内容'],
                                ['LINE', 'LINE 登录', 'LINE 用户 ID、显示名称、头像、电子邮件'],
                                ['Upstash', '请求限流', 'IP 地址'],
                                ['Vercel', '网站托管', '网页请求数据（IP、浏览器、访问页面）'],
                            ],
                        },
                    },
                ],
            },
            {
                id: 'transfer',
                title: '跨境传输',
                blocks: [
                    { p: '上述服务商大多在泰国境外（如美国、新加坡及其使用的其他国家）运行服务器。我们仅在履行与您的合同所必需的范围内传输数据（PDPA 第 28(3) 条），并选择具有国际通行数据保护措施的服务商。' },
                ],
            },
            {
                id: 'security',
                title: '安全措施',
                blocks: [
                    {
                        ul: [
                            '通过数据库和存储安全规则限制访问，例如聊天附件仅限该聊天成员打开，律师和口译/笔译员的身份文件仅限本人和管理员查看，口译预约方的联系方式单独存放并限制访问。',
                            '数据通过 HTTPS 传输；设备支持时，聊天消息在浏览器端加密。',
                            '后台仅限获授权的工作人员访问。',
                        ],
                    },
                    { p: '没有任何系统是绝对安全的。如发生对您有风险的数据泄露，我们将在 72 小时内通知个人数据保护委员会，并依法及时通知您。' },
                ],
            },
            {
                id: 'retention',
                title: '保存期限',
                blocks: [
                    {
                        ul: [
                            '账户开通期间，保存账户、案件、聊天和文件数据。',
                            '付款、退款及向口译员付款的记录，即使账户注销，也会按会计和税务法律规定的期限保存。',
                            `账户注销后，我们会在 ${zh.retentionDays} 天内删除您的数据或使其无法识别到您，但法律要求保存或行使法律请求权所需的数据除外，此类数据保存期限不超过诉讼时效。`,
                            '律师可依其职业义务保留您发送给他的消息和文件副本。',
                            '已发布的评价在账户注销后可能仍会显示，但不显示您的姓名和头像。',
                            '您发送给 AI 工具的部分内容（最多前 500 个字符）会与回答一起作为缓存保存，以免重复处理相同请求。该缓存不与您的账户关联。',
                        ],
                    },
                ],
            },
            {
                id: 'rights',
                title: '您的权利',
                blocks: [
                    { p: '根据 PDPA，您有权：' },
                    {
                        ul: [
                            '访问并获取您的数据副本；',
                            '以机器可读格式接收或转移您的数据；',
                            '更正您的数据（大部分资料可在账户页面自行修改）；',
                            '删除数据或使其匿名化，包括注销账户；',
                            '限制数据的使用；',
                            '反对基于合法利益的处理；',
                            '在基于同意的处理中撤回同意；',
                            '向个人数据保护委员会办公室（PDPC）投诉。',
                        ],
                    },
                    { p: `请使用与账户绑定的邮箱发送请求至 [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})。我们可能要求提供更多信息以核实身份，并将在 30 天内答复。如需拒绝请求，我们会说明理由。` },
                ],
            },
            {
                id: 'minors',
                title: '未成年人',
                blocks: [
                    { p: '本服务面向成年人。未成年人须经父母或监护人同意。如发现未经此类同意收集了未成年人的数据，我们将予以删除。' },
                ],
            },
            {
                id: 'cookies',
                title: 'Cookie',
                blocks: [
                    { p: '我们目前仅使用网站运行所必需的 Cookie 和浏览器存储。详见[Cookie 政策](/cookies)。' },
                ],
            },
            {
                id: 'changes',
                title: '政策变更',
                blocks: [
                    { p: '当服务或法律变化时，我们可能更新本政策，并在上方显示更新日期。如有重大变更（例如收集新类型数据或用于新目的），我们会在生效前通知您，并在法律要求时征得同意。' },
                ],
            },
        ],
    },
};
