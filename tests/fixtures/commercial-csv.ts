import {commercialCSVHeaders} from '../../src/modules/commerce/csv'
export const csvFields=['hotmart','synthetic','synthetic-transaction','synthetic-product','synthetic-offer','approved','2026-10-20T11:01:00.000Z','BRL','9990','','990','','']
// Canonical input intentionally does not use the spreadsheet exporter (which escapes formulas).
export const canonicalCSV=(rows:readonly (readonly string[])[]=[csvFields])=>Buffer.from([commercialCSVHeaders,...rows].map(row=>row.map(value=>/[",\r\n]/.test(value)?'"'+value.replaceAll('"','""')+'"':value).join(',')).join('\r\n')+'\r\n')
