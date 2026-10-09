const express = require('express');
const cors = require('cors'); 
const path = require('path');

const app = express();
const port = process.env.PORT || 3000; 

app.use(cors()); 
app.use(express.json({ limit: '10mb' })); 

// ตั้งค่า Cache ตามประเภทไฟล์ static
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: function (res, filePath) {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache');
    } else {
      res.set('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// 🌟 Import API 5 หมวดหมู่ที่แยกไว้มาต่อเข้ากับแอป 🌟
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/utils'));
app.use('/api', require('./routes/masters'));
app.use('/api', require('./routes/parts'));
app.use('/api', require('./routes/jobs'));

// ==========================================
// 🚀 Start Server
// ==========================================
if (require.main === module) {
    app.listen(port, () => console.log(`🚀 พร้อมที่: http://localhost:${port}`));
}

module.exports = app;