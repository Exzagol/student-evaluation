# ระบบประเมินโปรเจกต์นักเรียน — แยกไฟล์แล้ว

## ไฟล์ในโปรเจกต์
- `index.html` — หน้าเว็บหลัก เชื่อมไฟล์ CSS และ JavaScript
- `style.css` — รูปแบบและหน้าตาเว็บ
- `firebase.js` — การเชื่อมต่อ Firebase/Firestore (คงค่า config จากไฟล์ต้นฉบับ)
- `app.js` — การทำงานของระบบ เช่น เข้าสู่ระบบ จัดการข้อมูล และบันทึกคะแนน

## วิธีเปิดใช้งาน
1. แตกไฟล์ ZIP ให้อยู่ในโฟลเดอร์เดียวกัน
2. อย่าเปลี่ยนชื่อไฟล์ทั้ง 4 ไฟล์ และอย่าแยกไฟล์ออกจากโฟลเดอร์เดียวกัน
3. แนะนำให้เปิดผ่านเว็บเซิร์ฟเวอร์ เช่น VS Code + ส่วนขยาย Live Server หรือ deploy โฟลเดอร์นี้บน Firebase Hosting
4. เปิด `index.html` ผ่าน URL ของเว็บเซิร์ฟเวอร์

## วิธีเชื่อม Firebase ให้ทำงานเหมือนเดิม
1. เข้า Firebase Console: https://console.firebase.google.com/
2. เลือกโปรเจกต์เดิม `student-evaluation-67ffb`
3. ไปที่ Build → Firestore Database และตรวจว่ามีฐานข้อมูลอยู่
4. โค้ดเดิมใช้ Firestore document ที่ path `system/main` สำหรับอ่านและเขียนข้อมูล
5. ใน Firebase Console → Firestore Database → Rules ตรวจให้สิทธิ์การอ่าน/เขียนเหมาะสมกับระบบจริง

## ข้อควรระวัง
- คง `firebase.js` ไว้ตามเดิมเพื่อเชื่อมโปรเจกต์ Firebase เดิม ไม่ต้องสร้าง Firebase app ใหม่
- ค่า Firebase web config ที่อยู่ใน `firebase.js` เป็นค่าระบุโปรเจกต์ฝั่งเว็บ ไม่ใช่รหัสผ่านผู้ดูแล แต่ความปลอดภัยต้องบังคับด้วย Firestore Security Rules และระบบยืนยันตัวตนที่เหมาะสม
- อย่าตั้ง Firestore Rules เป็น read/write ได้ทุกคนในระบบที่ใช้งานจริง เพราะคนอื่นอาจอ่านหรือแก้คะแนนได้
- หากเปิดไฟล์ตรง ๆ แล้วเกิดปัญหา ให้ใช้ Live Server หรือ Firebase Hosting แทน เนื่องจาก Firebase ใช้ JavaScript modules จาก CDN
- โค้ดนี้คงรูปแบบการเชื่อมต่อและ document path จากไฟล์ต้นฉบับ ไม่ได้เปลี่ยนโครงสร้างฐานข้อมูล

## Deploy ด้วย Firebase Hosting (ตัวเลือก)
ติดตั้ง Firebase CLI และล็อกอิน จากนั้นในโฟลเดอร์โปรเจกต์:
```bash
firebase login
firebase init hosting
```
เลือกโปรเจกต์ `student-evaluation-67ffb` และกำหนด public directory เป็นโฟลเดอร์ปัจจุบัน (`.`) จากนั้น deploy:
```bash
firebase deploy
```
