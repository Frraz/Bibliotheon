import {commercialCSVHeaders} from '../../src/modules/commerce/csv'
import {reportEvidenceCSVHeaders} from '../../src/modules/commerce/report-evidence-csv'
export const csvFields=['hotmart','synthetic','synthetic-transaction','synthetic-product','synthetic-offer','approved','2026-10-20T11:01:00.000Z','BRL','9990','','990','','']
// Canonical input intentionally does not use the spreadsheet exporter (which escapes formulas).
export const canonicalCSV=(rows:readonly (readonly string[])[]=[csvFields])=>Buffer.from([commercialCSVHeaders,...rows].map(row=>row.map(value=>/[",\r\n]/.test(value)?'"'+value.replaceAll('"','""')+'"':value).join(',')).join('\r\n')+'\r\n')
export const reportEvidenceFields=['hotmart','synthetic','csv-report-transaction','synthetic-product','','approved','2026-10-20T11:01:00.000Z','2026-10-20T11:01:00.000Z','BRL','12000','','','','','','','synthetic-csv-line','[]']
export const canonicalReportEvidenceCSV=(rows:readonly (readonly string[])[]=[reportEvidenceFields])=>Buffer.from([reportEvidenceCSVHeaders,...rows].map(row=>row.map(value=>/[",\r\n]/.test(value)?'"'+value.replaceAll('"','""')+'"':value).join(',')).join('\r\n')+'\r\n')
