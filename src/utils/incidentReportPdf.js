import { apiFetch } from './apiClient';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const BRAND = [0, 49, 120]; // #003178
const BODY = [17, 24, 39];
const MUTED = [71, 85, 105];
const BORDER = [226, 232, 240];
const PAGE_MARGIN = 14;

function resolveTimezone(settingsTimezone) {
  const cached =
    settingsTimezone || (typeof localStorage !== 'undefined' && localStorage.getItem('cached_timezone')) || 'Etc/UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: cached });
    return cached;
  } catch {
    return 'Etc/UTC';
  }
}

function parseDate(dateString) {
  if (!dateString) return null;
  if (/^\d{8}_\d{6}$/.test(dateString)) {
    const y = Number(dateString.slice(0, 4));
    const m = Number(dateString.slice(4, 6)) - 1;
    const d = Number(dateString.slice(6, 8));
    const hh = Number(dateString.slice(9, 11));
    const mm = Number(dateString.slice(11, 13));
    const ss = Number(dateString.slice(13, 15));
    return new Date(Date.UTC(y, m, d, hh, mm, ss));
  }
  return new Date(dateString);
}

function getTzAbbrev(date, tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(date);
    const part = parts.find((p) => p.type === 'timeZoneName');
    return part?.value?.replace('GMT', 'UTC') || 'UTC';
  } catch {
    return 'UTC';
  }
}

function formatForReport(dateString, timeFormat, tz) {
  const date = parseDate(dateString);
  if (!date || Number.isNaN(date.getTime())) return 'Invalid Date';
  const use12h = timeFormat !== '24h';
  const fmt = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: use12h,
    timeZone: tz,
  });
  const abbr = getTzAbbrev(date, tz);
  return `${fmt.format(date)} (${abbr})`;
}

function displaySource(src, channelsById) {
  if (!src) return 'Unknown';
  const match = String(src).match(/Channel\s+(\d+)/i);
  const id = match ? parseInt(match[1], 10) : null;
  if (id != null) {
    const name = channelsById[String(id)] || `Channel ${id}`;
    return `Channel (${id}) ${name}`;
  }
  return String(src);
}

