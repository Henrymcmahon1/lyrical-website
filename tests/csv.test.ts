import { describe, it, expect } from 'vitest'
import { toCsv } from '@/lib/csv'

describe('toCsv formats a spreadsheet correctly', () => {
  it('writes a header row followed by the data', () => {
    const csv = toCsv(['name', 'email'], [{ name: 'Mara', email: 'm@example.com' }])
    expect(csv).toBe('name,email\r\nMara,m@example.com')
  })

  it('quotes a value containing a comma', () => {
    const csv = toCsv(['company'], [{ company: 'Northlight, Records' }])
    expect(csv).toContain('"Northlight, Records"')
  })

  it('escapes embedded quotes by doubling them', () => {
    const csv = toCsv(['message'], [{ message: 'He said "yes"' }])
    expect(csv).toContain('"He said ""yes"""')
  })

  it('keeps a multi-line message inside one quoted cell', () => {
    const csv = toCsv(['message'], [{ message: 'Line one\nLine two' }])
    expect(csv).toContain('"Line one\nLine two"')
    // The row separator is CRLF, so a bare LF inside quotes cannot split the row.
    expect(csv.split('\r\n')).toHaveLength(2)
  })

  it('renders null and undefined as empty cells, never as the word null', () => {
    const csv = toCsv(['a', 'b'], [{ a: null, b: undefined }])
    expect(csv).toBe('a,b\r\n,')
  })

  it('joins array values rather than printing object notation', () => {
    const csv = toCsv(['langs'], [{ langs: ['ES', 'PT'] }])
    expect(csv).toContain('"ES, PT"')
  })
})

describe('toCsv defuses spreadsheet formula injection', () => {
  // A cell beginning =, +, - or @ is executed as a formula by Excel and Sheets. The message
  // field is free text typed by a stranger, and this file gets opened in a spreadsheet, so
  // the export is a genuine attack surface rather than a theoretical one.
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '=cmd|calc'])('neutralises a cell starting %s', (v) => {
    const csv = toCsv(['message'], [{ message: v }])
    expect(csv).not.toMatch(/^message\r\n[=+\-@]/)
    expect(csv).toContain(v.replace(/^./, (c) => `'${c}`))
  })

  it('leaves ordinary text completely alone', () => {
    const csv = toCsv(['message'], [{ message: 'Forty masters, quoted please' }])
    expect(csv).toContain('"Forty masters, quoted please"')
    expect(csv).not.toContain("'")
  })

  it('does not mangle a negative number that is genuinely data', () => {
    // Still prefixed, because a spreadsheet cannot tell the difference and losing a minus
    // sign silently would be worse than a visible apostrophe.
    expect(toCsv(['n'], [{ n: -5 }])).toContain("'-5")
  })
})
