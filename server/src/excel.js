import ExcelJS from 'exceljs';
import { ORDER_TYPES } from './orderTypes.js';

const columns = [
  { header: 'วันเวลาสร้างใบสั่ง', key: 'createdAt' },
  { header: 'เลขที่ใบสั่ง', key: 'rxNumber' },
  { header: 'วันเวลาที่สั่ง', key: 'orderedAt' },
  { header: 'ประเภท', key: 'orderTypeLabel' },
  { header: 'HN', key: 'hn' },
  { header: 'AN', key: 'an' },
  { header: 'ชื่อ-นามสกุล', key: 'patientName' },
  { header: 'หอผู้ป่วย', key: 'wardName' },
];
const matchedColumns = [
  { header: 'ผู้จัดยา', key: 'matchedBy' },
  { header: 'วันเวลาที่จัดยา', key: 'matchedAt' },
];
const pendingColumns = [{ header: 'วันเวลาที่จ่ายยา', key: 'dispensedAt' }];

// pending=true exports the not-yet-scanned list (dispense time instead of who matched it).
export async function matchedRowsToXlsx(rows, { pending = false } = {}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(pending ? 'ยังไม่ได้สแกน' : 'บันทึกการจัดยา', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [...columns, ...(pending ? pendingColumns : matchedColumns)];
  rows.forEach((r) => ws.addRow({ ...r, orderTypeLabel: ORDER_TYPES[r.orderType] ?? '-' }));

  const border = { style: 'thin', color: { argb: 'FFBFBFBF' } };
  ws.eachRow((row, n) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: border, left: border, bottom: border, right: border };
      cell.font = { name: 'Tahoma', size: 10, bold: n === 1, color: n === 1 ? { argb: 'FFFFFFFF' } : undefined };
      if (n === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  });
  ws.columns.forEach((col) => {
    let width = 10;
    col.eachCell({ includeEmpty: true }, (cell) => {
      width = Math.max(width, String(cell.value ?? '').length + 4);
    });
    col.width = Math.min(width, 45);
  });

  return wb.xlsx.writeBuffer();
}
