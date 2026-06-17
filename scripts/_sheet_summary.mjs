import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile("C:/Users/vincent/Downloads/Infuz_AI自動發文系統 (2).xlsx");
console.log('Sheets:');
for (const ws of wb.worksheets) {
  console.log('  - ' + ws.name + ' (' + ws.actualRowCount + ' rows x ' + ws.actualColumnCount + ' cols)');
}
