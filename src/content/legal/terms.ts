import type { LegalDoc, LegalLocale } from './types';
import { COMPANY, CONTACT_EMAIL } from './meta';

const th = COMPANY.th;
const en = COMPANY.en;
const zh = COMPANY.zh;

export const TERMS: Record<LegalLocale, LegalDoc> = {
    th: {
        title: 'ข้อกำหนดและเงื่อนไขการใช้บริการ',
        intro: [
            `ข้อกำหนดนี้เป็นข้อตกลงระหว่างท่านกับ ${th.name} ผู้ดำเนินงาน Lawslane ("**Lawslane**" หรือ "**เรา**") ซึ่งปัจจุบันเป็นสตาร์ทอัพที่ยังไม่ได้จดทะเบียนเป็นนิติบุคคล ผู้ให้บริการเว็บไซต์ lawslane.com และบริการที่เกี่ยวข้อง ("**บริการ**") ใช้กับผู้ใช้ทุกประเภท ทั้งผู้เข้าชม ลูกความ และทนายความ`,
            'โปรดอ่านให้ครบก่อนใช้บริการ การสมัครสมาชิกหรือใช้บริการถือว่าท่านยอมรับข้อกำหนดนี้ และรับทราบ [นโยบายความเป็นส่วนตัว](/privacy) [นโยบายคุกกี้](/cookies) และ [ข้อจำกัดความรับผิดของ AI](/ai-disclaimer)',
        ],
        sections: [
            {
                id: 'service',
                title: 'Lawslane คืออะไร และไม่ใช่อะไร',
                blocks: [
                    { p: 'Lawslane เป็น**แพลตฟอร์มออนไลน์ที่ช่วยให้ลูกความค้นหาและติดต่อทนายความ** พร้อมเครื่องมือช่วยค้นข้อมูลกฎหมายเบื้องต้น เช่น ผู้ช่วย AI "ลลิน" การค้นหาข้อกฎหมาย และแบบฟอร์มเอกสาร' },
                    {
                        ul: [
                            'Lawslane **ไม่ใช่สำนักงานกฎหมาย** และไม่ได้ให้คำปรึกษาทางกฎหมายเอง',
                            'ทนายความบนแพลตฟอร์มเป็น**ผู้ประกอบวิชาชีพอิสระ** ไม่ใช่ลูกจ้างหรือตัวแทนของ Lawslane',
                            'ความสัมพันธ์ระหว่างทนายความกับลูกความ ขอบเขตงาน ค่าวิชาชีพ และผลของคดี เป็นเรื่องที่ทนายความกับลูกความตกลงและรับผิดชอบต่อกันโดยตรง',
                            'Lawslane ไม่รับประกันผลของคดีหรือคุณภาพของงานที่ทนายความให้บริการ',
                        ],
                    },
                ],
            },
            {
                id: 'accounts',
                title: 'บัญชีผู้ใช้',
                blocks: [
                    {
                        ul: [
                            'ผู้สมัครต้องมีอายุ 20 ปีบริบูรณ์ขึ้นไป หรือบรรลุนิติภาวะแล้ว ผู้เยาว์ต้องได้รับความยินยอมจากผู้แทนโดยชอบธรรมก่อนใช้บริการ',
                            'ท่านสมัครได้ด้วยอีเมลและรหัสผ่าน บัญชี Google หรือบัญชี LINE และต้องให้ข้อมูลที่ถูกต้องและเป็นปัจจุบัน',
                            'ท่านต้องเก็บรหัสผ่านเป็นความลับ และรับผิดชอบกิจกรรมที่เกิดขึ้นภายใต้บัญชีของท่าน หากสงสัยว่ามีผู้อื่นเข้าใช้บัญชี ให้แจ้งเราทันที',
                            'หนึ่งคนควรมีบัญชีเดียวต่อบทบาท ห้ามสร้างบัญชีแทนผู้อื่นโดยไม่ได้รับอนุญาต',
                            `ท่านขอปิดบัญชีได้ทุกเมื่อโดยติดต่อ [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}) รายละเอียดการลบข้อมูลอยู่ใน [นโยบายความเป็นส่วนตัว](/privacy)`,
                        ],
                    },
                ],
            },
            {
                id: 'lawyers',
                title: 'ข้อกำหนดเพิ่มเติมสำหรับทนายความ',
                blocks: [
                    {
                        ul: [
                            'ทนายความต้องมีใบอนุญาตให้เป็นทนายความที่ยังมีผล และต้องแจ้งเราทันทีหากใบอนุญาตถูกพักใช้ เพิกถอน หรือหมดอายุ',
                            'ข้อมูลและเอกสารที่ส่งตอนสมัคร เช่น เลขใบอนุญาต สำเนาบัตรประชาชน สำเนาใบอนุญาต ประวัติการศึกษา และประสบการณ์ ต้องเป็นความจริง',
                            '**การตรวจสอบของเรา:** เราเทียบเลขใบอนุญาตกับทะเบียนทนายความที่ทีมงานรวบรวมไว้ และ/หรือให้ทีมงานตรวจเอกสาร ก่อนเปิดโปรไฟล์ให้ลูกความเห็น การตรวจนี้เป็นการตรวจเบื้องต้นของ Lawslane เอง **ไม่ใช่การรับรองจากสภาทนายความ** และไม่ใช่การรับรองความสามารถของทนายความ ลูกความตรวจสถานะใบอนุญาตได้ที่หน้า [ตรวจสอบทนายความ](/verify-lawyer)',
                            'เมื่อได้รับการอนุมัติ ข้อมูลโปรไฟล์บางส่วนจะเปิดเผยต่อสาธารณะ รวมถึงผู้ที่ไม่ได้เข้าสู่ระบบและเครื่องมือค้นหา ได้แก่ ชื่อ รูปโปรไฟล์ เลขใบอนุญาต ความเชี่ยวชาญ จังหวัดที่ให้บริการ คำอธิบาย การศึกษา ประสบการณ์ สำนักงาน ตารางเวลา คะแนนและรีวิว ส่วนเบอร์โทรศัพท์ อีเมล ที่อยู่ และเอกสารยืนยันตัวตนจะไม่เปิดเผย',
                            'บัญชีธนาคารที่ทนายความกรอกไว้จะแสดงให้**เฉพาะลูกความในเคสของทนายความคนนั้น**เห็น เพื่อใช้โอนค่าวิชาชีพ ทนายความต้องใช้บัญชีที่เป็นชื่อของตนเองหรือสำนักงานของตน',
                            'ทนายความต้องปฏิบัติตามกฎหมาย ข้อบังคับสภาทนายความว่าด้วยมรรยาททนายความ และหน้าที่รักษาความลับของลูกความ',
                            'ทนายความเป็นผู้ออกใบเสร็จ/ใบกำกับภาษี และรับผิดชอบภาษีจากรายได้ของตนเอง',
                        ],
                    },
                ],
            },
            {
                id: 'payments',
                title: 'ค่าบริการและการชำระเงิน',
                blocks: [
                    { p: '**ลูกความชำระค่าวิชาชีพให้ทนายความโดยตรง Lawslane ไม่ได้รับ ถือ หรือพักเงินแทนฝ่ายใด** และไม่ใช่ผู้ให้บริการรับชำระเงินหรือบัญชีคุ้มครองเงิน (escrow)' },
                    {
                        ul: [
                            'ค่าวิชาชีพ งวดชำระ และค่าบริการเพิ่มเติม เป็นไปตามที่ทนายความเสนอและลูกความตกลงในระบบ',
                            'ลูกความโอนเงินเข้าบัญชีของทนายความที่แสดงในหน้าชำระเงินของเคส และแนบหลักฐานการโอนเพื่อแจ้งทนายความได้ ทนายความเป็นผู้กดยืนยันว่าได้รับเงินแล้ว สถานะ "ชำระแล้ว" ในระบบจึงเป็นบันทึกจากการยืนยันของทนายความ',
                            '**ก่อนโอน โปรดตรวจว่าชื่อบัญชีตรงกับชื่อทนายความหรือสำนักงานของทนายความ** หากมีผู้ขอให้โอนเข้าบัญชีอื่นที่ไม่ตรงกัน โปรดอย่าโอนและแจ้งเรา',
                            'การขอนัดหมายกับทนายความผ่านระบบไม่มีค่าใช้จ่ายให้ Lawslane',
                            'การยกเลิกงานและการคืนเงิน เป็นเรื่องที่ลูกความตกลงกับทนายความโดยตรง Lawslane ไม่มีเงินที่จะคืนให้ แต่อาจช่วยประสานงานเมื่อได้รับแจ้ง',
                            'ปัจจุบัน Lawslane ไม่เก็บค่าธรรมเนียมหรือส่วนแบ่งจากค่าวิชาชีพ หากจะเริ่มเก็บค่าบริการใดในอนาคต เราจะแจ้งอัตราและเงื่อนไขล่วงหน้าก่อนมีผล และท่านเลือกได้ว่าจะใช้บริการนั้นหรือไม่',
                        ],
                    },
                ],
            },
            {
                id: 'ai',
                title: 'ผู้ช่วย AI และเครื่องมือค้นข้อมูล',
                blocks: [
                    {
                        ul: [
                            'คำตอบจากลลิน การค้นหาข้อกฎหมาย การวิเคราะห์สัญญา และการแปล สร้างขึ้นโดยระบบอัตโนมัติ **เป็นข้อมูลทั่วไปเท่านั้น ไม่ใช่คำแนะนำทางกฎหมาย** อาจผิดพลาดหรือไม่เป็นปัจจุบัน และไม่ทำให้เกิดความสัมพันธ์ทนายความกับลูกความ',
                            'ก่อนตัดสินใจในเรื่องที่มีผลทางกฎหมาย โปรดปรึกษาทนายความ รายละเอียดอยู่ใน [ข้อจำกัดความรับผิดของ AI](/ai-disclaimer)',
                            'ข้อความและไฟล์ที่ท่านส่งให้เครื่องมือ AI จะถูกส่งไปประมวลผลที่ผู้ให้บริการ AI ภายนอก (ดู [นโยบายความเป็นส่วนตัว](/privacy)) โปรดอย่าใส่ข้อมูลส่วนบุคคลของผู้อื่นหรือข้อมูลอ่อนไหวเกินจำเป็น',
                            'เราอาจจำกัดจำนวนการใช้งานเครื่องมือ AI เพื่อป้องกันการใช้งานเกินควร',
                        ],
                    },
                ],
            },
            {
                id: 'forms',
                title: 'แบบฟอร์มและเอกสารตัวอย่าง',
                blocks: [
                    { p: 'แบบฟอร์มและเอกสารตัวอย่างเป็นแม่แบบทั่วไปที่อาจไม่เหมาะกับกรณีของท่าน โปรดให้ทนายความตรวจก่อนใช้จริง ผู้ที่ไม่ได้เข้าสู่ระบบอาจดาวน์โหลดได้ในจำนวนจำกัด ห้ามนำแบบฟอร์มไปจำหน่ายต่อ' },
                ],
            },
            {
                id: 'reviews',
                title: 'รีวิวและเนื้อหาของผู้ใช้',
                blocks: [
                    {
                        ul: [
                            'รีวิวทนายความทำได้จากเคสที่ท่านใช้บริการจริง และต้องสะท้อนประสบการณ์ของท่านตามจริง ห้ามรีวิวปลอม ห้ามให้หรือรับประโยชน์เพื่อแลกกับรีวิว และห้ามมีข้อความหมิ่นประมาท หยาบคาย หรือเปิดเผยข้อมูลส่วนตัวของผู้อื่น',
                            'รีวิวจะแสดงต่อสาธารณะพร้อมชื่อที่แสดงและรูปโปรไฟล์ของผู้รีวิว',
                            'ท่านยังเป็นเจ้าของข้อความ ไฟล์ และรีวิวที่ท่านส่ง แต่อนุญาตให้เราจัดเก็บ แสดง และประมวลผลเท่าที่จำเป็นในการให้บริการ',
                            'เราอาจซ่อนหรือลบเนื้อหาที่ขัดกับข้อกำหนดนี้หรือกฎหมาย',
                        ],
                    },
                ],
            },
            {
                id: 'prohibited',
                title: 'สิ่งที่ห้ามทำ',
                blocks: [
                    {
                        ul: [
                            'ใช้บริการเพื่อการที่ผิดกฎหมาย ฉ้อโกง หรือหลอกลวงผู้อื่น',
                            'แอบอ้างเป็นบุคคลอื่น หรืออ้างว่าเป็นทนายความโดยไม่มีใบอนุญาต',
                            'คุกคาม ข่มขู่ หรือส่งข้อความที่ไม่เหมาะสมถึงผู้ใช้อื่น',
                            'อัปโหลดมัลแวร์ หรือไฟล์ที่ละเมิดลิขสิทธิ์หรือสิทธิของผู้อื่น',
                            'เจาะระบบ หลบเลี่ยงการยืนยันตัวตนหรือการจำกัดการใช้งาน หรือทำให้ระบบทำงานผิดปกติ',
                            'ดึงข้อมูลโปรไฟล์ทนายความหรือข้อมูลอื่นแบบอัตโนมัติจำนวนมาก โดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร',
                        ],
                    },
                ],
            },
            {
                id: 'ip',
                title: 'ทรัพย์สินทางปัญญา',
                blocks: [
                    { p: 'ชื่อ Lawslane โลโก้ การออกแบบ ซอฟต์แวร์ และเนื้อหาที่เราจัดทำ เป็นของ Lawslane หรือผู้อนุญาตให้เราใช้ ห้ามทำซ้ำหรือดัดแปลงเพื่อการค้าโดยไม่ได้รับอนุญาต ตัวบทกฎหมายและคำพิพากษาที่แสดงในระบบเป็นข้อมูลสาธารณะ' },
                ],
            },
            {
                id: 'liability',
                title: 'ข้อจำกัดความรับผิด',
                blocks: [
                    {
                        ul: [
                            'เราให้บริการตามสภาพที่เป็นอยู่ และพยายามให้ระบบใช้งานได้ต่อเนื่อง แต่ไม่รับประกันว่าจะไม่มีการหยุดชะงักหรือข้อผิดพลาด',
                            'เท่าที่กฎหมายอนุญาต Lawslane ไม่ต้องรับผิดต่อความเสียหายที่เกิดจากคำแนะนำหรือการกระทำของทนายความ การตกลงหรือการโอนเงินระหว่างผู้ใช้ หรือการที่ท่านนำข้อมูลจากเครื่องมือ AI ไปใช้โดยไม่ปรึกษาทนายความ',
                            'ข้อจำกัดนี้ไม่ใช้กับความเสียหายที่เกิดจากการกระทำโดยจงใจหรือประมาทเลินเล่ออย่างร้ายแรงของเรา และไม่ตัดสิทธิใดที่ท่านมีตามกฎหมายคุ้มครองผู้บริโภค',
                        ],
                    },
                ],
            },
            {
                id: 'termination',
                title: 'การระงับหรือยุติบัญชี',
                blocks: [
                    { p: 'เราอาจระงับหรือปิดบัญชี หรือซ่อนโปรไฟล์ทนายความ หากพบว่ามีการละเมิดข้อกำหนดนี้ ให้ข้อมูลเท็จ ใบอนุญาตไม่มีผล หรือมีเหตุอันควรสงสัยว่ามีการฉ้อโกง โดยจะแจ้งเหตุผลให้ทราบเท่าที่ทำได้ ท่านโต้แย้งได้ทางอีเมลด้านล่าง' },
                ],
            },
            {
                id: 'changes',
                title: 'การแก้ไขข้อกำหนด',
                blocks: [
                    { p: 'เราอาจปรับปรุงข้อกำหนดนี้เมื่อบริการหรือกฎหมายเปลี่ยนไป และจะแสดงวันที่ปรับปรุงไว้ด้านบน หากเป็นการเปลี่ยนแปลงสำคัญ เราจะแจ้งผ่านเว็บไซต์หรืออีเมลล่วงหน้าอย่างน้อย 30 วันก่อนมีผล การใช้บริการต่อหลังจากนั้นถือว่าท่านยอมรับข้อกำหนดฉบับใหม่' },
                    { p: 'เมื่อ Lawslane จดทะเบียนเป็นนิติบุคคล สิทธิและหน้าที่ของเราตามข้อกำหนดนี้จะโอนไปยังนิติบุคคลนั้น โดยเงื่อนไขที่ท่านได้รับไม่ด้อยลง เราจะแจ้งชื่อและข้อมูลของนิติบุคคลให้ทราบล่วงหน้า' },
                ],
            },
            {
                id: 'law',
                title: 'กฎหมายที่ใช้บังคับ',
                blocks: [
                    { p: 'ข้อกำหนดนี้อยู่ภายใต้กฎหมายไทย ข้อพิพาทให้อยู่ในอำนาจของศาลไทย ข้อกำหนดนี้จัดทำเป็นภาษาไทย อังกฤษ และจีน หากไม่ตรงกันให้ถือฉบับภาษาไทยเป็นหลัก' },
                ],
            },
            {
                id: 'contact',
                title: 'ติดต่อเรา',
                blocks: [
                    { p: `${th.name} · ${th.address}` },
                    { p: `อีเมล: [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}) หรือ [ศูนย์ช่วยเหลือ](/help)` },
                ],
            },
        ],
    },

    en: {
        title: 'Terms of Service',
        intro: [
            `These Terms are an agreement between you and ${en.name}, the operator of Lawslane ("**Lawslane**", "**we**"), currently a startup not yet registered as a company, which operates lawslane.com and related services (the "**Service**"). They apply to every user: visitors, clients and lawyers.`,
            'Please read them in full. By signing up for or using the Service you accept these Terms and acknowledge our [Privacy Policy](/privacy), [Cookie Policy](/cookies) and [AI Disclaimer](/ai-disclaimer).',
        ],
        sections: [
            {
                id: 'service',
                title: 'What Lawslane is, and is not',
                blocks: [
                    { p: 'Lawslane is an **online platform that helps clients find and contact lawyers**, with tools for preliminary legal research such as the "Lalin" AI assistant, law search and document forms.' },
                    {
                        ul: [
                            'Lawslane is **not a law firm** and does not give legal advice itself.',
                            'Lawyers on the platform are **independent professionals**, not employees or agents of Lawslane.',
                            'The lawyer–client relationship, scope of work, fees and case outcome are agreed and owed directly between the lawyer and the client.',
                            'Lawslane does not guarantee case outcomes or the quality of any lawyer\'s work.',
                        ],
                    },
                ],
            },
            {
                id: 'accounts',
                title: 'Accounts',
                blocks: [
                    {
                        ul: [
                            'You must be at least 20 years old or have attained majority under Thai law. Minors need the consent of their legal representative.',
                            'You may sign up with email and password, a Google account or a LINE account, and must keep your information accurate and current.',
                            'Keep your password confidential. You are responsible for activity under your account and must tell us promptly if you suspect unauthorised use.',
                            'One account per person per role. Do not create accounts for others without their permission.',
                            `You may close your account at any time by contacting [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}). See the [Privacy Policy](/privacy) for how data is deleted.`,
                        ],
                    },
                ],
            },
            {
                id: 'lawyers',
                title: 'Additional terms for lawyers',
                blocks: [
                    {
                        ul: [
                            'You must hold a valid lawyer\'s licence and tell us immediately if it is suspended, revoked or expires.',
                            'Information and documents you submit (licence number, ID card copy, licence copy, education, experience) must be true.',
                            '**Our checks:** before a profile is shown to clients, we match the licence number against a lawyer register compiled by our team and/or have our team review the documents. This is Lawslane\'s own preliminary check. It is **not a certification by the Lawyers Council of Thailand** and does not vouch for a lawyer\'s competence. Clients can check a licence on the [Verify a Lawyer](/verify-lawyer) page.',
                            'Once approved, part of your profile is public, including to logged-out visitors and search engines: name, photo, licence number, specialties, provinces served, description, education, experience, firm, schedule, ratings and reviews. Your phone number, email, address and identity documents are not published.',
                            'Your bank account details are shown **only to clients in your own cases**, so they can pay your fees. The account must be in your name or your firm\'s name.',
                            'You must comply with the law, the Lawyers Council\'s regulations on professional conduct, and your duty of client confidentiality.',
                            'You issue your own receipts or tax invoices and are responsible for tax on your income.',
                        ],
                    },
                ],
            },
            {
                id: 'payments',
                title: 'Fees and payments',
                blocks: [
                    { p: '**Clients pay lawyers directly. Lawslane does not receive, hold or pass on money for anyone**, and is not a payment service or escrow.' },
                    {
                        ul: [
                            'Fees, instalments and additional charges are as proposed by the lawyer and agreed by the client in the system.',
                            'The client transfers to the lawyer\'s account shown on the case payment page and may attach proof of transfer to notify the lawyer. The lawyer confirms receipt, so a "paid" status is a record of the lawyer\'s confirmation.',
                            '**Before transferring, check that the account name matches the lawyer or their firm.** If anyone asks you to pay a different account, do not pay and tell us.',
                            'Requesting an appointment through the system is free of charge from Lawslane.',
                            'Cancellations and refunds are settled directly between client and lawyer. Lawslane holds no money to refund, but may help coordinate if told.',
                            'Lawslane currently charges no fees or commission on lawyers\' fees. If we introduce any charge in future we will announce the rate and terms before it takes effect, and you may choose whether to use that service.',
                        ],
                    },
                ],
            },
            {
                id: 'ai',
                title: 'AI assistant and research tools',
                blocks: [
                    {
                        ul: [
                            'Answers from Lalin, law search, contract analysis and translation are generated automatically. **They are general information, not legal advice**, may be wrong or out of date, and do not create a lawyer–client relationship.',
                            'Consult a lawyer before acting on anything with legal consequences. See the [AI Disclaimer](/ai-disclaimer).',
                            'Text and files you give the AI tools are sent to external AI providers for processing (see the [Privacy Policy](/privacy)). Do not include other people\'s personal data or more sensitive information than needed.',
                            'We may limit how often the AI tools can be used to prevent abuse.',
                        ],
                    },
                ],
            },
            {
                id: 'forms',
                title: 'Forms and sample documents',
                blocks: [
                    { p: 'Forms and sample documents are general templates that may not fit your situation; have a lawyer review them before real use. Logged-out visitors may download a limited number. Do not resell the forms.' },
                ],
            },
            {
                id: 'reviews',
                title: 'Reviews and user content',
                blocks: [
                    {
                        ul: [
                            'You may review a lawyer only for a case in which you used their service, and the review must honestly reflect your experience. No fake reviews, no incentives for reviews, and no defamatory, abusive or privacy-invading content.',
                            'Reviews are public, together with the reviewer\'s display name and profile photo.',
                            'You keep ownership of messages, files and reviews you submit, and allow us to store, display and process them as needed to run the Service.',
                            'We may hide or remove content that breaks these Terms or the law.',
                        ],
                    },
                ],
            },
            {
                id: 'prohibited',
                title: 'Prohibited conduct',
                blocks: [
                    {
                        ul: [
                            'Using the Service for anything unlawful, fraudulent or deceptive.',
                            'Impersonating anyone, or claiming to be a lawyer without a licence.',
                            'Harassing, threatening or sending inappropriate messages to other users.',
                            'Uploading malware or files that infringe copyright or others\' rights.',
                            'Hacking, bypassing authentication or rate limits, or disrupting the system.',
                            'Bulk automated collection of lawyer profiles or other data without written permission.',
                        ],
                    },
                ],
            },
            {
                id: 'ip',
                title: 'Intellectual property',
                blocks: [
                    { p: 'The Lawslane name, logo, design, software and content we create belong to Lawslane or its licensors. Do not copy or adapt them commercially without permission. Statutes and court decisions shown in the Service are public information.' },
                ],
            },
            {
                id: 'liability',
                title: 'Limitation of liability',
                blocks: [
                    {
                        ul: [
                            'The Service is provided as is. We try to keep it available but do not guarantee it will be uninterrupted or error-free.',
                            'To the extent permitted by law, Lawslane is not liable for loss caused by a lawyer\'s advice or conduct, by agreements or payments between users, or by your use of AI output without consulting a lawyer.',
                            'This does not limit liability for our wilful misconduct or gross negligence, or any rights you have under consumer protection law.',
                        ],
                    },
                ],
            },
            {
                id: 'termination',
                title: 'Suspension and termination',
                blocks: [
                    { p: 'We may suspend or close an account, or hide a lawyer profile, for breach of these Terms, false information, an invalid licence, or reasonable suspicion of fraud. We will give reasons where we can, and you may dispute the decision by email.' },
                ],
            },
            {
                id: 'changes',
                title: 'Changes to these Terms',
                blocks: [
                    { p: 'We may update these Terms when the Service or the law changes, and will show the date of the update above. For material changes we will give at least 30 days\' notice on the website or by email. Continuing to use the Service afterwards means you accept the new Terms.' },
                    { p: 'When Lawslane is registered as a company, our rights and obligations under these Terms will transfer to that company on terms no less favourable to you. We will tell you its name and details in advance.' },
                ],
            },
            {
                id: 'law',
                title: 'Governing law',
                blocks: [
                    { p: 'These Terms are governed by Thai law and disputes are subject to the Thai courts. They are published in Thai, English and Chinese; if the versions differ, the Thai version prevails.' },
                ],
            },
            {
                id: 'contact',
                title: 'Contact us',
                blocks: [
                    { p: `${en.name} · ${en.address}` },
                    { p: `Email: [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}) or the [Help Center](/help)` },
                ],
            },
        ],
    },

    zh: {
        title: '服务条款',
        intro: [
            `本条款是您与 Lawslane 的运营者 ${zh.name}（以下称"**Lawslane**"或"**我们**"）之间的协议。Lawslane 目前是尚未注册为公司的初创项目。我们运营 lawslane.com 及相关服务（"**本服务**"）。本条款适用于所有用户，包括访客、委托人和律师。`,
            '请完整阅读。注册或使用本服务即表示您接受本条款，并已知悉我们的[隐私政策](/privacy)、[Cookie 政策](/cookies)和[AI 免责声明](/ai-disclaimer)。',
        ],
        sections: [
            {
                id: 'service',
                title: 'Lawslane 是什么，不是什么',
                blocks: [
                    { p: 'Lawslane 是一个**帮助委托人查找并联系律师的在线平台**，并提供初步法律检索工具，例如 AI 助手"Lalin"、法律检索和文书模板。' },
                    {
                        ul: [
                            'Lawslane **不是律师事务所**，本身不提供法律意见。',
                            '平台上的律师是**独立执业者**，不是 Lawslane 的雇员或代理人。',
                            '律师与委托人之间的委托关系、工作范围、律师费及案件结果，由双方直接约定并相互负责。',
                            'Lawslane 不保证案件结果或律师的服务质量。',
                        ],
                    },
                ],
            },
            {
                id: 'accounts',
                title: '用户账户',
                blocks: [
                    {
                        ul: [
                            '您须年满 20 周岁或依泰国法律已成年。未成年人须经法定代理人同意。',
                            '您可以使用电子邮件和密码、Google 账户或 LINE 账户注册，并须保持信息准确、最新。',
                            '请妥善保管密码。您须对账户下的活动负责；如怀疑账户被他人使用，请立即通知我们。',
                            '每人每个角色限一个账户。未经他人同意，不得代其创建账户。',
                            `您可随时发送邮件至 [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}) 申请注销账户。数据删除方式见[隐私政策](/privacy)。`,
                        ],
                    },
                ],
            },
            {
                id: 'lawyers',
                title: '律师附加条款',
                blocks: [
                    {
                        ul: [
                            '律师须持有有效的律师执照；执照被暂停、吊销或过期时须立即通知我们。',
                            '注册时提交的信息和文件（执照号、身份证复印件、执照复印件、学历、经验）必须真实。',
                            '**我们的审核：**在向委托人展示资料前，我们会将执照号与团队整理的律师名录比对，和/或由团队审核文件。这是 Lawslane 自己的初步审核，**并非泰国律师公会的认证**，也不代表对律师能力的担保。委托人可在[核实律师](/verify-lawyer)页面查询执照。',
                            '审核通过后，部分资料将公开，包括对未登录访客和搜索引擎公开：姓名、照片、执照号、专业领域、服务府、简介、学历、经验、事务所、日程、评分和评价。电话、电子邮件、地址和身份文件不会公开。',
                            '您的银行账户**仅向您本人案件中的委托人**显示，以便支付律师费。账户须为您本人或您所在事务所的名义。',
                            '律师须遵守法律、律师公会关于律师职业道德的规定及为委托人保密的义务。',
                            '律师自行开具收据或税务发票，并自行负责其收入的税款。',
                        ],
                    },
                ],
            },
            {
                id: 'payments',
                title: '费用与付款',
                blocks: [
                    { p: '**委托人直接向律师付款。Lawslane 不代任何一方收取、持有或转付款项**，也不是支付服务商或第三方托管（escrow）。' },
                    {
                        ul: [
                            '律师费、分期款和附加费用以律师在系统中提出、委托人同意的内容为准。',
                            '委托人向案件付款页面显示的律师账户转账，并可上传转账凭证通知律师。由律师确认收款，因此系统中的"已付款"状态是律师确认的记录。',
                            '**转账前请核对账户名称与律师本人或其事务所一致。**如有人要求您转入其他不一致的账户，请勿转账并通知我们。',
                            '通过系统预约律师，Lawslane 不收取任何费用。',
                            '取消和退款由委托人与律师直接协商。Lawslane 没有可退还的款项，但在收到通知后可协助沟通。',
                            'Lawslane 目前不收取任何手续费或律师费分成。如将来开始收取任何费用，我们会在生效前公布费率和条件，您可自行选择是否使用该服务。',
                        ],
                    },
                ],
            },
            {
                id: 'ai',
                title: 'AI 助手与检索工具',
                blocks: [
                    {
                        ul: [
                            'Lalin 的回答、法律检索、合同分析和翻译均由系统自动生成，**仅为一般信息，不构成法律意见**，可能有误或未及时更新，也不形成律师与委托人关系。',
                            '在做出任何具有法律后果的决定前，请咨询律师。详见[AI 免责声明](/ai-disclaimer)。',
                            '您提交给 AI 工具的文字和文件会发送给外部 AI 服务商处理（见[隐私政策](/privacy)）。请勿提交他人的个人信息或超出必要的敏感信息。',
                            '为防止滥用，我们可能限制 AI 工具的使用次数。',
                        ],
                    },
                ],
            },
            {
                id: 'forms',
                title: '文书模板',
                blocks: [
                    { p: '文书模板为通用范本，未必适合您的情况，实际使用前请让律师审阅。未登录访客的下载次数有限。禁止转售模板。' },
                ],
            },
            {
                id: 'reviews',
                title: '评价与用户内容',
                blocks: [
                    {
                        ul: [
                            '您只能就实际使用过服务的案件评价律师，且评价须如实反映您的体验。禁止虚假评价、以利益换取评价，以及诽谤、辱骂或泄露他人隐私的内容。',
                            '评价会连同评价者的显示名称和头像公开展示。',
                            '您仍拥有所提交的消息、文件和评价，但授权我们在提供服务所需范围内存储、展示和处理。',
                            '对违反本条款或法律的内容，我们可以隐藏或删除。',
                        ],
                    },
                ],
            },
            {
                id: 'prohibited',
                title: '禁止行为',
                blocks: [
                    {
                        ul: [
                            '将本服务用于违法、欺诈或欺骗目的。',
                            '冒充他人，或在无执照情况下自称律师。',
                            '骚扰、威胁其他用户或发送不当信息。',
                            '上传恶意软件或侵犯版权及他人权利的文件。',
                            '入侵系统、绕过身份验证或使用限制，或干扰系统运行。',
                            '未经书面许可，批量自动抓取律师资料或其他数据。',
                        ],
                    },
                ],
            },
            {
                id: 'ip',
                title: '知识产权',
                blocks: [
                    { p: 'Lawslane 名称、标志、设计、软件及我们制作的内容归 Lawslane 或其许可方所有，未经许可不得复制或改编用于商业目的。系统中显示的法律条文和判决属于公开信息。' },
                ],
            },
            {
                id: 'liability',
                title: '责任限制',
                blocks: [
                    {
                        ul: [
                            '本服务按现状提供。我们会尽力保持服务可用，但不保证不中断或无错误。',
                            '在法律允许的范围内，对于因律师的意见或行为、用户之间的约定或付款，或您未咨询律师而使用 AI 输出所造成的损失，Lawslane 不承担责任。',
                            '上述限制不适用于我们的故意或重大过失，也不影响您依消费者保护法享有的权利。',
                        ],
                    },
                ],
            },
            {
                id: 'termination',
                title: '暂停与终止',
                blocks: [
                    { p: '如发现违反本条款、提供虚假信息、执照无效或有合理理由怀疑欺诈，我们可以暂停或关闭账户，或隐藏律师资料。我们会尽可能说明理由，您可通过电子邮件提出异议。' },
                ],
            },
            {
                id: 'changes',
                title: '条款变更',
                blocks: [
                    { p: '当服务或法律变化时，我们可能更新本条款，并在上方显示更新日期。如有重大变更，我们将至少提前 30 天通过网站或电子邮件通知。此后继续使用本服务即表示您接受新条款。' },
                    { p: 'Lawslane 注册为公司后，我们在本条款下的权利和义务将转移至该公司，且对您的条件不会降低。我们会提前告知该公司的名称和信息。' },
                ],
            },
            {
                id: 'law',
                title: '适用法律',
                blocks: [
                    { p: '本条款受泰国法律管辖，争议由泰国法院管辖。本条款以泰文、英文和中文发布；如有不一致，以泰文版本为准。' },
                ],
            },
            {
                id: 'contact',
                title: '联系我们',
                blocks: [
                    { p: `${zh.name} · ${zh.address}` },
                    { p: `电子邮件：[${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}) 或[帮助中心](/help)` },
                ],
            },
        ],
    },
};
