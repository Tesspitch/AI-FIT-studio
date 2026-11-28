# Office Reset

เว็บบริหารร่างกายและยืดเหยียดระหว่างวันสำหรับคนทำงานหน้าคอม พร้อมตรวจตำแหน่งร่างกายในเบราว์เซอร์ ใช้ React, Vite, TypeScript, Tailwind CSS, MediaPipe Tasks Vision และ Supabase

## เริ่มใช้งาน

```shell
npm ci
npm run dev
npm test
npm run build
```

เปิด URL ที่ Vite แสดง กด **เปิดห้องฝึก** แล้วเลือกท่าจากรายการ เมื่อเข้าห้องฝึกให้แตะไอคอนกล้องในกรอบ **เตรียมกล้องให้พร้อม** การใช้กล้องต้องอยู่บน localhost หรือ HTTPS และได้รับสิทธิ์จากเบราว์เซอร์ ตัวเว็บโหลดโมเดล Pose Landmarker Lite ของ Google เมื่อเปิดกล้อง ส่วนภาพและจุดข้อต่อประมวลผลในเบราว์เซอร์ ตั้ง `VITE_POSE_MODEL_URL` ได้หากโฮสต์ไฟล์โมเดลเอง

## เชื่อมบริการ

1. คัดลอก `.env.example` เป็น `.env.local` แล้วตั้ง `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY` จาก Supabase ของโปรเจกต์
2. ใช้ migration ใน [supabase/migrations](./supabase/migrations) กับฐานข้อมูลสำหรับโปรเจกต์นี้ และตั้ง Site URL กับ redirect URLs ใน Supabase Auth ให้ตรงกับเว็บที่ใช้งาน
3. เมื่อยืนยันรายชื่อท่าและมีคลิปแล้ว ให้เพิ่มข้อมูลใน `exercises` ตั้ง `is_active` สำหรับท่าที่พร้อมแสดง และตั้ง `VITE_REFERENCE_VIDEO_BASE_URL` เป็น URL ฐานของคลิปสาธารณะบน R2
4. สำหรับ Cloudflare Pages ใช้คำสั่ง build `npm run build` และ output directory `dist`

### ตั้งค่าการเข้าสู่ระบบ

- เปิด Email และ Google providers ใน Supabase Auth การสมัครด้วยอีเมลและ Google OAuth กลับมาที่หน้าภาพรวม `/` ของเว็บที่เริ่มใช้งาน เพิ่ม URL เต็มใน Redirect URLs เช่น `http://127.0.0.1:5174/`, `http://localhost:5174/` และ URL จริงเมื่อ Deploy
- ใน Google Auth Platform ใช้ OAuth Client ประเภท Web application และใส่ Callback URL ที่หน้า Google Provider ของ Supabase แสดงใน Authorized redirect URIs กรอก Google Client ID และ Client Secret ใน Supabase Dashboard
- สำหรับการสมัครด้วยอีเมลของผู้ใช้ทั่วไป ให้ตั้ง [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) ใน Supabase Auth บริการส่งอีเมลเริ่มต้นมีข้อจำกัดผู้รับและโควตาส่งอีเมลยืนยันระดับโปรเจกต์
- การสมัครด้วยชื่อผู้ใช้ต้องใช้ migration `20261128000000_username_signup.sql` ก่อน deploy Edge Function `register-username` ด้วย Supabase CLI (`supabase functions deploy register-username --project-ref <project-ref>`) สำหรับการ deploy ผ่าน Dashboard ให้อัปโหลด `supabase/functions/register-username/index.ts` และปิดการตรวจ JWT ที่ gateway เฉพาะฟังก์ชันนี้ เพราะผู้สมัครยังไม่มี session ฟังก์ชันจำกัดคำขอและใช้ `SUPABASE_SERVICE_ROLE_KEY` ที่ Supabase จัดให้ใน Edge Functions เก็บคีย์นี้ฝั่งเซิร์ฟเวอร์เท่านั้น
- บัญชีชื่อผู้ใช้เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านโดยไม่ต้องยืนยันอีเมล และใช้การกู้รหัสผ่านทางอีเมลไม่ได้

รายชื่อท่า กฎนับ Rep สมการให้คะแนน และคลิปอยู่ระหว่างกำหนด ห้องฝึกใช้ทดสอบกล้องและการตรวจจับได้ทันที ประวัติอ่านผลที่มีอยู่จาก Supabase เมื่อเชื่อมต่อ งานบันทึกผลการฝึกจะเชื่อมกับกฎที่ยืนยันแล้วตาม [requirement.md](./requirement.md)

## ท่าทดลองกางแขนขวาถึงระดับไหล่

จาก **ภาพรวม → รายการท่า** เลือก **กางแขนขวาถึงระดับไหล่ (ทดลอง)** แล้วกด **เริ่มออกกำลัง** หากกล้องยังปิดอยู่ ให้ตอบคำขอสิทธิ์ในเบราว์เซอร์ ระบบจะเริ่มฝึกเมื่อกล้องและการตรวจจับพร้อม จัดกล้องให้เห็นไหล่ ศอก และสะโพกขวาเพื่อดูมุมปัจจุบัน จำนวนรอบ มุมสูงสุด และคะแนนมุมของรอบล่าสุด เมื่อกด **สิ้นสุดและบันทึก** กล้องจะปิดและบันทึกผลลง Supabase จากนั้นเปิดดูได้ในประวัติ

การบันทึกต้นแบบต้องใช้ migration `20261125010000_save_shoulder_raise_demo.sql` ซึ่งเพิ่มท่าอ้างอิงและฟังก์ชันบันทึกผลในธุรกรรมเดียว กรณีฝึกไม่ครบรอบยังบันทึกได้และแสดงคะแนนเป็น N/A คะแนนรวมใช้ค่าเฉลี่ยของคะแนนมุมในรอบที่นับได้

- คำนวณมุมจาก MediaPipe World Landmarks โดยให้ `u = ศอกขวา − ไหล่ขวา` และ `v = สะโพกขวา − ไหล่ขวา` มุมเป็นองศาจาก `acos(clamp(dot(u,v) / (|u| × |v|), −1, 1)) × 180 / π` จุดที่หลุดกรอบหรือความมั่นใจต่ำจะยกเลิกรอบที่ยังทำไม่จบ
- เกณฑ์เดโมเริ่มที่มุมไม่เกิน 25° ยกถึงอย่างน้อย 75° แล้วกลับมาที่ไม่เกิน 25° แต่ละช่วงต้องอยู่ในเกณฑ์อย่างน้อย 120 มิลลิวินาที นับหนึ่งครั้งเมื่อจบครบลำดับ
- คะแนนเดโมตั้งเป้า 90° และใช้ `round(100 × max(0, 1 − |มุมสูงสุด − 90| / 45))` คะแนนสะท้อนความใกล้มุมเป้าหมาย ระบบยังไม่แยกการยกแขนไปด้านหน้าจากการกางแขนด้านข้าง
- วิธีวัดมุมอ้างอิงงานวิจัย [Measurement of Shoulder Abduction Angle](https://pmc.ncbi.nlm.nih.gov/articles/PMC10416158/) และ [การคำนวณมุมข้อต่อจากเวกเตอร์ในงาน markerless motion capture](https://pmc.ncbi.nlm.nih.gov/articles/PMC13378133/) ค่าแบ่งช่วงและสูตรคะแนนเป็นเกณฑ์ของเดโมที่ต้องปรับเทียบกับกล้องจริง
# AI-FIT-studio