function channelsInvolvedLabel(report, channelsById) {
  const extractIdFromSource = (src) => {
    if (!src) return null;
    const m = String(src).match(/Channel\s+(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  };
  const uniqueIds = Array.from(
    new Set((report.audios || []).map((a) => extractIdFromSource(a.source)).filter((id) => id !== null))
  );
  if (uniqueIds.length > 0) {
    return uniqueIds.map((id) => `(${id}) ${channelsById[String(id)] || `Channel ${id}`}`).join(', ');
  }
  return report.location || '—';
}

function severityFill(severity) {
  const s = String(severity || '').toLowerCase();
  if (s === 'high') return [254, 226, 226];
  if (s === 'medium') return [254, 243, 199];
  if (s === 'low') return [220, 252, 231];
  return [241, 245, 249];
}

function safeFilename(title) {
  return `${String(title || 'incident').replace(/[^a-z0-9]/gi, '_')}_report.pdf`;
}

/** Normalize API branding logo (raw base64 or data URL) for use in <img> / jsPDF. */
export function brandingLogoToDataUrl(logo) {
  if (logo == null || logo === '') return null;
  const s = String(logo).trim();
  if (s.startsWith('data:image')) return s;
  const b64 = s.replace(/\s/g, '');
  if (!b64) return null;
  if (b64.startsWith('iVBORw0KGgo')) return `data:image/png;base64,${b64}`;
  if (b64.startsWith('/9j/')) return `data:image/jpeg;base64,${b64}`;
  if (b64.startsWith('UklGR')) return `data:image/webp;base64,${b64}`;
  if (b64.startsWith('R0lGOD')) return `data:image/gif;base64,${b64}`;
  return `data:image/jpeg;base64,${b64}`;
}

function imageFormatForJsPdf(dataUrl) {
  const m = /^data:image\/(png|jpeg|jpg|webp|gif)/i.exec(dataUrl);
  if (!m) return 'JPEG';
  const t = m[1].toLowerCase();
  if (t === 'jpg' || t === 'jpeg') return 'JPEG';
  if (t === 'png') return 'PNG';
  if (t === 'webp') return 'WEBP';
  if (t === 'gif') return 'GIF';
  return 'JPEG';
}

function loadNaturalImageSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** Fit image (pixel natural size) into a max box in mm, preserving aspect ratio. */
function fitLogoToMmBox(nw, nh, maxWmm, maxHmm) {
  if (!nw || !nh || maxWmm <= 0 || maxHmm <= 0) return { w: maxWmm, h: maxHmm };
  const aspect = nw / nh;
  let w = maxWmm;
  let h = w / aspect;
  if (h > maxHmm) {
    h = maxHmm;
    w = h * aspect;
  }
  return { w, h };
}

/**
 * Loads organization name and logo from GET /branding (same source as Global → Branding).
 * @returns {Promise<{ organizationName: string | null, logoDataUrl: string | null }>}
 */
export async function fetchBrandingForPdf() {
  try {
    const resp = await apiFetch(`/branding`);
    if (!resp.ok) return { organizationName: null, logoDataUrl: null };
    const data = await resp.json();
    const organizationName = (data.organization_name && String(data.organization_name).trim()) || null;
    const logoDataUrl = brandingLogoToDataUrl(data.assets?.logo);
    return { organizationName, logoDataUrl };
  } catch {
    return { organizationName: null, logoDataUrl: null };
  }
}

/**
 * Builds a print-ready, light-theme incident report PDF (suitable for records / compliance).
 * @param {object} report — mapped incident object from ReportsManagement
 * @param {{ user?: object | null, timeFormat?: string, settingsTimezone?: string | null, channelsById?: Record<string,string>, organizationName?: string | null, logoDataUrl?: string | null }} options
 * @returns {Promise<Blob>}
 */
export async function buildIncidentReportPdfBlob(report, options = {}) {
  const {
    user = null,
    timeFormat = '24h',
    settingsTimezone = null,
    channelsById = {},
    organizationName = null,
    logoDataUrl = null,
  } = options;
  const tz = resolveTimezone(settingsTimezone);
  const createdByName = user?.name || user?.username || 'Boondock Team';
  const createdByFull = user ? `${user.name || createdByName} (${user.username || '—'})` : 'Unknown';
  const incidentCode = `RE-${String(report.id).padStart(5, '0')}`;
  const generatedAt = new Date();
  const genFmt = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: tz,
  });
  const genStr = `${genFmt.format(generatedAt)} (${getTzAbbrev(generatedAt, tz)})`;

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - PAGE_MARGIN * 2;

  const orgDisplay = organizationName || 'Boondock Edge';

  doc.setProperties({
    title: `Incident Report — ${report.title}`,
    subject: 'Incident transcription and metadata record',
    author: createdByName,
    keywords: `incident,${incidentCode},boondock`,
    creator: orgDisplay,
  });

  const HEADER_H = 28;
  const logoPad = 2;
  const logoMaxInnerW = 46;
  const logoMaxInnerH = 17;
  const logoOuterW = logoMaxInnerW + logoPad * 2;
  const logoOuterH = logoMaxInnerH + logoPad * 2;
  const logoBoxX = pageW - PAGE_MARGIN - logoOuterW;

  // Header band
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, HEADER_H, 'F');

  let logoDims = null;
  if (logoDataUrl) {
    logoDims = await loadNaturalImageSize(logoDataUrl);
  }

  if (logoDataUrl && logoDims) {
    doc.setFillColor(255, 255, 255);
    doc.rect(logoBoxX, 4, logoOuterW, logoOuterH, 'F');
    const { w: iw, h: ih } = fitLogoToMmBox(logoDims.w, logoDims.h, logoMaxInnerW, logoMaxInnerH);
    const imgX = logoBoxX + logoPad + (logoMaxInnerW - iw) / 2;
    const imgY = 4 + logoPad + (logoMaxInnerH - ih) / 2;
    try {
      doc.addImage(logoDataUrl, imageFormatForJsPdf(logoDataUrl), imgX, imgY, iw, ih);
    } catch {
      // Unsupported image type for jsPDF — skip logo
    }
  }

  const textBlockRight = logoDataUrl && logoDims ? logoBoxX - 6 : pageW - PAGE_MARGIN;
  const headerTitleMaxW = Math.max(60, textBlockRight - PAGE_MARGIN);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('INCIDENT REPORT', PAGE_MARGIN, 12, { maxWidth: headerTitleMaxW });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${incidentCode}  ·  ${orgDisplay}`, PAGE_MARGIN, 21, { maxWidth: headerTitleMaxW });

  let y = HEADER_H + 6;
  doc.setTextColor(...BODY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(String(report.title || 'Untitled'), PAGE_MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Document generated: ${genStr}`, PAGE_MARGIN, y);
  y += 4;
  doc.text(`All incident timestamps use timezone: ${tz}`, PAGE_MARGIN, y);
  y += 10;

  doc.setTextColor(...BODY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Summary', PAGE_MARGIN, y);
  y += 2;

  const sevBg = severityFill(report.severity);
  const summaryBody = [
    ['Report ID', incidentCode],
    ...(organizationName ? [['Organization', organizationName]] : []),
    ['Title', String(report.title || '—')],
    ['Created', formatForReport(report.date, timeFormat, tz)],
    ['Created by', createdByFull],
    ['Incident start', formatForReport(report.startTime, timeFormat, tz)],
    ['Incident end', formatForReport(report.endTime, timeFormat, tz)],
    ['Channels / units', channelsInvolvedLabel(report, channelsById)],
    ['Severity', String(report.severity || '—')],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: summaryBody,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      textColor: BODY,
      lineColor: BORDER,
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 48, fillColor: [248, 250, 252] },
      1: { cellWidth: contentW - 48 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 1) return;
      const raw = data.row.raw;
      const label = Array.isArray(raw) ? raw[0] : null;
      if (label === 'Severity') {
        data.cell.styles.fillColor = sevBg;
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  y = doc.lastAutoTable.finalY + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BODY);
  doc.text('Incident description', PAGE_MARGIN, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const desc = String(report.description || '—').trim() || '—';
  const descLines = doc.splitTextToSize(desc, contentW);
  const lineH = 4.2;
  for (let i = 0; i < descLines.length; i++) {
    if (y + lineH > pageH - 18) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
    doc.setTextColor(...BODY);
    doc.text(descLines[i], PAGE_MARGIN, y);
    y += lineH;
  }
  y += 6;

  if (y > pageH - 40) {
    doc.addPage();
    y = PAGE_MARGIN;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Recorded messages & transcriptions', PAGE_MARGIN, y);
  y += 2;

  const audioRows = (report.audios || []).map((a, i) => [
    String(i + 1),
    displaySource(a.source, channelsById),
    formatForReport(a.recordedAt, timeFormat, tz),
    String(a.transcription || '—'),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Channel / source', 'Recorded', 'Transcription']],
    body: audioRows.length ? audioRows : [['—', '—', '—', 'No messages attached to this report.']],
    theme: 'striped',
    headStyles: {
      fillColor: BRAND,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: BODY,
      lineColor: BORDER,
      lineWidth: 0.1,
      valign: 'top',
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 9 },
      1: { cellWidth: 44 },
      2: { cellWidth: 38 },
      3: { cellWidth: pageW - PAGE_MARGIN * 2 - 9 - 44 - 38 },
    },
    alternateRowStyles: { fillColor: [252, 252, 253] },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  y = doc.lastAutoTable.finalY + 8;
  if (y > pageH - 24) {
    doc.addPage();
    y = PAGE_MARGIN;
  }

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.line(PAGE_MARGIN, y, pageW - PAGE_MARGIN, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'italic');
  const legal =
    `This document was generated from Boondock Edge incident report data${organizationName ? ` for ${organizationName}` : ''}. ` +
    'Retain according to your organization’s records policy. ' +
    'Audio evidence is referenced by URL in the live system; use ZIP export to bundle audio files.';
  const footLines = doc.splitTextToSize(legal, contentW);
  doc.text(footLines, PAGE_MARGIN, y);

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`${orgDisplay} · ${incidentCode}`, PAGE_MARGIN, pageH - 8);
    doc.text(`Page ${p} of ${totalPages}`, pageW - PAGE_MARGIN, pageH - 8, { align: 'right' });
  }

  return doc.output('blob');
}

export { safeFilename as incidentReportPdfFilename };
