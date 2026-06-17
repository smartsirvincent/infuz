import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile("C:/Users/vincent/Downloads/Infuz_AI自動發文系統 (2).xlsx");

// Print remaining 情境 + 單件 + 搭配 header rows + first few data rows
for (const name of ['情境資料庫', '單件', '搭配']) {
  const ws = wb.getWorksheet(name);
  console.log('\n=== ' + name + ' (' + ws.actualRowCount + ' rows) ===');
  const startRow = name === '情境資料庫' ? 13 : 1;
  const limit = name === '情境資料庫' ? 30 : 4;
  let count = 0;
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum < startRow || count++ > limit) return;
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
