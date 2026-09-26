import type { LegalDoc, LegalLocale } from './types';
import { COMPANY, CONTACT_EMAIL } from './meta';

// ตารางในหน้านี้ต้องตรงกับที่โค้ดตั้งจริง:
//   session / session_hint / role_hint  → src/app/api/auth/session/route.ts
//   NEXT_LOCALE                         → next-intl middleware (src/middleware.ts)
//   cookie_consent                      → src/components/cookie-banner.tsx
//   guest_downloads                     → src/app/[locale]/forms/page.tsx
//   chat_draft_* / chat_pub_* / chat_priv_* → components/chat/chat-box.tsx, hooks/use-chat-socket.ts
// เพิ่มคุกกี้/เครื่องมือวิเคราะห์ใหม่เมื่อไร ต้องแก้ตารางนี้ และถ้าไม่ใช่ "จำเป็น" ต้องขอความยินยอมก่อนตั้ง

export const COOKIES: Record<LegalLocale, LegalDoc> = {
    th: {
        title: 'นโยบายคุกกี้',
        intro: [
            `นโยบายนี้อธิบายว่า ${COMPANY.th.name} ("**Lawslane**") ใช้คุกกี้และพื้นที่เก็บข้อมูลในเบราว์เซอร์อย่างไรบน lawslane.com อ่านประกอบกับ [นโยบายความเป็นส่วนตัว](/privacy)`,
        ],
        sections: [
            {
                id: 'what',
                title: 'คุกกี้คืออะไร',
                blocks: [
                    { p: 'คุกกี้คือไฟล์ข้อมูลขนาดเล็กที่เว็บไซต์บันทึกไว้ในเบราว์เซอร์ของท่าน นอกจากคุกกี้ เว็บไซต์ยังใช้พื้นที่เก็บข้อมูลในเบราว์เซอร์ (localStorage และ IndexedDB) ในลักษณะคล้ายกัน นโยบายนี้ครอบคลุมทั้งสองแบบ' },
                ],
            },
            {
                id: 'summary',
                title: 'สรุปสั้น ๆ',
                blocks: [
                    {
                        ul: [
                            '**เราใช้เฉพาะคุกกี้ที่จำเป็น** เพื่อให้ท่านเข้าสู่ระบบ ใช้ภาษาที่เลือก และใช้งานแชทได้',
                            '**เราไม่ใช้คุกกี้วิเคราะห์พฤติกรรมหรือคุกกี้โฆษณา** และไม่มีเครื่องมือติดตามของบุคคลที่สาม เช่น Google Analytics หรือ Facebook Pixel',
                            'ตัวนับยอดเข้าชมที่แสดงท้ายเว็บเป็นตัวเลขรวมรายเดือนบนเซิร์ฟเวอร์ ไม่ใช้คุกกี้และไม่ผูกกับตัวท่าน',
                            'คุกกี้ที่จำเป็นไม่ต้องขอความยินยอมตามกฎหมาย แต่เราแจ้งให้ทราบผ่านแถบประกาศเมื่อเข้าเว็บครั้งแรก',
                        ],
                    },
                ],
            },
            {
                id: 'cookies',
                title: 'คุกกี้ที่เราตั้ง',
                blocks: [
                    {
                        table: {
                            head: ['ชื่อ', 'ใช้ทำอะไร', 'อายุ'],
                            rows: [
                                ['session', 'เก็บสถานะการเข้าสู่ระบบ อ่านได้เฉพาะเซิร์ฟเวอร์ (HttpOnly) ใช้ร่วมกันทุกเว็บใน *.lawslane.com เพื่อให้เข้าสู่ระบบครั้งเดียว', '5 วัน หรือจนออกจากระบบ'],
                                ['session_hint', 'บอกหน้าเว็บว่าท่านเข้าสู่ระบบอยู่ (ค่าเป็น "authenticated" เท่านั้น)', '5 วัน หรือจนออกจากระบบ'],
                                ['role_hint', 'บอกว่าบัญชีเป็นลูกความ ทนายความ หรือล่าม/นักแปล เพื่อพาไปหน้าที่ถูกต้อง', '5 วัน หรือจนออกจากระบบ'],
                                ['NEXT_LOCALE', 'จำภาษาที่ท่านเลือก (ไทย/อังกฤษ/จีน)', 'จนปิดเบราว์เซอร์'],
                            ],
                        },
                    },
                ],
            },
            {
                id: 'storage',
                title: 'ข้อมูลที่เก็บในเบราว์เซอร์',
                blocks: [
                    {
                        table: {
                            head: ['ชื่อ', 'ใช้ทำอะไร', 'อายุ'],
                            rows: [
                                ['firebaseLocalStorageDb (IndexedDB)', 'ระบบยืนยันตัวตนของ Google Firebase เก็บสถานะการเข้าสู่ระบบในอุปกรณ์นี้', 'จนออกจากระบบ'],
                                ['cookie_consent', 'จำว่าท่านรับทราบประกาศคุกกี้แล้ว จะได้ไม่แสดงซ้ำ', 'จนกว่าจะล้างข้อมูลเบราว์เซอร์'],
                                ['guest_downloads', 'นับจำนวนแบบฟอร์มที่ดาวน์โหลดฟรีเมื่อยังไม่เข้าสู่ระบบ', 'จนกว่าจะล้างข้อมูลเบราว์เซอร์'],
                                ['chat_draft_…', 'เก็บข้อความแชทที่พิมพ์ค้างไว้ยังไม่ได้ส่ง', 'ลบเมื่อส่งข้อความ'],
                                ['chat_pub_… / chat_priv_…', 'กุญแจเข้ารหัสข้อความแชทของอุปกรณ์นี้ กุญแจส่วนตัวไม่ถูกส่งออกจากเบราว์เซอร์', 'จนกว่าจะล้างข้อมูลเบราว์เซอร์'],
                            ],
                        },
                    },
                ],
            },
            {
                id: 'third-party',
                title: 'บริการภายนอกที่อาจตั้งคุกกี้',
                blocks: [
                    { p: 'บริการต่อไปนี้ทำงานเฉพาะเมื่อท่านใช้ฟีเจอร์นั้น และอาจตั้งคุกกี้บนโดเมนของผู้ให้บริการเองตามนโยบายของผู้ให้บริการนั้น:' },
                    {
                        ul: [
                            '**Google** — เมื่อเข้าสู่ระบบด้วย Google',
                            '**LINE** — เมื่อเข้าสู่ระบบด้วย LINE',
                            '**Cloudflare Turnstile** — ตรวจว่าเป็นคนจริงในฟอร์มสมัครสมาชิกและฟอร์มอื่น ๆ เพื่อกันบอท',
                            '**Stripe** — เมื่อทนายความหรือล่าม/นักแปลสมัครหรือจัดการแพลนรายเดือน (หน้าชำระเงินอยู่บน stripe.com ไม่ได้ตั้งคุกกี้บน lawslane.com)',
                        ],
                    },
                    { p: 'นอกจากนี้ เว็บไซต์โหลดฟอนต์จาก Google Fonts ซึ่งไม่ได้ตั้งคุกกี้ แต่เซิร์ฟเวอร์ของ Google จะได้รับหมายเลข IP ของท่านตามปกติของการโหลดไฟล์' },
                ],
            },
            {
                id: 'control',
                title: 'การจัดการคุกกี้',
                blocks: [
                    { p: 'ท่านลบหรือบล็อกคุกกี้ได้จากการตั้งค่าเบราว์เซอร์ เนื่องจากเราใช้เฉพาะคุกกี้ที่จำเป็น การบล็อกหรือลบจะทำให้ท่านออกจากระบบ ภาษากลับเป็นค่าเริ่มต้น และข้อความที่พิมพ์ค้างไว้หายไป' },
                ],
            },
            {
                id: 'changes',
                title: 'การเปลี่ยนแปลง',
                blocks: [
                    { p: 'หากในอนาคตเราจะใช้คุกกี้ที่ไม่จำเป็น เช่น คุกกี้วิเคราะห์การใช้งาน เราจะปรับปรุงนโยบายนี้และ**ขอความยินยอมจากท่านก่อนตั้งคุกกี้นั้น** โดยท่านปฏิเสธได้โดยไม่กระทบการใช้งานหลัก' },
                    { p: `สอบถามเพิ่มเติม: [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})` },
                ],
            },
        ],
    },

    en: {
        title: 'Cookie Policy',
        intro: [
            `This policy explains how ${COMPANY.en.name} ("**Lawslane**") uses cookies and browser storage on lawslane.com. Please read it with our [Privacy Policy](/privacy).`,
        ],
        sections: [
            {
                id: 'what',
                title: 'What cookies are',
                blocks: [
                    { p: 'Cookies are small data files a website saves in your browser. The site also uses browser storage (localStorage and IndexedDB) in a similar way. This policy covers both.' },
                ],
            },
            {
                id: 'summary',
                title: 'In short',
                blocks: [
                    {
                        ul: [
                            '**We use only strictly necessary cookies**, so you can sign in, keep your chosen language and use chat.',
                            '**We use no analytics or advertising cookies**, and no third-party trackers such as Google Analytics or Facebook Pixel.',
                            'The visitor counter in the footer is a monthly server-side total. It uses no cookies and is not linked to you.',
                            'Strictly necessary cookies do not require consent by law, but we tell you about them in a notice on your first visit.',
                        ],
                    },
                ],
            },
            {
                id: 'cookies',
                title: 'Cookies we set',
                blocks: [
                    {
                        table: {
                            head: ['Name', 'Purpose', 'Duration'],
                            rows: [
                                ['session', 'Keeps you signed in. Server-only (HttpOnly). Shared across *.lawslane.com so you sign in once.', '5 days or until sign-out'],
                                ['session_hint', 'Tells pages that you are signed in (value is only "authenticated").', '5 days or until sign-out'],
                                ['role_hint', 'Whether the account is a client, lawyer or interpreter/translator, to route you to the right dashboard.', '5 days or until sign-out'],
                                ['NEXT_LOCALE', 'Remembers your language (Thai/English/Chinese).', 'Until the browser closes'],
                            ],
                        },
                    },
                ],
            },
            {
                id: 'storage',
                title: 'Browser storage',
                blocks: [
                    {
                        table: {
                            head: ['Name', 'Purpose', 'Duration'],
                            rows: [
                                ['firebaseLocalStorageDb (IndexedDB)', 'Google Firebase Authentication keeps your sign-in state on this device.', 'Until sign-out'],
                                ['cookie_consent', 'Remembers that you have seen the cookie notice.', 'Until you clear browser data'],
                                ['guest_downloads', 'Counts free form downloads while not signed in.', 'Until you clear browser data'],
                                ['chat_draft_…', 'Keeps an unsent chat message you were typing.', 'Removed when sent'],
                                ['chat_pub_… / chat_priv_…', 'Chat encryption keys for this device. The private key never leaves the browser.', 'Until you clear browser data'],
                            ],
                        },
                    },
                ],
            },
            {
                id: 'third-party',
                title: 'Third-party services that may set cookies',
                blocks: [
                    { p: 'These services run only when you use the related feature, and may set cookies on their own domains under their own policies:' },
                    {
                        ul: [
                            '**Google** — when you sign in with Google',
                            '**LINE** — when you sign in with LINE',
                            '**Cloudflare Turnstile** — human verification on sign-up and other forms, to stop bots',
                            '**Stripe** — when a lawyer or interpreter subscribes to or manages a monthly plan (checkout runs on stripe.com and sets no cookies on lawslane.com)',
                        ],
                    },
                    { p: 'The site also loads fonts from Google Fonts. This sets no cookies, but Google\'s servers receive your IP address as with any file download.' },
                ],
            },
            {
                id: 'control',
                title: 'Managing cookies',
                blocks: [
                    { p: 'You can delete or block cookies in your browser settings. Because we use only necessary cookies, doing so will sign you out, reset your language and discard unsent drafts.' },
                ],
            },
            {
                id: 'changes',
                title: 'Changes',
                blocks: [
                    { p: 'If we ever use non-essential cookies, such as analytics, we will update this policy and **ask for your consent before setting them**. You will be able to refuse without affecting the core service.' },
                    { p: `Questions: [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})` },
                ],
            },
        ],
    },

    zh: {
        title: 'Cookie 政策',
        intro: [
            `本政策说明 ${COMPANY.zh.name}（"**Lawslane**"）如何在 lawslane.com 上使用 Cookie 和浏览器存储。请与[隐私政策](/privacy)一并阅读。`,
        ],
        sections: [
            {
                id: 'what',
                title: '什么是 Cookie',
                blocks: [
                    { p: 'Cookie 是网站保存在您浏览器中的小型数据文件。本网站还以类似方式使用浏览器存储（localStorage 和 IndexedDB）。本政策同时涵盖两者。' },
                ],
            },
            {
                id: 'summary',
                title: '简要说明',
                blocks: [
                    {
                        ul: [
                            '**我们只使用必要的 Cookie**，以便您登录、保持所选语言并使用聊天功能。',
                            '**我们不使用分析或广告 Cookie**，也没有 Google Analytics、Facebook Pixel 等第三方追踪工具。',
                            '页脚的访问量是服务器端的每月总数，不使用 Cookie，也不与您关联。',
                            '依法律，必要 Cookie 无需征得同意，但我们会在您首次访问时通过提示告知。',
                        ],
                    },
                ],
            },
            {
                id: 'cookies',
                title: '我们设置的 Cookie',
                blocks: [
                    {
                        table: {
                            head: ['名称', '用途', '有效期'],
                            rows: [
                                ['session', '保持登录状态。仅服务器可读（HttpOnly）。在 *.lawslane.com 各网站间共用，只需登录一次。', '5 天或至退出登录'],
                                ['session_hint', '告知页面您已登录（值仅为 "authenticated"）。', '5 天或至退出登录'],
                                ['role_hint', '标明账户是委托人、律师还是口译/笔译员，以进入正确的页面。', '5 天或至退出登录'],
                                ['NEXT_LOCALE', '记住您选择的语言（泰文/英文/中文）。', '至关闭浏览器'],
                            ],
                        },
                    },
                ],
            },
            {
                id: 'storage',
                title: '浏览器存储',
                blocks: [
                    {
                        table: {
                            head: ['名称', '用途', '有效期'],
                            rows: [
                                ['firebaseLocalStorageDb（IndexedDB）', 'Google Firebase 身份验证在本设备保存登录状态。', '至退出登录'],
                                ['cookie_consent', '记住您已看过 Cookie 提示，不再重复显示。', '至清除浏览器数据'],
                                ['guest_downloads', '未登录时统计免费下载的文书数量。', '至清除浏览器数据'],
                                ['chat_draft_…', '保存尚未发送的聊天草稿。', '发送后删除'],
                                ['chat_pub_… / chat_priv_…', '本设备的聊天加密密钥。私钥不会离开浏览器。', '至清除浏览器数据'],
                            ],
                        },
                    },
                ],
            },
            {
                id: 'third-party',
                title: '可能设置 Cookie 的第三方服务',
                blocks: [
                    { p: '以下服务仅在您使用相关功能时运行，并可能依其自身政策在其域名下设置 Cookie：' },
                    {
                        ul: [
                            '**Google** —— 使用 Google 登录时',
                            '**LINE** —— 使用 LINE 登录时',
                            '**Cloudflare Turnstile** —— 在注册及其他表单中进行人机验证，防止机器人',
                            '**Stripe** —— 律师或口译/笔译员订阅或管理月度方案时（付款页面在 stripe.com 上，不会在 lawslane.com 设置 Cookie）',
                        ],
                    },
                    { p: '本网站还从 Google Fonts 加载字体。这不会设置 Cookie，但与下载任何文件一样，Google 服务器会收到您的 IP 地址。' },
                ],
            },
            {
                id: 'control',
                title: '管理 Cookie',
                blocks: [
                    { p: '您可以在浏览器设置中删除或阻止 Cookie。由于我们只使用必要 Cookie，这样做会使您退出登录、语言恢复默认，并丢失未发送的草稿。' },
                ],
            },
            {
                id: 'changes',
                title: '变更',
                blocks: [
                    { p: '如将来使用非必要 Cookie（例如分析 Cookie），我们会更新本政策，并**在设置前征得您的同意**。您可以拒绝，且不影响核心服务的使用。' },
                    { p: `如有疑问：[${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})` },
                ],
            },
        ],
    },
};
