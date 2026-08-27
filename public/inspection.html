<!-- ========================================== -->
<!-- 🚗 แบบฟอร์มตรวจสภาพรถ (โหลดแยกจากไฟล์ภายนอก) -->
<!-- ========================================== -->
<style>
    #inspectionModal, #inspectionModal *,
    #carDrawModal, #carDrawModal * {
        font-family: 'Prompt', sans-serif !important;
    }

    /* 🌟 CSS สำหรับการพิมพ์ A4 โดยเฉพาะ (บังคับไม่ให้ซูมติดไปตอนปริ้น) 🌟 */
    @media print {
        @page { size: A4 portrait; margin: 2mm 4mm 2mm 4mm; }
        html, body { width: 210mm; height: 297mm; overflow: hidden !important; background: #fff !important; font-family: 'Prompt', sans-serif !important; }
        body * { visibility: hidden; }
        #inspectionModal { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; height: 293mm !important; margin: 0 !important; padding: 0 !important; background: white !important; visibility: visible !important; overflow: hidden !important; }
        
        #inspection_scroll_container { overflow: visible !important; padding: 0 !important; display: block !important; }
        #inspection_print_area, #inspection_print_area * { visibility: visible; }
        #inspection_print_area { 
            width: 202mm !important; 
            height: 289mm !important; 
            margin: 0 auto !important; 
            padding: 0 !important; 
            box-shadow: none !important; 
            border: none !important; 
            overflow: hidden !important; 
            font-family: 'Prompt', sans-serif !important;
            transform: scale(1) !important; /* บังคับรีเซ็ต Zoom ตอนปริ้น */
            transform-origin: top left !important;
        }
        
        .print-exact { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        .no-print { display: none !important; }
        .form-input-line { border-bottom: 1px solid #000 !important; }
    }

    .form-input-line { border-bottom: 1px dashed #64748b; background: transparent; outline: none; padding: 0 2px; color: #1e293b; font-weight: 600; }
    .insp-table-compact th, .insp-table-compact td { border: 1px solid #334155; text-align: center; padding: 1.5px 0; font-size: 8px; height: 11px; }
    .cb-box-sm { width: 10px; height: 10px; border: 1px solid #334155; cursor: pointer; accent-color: #00320D; margin: 0; }
    .sec-title-sm { background-color: #00320D; color: white; text-align: center; font-weight: 700; font-size: 9.5px; padding: 2px 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
</style>

<!-- Modal หลัก -->
<!-- เปลี่ยนจาก items-center เป็น items-start เพื่อให้เวลาซูมแล้ว Scroll ดูได้ครบ -->
<div id="inspectionModal" class="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] hidden flex-col items-center p-0 print:bg-white print:z-auto print:block overflow-hidden">
    
    <!-- 🔍 เครื่องมือ Zoom (มุมซ้ายบน) -->
    <div class="absolute top-4 left-6 flex items-center gap-1 z-50 no-print bg-white/90 p-1.5 rounded-xl shadow-lg backdrop-blur-md border border-slate-200">
        <button onclick="changeZoom(-0.1)" class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-800 font-black rounded-lg transition"><i class="fa-solid fa-minus"></i></button>
        <div class="w-16 text-center flex flex-col items-center justify-center">
            <span class="text-[9px] font-bold text-slate-500 leading-none">มุมมอง</span>
            <span id="zoomLevelText" class="text-xs font-black text-[#00320D] leading-tight">100%</span>
        </div>
        <button onclick="changeZoom(0.1)" class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-800 font-black rounded-lg transition"><i class="fa-solid fa-plus"></i></button>
        <div class="w-px h-6 bg-slate-300 mx-1"></div>
        <button onclick="resetZoom()" class="px-3 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition"><i class="fa-solid fa-rotate-right mr-1"></i> คืนค่า</button>
    </div>

    <!-- 🖨️ เครื่องมือ Print/Save (มุมขวาบน) -->
    <div class="absolute top-4 right-6 flex gap-2 z-50 no-print">
        <button onclick="printInspection()" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition flex items-center gap-2 text-xs border border-blue-500"><i class="fa-solid fa-print"></i> พิมพ์ (Print)</button>
        <button onclick="saveInspectionForm()" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition flex items-center gap-2 text-xs border border-emerald-500"><i class="fa-solid fa-save"></i> บันทึกข้อมูล</button>
        <button onclick="closeInspectionModal()" class="px-4 py-2.5 bg-slate-800 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg transition text-xs border border-slate-700"><i class="fa-solid fa-xmark mr-1"></i> ปิด</button>
    </div>

    <!-- 📜 คอนเทนเนอร์สำหรับ Scroll เลื่อนดูเอกสาร -->
    <div id="inspection_scroll_container" class="w-full h-full overflow-auto flex justify-center items-start pt-20 pb-20 custom-scrollbar relative">
        
        <!-- กระดาษ A4 -->
        <div id="inspection_print_area" class="bg-white w-[202mm] h-[289mm] mx-auto p-1.5 text-slate-900 shadow-2xl relative text-[9px] leading-tight font-medium flex flex-col justify-between shrink-0 transition-transform duration-200 origin-top">
            <div>
                <!-- Header -->
                <div class="flex justify-between items-start mb-1">
                    <img src="photo/logo.png" alt="RIZENIC LOGO" class="h-8 object-contain">
                    <div id="ins_company_address" class="text-right text-[8px] font-bold leading-tight">
                        <p class="text-xs font-black text-[#00320D]">บริษัท ไรเซน เอนเนอร์จี จำกัด</p>
                        <p>เลขที่เสียภาษี 0-1055-60176-43-4</p>
                        <p>47/1 หมู่ที่ 1 ตำบลคลองหนึ่ง อำเภอคลองหลวง จังหวัดปทุมธานี 12120</p>
                        <p>โทรศัพท์ : 02-055-9199 / 090-954-1115</p>
                    </div>
                </div>

                <div class="bg-[#00320D] text-white text-center font-bold text-xs py-0.5 mb-1 print-exact">แบบฟอร์มตรวจสภาพรถก่อนรับบริการ (Vehicle Inspection Form)</div>

                <!-- วันที่ & NO -->
                <div class="flex justify-between items-center mb-0.5 font-bold text-[8.5px]">
                    <div class="flex items-center gap-1">
                        <span>วันที่ นำรถซ่อม</span> <input type="text" id="ins_arr_date" class="form-input-line w-20 text-center">
                        <span>เวลา</span> <input type="text" id="ins_arr_time" class="form-input-line w-12 text-center">
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="text-xs">NO.</span> <input type="text" id="ins_job_no" class="form-input-line w-32 text-blue-700 uppercase text-center font-black">
                    </div>
                </div>
                <div class="flex justify-between items-center mb-1 font-bold text-[8.5px]">
                    <div class="flex items-center gap-1">
                        <span>วันที่ นัดรับรถ</span> <input type="text" id="ins_tgt_date" class="form-input-line w-20 text-center">
                        <span>เวลา</span> <input type="text" id="ins_tgt_time" class="form-input-line w-12 text-center">
                    </div>
                    <div class="flex items-center gap-2">
                        <span>ประเภทงานซ่อม</span>
                        <label class="flex items-center gap-0.5"><input type="radio" name="ins_job_type" value="L" class="cb-box-sm rounded-full"> งานเบา L</label>
                        <label class="flex items-center gap-0.5"><input type="radio" name="ins_job_type" value="M" class="cb-box-sm rounded-full"> งานกลาง M</label>
                        <label class="flex items-center gap-0.5"><input type="radio" name="ins_job_type" value="H" class="cb-box-sm rounded-full"> งานหนัก H</label>
                    </div>
                </div>

                <!-- ข้อมูลลูกค้า -->
                <div class="border border-slate-700 px-1.5 py-0.5 mb-1 font-bold">
                    <p class="text-[8px] bg-white -mt-2.5 ml-1 px-1 w-max font-bold text-slate-700">ข้อมูลลูกค้า</p>
                    <div class="grid grid-cols-12 gap-x-1.5 gap-y-0.5 items-center">
                        <div class="col-span-3 flex"><span>ทะเบียน</span><input type="text" id="ins_car_plate" class="form-input-line flex-1 uppercase text-blue-700"></div>
                        <div class="col-span-3 flex"><span>ยี่ห้อ</span><input type="text" id="ins_car_brand" class="form-input-line flex-1 text-blue-700"></div>
                        <div class="col-span-3 flex"><span>รุ่น</span><input type="text" id="ins_car_model" class="form-input-line flex-1 text-blue-700"></div>
                        <div class="col-span-3 flex"><span>VIN</span><input type="text" id="ins_vin" class="form-input-line flex-1 font-mono text-[7.5px] text-blue-700"></div>
                        <div class="col-span-6 flex"><span>บริษัทประกันภัย</span><input type="text" id="ins_insurance" class="form-input-line flex-1 text-blue-700"></div>
                        <div class="col-span-6 flex"><span>เลขที่ เคลม/รับแจ้ง</span><input type="text" id="ins_claim_no" class="form-input-line flex-1 text-blue-700"></div>
                        <div class="col-span-7 flex"><span>ชื่อ-นามสกุล</span><input type="text" id="ins_cust_name" class="form-input-line flex-1 text-blue-700"></div>
                        <div class="col-span-5 flex"><span>เบอร์โทร</span><input type="text" id="ins_phone" class="form-input-line flex-1 font-mono text-blue-700"></div>
                    </div>
                </div>

                <!-- ตารางหลัก 2 ฝั่ง -->
                <div class="flex border border-slate-700 h-[155mm] mb-1">
                    
                    <!-- 👈 ฝั่งซ้าย: รายการซ่อม (40%) -->
                    <div class="w-[42%] border-r border-slate-700 flex flex-col justify-between">
                        <div class="sec-title-sm">รายการซ่อม</div>
                        <table class="insp-table-compact w-full flex-1" style="border-collapse: collapse;">
                            <thead class="bg-[#00320D] text-white print-exact font-bold">
                                <tr>
                                    <th rowspan="2" colspan="2" class="w-1/2 border border-slate-600">ชิ้นส่วน</th>
                                    <th colspan="5" class="border border-slate-600">ลักษณะงานซ่อม</th>
                                </tr>
                                <tr>
                                    <th class="w-[10%] border border-slate-600">L</th>
                                    <th class="w-[10%] border border-slate-600">M</th>
                                    <th class="w-[10%] border border-slate-600">H</th>
                                    <th class="w-[10%] border border-slate-600">X</th>
                                    <th class="w-[10%] border border-slate-600">O</th>
                                </tr>
                            </thead>
                            <!-- 🌟 จุดแสดงตารางที่สร้างด้วย JS -->
                            <tbody id="ins_parts_table_body" class="font-bold"></tbody>
                        </table>
                        <div class="p-1 border-t border-slate-700 font-bold h-10 flex flex-col justify-start">
                            <span>รายการที่เพิ่มเติม :</span>
                            <textarea id="ins_extra_notes" class="w-full outline-none resize-none border-b border-dashed border-slate-500 bg-transparent text-[8px] leading-tight h-5"></textarea>
                        </div>
                    </div>

                    <!-- 👉 ฝั่งขวา: สภาพรถและอุปกรณ์ (60%) -->
                    <div class="w-[58%] flex flex-col justify-between">
                        <div class="sec-title-sm">สภาพรถและอุปกรณ์</div>
                        <div class="relative w-full h-[125px] border-b border-slate-400 p-1 flex justify-center items-center group cursor-pointer" onclick="openCarDrawModal()">
                            <div class="absolute inset-0 bg-black/60 hidden group-hover:flex flex-col justify-center items-center text-white font-bold rounded z-50 no-print transition-all">
                                <i class="fa-solid fa-expand text-xl mb-0.5"></i>
                                <span class="text-[10px]">แตะเพื่อขยายวาดรูป</span>
                            </div>
                            <div class="relative w-[90%] h-[95%]" style="background-image: url('photo/car_outline.png'); background-size: contain; background-position: center; background-repeat: no-repeat;">
                                <canvas id="carCanvasSmall" class="absolute top-0 left-0 w-full h-full pointer-events-none"></canvas>
                            </div>
                        </div>

                        <!-- เกจน้ำมัน -->
                        <div class="flex px-1.5 py-1 border-b border-slate-400">
                            <div class="w-[38%] flex flex-col items-center justify-center border-r border-slate-300 pr-1.5">
                                <div class="relative w-20 h-10 overflow-hidden">
                                    <svg viewBox="0 0 100 50" class="w-full h-full">
                                        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#cbd5e1" stroke-width="8" />
                                        <path id="fuel_arc" d="M 10 50 A 40 40 0 0 1 50 10" fill="none" stroke="#00320D" stroke-width="8" stroke-dasharray="125" stroke-dashoffset="0" />
                                        <text x="5" y="48" font-size="10" font-weight="bold">E</text>
                                        <text x="88" y="48" font-size="10" font-weight="bold">F</text>
                                    </svg>
                                    <input type="range" id="ins_fuel_level" min="0" max="100" value="50" oninput="updateFuelGauge(this.value)" class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer no-print">
                                </div>
                                <span class="font-bold text-[8px] -mt-0.5">ระดับพลังงาน (<span id="fuel_txt">50</span>%)</span>
                                <div class="flex items-center gap-0.5 mt-0.5 w-full text-[8px] font-bold">
                                    <span>เลขไมล์</span><input type="text" id="ins_mileage" class="form-input-line flex-1 text-center font-mono text-[7.5px]"><span>กม.</span>
                                </div>
                            </div>
                            <div class="w-[62%] pl-1.5 flex flex-col justify-center gap-0.5 font-bold text-[8px] leading-tight">
                                <p class="text-red-600 text-[6.5px] leading-[8px] mb-1">หมายเหตุ โปรดตรวจสอบและนำสิ่งของมีค่าออกจากรถของท่าน บริษัทจะไม่สามารถรับผิดชอบต่อสิ่งของที่สูญหายได้</p>
                                <label class="flex items-center gap-1"><input type="radio" name="ins_job_cat" value="รถจอดซ่อม" class="cb-box-sm rounded-full"> รถจอดซ่อม</label>
                                <label class="flex items-center gap-1"><input type="radio" name="ins_job_cat" value="นำรถเข้าประเมินราคาและนำรถกลับ" class="cb-box-sm rounded-full"> นำรถเข้าประเมินราคาและนำรถกลับ</label>
                                <label class="flex items-center gap-1"><input type="radio" name="ins_job_cat" value="เปิดใบสั่งซ่อม,ถอดชิ้นส่วน,และนำรถกลับ" class="cb-box-sm rounded-full"> เปิดใบสั่งซ่อม,ถอดชิ้นส่วน,และนำรถกลับ</label>
                                <label class="flex items-center gap-1"><input type="radio" name="ins_job_cat" value="นัดหมายเข้าซ่อมและนำรถกลับ" class="cb-box-sm rounded-full"> นัดหมายเข้าซ่อมและนำรถกลับ</label>
                            </div>
                        </div>

                        <!-- อุปกรณ์ทั่วไป -->
                        <div class="grid grid-cols-2 gap-x-2 gap-y-0.5 p-1.5 border-b border-slate-400 font-bold text-[8px]">
                            <label class="flex items-center gap-1"><input type="checkbox" id="inv_tools" class="cb-box-sm"> ชุดถุงเครื่องมือ</label>
                            <div class="flex items-center gap-0.5"><input type="checkbox" id="inv_carpet" class="cb-box-sm"> พรมปูพื้น<input type="text" id="inv_carpet_qty" class="form-input-line w-4 text-center">ชิ้น</div>
                            <label class="flex items-center gap-1"><input type="checkbox" id="inv_jack" class="cb-box-sm"> แม่แรง</label>
                            <div class="flex items-center gap-0.5"><input type="checkbox" id="inv_rubber" class="cb-box-sm"> ผ้ายาง<input type="text" id="inv_rubber_qty" class="form-input-line w-4 text-center">ชิ้น</div>
                            <label class="flex items-center gap-1"><input type="checkbox" id="inv_spare_tire" class="cb-box-sm"> ยางอะไหล่</label>
                            <label class="flex items-center gap-1"><input type="checkbox" id="inv_lock_spare" class="cb-box-sm"> ล็อคยางอะไหล่</label>
                            <label class="flex items-center gap-1"><input type="checkbox" id="inv_lighter" class="cb-box-sm"> ที่จุดบุหรี่</label>
                            <label class="flex items-center gap-1"><input type="checkbox" id="inv_extra_lock" class="cb-box-sm"> อุปกรณ์ชุดล็อคเสริม (เบรค,คันเร่ง,เกียร์)</label>
                            <label class="flex items-center gap-1"><input type="checkbox" id="inv_radio" class="cb-box-sm"> วิทยุ-ซีดี</label>
                            <div class="flex items-center gap-0.5"><input type="checkbox" id="inv_hubcap" class="cb-box-sm"> ฝาครอบล้อ<input type="text" id="inv_hubcap_qty" class="form-input-line w-4 text-center">ชิ้น</div>
                            <div class="flex items-center gap-1 col-span-2"><input type="checkbox" id="inv_other" class="cb-box-sm"> อื่นๆ<input type="text" id="inv_other_desc" class="form-input-line flex-1"></div>
                        </div>

                        <!-- อุปกรณ์ไฟฟ้า & เอกสาร -->
                        <div class="p-1.5 font-bold text-[8px]">
                            <div class="grid grid-cols-2 gap-x-2 items-start">
                                <div class="flex flex-col gap-0.5">
                                    <span class="font-bold text-slate-800 underline">อุปกรณ์ไฟฟ้า</span>
                                    <div class="flex justify-between items-center pr-1"><span>ชุดไฟหน้าซ้าย-ขวา</span> <div class="flex gap-1.5"><label class="flex items-center gap-0.5"><input type="radio" name="el_hlight" class="cb-box-sm rounded-full" checked>ปกติ</label> <label class="flex items-center gap-0.5"><input type="radio" name="el_hlight" class="cb-box-sm rounded-full">ไม่</label></div></div>
                                    <div class="flex justify-between items-center pr-1"><span>ชุดไฟตัดหมอกซ้าย-ขวา</span> <div class="flex gap-1.5"><label class="flex items-center gap-0.5"><input type="radio" name="el_fog" class="cb-box-sm rounded-full" checked>ปกติ</label> <label class="flex items-center gap-0.5"><input type="radio" name="el_fog" class="cb-box-sm rounded-full">ไม่</label></div></div>
                                    <div class="flex justify-between items-center pr-1"><span>กระจกมองข้างซ้าย-ขวา</span> <div class="flex gap-1.5"><label class="flex items-center gap-0.5"><input type="radio" name="el_smirror" class="cb-box-sm rounded-full" checked>ปกติ</label> <label class="flex items-center gap-0.5"><input type="radio" name="el_smirror" class="cb-box-sm rounded-full">ไม่</label></div></div>
                                    <div class="flex justify-between items-center pr-1"><span>กระจกประตูหน้าซ้าย-ขวา</span> <div class="flex gap-1.5"><label class="flex items-center gap-0.5"><input type="radio" name="el_fwin" class="cb-box-sm rounded-full" checked>ปกติ</label> <label class="flex items-center gap-0.5"><input type="radio" name="el_fwin" class="cb-box-sm rounded-full">ไม่</label></div></div>
                                    <div class="flex justify-between items-center pr-1"><span>กระจกประตูหลังซ้าย-ขวา</span> <div class="flex gap-1.5"><label class="flex items-center gap-0.5"><input type="radio" name="el_rwin" class="cb-box-sm rounded-full" checked>ปกติ</label> <label class="flex items-center gap-0.5"><input type="radio" name="el_rwin" class="cb-box-sm rounded-full">ไม่</label></div></div>
                                    <div class="flex justify-between items-center pr-1 mt-1"><span>เบาะนั่ง,พวงมาลัย</span> <div class="flex gap-1"><label class="flex items-center gap-0.5"><input type="checkbox" class="cb-box-sm">สะอาด</label> <label class="flex items-center gap-0.5"><input type="checkbox" class="cb-box-sm">รอย</label></div></div>
                                    <div class="flex justify-between items-center pr-1"><span>แผงข้างประตู</span> <div class="flex gap-1"><label class="flex items-center gap-0.5"><input type="checkbox" class="cb-box-sm">สะอาด</label> <label class="flex items-center gap-0.5"><input type="checkbox" class="cb-box-sm">รอย</label></div></div>
                                </div>
                                
                                <div class="flex flex-col gap-0.5 pl-2 border-l border-slate-300">
                                    <span class="font-bold text-slate-800 underline">เอกสารแนบ</span>
                                    <label class="flex gap-1.5 items-center"><input type="checkbox" id="doc_claim" class="cb-box-sm"> ใบเคลม</label>
                                    <label class="flex gap-1.5 items-center"><input type="checkbox" id="doc_license" class="cb-box-sm"> ใบขับขี่</label>
                                    <label class="flex gap-1.5 items-center"><input type="checkbox" id="doc_policy" class="cb-box-sm"> กรมธรรม์</label>
                                    <label class="flex gap-1.5 items-center"><input type="checkbox" id="doc_idcard" class="cb-box-sm"> บัตรประชาชน</label>
                                    <label class="flex gap-1.5 items-center"><input type="checkbox" id="doc_carreg" class="cb-box-sm"> สำเนาทะเบียนรถ</label>
                                    <label class="flex gap-1.5 items-center"><input type="checkbox" id="doc_film" class="cb-box-sm"> ใบรับประกันฟิล์ม</label>
                                    <div class="flex gap-1.5 items-center mt-1"><input type="checkbox" id="doc_other" class="cb-box-sm"> อื่นๆ <input type="text" class="form-input-line w-full"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <!-- 5. Consent PDPA -->
                <div class="text-[6.5px] leading-[8px] text-justify font-bold mb-1">
                    <p><strong>ข้อมูลลูกค้าให้ความยินยอมของลูกค้า Customer Consent Clause ภายใต้พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562. ("บริษัท" มีหน้าที่ต้องแจ้งให้ท่านทราบถึงรายละเอียดนโยบายความเป็นส่วนตัวของบริษัท บริษัทมีความจำเป็นต้องขอความยินยอมในการเก็บรวบรวม ใช้ เปิดเผย ส่ง หรือโอนข้อมูลส่วนบุคคลของท่านในบางกรณี โปรดทำเครื่องหมายติ๊กกล่องด้านล่างเพื่อยืนยันการรับทราบ และ/หรือ เพื่อให้ความยินยอมโดยชัดแจ้งแก่บริษัทในการเก็บรวบรวม ใช้ เปิดเผย ส่ง หรือ โอนข้อมูลส่วนบุคคลของท่านทั้งในประเทศและต่างประเทศให้แก่บริษัทในเครือ บริษัทในกลุ่มเพื่อประโยชน์ในการประมวลผล การตรวจสอบภายใน และการพัฒนาบริการของเราเพื่อประโยชน์ของท่านในอนาคต</strong></p>
                    <div class="flex flex-col gap-0.5 mt-0.5 ml-1">
                        <label class="flex items-start gap-1"><input type="checkbox" checked class="cb-box-sm shrink-0 mt-[1px]"> ข้าพเจ้าได้รับทราบถึงนโยบายความเป็นส่วนตัวของบริษัท และให้ความยินยอมโดยชัดแจ้งให้บริษัทเก็บรวบรวม ใช้ เปิดเผย ส่งหรือโอนข้อมูลส่วนบุคคลของข้าพเจ้าทั้งในประเทศและต่างประเทศ ตามวัตถุประสงค์ที่กำหนดไว้ในกฎหมายและที่ระบุไว้ในนโยบายความเป็นส่วนตัว</label>
                        <label class="flex items-start gap-1"><input type="checkbox" checked class="cb-box-sm shrink-0 mt-[1px]"> ข้าพเจ้าให้ความยินยอมในการเก็บ รวบรวม ใช้ เปิดเผย โอนข้อมูลส่วนบุคคลของท่านทั้งในประเทศและต่างประเทศให้แก่บริษัท บริษัทในเครือ บริษัทในกลุ่ม พันธมิตรทางธุรกิจของบริษัท และตัวแทนจำหน่ายอย่างเป็นทางการของบริษัท ไรเซน เอนเนอร์จี จำกัด เพื่อประมวลผลข้อมูลประกอบการซ่อมแซมรถยนต์ การบำรุงรักษารถยนต์ การซ่อมสี รวมทั้งเพื่อการเพิ่มประสิทธิภาพการซ่อมแซมและวัตถุประสงค์อื่นใดในการให้บริการหลังการขาย</label>
                        <label class="flex items-start gap-1"><input type="checkbox" checked class="cb-box-sm shrink-0 mt-[1px]"> ข้าพเจ้าให้ความยินยอมโดยชัดแจ้งในการรับข้อมูลทางการตลาด ข้อเสนอพิเศษ กิจกรรมส่งเสริมการขาย หรือโฆษณาต่างๆ ที่เกี่ยวกับสินค้าและบริการจากบริษัท บริษัทในเครือ บริษัทในกลุ่ม พันธมิตรทางธุรกิจของบริษัท ผ่านทางโทรศัพท์ อีเมล หรือช่องทางอื่นที่ระบุของข้าพเจ้า</label>
                    </div>
                </div>

                <!-- 6. กล่องลายเซ็น 2 ชั้น -->
                <div class="border border-slate-700 rounded overflow-hidden">
                    <div class="flex px-2 py-1 font-bold border-b border-slate-400 bg-white">
                        <div class="w-[25%] text-[8px] underline underline-offset-2">สำหรับเจ้าของรถ/ลูกค้า (วันเปิดใบซ่อม)</div>
                        <div class="w-[37.5%] flex flex-col items-center">
                            <span class="mb-4 text-[8px]">เจ้าของรถ / ลูกค้า</span>
                            <div class="flex items-center gap-1 text-[8px]"><span>(ลายมือชื่อ)</span> <input type="text" class="form-input-line w-32"></div>
                            <div class="flex items-center gap-1 text-[8px] mt-1"><span>ชื่อ-นามสกุล</span> <input type="text" id="sign_cust_name" class="form-input-line w-28 text-center text-blue-700"></div>
                            <div class="flex items-center gap-1 text-[8px] mt-1"><span>วัน / เดือน / ปี</span> <input type="text" class="form-input-line w-28"></div>
                        </div>
                        <div class="w-[37.5%] flex flex-col items-center">
                            <span class="mb-4 text-[8px]">เจ้าหน้าที่ผู้ให้บริการ (SA)</span>
                            <div class="flex items-center gap-1 text-[8px]"><span>(ลายมือชื่อ)</span> <input type="text" class="form-input-line w-32"></div>
                            <div class="flex items-center gap-1 text-[8px] mt-1"><span>ชื่อ-นามสกุล</span> <span class="form-input-line w-28 text-center text-transparent">.............................</span></div>
                            <div class="flex items-center gap-1 text-[8px] mt-1"><span>วัน / เดือน / ปี</span> <input type="text" class="form-input-line w-28"></div>
                        </div>
                    </div>
                    <div class="flex px-2 py-1 font-bold bg-slate-50 print-exact">
                        <div class="w-[25%] text-[7.5px] flex flex-col justify-center leading-tight">
                            <span class="underline font-bold mb-1 underline-offset-2">สำหรับเจ้าของรถ/ลูกค้า (วันส่งมอบรถ)</span>
                            <span class="text-slate-600">ได้รับรถตามสภาพเรียบร้อยแล้ว</span>
                        </div>
                        <div class="w-[37.5%] flex flex-col items-center">
                            <span class="mb-4 text-[8px]">เจ้าของรถ / ลูกค้า</span>
                            <div class="flex items-center gap-1 text-[8px]"><span>(ลายมือชื่อ)</span> <input type="text" class="form-input-line w-32"></div>
                        </div>
                        <div class="w-[37.5%] flex flex-col items-center">
                            <span class="mb-4 text-[8px]">เจ้าหน้าที่ผู้ให้บริการ (SA)</span>
                            <div class="flex items-center gap-1 text-[8px]"><span>(ลายมือชื่อ)</span> <input type="text" class="form-input-line w-32"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Modal ขยายวาดรูปรถ -->
<div id="carDrawModal" class="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[300] hidden items-center justify-center p-4 print:hidden">
    <div class="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl h-[85vh]">
        <div class="bg-[#00320D] px-6 py-4 flex justify-between items-center text-white shrink-0 rounded-t-2xl">
            <h3 class="font-bold text-lg flex items-center gap-2"><i class="fa-solid fa-paintbrush text-amber-400"></i> วาดรอยแผล / ประเมินสภาพรถ</h3>
            <button type="button" onclick="closeCarDrawModal(false)" class="hover:text-red-400 transition text-2xl"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="p-4 bg-slate-100 flex flex-wrap justify-center items-center gap-4 shrink-0 border-b border-slate-300">
            <span class="font-black text-[#00320D] mr-2">เครื่องมือ:</span>
            <button onclick="setDrawTool('O')" id="tool_O" class="px-5 py-2 bg-red-100 border-2 border-red-600 text-red-700 font-bold rounded-xl shadow-sm">วงกลม (O)</button>
            <button onclick="setDrawTool('X')" id="tool_X" class="px-5 py-2 bg-white border border-slate-300 text-slate-600 font-bold rounded-xl shadow-sm">กากบาท (X)</button>
            <div class="w-px h-8 bg-slate-300 mx-2 hidden sm:block"></div>
            <button onclick="clearCanvas()" class="px-5 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold rounded-xl shadow-sm"><i class="fa-solid fa-eraser"></i> ล้างทั้งหมด</button>
        </div>
        <div class="flex-1 overflow-hidden p-4 flex justify-center items-center bg-slate-50">
            <div class="relative w-full h-full max-h-[600px] border-2 border-slate-300 bg-white rounded-xl shadow-inner" style="background-image: url('photo/car_outline.png'); background-size: contain; background-position: center; background-repeat: no-repeat;">
                <canvas id="carCanvasLarge" class="absolute top-0 left-0 w-full h-full cursor-crosshair"></canvas>
            </div>
        </div>
        <div class="bg-white border-t border-slate-300 p-4 flex justify-end gap-3 shrink-0 rounded-b-2xl">
            <button onclick="closeCarDrawModal(false)" class="px-6 py-2.5 bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition shadow-sm">ยกเลิก (ไม่บันทึก)</button>
            <button onclick="closeCarDrawModal(true)" class="px-6 py-2.5 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 transition shadow-md flex items-center gap-2"><i class="fa-solid fa-check"></i> ยืนยันรูปรถ</button>
        </div>
    </div>
</div>

<!-- 🌟 สคริปต์ควบคุมตารางซ้ายขวา และ ระบบ Zoom -->
<script>
    let currentZoom = 1;

    function changeZoom(delta) {
        currentZoom += delta;
        if(currentZoom < 0.5) currentZoom = 0.5; // ขั้นต่ำ 50%
        if(currentZoom > 2.0) currentZoom = 2.0; // สูงสุด 200%
        applyZoom();
    }

    function resetZoom() {
        currentZoom = 1;
        applyZoom();
    }

    function applyZoom() {
        const area = document.getElementById('inspection_print_area');
        const text = document.getElementById('zoomLevelText');
        if(area) {
            area.style.transform = `scale(${currentZoom})`;
        }
        if(text) {
            text.innerText = Math.round(currentZoom * 100) + '%';
        }
    }

    // เมื่อเปิดฟอร์มขึ้นมา ให้รีเซ็ต Zoom เสมอ
    document.addEventListener('DOMContentLoaded', () => {
        const targetNode = document.getElementById('inspectionModal');
        if(!targetNode) return;
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const isVisible = !targetNode.classList.contains('hidden');
                    if(isVisible) resetZoom();
                }
            });
        });
        observer.observe(targetNode, { attributes: true });
    });

    // สร้างตารางรายการซ่อม (ชิดซ้าย จัดระเบียบคำว่า ซ้าย/ขวา)
    document.addEventListener('DOMContentLoaded', () => {
        const partsList = [
            { name: "กันชนหน้า", sides: false }, { name: "ฝากระโปรงหน้า", sides: false },
            { name: "บังโคลนหน้า", sides: true }, { name: "แผงหน้าทั้งชุด", sides: false },
            { name: "คานหม้อน้ำ", sides: false }, { name: "กระโหลกบังโคลนหน้า", sides: true },
            { name: "เสากระจกบังลมหน้า", sides: true }, { name: "กระจกบังลมหน้า", sides: false },
            { name: "หลังคา", sides: false }, { name: "ประตูหน้า", sides: true },
            { name: "กระจกมองข้าง", sides: true }, { name: "ประตูหลัง", sides: true },
            { name: "บันได", sides: true }, { name: "บังโคลนหลัง", sides: true },
            { name: "กระจกบังลมหลัง", sides: false }, { name: "ฝาปิดถังน้ำมัน", sides: false },
            { name: "ฝากระโปรงหลัง", sides: false }, { name: "ฝาปิดท้าย", sides: false },
            { name: "แผงตั้งท้าย", sides: false }, { name: "เปลือก กระบะ", sides: true },
            { name: "กันชนหลัง", sides: false }
        ];
        
        let tbodyHtml = '';
        partsList.forEach(part => {
            if(part.sides) {
                tbodyHtml += `
                    <tr>
                        <td rowspan="2" class="text-left pl-2 border-b border-r border-slate-600 w-[65%]">${part.name}</td>
                        <td class="text-right pr-2 border-b border-r border-slate-600 w-[35%] font-bold text-[7.5px]">ซ้าย</td>
                        <td class="border-b border-r border-slate-600"><input type="checkbox" class="cb-box-sm"></td>
                        <td class="border-b border-r border-slate-600"><input type="checkbox" class="cb-box-sm"></td>
                        <td class="border-b border-r border-slate-600"><input type="checkbox" class="cb-box-sm"></td>
                        <td class="border-b border-r border-slate-600"><input type="checkbox" class="cb-box-sm"></td>
                        <td class="border-b border-slate-600"><input type="checkbox" class="cb-box-sm"></td>
                    </tr>
                    <tr>
                        <td class="text-right pr-2 border-b border-r border-slate-600 font-bold text-[7.5px]">ขวา</td>
                        <td class="border-b border-r border-slate-600"><input type="checkbox" class="cb-box-sm"></td>
                        <td class="border-b border-r border-slate-600"><input type="checkbox" class="cb-box-sm"></td>
                        <td class="border-b border-r border-slate-600"><input type="checkbox" class="cb-box-sm"></td>
                        <td class="border-b border-r border-slate-600"><input type="checkbox" class="cb-box-sm"></td>
                        <td class="border-b border-slate-600"><input type="checkbox" class="cb-box-sm"></td>
                    </tr>
                `;
            } else {
                tbodyHtml += `
                    <tr>
                        <td colspan="2" class="text-left pl-2 border-b border-r border-slate-600">${part.name}</td>
                        <td class="border-b border-r border-slate-600"><input type="checkbox" class="cb-box-sm"></td>
                        <td class="border-b border-r border-slate-600"><input type="checkbox" class="cb-box-sm"></td>
                        <td class="border-b border-r border-slate-600"><input type="checkbox" class="cb-box-sm"></td>
                        <td class="border-b border-r border-slate-600"><input type="checkbox" class="cb-box-sm"></td>
                        <td class="border-b border-slate-600"><input type="checkbox" class="cb-box-sm"></td>
                    </tr>`;
            }
        });
        const container = document.getElementById('ins_parts_table_body');
        if(container) container.innerHTML = tbodyHtml;
    });

    function updateFuelGauge(val) {
        document.getElementById('fuel_txt').innerText = val;
        const arcLength = 125;
        const filled = (val / 100) * arcLength;
        document.getElementById('fuel_arc').style.strokeDasharray = `${filled} ${arcLength}`;
    }
</script>