import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile("C:/Users/vincent/Downloads/Infuz_AI自動發文系統 (2).xlsx");

for (const ws of wb.worksheets) {
  console.log('\n=== Sheet: ' + ws.name + ' ===');
  console.log('Rows: ' + ws.actualRowCount + ', Cols: ' + ws.actualColumnCount);
  let count = 0;
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (count++ > 15) return;
    const vals = row.values.slice(1).map(v => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'object' && v.text) return v.text;
      if (typeof v === 'object' && v.hyperlink) return v.hyperlink;
      if (typeof v === 'object' && v.richText) return v.richText.map(r => r.text).join('');
      return String(v).slice(0, 100);
    });
    console.log('R' + rowNum + ': ' + JSON.stringify(vals));
  });
}
