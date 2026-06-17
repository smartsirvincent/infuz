import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile("C:/Users/vincent/Downloads/Infuz_AI自動發文系統 (2).xlsx");
const targets = ['產品資料庫', '模特兒資料庫', '情境資料庫'];
for (const name of targets) {
  const ws = wb.getWorksheet(name);
  console.log('\n=== ' + name + ' (' + ws.actualRowCount + ' rows) ===');
  let count = 0;
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (count++ > (name === '產品資料庫' ? 25 : 12)) return;
    const vals = row.values.slice(1).map(v => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'object' && v.text) return v.text;
      if (typeof v === 'object' && v.hyperlink) return '[link]' + v.hyperlink;
      if (typeof v === 'object' && v.richText) return v.richText.map(r => r.text).join('');
      return String(v).slice(0, 120);
    });
    console.log('R' + rowNum + ':', JSON.stringify(vals));
  });
}
