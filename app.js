const express = require('express');
const cors = require('cors'); 
const path = require('path');

const app = express();
const port = process.env.PORT || 3000; 

app.use(cors()); 
app.use('/api/line/webhook',require('./routes/line_webhook'));
app.use(express.json({ limit: '10mb' })); 

// ตั้งค่า Cache ตามประเภทไฟล์ static
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: function (res, filePath) {
    if(path.basename(filePath)==='tracking.html'){res.set('Referrer-Policy','no-referrer');res.set('X-Frame-Options','DENY');res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'none'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");}

    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache');
    } else {
      res.set('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// 🌟 Import API 5 หมวดหมู่ที่แยกไว้มาต่อเข้ากับแอป 🌟
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/tracking'));
app.use('/api', require('./routes/line_settings'));
app.use('/api', require('./routes/line_customers'));
app.use('/api', require('./routes/utils'));
app.use('/api', require('./routes/masters'));
app.use('/api', require('./routes/parts'));
app.use('/api', require('./routes/jobs'));
app.use('/api', require('./routes/sa_activity'));
app.use('/api', require('./routes/delivery_inspections'));
app.use('/api', require('./routes/admin'));

// ==========================================
// 🚀 Start Server
// ==========================================
if (require.main === module) {
    app.listen(port, () => console.log(`🚀 พร้อมที่: http://localhost:${port}`));
}

module.exports = app;
