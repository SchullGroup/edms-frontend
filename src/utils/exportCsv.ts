/**
 * Reusable utility to export array data into downloadable CSV files.
 */
export function exportCsv(filename: string, rows: Record<string, any>[], columns?: { key: string; label: string }[]) {
  if (!rows || rows.length === 0) return;

  const cols = columns || Object.keys(rows[0]).map(k => ({ key: k, label: k }));
  const headers = cols.map(c => `"${String(c.label).replace(/"/g, '""')}"`).join(',');

  const body = rows.map(r => {
    return cols.map(c => {
      let val = r[c.key];
      if (val === null || val === undefined) val = '';
      else if (typeof val === 'object') val = JSON.stringify(val);
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
  }).join('\n');

  const csvContent = `${headers}\n${body}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename.replace(/[^\w-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
