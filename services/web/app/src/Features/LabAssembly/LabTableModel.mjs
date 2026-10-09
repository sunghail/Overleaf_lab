import { AssemblyError, escapeLatex } from './LabLatex.mjs'

const check = (ok, message) => {
  if (!ok) throw new AssemblyError(message)
}
export function createTable() {
  const cells = [
    ['K_j', 'A', 'B', 'C', 'D', 'Reference'],
    ...Array.from({ length: 7 }, (_, i) => [
      i < 6 ? `K_${i + 1}` : 'H_{CO_2,H_2O}',
      '',
      '',
      '',
      '',
      '',
    ]),
  ]
  return {
    cells,
    math: cells.map(row => row.map((_, c) => c === 0)),
    columns: [14.76, 15.4, 16.53, 15.4, 16.53, 21.38].map(width => ({
      width,
      align: 'center',
    })),
    merges: [],
    headerRows: 1,
    fontSize: 12,
    rowSpacing: 2.3,
    borders: 'academic',
    notes: '',
  }
}
export function validateTable(table) {
  check(
    table &&
      Array.isArray(table.cells) &&
      table.cells.length >= 1 &&
      table.cells.length <= 60,
    '표는 1–60행까지 지원합니다.',
  )
  check(
    Array.isArray(table.columns) &&
      table.columns.length >= 1 &&
      table.columns.length <= 12,
    '표는 1–12열까지 지원합니다.',
  )
  const count = table.columns.length
  check(
    table.cells.every(
      row =>
        Array.isArray(row) &&
        row.length === count &&
        row.every(v => typeof v === 'string' && v.length <= 500),
    ),
    '각 셀에는 500자 이하의 내용을 입력해 주세요.',
  )
  check(
    Array.isArray(table.math) &&
      table.math.length === table.cells.length &&
      table.math.every(
        row =>
          Array.isArray(row) &&
          row.length === count &&
          row.every(v => typeof v === 'boolean'),
      ),
    '셀 종류를 확인해 주세요.',
  )
  check(
    table.columns.every(
      c =>
        c &&
        Number.isFinite(c.width) &&
        c.width > 0 &&
        c.width <= 100 &&
        ['left', 'center', 'right'].includes(c.align),
    ),
    '열 너비와 정렬을 확인해 주세요.',
  )
  check(
    Number.isInteger(table.headerRows) &&
      table.headerRows >= 0 &&
      table.headerRows <= Math.min(3, table.cells.length),
    '머리글은 최대 3행까지 지정해 주세요.',
  )
  check(
    Number.isFinite(table.fontSize) &&
      table.fontSize >= 8 &&
      table.fontSize <= 16 &&
      Number.isFinite(table.rowSpacing) &&
      table.rowSpacing >= 1 &&
      table.rowSpacing <= 3,
    '표 글자 크기와 행간을 확인해 주세요.',
  )
  check(
    ['academic', 'grid', 'none'].includes(table.borders),
    '테두리 종류를 확인해 주세요.',
  )
  check(
    typeof table.notes === 'string' && table.notes.length <= 2000,
    '표 주석은 2000자 이하로 입력해 주세요.',
  )
  check(
    Array.isArray(table.merges) && table.merges.length <= 100,
    '병합 영역을 확인해 주세요.',
  )
  const occupied = new Set()
  for (const m of table.merges) {
    check(
      m &&
        [m.row, m.col, m.rows, m.cols].every(Number.isInteger) &&
        m.row >= 0 &&
        m.col >= 0 &&
        m.rows >= 1 &&
        m.cols >= 1 &&
        m.rows * m.cols > 1 &&
        m.row + m.rows <= table.cells.length &&
        m.col + m.cols <= count,
      '병합할 영역이 표 범위를 벗어났습니다.',
    )
    check(
      !(m.row < table.headerRows && m.row + m.rows > table.headerRows),
      '머리글과 본문을 가로질러 병합할 수 없습니다.',
    )
    for (let r = m.row; r < m.row + m.rows; r++)
      for (let c = m.col; c < m.col + m.cols; c++) {
        check(!occupied.has(`${r}:${c}`), '병합 영역이 겹칩니다.')
        occupied.add(`${r}:${c}`)
        check(
          (r === m.row && c === m.col) || table.cells[r][c] === '',
          '병합 영역의 첫 셀 외에는 내용을 비워 주세요. 기존 내용은 자동 삭제하지 않습니다.',
        )
      }
  }
  return table
}
export function renderTable(table, title, id, { word = false, numbered = true } = {}) {
  validateTable(table)
  const total = table.columns.reduce((sum, c) => sum + c.width, 0)
  const format = (col, span = 1) => {
    const width =
      table.columns.slice(col, col + span).reduce((s, c) => s + c.width, 0) /
      total
    const align = {
      left: 'raggedright',
      center: 'centering',
      right: 'raggedleft',
    }[table.columns[col].align]
    return word
      ? `p{${(width * 15.92).toFixed(5)}cm}`
      : `>{\\${align}\\arraybackslash}p{\\dimexpr ${width.toFixed(5)}\\linewidth-2\\tabcolsep\\relax}`
  }
  const border = table.borders === 'grid' ? '|' : ''
  const spec =
    border + table.columns.map((_, c) => format(c)).join(border) + border
  const rule =
    table.borders === 'academic'
      ? '\\toprule'
      : table.borders === 'grid'
        ? '\\hline'
        : ''
  const bottom = table.borders === 'academic' ? '\\bottomrule' : rule
  const mid = table.borders === 'academic' ? '\\midrule' : rule
  const row = r => {
    const values = []
    for (let c = 0; c < table.columns.length; ) {
      const merge = table.merges.find(
        m =>
          r >= m.row && r < m.row + m.rows && c >= m.col && c < m.col + m.cols,
      )
      const span = merge?.cols || 1
      let value =
        merge && r !== merge.row
          ? ''
          : table.math[r][c] && table.cells[r][c]
            ? `$${table.cells[r][c]}$`
            : escapeLatex(table.cells[r][c]).replaceAll('\n', '\\newline ')
      if (merge && r === merge.row && merge.rows > 1)
        value = `\\multirow{${merge.rows}}{=}{${value}}`
      if (span > 1)
        value = `\\multicolumn{${span}}{${border}${format(c, span)}${border}}{${value}}`
      values.push(value)
      c += span
    }
    return values.join(' & ') + ' \\\\'
  }
  const lines = ['% Generated by the lab table editor.', '\\begingroup']
  if (!word)
    lines.push(
      `\\fontsize{${table.fontSize}}{${table.fontSize * 1.2}}\\selectfont`,
      '\\setstretch{1}',
      `\\renewcommand{\\arraystretch}{${table.rowSpacing}}`,
    )
  lines.push(
    `\\begin{longtable}{${spec}}`,
    `\\caption${!word && !numbered ? '*' : ''}{${escapeLatex(title)}}${numbered ? `\\label{lab:${id}}` : ''}\\\\`,
    rule,
  )
  for (let r = 0; r < table.headerRows; r++) lines.push(row(r))
  if (table.headerRows) lines.push(mid)
  if (!word) {
    lines.push('\\endfirsthead', rule)
    for (let r = 0; r < table.headerRows; r++) lines.push(row(r))
    if (table.headerRows) lines.push(mid)
    lines.push('\\endhead')
  }
  for (let r = table.headerRows; r < table.cells.length; r++) {
    lines.push(row(r))
    if (table.borders === 'grid') lines.push('\\hline')
  }
  lines.push(bottom, '\\end{longtable}')
  if (table.notes) lines.push(`\\noindent ${escapeLatex(table.notes)}\\par`)
  lines.push('\\endgroup', '')
  return lines.filter(line => line !== '').join('\n') + '\n'
}
