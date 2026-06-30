const express = require('express');
const cors = require('cors'); // 👈 1. เพิ่มบรรทัดนี้ด้านบนสุด
const { Client } = require('pg');

const app = express();
const port = 3000; // เปิดพอร์ต 3000 ในคอมของนายเพื่อสแตนด์บายรอหน้าเว็บ

// ตัวช่วยให้ Backend อ่านข้อมูลที่หน้าเว็บส่งมาได้
app.use(cors()); // 👈 2. เพิ่มบรรทัดนี้ตรงนี้เพื่อปลดล็อกให้หน้าเว็บดึงข้อมูลได้
app.use(express.json());

// 🔑 ลิงก์ฐานข้อมูลที่ถูกต้องของนาย
const connectionString = 'postgresql://neondb_owner:npg_l8n2NahBFVEj@ep-dry-thunder-aolqf6op-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full';

// 1. API สำหรับดึงข้อมูลลูกค้าทั้งหมด (GET)
app.get('/api/customers', async (req, res) => {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query('SELECT * FROM customers ORDER BY id ASC;');
    res.json(result.rows); // ส่งข้อมูลลูกค้ากลับไปให้หน้าเว็บในรูปแบบ JSON
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ดึงข้อมูลไม่สำเร็จนะนาย' });
  } finally {
    await client.end();
  }
});

/// 2. API สำหรับบันทึกข้อมูลลูกค้าใหม่ (POST)
app.post('/api/customers', async (req, res) => {
  const { customer_name, phone_number } = req.body; // รับชื่อและเบอร์โทรที่พิมพ์จากหน้าเว็บ
  
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const queryText = 'INSERT INTO customers (customer_name, phone_number) VALUES ($1, $2) RETURNING *;';
    
    // 🎯 🔥 แก้ตรงนี้: เปลี่ยนจาก [name, phone] เป็น [customer_name, phone_number] ให้ตรงกับด้านบนครับนาย!
    const result = await client.query(queryText, [customer_name, phone_number]); 
    
    res.json({ message: 'บันทึกข้อมูลสำเร็จแล้วครับนาย!', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'บันทึกข้อมูลไม่สำเร็จนะนาย' });
  } finally {
    await client.end();
  }
});

/// 🚀 ท่อนเดิมของนาย ปรับให้ฉลาดขึ้น: รันในคอมก็ได้ รันบน Vercel ก็ไม่พัง
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`🚀 เซิร์ฟเวอร์ RIZENIC หลังบ้านพร้อมแล้ว! รันอยู่ที่ http://localhost:${port}`);
    });
}

// 📦 เพิ่มบรรทัดนี้ปิดท้ายไฟล์ (สำคัญมาก สำหรับให้ Vercel ดึงไปรันบนฟ้าฟรี ๆ)
module.exports = app;