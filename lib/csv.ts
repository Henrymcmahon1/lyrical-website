/**
 * Minimal RFC 4180 CSV writer for the leads export.
 *
 * Hand-rolled rather than pulled in as a dependency: the whole job is quoting, and a
 * dependency here would be more code to trust than the twenty lines it replaces.
 */

/** Characters that make a spreadsheet treat a cell as a formula rather than as text. */
const FORMULA_START = /^[=+\-@\t\r]/

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''

  let s = Array.isArray(value) ? value.join(', ') : String(value)

  /**
   * Defuse spreadsheet formula injection.
   *
   * Excel and Google Sheets execute a cell beginning `=`, `+`, `-` or `@`. The message field
   * is free text typed by a stranger and this file is opened in a spreadsheet, so a lead
   * could otherwise ship a formula straight into whoever opens the export. Prefixing an
   * apostrophe forces it to be read as text; the apostrophe is not shown in the cell.
   *
   * Applied to genuine negative numbers too. A spreadsheet cannot distinguish them, and a
   * visible apostrophe is a much better outcome than a silently executed cell.
   */
  if (FORMULA_START.test(s)) s = `'${s}`

  // Quote when the value contains a delimiter, a quote or a line break. Inner quotes double.
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`

  return s
}

/**
 * Rows are keyed by the column names given, so the header and the data cannot drift.
 * Row separator is CRLF, which keeps a bare newline inside a quoted cell from splitting it.
 */
export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const head = columns.map(cell).join(',')
  const body = rows.map((row) => columns.map((c) => cell(row[c])).join(','))
  return [head, ...body].join('\r\n')
}
