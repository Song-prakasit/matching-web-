# ระบบบันทึกจัดยา (Matching) เวอร์ชันเว็บ

ระบบที่เขียนขึ้นใหม่แทนโปรแกรม WinForms เดิม (`Matching/Matching`) ด้วย **Node.js + React**
ใช้ฐานข้อมูล SQL Server ตัวเดิม (`IPharmaDB`, `HAD.ms_users`) โดยไม่ต้องแก้โครงสร้างตาราง
และใช้ user/password เดิมของระบบ HAD ได้ทันที

## ฟังก์ชัน

- เข้าสู่ระบบด้วยชื่อผู้ใช้/รหัสผ่าน หรือสแกน QR บัตรพนักงาน
- สแกน QR ใบสั่งยาเพื่อยืนยันการจัดยา (ใช้ได้ทั้งเครื่องสแกนและกล้องของแท็บเล็ต/มือถือ)
- ค้นหารายการที่จัดยาแล้ว ตามวันที่ / หอผู้ป่วย / ประเภท / HN / AN / เลขที่ใบสั่ง
- ดูรายละเอียดยาในใบสั่ง (Robot / จัดมือ)
- Export Excel
- หน้าจอรองรับคอมพิวเตอร์ แท็บเล็ต และมือถือ

## เอกสาร

- [คู่มือผู้ใช้](docs/คู่มือผู้ใช้.md) สำหรับเภสัชกรและผู้ดูแลระบบ
- [การสำรองข้อมูล](docs/สำรองข้อมูล.md) สำหรับ IT

## โครงสร้าง

```
matching-web/
├─ server/                 Node.js (Express) – API + เสิร์ฟหน้าเว็บ
│  ├─ .env                 การตั้งค่า (ไม่ commit) – ดูตัวอย่างใน .env.example
│  └─ src/
│     ├─ index.js          เริ่ม server (HTTP/HTTPS)
│     ├─ routes.js         API ทั้งหมด (/api/...)
│     ├─ auth.js           ตรวจสิทธิ์ด้วย JWT, จำกัดจำนวนครั้ง login
│     ├─ legacyCrypto.js   การเข้ารหัสแบบเดียวกับ StdRijndael.cs เดิม
│     ├─ excel.js          สร้างไฟล์ Excel
│     └─ db/
│        ├─ mssqlRepo.js   คำสั่ง SQL จริง (ใช้ parameter ทุกจุด)
│        └─ mockRepo.js    ข้อมูลจำลองสำหรับทดสอบนอกเครือข่าย
└─ client/                 React + Tailwind (หน้าเว็บ)
   └─ src/components/      LoginPage, MainPage, OrderDetailDialog, CameraScanner
```

## เริ่มใช้งาน

ต้องมี Node.js 22 ขึ้นไป

```powershell
cd C:\xampp\htdocs\Matching\matching-web
npm install
npm run build      # สร้างหน้าเว็บ
npm start          # เปิด server ที่ http://localhost:3000
```

บน macOS: ติดตั้ง Node.js จาก https://nodejs.org (หรือ `brew install node`) แล้วใช้คำสั่งเดียวกันใน Terminal
(`cd` ไปที่โฟลเดอร์ `matching-web` ที่แตกไฟล์ไว้)

ระหว่างพัฒนา (แก้โค้ดแล้วหน้าเว็บอัปเดตทันที):

```powershell
npm run dev        # เปิด http://localhost:5173
```

## การตั้งค่า (`server/.env`)

| ค่า | ความหมาย |
|---|---|
| `DB_MODE` | `mock` = ข้อมูลจำลอง (ผู้ใช้ `demo` / `Demo@Matching12`), `mssql` = ฐานข้อมูลจริง |
| `ADMIN_USER_IDS` | `vc_UserId` ของผู้ดูแล (คั่นด้วยจุลภาค) ที่เปิดหน้าตั้งค่าได้ — mock ใช้ `U001`, mssql ถ้าไม่ตั้งจะไม่มีผู้ดูแล |
| `DB_SERVER`, `DB_DATABASE` | SQL Server (ค่าเดิม `10.0.0.77`, `IPharmaDB`) |
| `DB_USER_ENC`, `DB_PASSWORD_ENC` | คัดลอก `Uid` / `Pwd` จาก `system.ini` เดิมมาได้เลย (หรือใช้ `DB_USER` / `DB_PASSWORD` แบบไม่เข้ารหัส) |
| `JWT_SECRET` | ข้อความลับสำหรับ session – ตั้งเป็นค่าสุ่มยาว ๆ |
| `SCAN_LOOKBACK_DAYS` | สแกนได้เฉพาะใบสั่งที่จ่ายยาภายในกี่วันย้อนหลัง (เดิม = 1) |
| `LEGACY_*` | คีย์เข้ารหัสของระบบเดิม ห้ามเปลี่ยน |
| `HTTPS_KEY`, `HTTPS_CERT` | ไฟล์ใบรับรอง – **จำเป็นถ้าจะใช้กล้องสแกนบนแท็บเล็ต/มือถือ** |

### ใช้งานกับฐานข้อมูลจริง

1. ต่อเครือข่ายโรงพยาบาลให้เข้าถึง `10.0.0.77` ได้
2. แก้ `server/.env` → `DB_MODE=mssql`
3. `npm start` แล้วเปิด `http://<IP เครื่อง server>:3000` จากเครื่องอื่นในเครือข่าย

### กล้องบนแท็บเล็ต/มือถือ

เบราว์เซอร์อนุญาตให้ใช้กล้องเฉพาะเว็บที่เปิดผ่าน `https://` (หรือ `localhost`)
ให้ฝ่าย IT ออกใบรับรอง (certificate) ภายในองค์กร แล้วใส่ path ใน `HTTPS_KEY` / `HTTPS_CERT`
ถ้ายังไม่มี HTTPS ยังใช้เครื่องสแกนแบบยิงได้ตามปกติ

## สิ่งที่ปรับปรุงจากโปรแกรมเดิม

- ป้องกัน SQL Injection – ทุกคำสั่ง SQL ใช้ parameter
- แก้บั๊กสถานะ `MatchingStatus = 0` ที่ทำให้บันทึกไม่สำเร็จ (เดิมอัปเดตเฉพาะค่า `NULL`)
- ไม่ต้องติดตั้งโปรแกรมที่เครื่องผู้ใช้ อัปเดตที่ server จุดเดียว
- จำกัดการเดารหัสผ่าน (10 ครั้ง / 5 นาที / IP)
