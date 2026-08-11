@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700;900&display=swap');

body { font-family: 'Kanit', sans-serif; background-color: #f8fafc; display: flex; flex-direction: column; min-height: 100vh; }
.custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }

.table-container { overflow: auto; border-radius: 6px; border: 2px solid #cbd5e1; background: #fff; height: calc(100vh - 220px); min-height: 350px; resize: both; position: relative; box-shadow: inset 0 0 4px rgba(0,0,0,0.02); }
.excel-table { width: max-content; min-width: 100%; table-layout: fixed; text-align: left; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.excel-table thead th { 
    background-color: #00320D; color: #ffffff; font-weight: 600; padding: 12px 14px; 
    border-right: 1px solid #334155; border-bottom: 3px solid #f59e0b; position: sticky; top: 0; z-index: 10; letter-spacing: 0.5px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; user-select: none; font-size: 13px;
}
.excel-table tbody tr { transition: background-color 0.2s; }
.excel-table tbody tr:hover td { background-color: #fef3c7; color: #00320D; }
.excel-table tbody td { padding: 0; vertical-align: middle; color: #334155; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; background-color: #fff; }

.inline-edit-input { 
    width: 100%; border: 1px solid transparent; background: transparent; padding: 8px 10px; border-radius: 4px; 
    font-family: monospace; font-size: 13px; font-weight: 600; color: #0f172a; cursor: text; transition: all 0.2s; text-align: center;
}
.inline-edit-input:hover { border-color: #cbd5e1; background: #f8fafc; }
.inline-edit-input:focus { border-color: #f59e0b; background: #fff; outline: none; box-shadow: 0 0 0 2px rgba(245,158,11,0.1); }
.inline-edit-input.text-left { text-align: left; font-family: 'Kanit', sans-serif; font-weight: 500; font-size: 14px; }

.inline-edit-select {
    width: 100%; border: 1px solid #cbd5e1; background-color: #f8fafc; padding: 6px 8px; border-radius: 6px;
    font-family: 'Kanit', sans-serif; font-size: 13px; font-weight: 700; color: #0f172a; cursor: pointer; transition: all 0.2s; outline: none;
}
.inline-edit-select:hover { border-color: #f59e0b; background-color: #fff; }
.inline-edit-select:focus { border-color: #f59e0b; background-color: #fff; box-shadow: 0 0 0 2px rgba(245,158,11,0.15); }

.action-btn { 
    display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 6px; 
    color: #94a3b8; background: #f8fafc; transition: all 0.2s; border: 1px solid #e2e8f0; font-size: 14px;
}
.action-btn:hover { background: #fef3c7; color: #d97706; border-color: #fcd34d; transform: scale(1.05); }

.timeline-wrapper { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.timeline-step { cursor: pointer; position: relative; }
.timeline-step input { display: none; }
.timeline-content { 
    padding: 8px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; border: 1px solid #e2e8f0; 
    background: #fff; color: #64748b; transition: all 0.2s; display: flex; align-items: center; gap: 6px;
}
.timeline-step input:checked + .timeline-content { background: #00320D; border-color: #00320D; color: #fff; }
.timeline-arrow { color: #cbd5e1; font-size: 12px; }

.calendar-grid-container {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    background-color: #cbd5e1;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.calendar-cell {
    background-color: #ffffff;
    min-height: 120px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: all 0.2s ease;
    cursor: pointer;
    position: relative;
}
.calendar-cell:hover {
    background-color: #f8fafc;
    box-shadow: inset 0 0 0 2px #f59e0b;
}
.calendar-cell.today {
    background-color: #fefce8;
}
.calendar-day-label {
    font-size: 14px;
    font-weight: 800;
    color: #64748b;
    font-family: monospace;
}
.calendar-cell.today .calendar-day-label {
    color: #d97706;
    background-color: #fef3c7;
    padding: 1px 6px;
    border-radius: 4px;
}

.tab-content { display: none; animation: fadeIn 0.3s ease; flex: 1; min-height: 0; }
.tab-content.active { display: flex; flex-direction: column; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

.nav-tab { padding: 12px 24px; font-size: 15px; font-weight: 600; color: #64748b; border-bottom: 2px solid transparent; transition: all 0.2s; cursor: pointer; display: flex; align-items: center; gap: 8px; }
.nav-tab.active { color: #00320D; border-bottom-color: #00320D; }
.nav-tab:hover:not(.active) { color: #334155; border-bottom-color: #cbd5e1; }

.kpi-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; display: flex; align-items: center; gap: 16px; flex: 1; min-w: 200px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }

.sort-icon { @apply ml-1 opacity-40 transition-opacity group-hover:opacity-100 text-[11px] text-amber-400; }
.filter-icon { @apply ml-2 text-white/40 hover:text-amber-400 transition-colors p-1.5 rounded cursor-pointer; }
.filter-icon.active { @apply text-amber-400 opacity-100; }

.resizer { position: absolute; top: 0; right: 0; width: 6px; height: 100%; cursor: col-resize; user-select: none; z-index: 20; }
.resizer:hover, .resizer.resizing { background-color: #f59e0b !important; }