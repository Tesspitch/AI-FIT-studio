# AI Fit Studio

เว็บฝึกออกกำลังกายที่ตรวจตำแหน่งร่างกายในเบราว์เซอร์ ใช้ React, Vite, TypeScript, Tailwind CSS, MediaPipe Tasks Vision และ Supabase

## เริ่มใช้งาน

```shell
npm ci
npm run dev
npm test
npm run build
```

เปิด URL ที่ Vite แสดง แล้วเลือก **เปิดห้องฝึก → เปิดกล้อง** การใช้กล้องต้องอยู่บน localhost หรือ HTTPS และได้รับสิทธิ์จากเบราว์เซอร์ ตัวเว็บโหลดโมเดล Pose Landmarker Lite ของ Google เมื่อเปิดกล้อง ส่วนภาพและจุดข้อต่อประมวลผลในเบราว์เซอร์ ตั้ง `VITE_POSE_MODEL_URL` ได้หากโฮสต์ไฟล์โมเดลเอง

## เชื่อมบริการ

1. คัดลอก `.env.example` เป็น `.env.local` แล้วตั้ง `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY` จาก Supabase ของโปรเจกต์
2. ใช้ migration ใน [supabase/migrations](./supabase/migrations) กับฐานข้อมูลสำหรับโปรเจกต์นี้ และตั้ง Site URL กับ redirect URLs ใน Supabase Auth ให้ตรงกับเว็บที่ใช้งาน
3. เมื่อยืนยันรายชื่อท่าและมีคลิปแล้ว ให้เพิ่มข้อมูลใน `exercises` ตั้ง `is_active` สำหรับท่าที่พร้อมแสดง และตั้ง `VITE_REFERENCE_VIDEO_BASE_URL` เป็น URL ฐานของคลิปสาธารณะบน R2
4. สำหรับ Cloudflare Pages ใช้คำสั่ง build `npm run build` และ output directory `dist`

### ตั้งค่าการเข้าสู่ระบบ

- เปิด Email และ Google providers ใน Supabase Auth การสมัครด้วยอีเมลและ Google OAuth กลับมาที่หน้าภาพรวม `/` ของเว็บที่เริ่มใช้งาน เพิ่ม URL เต็มใน Redirect URLs เช่น `http://127.0.0.1:5174/`, `http://localhost:5174/` และ URL จริงเมื่อ Deploy
- ใน Google Auth Platform ใช้ OAuth Client ประเภท Web application และใส่ Callback URL ที่หน้า Google Provider ของ Supabase แสดงใน Authorized redirect URIs กรอก Google Client ID และ Client Secret ใน Supabase Dashboard
- สำหรับการสมัครด้วยอีเมลของผู้ใช้ทั่วไป ให้ตั้ง [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) ใน Supabase Auth บริการส่งอีเมลเริ่มต้นมีข้อจำกัดผู้รับและโควตาส่งอีเมลยืนยันระดับโปรเจกต์

รายชื่อท่า กฎนับ Rep สมการให้คะแนน และคลิปอยู่ระหว่างกำหนด ห้องฝึกใช้ทดสอบกล้องและการตรวจจับได้ทันที ประวัติอ่านผลที่มีอยู่จาก Supabase เมื่อเชื่อมต่อ งานบันทึกผลการฝึกจะเชื่อมกับกฎที่ยืนยันแล้วตาม [requirement.md](./requirement.md)
# AI-FIT-studio
