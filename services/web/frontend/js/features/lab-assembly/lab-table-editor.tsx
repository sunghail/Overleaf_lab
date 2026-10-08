import { useState } from 'react'
import Modal from 'react-bootstrap/Modal'
import type { Module, LabTable } from './lab-assembly-widget'

export default function LabTableEditor({
  module,
  onClose,
  onApply,
  error,
  editable = true
}: {
  module: Module
  onClose: () => void
  onApply: (table: LabTable) => Promise<boolean>
  error: string
  editable?: boolean
}) {
  const [table, setTable] = useState<LabTable>(() =>
    structuredClone(module.table!)
  )
  const [cell, setCell] = useState({ r: 0, c: 0 })
  const [mergeRows, setMergeRows] = useState(1)
  const [mergeCols, setMergeCols] = useState(2)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')
  const edit = (fn: (next: LabTable) => void) =>
    setTable(old => {
      const next = structuredClone(old)
      fn(next)
      return next
    })
  const resize = (rows: number, cols: number) => {
    if (rows < 1 || rows > 60 || cols < 1 || cols > 12) return
    edit(next => {
      next.cells = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => next.cells[r]?.[c] || '')
      )
      next.math = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => next.math[r]?.[c] || false)
      )
      next.columns = Array.from(
        { length: cols },
        (_, c) => next.columns[c] || { width: 20, align: 'center' }
      )
      next.merges = next.merges.filter(
        m => m.row + m.rows <= rows && m.col + m.cols <= cols
      )
      next.headerRows = Math.min(next.headerRows, rows)
    })
    setCell({ r: 0, c: 0 })
  }
  const merge = () => {
    setLocalError('')
    if (
      cell.r + mergeRows > table.cells.length ||
      cell.c + mergeCols > table.columns.length ||
      mergeRows * mergeCols < 2
    ) {
      setLocalError('병합 영역을 확인해 주세요.')
      return
    }
    for (let r = cell.r; r < cell.r + mergeRows; r++)
      for (let c = cell.c; c < cell.c + mergeCols; c++) {
        if (
          table.merges.some(
            m =>
              r >= m.row &&
              r < m.row + m.rows &&
              c >= m.col &&
              c < m.col + m.cols
          ) ||
          ((r !== cell.r || c !== cell.c) && table.cells[r][c])
        ) {
          setLocalError(
            '병합 영역이 겹치거나 다른 셀에 내용이 있습니다. 내용을 정리한 뒤 병합해 주세요.'
          )
          return
        }
      }
    edit(next =>
      next.merges.push({
        row: cell.r,
        col: cell.c,
        rows: mergeRows,
        cols: mergeCols
      })
    )
  }
  return (
    <Modal show scrollable onHide={onClose} dialogClassName="lab-table-dialog">
      <Modal.Header closeButton>
        <Modal.Title>표 편집 · {module.title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {!editable && <p>이 표는 읽기 전용입니다.</p>}
        <fieldset disabled={!editable || busy}>
          {(error || localError) && (
            <p role="alert" className="text-danger">
              {localError || error}
            </p>
          )}
          <p>
            셀에 값을 입력하고 열 너비·정렬·테두리를 조절하세요. 수식 셀은
            LaTeX로 입력합니다.
          </p>
          <div className="lab-table-controls">
            <div>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() =>
                  resize(table.cells.length + 1, table.columns.length)
                }
              >
                행 추가
              </button>{' '}
              <button
                className="btn btn-sm btn-secondary"
                onClick={() =>
                  resize(table.cells.length - 1, table.columns.length)
                }
              >
                마지막 행 제거
              </button>
            </div>
            <div>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() =>
                  resize(table.cells.length, table.columns.length + 1)
                }
              >
                열 추가
              </button>{' '}
              <button
                className="btn btn-sm btn-secondary"
                onClick={() =>
                  resize(table.cells.length, table.columns.length - 1)
                }
              >
                마지막 열 제거
              </button>
            </div>
            <label>
              테두리{' '}
              <select
                aria-label="표 테두리"
                value={table.borders}
                onChange={e =>
                  edit(t => {
                    t.borders = e.target.value as LabTable['borders']
                  })
                }
              >
                <option value="academic">학술형 가로선</option>
                <option value="grid">격자</option>
                <option value="none">없음</option>
              </select>
            </label>
            <label>
              글자 크기(pt){' '}
              <input
                aria-label="표 글자 크기"
                type="number"
                min={8}
                max={16}
                value={table.fontSize}
                onChange={e =>
                  edit(t => {
                    t.fontSize = Number(e.target.value)
                  })
                }
              />
            </label>
            <label>
              행간 배율{' '}
              <input
                aria-label="표 행간"
                type="number"
                min={1}
                max={3}
                step={0.1}
                value={table.rowSpacing}
                onChange={e =>
                  edit(t => {
                    t.rowSpacing = Number(e.target.value)
                  })
                }
              />
            </label>
            <label>
              머리글 행{' '}
              <input
                aria-label="머리글 행 수"
                type="number"
                min={0}
                max={Math.min(3, table.cells.length)}
                value={table.headerRows}
                onChange={e =>
                  edit(t => {
                    t.headerRows = Number(e.target.value)
                  })
                }
              />
            </label>
          </div>
          <div className="lab-table-grid-wrap">
            <table className={`lab-table-grid ${table.borders}`}>
              <thead>
                <tr>
                  {table.columns.map((col, c) => (
                    <th key={c}>
                      <span>{String.fromCharCode(65 + c)}열</span>
                      <label>
                        너비 비율{' '}
                        <input
                          aria-label={`${c + 1}열 너비`}
                          type="number"
                          min={1}
                          max={100}
                          step={0.1}
                          value={col.width}
                          onChange={e =>
                            edit(t => {
                              t.columns[c].width = Number(e.target.value)
                            })
                          }
                        />
                      </label>
                      <select
                        aria-label={`${c + 1}열 정렬`}
                        value={col.align}
                        onChange={e =>
                          edit(t => {
                            t.columns[c].align = e.target
                              .value as typeof col.align
                          })
                        }
                      >
                        <option value="left">왼쪽</option>
                        <option value="center">가운데</option>
                        <option value="right">오른쪽</option>
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.cells.map((row, r) => (
                  <tr key={r}>
                    {row.map((value, c) => {
                      const m = table.merges.find(
                        m =>
                          r >= m.row &&
                          r < m.row + m.rows &&
                          c >= m.col &&
                          c < m.col + m.cols
                      )
                      if (m && (r !== m.row || c !== m.col)) return null
                      return (
                        <td
                          key={c}
                          rowSpan={m?.rows}
                          colSpan={m?.cols}
                          className={`${r < table.headerRows ? 'header-cell' : ''} ${cell.r === r && cell.c === c ? 'selected-cell' : ''}`}
                        >
                          <input
                            aria-label={`셀 ${r + 1}행 ${c + 1}열`}
                            value={value}
                            style={{ textAlign: table.columns[c].align }}
                            onFocus={() => setCell({ r, c })}
                            onChange={e =>
                              edit(t => {
                                t.cells[r][c] = e.target.value
                              })
                            }
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lab-table-controls">
            <span>
              선택 셀: {cell.r + 1}행 {cell.c + 1}열
            </span>
            <label>
              <input
                type="checkbox"
                checked={table.math[cell.r]?.[cell.c] || false}
                onChange={e =>
                  edit(t => {
                    t.math[cell.r][cell.c] = e.target.checked
                  })
                }
              />{' '}
              LaTeX 수식 셀
            </label>
            <label>
              병합 행{' '}
              <input
                aria-label="병합 행 수"
                type="number"
                min={1}
                max={60}
                value={mergeRows}
                onChange={e => setMergeRows(Number(e.target.value))}
              />
            </label>
            <label>
              병합 열{' '}
              <input
                aria-label="병합 열 수"
                type="number"
                min={1}
                max={12}
                value={mergeCols}
                onChange={e => setMergeCols(Number(e.target.value))}
              />
            </label>
            <button className="btn btn-sm btn-secondary" onClick={merge}>
              선택 셀부터 병합
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() =>
                edit(t => {
                  t.merges = t.merges.filter(
                    m => m.row !== cell.r || m.col !== cell.c
                  )
                })
              }
            >
              선택 병합 해제
            </button>
          </div>
          <label className="d-block">
            표 하단 주석
            <textarea
              aria-label="표 하단 주석"
              className="form-control"
              value={table.notes}
              onChange={e =>
                edit(t => {
                  t.notes = e.target.value
                })
              }
            />
          </label>
        </fieldset>
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-secondary" disabled={busy} onClick={onClose}>
          취소
        </button>
        <button
          className="btn btn-primary"
          disabled={busy || !editable}
          onClick={async () => {
            setBusy(true)
            try {
              if (await onApply(table)) onClose()
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? '저장하는 중…' : '표 저장'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}
