// ==========================================
// 📥 RIZENIC - Import Quotation (Excel)
// ==========================================

async function importQuotationExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    // แสดง Toast โหลด
    showToast('กำลังอ่านไฟล์ Excel...', 'info');

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // อ่าน Sheet แรก
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // แปลงเป็น Array 2 มิติ (ละเว้นบรรทัดว่าง)
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });

            if (!jsonData || jsonData.length < 15) {
                showToast('รูปแบบไฟล์ไม่ถูกต้อง หรือ ข้อมูลไม่ครบถ้วน', 'error');
                return;
            }

            // 🌟 1. ดึงข้อมูลหลัก (Header)
            let qtNo = '', qtDateStr = '', saName = '', carPlate = '', customerName = '';

            // ค้นหาบรรทัดที่มีเลข QT (มักจะอยู่บรรทัดที่ 10-12 ใน Excel)
            const headerRowIndex = jsonData.findIndex(row => row.some(cell => String(cell).startsWith('QT')));
            
            if (headerRowIndex !== -1) {
                const headerRow = jsonData[headerRowIndex].filter(Boolean); // ตัดช่องว่างออก
                qtNo = headerRow.find(cell => String(cell).startsWith('QT')) || '';
                saName = headerRow.find(cell => String(cell).startsWith('SA')) || '';
                carPlate = headerRow[headerRow.length - 1] || ''; // ปกติทะเบียนรถอยู่ขวาสุดของบรรทัดนี้
            }

            // ชื่อบริษัทประกัน/ลูกค้า (บรรทัดถัดจากเลข QT)
            if (headerRowIndex !== -1 && jsonData.length > headerRowIndex + 1) {
                const customerRow = jsonData[headerRowIndex + 1].filter(Boolean);
                if (customerRow.length > 0) {
                    customerName = String(customerRow[0]).trim();
                }
            }

            // 🌟 2. ดึงข้อมูลรายการชิ้นส่วนอะไหล่ทำสี (Line Items)
            const mainParts = [];
            let totalCost = 0;

            for (let i = headerRowIndex + 2; i < jsonData.length; i++) {
                const row = jsonData[i].filter(Boolean);
                
                // ตรวจสอบว่าบรรทัดนี้เป็นรายการสินค้าหรือไม่ (มีรหัส, ชื่อ, จำนวน, ราคา)
                if (row.length >= 4) {
                    const descIndex = row.findIndex(cell => typeof cell === 'string' && cell.includes('เปลี่ยน'));
                    
                    if (descIndex !== -1) {
                        const description = String(row[descIndex]);
                        
                        // กรองเอาเฉพาะรายการ "พ่นสี" หรือ "ทำสี" เพื่อลงชิ้นส่วนหลัก
                        if (description.includes('พ่นสี') || description.includes('ทำสี')) {
                            // ตัดคำนำหน้าออกเพื่อให้เหลือแค่ชื่อชิ้นส่วน เช่น "เปลี่ยนพ่นสีกันชนหลัง" -> "กันชนหลัง"
                            let cleanPartName = description.replace(/เปลี่ยนพ่นสี/g, '').replace(/ทำสี/g, '').replace(/-/g, '').trim();
                            if(cleanPartName) mainParts.push(cleanPartName);
                        }
                    }

                    // หาราคาสุทธิ (มักอยู่ท้ายๆ ของแถว)
                    const lastNum = parseFloat(String(row[row.length - 1]).replace(/,/g, ''));
                    if (!isNaN(lastNum) && lastNum > 100) {
                        totalCost += lastNum;
                    }
                }
            }

            // 🌟 3. นำข้อมูลมาหยอดใส่ฟอร์มบนหน้าเว็บ (Auto-fill)
            
            // 3.1 ข้อมูลรถและลูกค้า
            if (document.getElementById('car_plate') && carPlate) document.getElementById('car_plate').value = carPlate.trim();
            if (document.getElementById('customer_name') && customerName) document.getElementById('customer_name').value = customerName;
            if (document.getElementById('sa_owner_input') && saName) document.getElementById('sa_owner_input').value = saName;
            
            // พยายามตัดคำเพื่อใส่ "รูปแบบการชำระเงิน/ประกัน" (ถ้ามีคำว่าประกันภัย)
            if (document.getElementById('payment_type') && customerName.includes('ประกันภัย')) {
                const insuranceName = customerName.split(' จำกัด')[0].trim();
                document.getElementById('payment_type').value = insuranceName;
            }

            // 3.2 ใบเสนอราคา
            if (document.getElementById('qt_no_doc')) {
                // สมมติว่ามีช่องใส่เลขเอกสารอ้างอิง
                document.getElementById('qt_no_doc').value = qtNo;
            } else if (document.getElementById('notes')) {
                // ถ้าไม่มีช่องเฉพาะ ให้ใส่ไว้ในหมายเหตุก่อน
                document.getElementById('notes').value = `นำเข้าจาก: ${qtNo}\nยอดรวมประเมิน: ${totalCost.toLocaleString('th-TH')} บาท\n` + document.getElementById('notes').value;
            }

            // 3.3 รายการชิ้นส่วนอะไหล่
            if (mainParts.length > 0) {
                // เช็คว่ามีฟังก์ชันเพิ่มอะไหล่ใน sa_parts.js หรือไม่
                if (typeof addPartToDOM === 'function') {
                    mainParts.forEach(part => {
                        // สมมติว่าฟังก์ชันรับ (name, type) 
                        addPartToDOM(part, 'main'); 
                    });
                } else {
                    // แจ้งเตือนถ้าไม่มีฟังก์ชันรองรับ
                    console.log("อะไหล่ที่แกะได้:", mainParts);
                    showToast(`ดึงรายการชิ้นส่วนได้ ${mainParts.length} ชิ้น`, 'info');
                }
            }

            showToast('ดึงข้อมูลจากใบเสนอราคาเรียบร้อยแล้ว!', 'success');
            
            // ล้างค่า input file เพื่อให้อัปโหลดไฟล์เดิมซ้ำได้
            event.target.value = '';

        } catch (error) {
            console.error("Excel Parsing Error:", error);
            showToast('เกิดข้อผิดพลาดในการอ่านไฟล์', 'error');
        }
    };

    reader.readAsArrayBuffer(file);
}