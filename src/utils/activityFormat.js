/** Shared helpers for showing Activity Log rows. */

export function formatActivityTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function activityWho(row) {
  if (row?.admin_name) return row.admin_name;
  if (row?.admin_email) return row.admin_email;
  if (row?.admin_id) return `Admin #${row.admin_id}`;
  return 'System';
}

export function formatChangeValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  const text = String(value);
  // ISO timestamps -> IST
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) return formatActivityTime(text);
  if (text === '1' || text === 'true') return text === '1' ? '1 (yes)' : 'yes';
  if (text === '0' || text === 'false') return text === '0' ? '0 (no)' : 'no';
  return text.replace(/_/g, ' ');
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadActivityCsv(rows, filename) {
  const header = ['Time (IST)', 'Employee', 'Email', 'Action', 'Order', 'Field', 'Old value', 'New value', 'Summary'];
  const lines = [header.map(csvCell).join(',')];
  rows.forEach((row) => {
    const base = [formatActivityTime(row.created_at), activityWho(row), row.admin_email || '', row.action_label || row.action, row.order_number || row.order_id || ''];
    const changes = Array.isArray(row.changes) && row.changes.length ? row.changes : [null];
    changes.forEach((change) => {
      lines.push([
        ...base,
        change?.label || '',
        change ? formatChangeValue(change.from) : '',
        change ? formatChangeValue(change.to) : '',
        row.summary || '',
      ].map(csvCell).join(','));
    });
  });
  const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
