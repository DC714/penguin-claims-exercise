import ExcelJS from 'exceljs';
import { readFile, readdir } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { extractText, getDocumentProxy } from 'unpdf';
import { parseDate } from '../engine/dates';
import type { Plan } from '../engine/types';

export interface RawVisit { encId: string; sourceFile: string; text: string; dosCol?: string; provider?: string; memberCol?: string }
export interface Member { memberId: string; last: string; first: string; dob: string; plan: Plan; effDt: string }
export interface CoderExample { encId: string; codes: string[]; coder: string }

const cellStr = (v: unknown): string => {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && 'text' in (v as object)) return String((v as { text: string }).text);
  return String(v);
};

export async function loadXlsx(path: string): Promise<{ visits: RawVisit[]; coded: CoderExample[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const visits: RawVisit[] = [];
  wb.getWorksheet('Visits')!.eachRow((row, i) => {
    if (i === 1) return;
    visits.push({ encId: cellStr(row.getCell(1).value), sourceFile: 'visits_export_2026-10-20.xlsx', dosCol: cellStr(row.getCell(2).value), memberCol: cellStr(row.getCell(3).value) || undefined, provider: cellStr(row.getCell(5).value), text: cellStr(row.getCell(6).value) });
  });
  const coded: CoderExample[] = [];
  wb.getWorksheet('Coded examples')!.eachRow((row, i) => {
    if (i === 1) return;
    coded.push({ encId: cellStr(row.getCell(1).value), codes: cellStr(row.getCell(2).value).split(',').map((s) => s.trim()).filter(Boolean), coder: cellStr(row.getCell(3).value) });
  });
  return { visits, coded };
}

export async function loadPdfs(dir: string): Promise<RawVisit[]> {
  const out: RawVisit[] = [];
  for (const f of (await readdir(dir)).filter((x) => x.endsWith('.pdf')).sort()) {
    const pdf = await getDocumentProxy(new Uint8Array(await readFile(`${dir}/${f}`)));
    const { text } = await extractText(pdf, { mergePages: true });
    const encId = text.match(/E-\d{5}/)?.[0];
    if (!encId) throw new Error(`No encounter id in ${f}`);
    out.push({ encId, sourceFile: `notes_pdf_batch2/${f}`, text });
  }
  return out;
}

export function loadRosterText(csv: string): Member[] {
  return (parse(csv, { columns: true, skip_empty_lines: true }) as Record<string, string>[]).map((r) => ({
    memberId: r.MBR_ID, last: r.LNAME, first: r.FNAME, dob: parseDate(r.DOB) ?? r.DOB, plan: r.PLAN as Plan, effDt: parseDate(r.EFF_DT) ?? r.EFF_DT,
  }));
}
export async function loadRoster(path: string): Promise<Member[]> { return loadRosterText(await readFile(path, 'utf8')); }
