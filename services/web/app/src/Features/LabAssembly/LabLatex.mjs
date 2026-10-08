export class AssemblyError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}
export function escapeLatex(text) {
  const escaped = {
    '\\': '\\textbackslash{}',
    '{': '\\{',
    '}': '\\}',
    '%': '\\%',
    '&': '\\&',
    '#': '\\#',
    $: '\\$',
    _: '\\_',
    '^': '\\textasciicircum{}',
    '~': '\\textasciitilde{}',
  }
  return text
    .replace(/[\\{}%&#$_^~]/g, char => escaped[char])
    .replace(/[\r\n]/g, ' ')
}
