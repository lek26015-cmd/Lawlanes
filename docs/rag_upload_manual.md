# คู่มือการอัพโหลดข้อมูลสำหรับ RAG (Lawslane)

ระบบ RAG ของ Lawslane ใช้สำหรับดึงข้อมูลกฎหมายเพื่อตอบคำถามผู้ใช้งาน โดยแบ่งส่วนการทำงานหลักๆ ดังนี้:

## 1. การอัพโหลดไฟล์ PDF ด้วยตัวเอง (Manual PDF Upload)

หากคุณมีไฟล์ PDF กฎหมายที่ต้องการเพิ่มเข้าระบบ RAG:

1.  นำไฟล์ PDF ไปวางที่ไดเรกทอรี: `src/data/pdfs/`
2.  รันสคริปต์อัพโหลดไปยัง Cloudflare โดยใช้คำสั่ง:
    ```bash
    npx tsx scripts/ingest-to-cloudflare.ts
    ```
    *สคริปต์นี้จะอ่านไฟล์ PDF ทั้งหมดในโฟลเดอร์ แบ่งเป็นส่วนๆ (Chunks) และส่งไปยัง Vector Database บน Cloudflare*

## 2. ระบบดูดข้อมูลอัตโนมัติ (Automated Scrapers)

ระบบได้เตรียมสคริปต์ Python สำหรับดึงข้อมูลจากแหล่งต่างๆ (เช่น ราชกิจจานุเบกษา, กฤษฎีกา):

-   `scripts/ingest-ratchakitcha.py`: ดึงข้อมูลราชกิจจานุเบกษาจาก HuggingFace
-   `scripts/ingest-krisdika.py`: ดึงข้อมูลจากกฤษฎีกา
-   `scripts/supervisor.sh`: เป็นตัวควบคุม (Supervisor) ที่จะคอยเช็คและรันสคริปต์ด้านบนให้ทำงานตลอดเวลา

### การควบคุมระบบอัตโนมัติ:
คุณสามารถควบคุมการเปิด-ปิดระบบดูดข้อมูลได้ผ่าน Dashboard ในตัวแอป หรือเรียก API:
-   `POST /api/admin/ingestor-control` พร้อม body `{"action": "pause"}` หรือ `{"action": "resume"}`

## 3. สิ่งที่จำเป็น (Prerequisites)

-   **Node.js & npm**: สำหรับรันสคริปต์ TypeScript
-   **Python 3**: สำหรับรันสคริปต์ดูดข้อมูล (ต้องการ library `requests`, `huggingface_hub`)
-   **Cloudflare Credentials**: ต้องตั้งค่าใน `.env` (หากยังไม่ได้ตั้งค่า) ได้แก่ `NEXT_PUBLIC_RAG_WORKER_URL`

## 4. การตรวจสอบสถานะ

คุณสามารถดูสถานะการอัพโหลดและสถิติของ RAG ได้ที่:
-   หน้าเว็บ Dashboard: `/rag-status` (ต้องเป็น Admin)
-   ไฟล์ Log: `ratchakitcha.log`, `krisdika.log`, `supervisor.log` ใน root directory

---
*หมายเหตุ: หากต้องการล้างข้อมูลเก่าในโฟลเดอร์ PDF เพื่ออัพโหลดใหม่เท่านั้น สามารถลบไฟล์ใน `src/data/pdfs/` ก่อนวางไฟล์ใหม่ได้*
