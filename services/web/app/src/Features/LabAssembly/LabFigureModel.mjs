import { AssemblyError, escapeLatex } from './LabLatex.mjs'

export function createFigure() {
  return { path: '', width: 80 }
}

export function isFigurePath(path) {
  return typeof path === 'string' && path.length <= 500 &&
    !path.startsWith('/') && !path.split('/').includes('..') &&
    /^[\p{L}\p{N}_ .()/+-]+\.(png|jpe?g)$/iu.test(path)
}

export function validateFigure(figure) {
  if (!figure || (figure.path !== '' && !isFigurePath(figure.path)) ||
      !Number.isFinite(figure.width) || figure.width < 10 || figure.width > 100)
    throw new AssemblyError('그림 파일과 너비(10–100%)를 확인해 주세요.')
  return figure
}

export function renderFigure(module, { word = false, caption = module.title } = {}) {
  const figure = validateFigure(module.figure)
  const numbered = module.numbered !== false
  const lines = ['\\begin{figure}[htbp]', '\\centering']
  if (figure.path)
    lines.push(`\\includegraphics[width=${figure.width / 100}\\linewidth]{${word ? figure.path : `\\detokenize{${figure.path}}`}}`)
  lines.push(`\\input{lab-module-${module.id}.tex}`)
  lines.push(`\\caption${!word && !numbered ? '*' : ''}{${escapeLatex(caption)}}`)
  if (!word && numbered) lines.push(`\\label{lab:${module.id}}`)
  lines.push('\\end{figure}')
  return lines.join('\n')
}
