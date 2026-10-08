"""Apply the lab's measured Word manuscript and editable table formatting."""
import json, sys, zipfile, copy, io, re
from xml.etree import ElementTree as E
from pathlib import Path
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
E.register_namespace('w',W)
def tag(s):return '{'+W+'}'+s
def node(parent,name,attrs=None):
 x=parent.find(tag(name))
 if x is None:x=E.SubElement(parent,tag(name))
 if attrs:
  for k,v in attrs.items():x.set(tag(k),str(v))
 return x
def text(element):return ''.join(t.text or '' for t in element.iter(tag('t')))
path=Path(sys.argv[1]);settings=json.loads(Path(sys.argv[2]).read_text())
with zipfile.ZipFile(path) as z:parts={n:z.read(n) for n in z.namelist()}
namespaces={}
for _,pair in E.iterparse(io.BytesIO(parts['word/document.xml']),events=['start-ns']):
 prefix,uri=pair;namespaces[prefix]=uri
 if prefix and not re.fullmatch(r'ns[0-9]+',prefix):E.register_namespace(prefix,uri)
E.register_namespace('w',W)
doc=E.fromstring(parts['word/document.xml']);body=doc.find(tag('body'))
for sect in doc.iter(tag('sectPr')):
 node(sect,'pgSz',{'w':11906,'h':16838})
 node(sect,'pgMar',{'top':1701,'bottom':1440,'left':1440,'right':1440,'header':851,'footer':992,'gutter':0})
 node(sect,'lnNumType',{'countBy':1,'restart':'continuous'})
 for x in list(sect):
  if x.tag in (tag('footerReference'),tag('headerReference')):sect.remove(x)
# Preserve native Word equations created by Pandoc. Format only table geometry and paragraphs.
tables=list(body.iter(tag('tbl')))
if len(tables)!=len(settings['tables']):raise ValueError('Word table conversion did not preserve the managed table count')
for tbl,config in zip(tables,settings['tables']):
 # Build a minimal native table shell and retain every converted paragraph/math node.
 clean=E.Element(tag('tbl'));newpr=E.SubElement(clean,tag('tblPr'))
 E.SubElement(clean,tag('tblGrid'))
 for oldrow in tbl.findall(tag('tr')):
  newrow=E.SubElement(clean,tag('tr'));E.SubElement(newrow,tag('trPr'))
  for oldcell in oldrow.findall(tag('tc')):
   newcell=E.SubElement(newrow,tag('tc'));cp=E.SubElement(newcell,tag('tcPr'))
   oldpr=oldcell.find(tag('tcPr'))
   if oldpr is not None:
    for item in oldpr:
     if item.tag in (tag('gridSpan'),tag('vMerge')):cp.append(copy.deepcopy(item))
   for item in oldcell:
    if item.tag in (tag('p'),tag('tbl')):newcell.append(copy.deepcopy(item))
 index=list(body).index(tbl);body.remove(tbl);body.insert(index,clean);tbl=clean
 count=len(config['columns']);total=sum(c['width'] for c in config['columns'])
 widths=[round(9026*c['width']/total) for c in config['columns']]
 pr=node(tbl,'tblPr')
 for child in list(pr):
  if child.tag==tag('tblStyle'):pr.remove(child)
 node(pr,'tblW',{'w':9026,'type':'dxa'});node(pr,'tblLayout',{'type':'fixed'})
 borders=node(pr,'tblBorders')
 for name in ['top','bottom','left','right','insideH','insideV']:
  show=config['borders']=='grid' or config['borders']=='academic' and name in ['top','bottom']
  node(borders,name,{'val':'single' if show else 'nil','sz':12 if name in ['top','bottom'] else 4,'color':'000000'})
 margins=node(pr,'tblCellMar')
 for side in ['top','bottom','left','right']:node(margins,side,{'w':0 if side in ['top','bottom'] else 99,'type':'dxa'})
 grid=node(tbl,'tblGrid')
 for x in list(grid):grid.remove(x)
 for width in widths:node_width=E.SubElement(grid,tag('gridCol'));node_width.set(tag('w'),str(width))
 rows=tbl.findall(tag('tr'))
 if len(rows)!=len(config['cells']):raise ValueError('Word table conversion did not preserve row count')
 for r,tr in enumerate(rows):
  rp=node(tr,'trPr');node(rp,'trHeight',{'val':round(config['fontSize']*1.2*config['rowSpacing']*20),'hRule':'atLeast'})
  if r<config['headerRows']:node(rp,'tblHeader',{'val':'true'})
  c=0
  for tc in tr.findall(tag('tc')):
   tcp=node(tc,'tcPr');span_node=tcp.find(tag('gridSpan'));span=int(span_node.get(tag('val'),'1')) if span_node is not None else 1
   node(tcp,'tcW',{'w':sum(widths[c:c+span]),'type':'dxa'});node(tcp,'vAlign',{'val':'center'})
   for x in list(tcp):
    if x.tag==tag('shd'):tcp.remove(x)
   cb=node(tcp,'tcBorders')
   for name in ['top','bottom','left','right']:
    edge=(r==0 and name=='top') or (r==len(rows)-1 and name=='bottom')
    header=r==config['headerRows']-1 and name=='bottom'
    show=config['borders']=='grid' or config['borders']=='academic' and (edge or header)
    node(cb,name,{'val':'single' if show else 'nil','sz':12 if edge else 4,'color':'000000'})
   for p in tc.findall(tag('p')):
    pp=node(p,'pPr');node(pp,'pStyle',{'val':'Normal'});node(pp,'jc',{'val':{'left':'left','center':'center','right':'right'}[config['columns'][min(c,count-1)]['align']]});node(pp,'ind',{'left':0,'right':0,'firstLine':0});node(pp,'spacing',{'before':0,'after':0,'line':240,'lineRule':'auto'})
    for run in p.findall(tag('r')):
     rpr=node(run,'rPr');node(rpr,'rFonts',{'ascii':'Times New Roman','hAnsi':'Times New Roman'});node(rpr,'sz',{'val':config['fontSize']*2});node(rpr,'color',{'val':'000000'});node(rpr,'b',{'val':0})
   c+=span
# Keep captions in the source's 12pt bold role.
for p in body.findall(tag('p')):
 if any(text(p).strip()==c['caption'] for c in settings['tables']):node(node(p,'pPr'),'pStyle',{'val':'Caption'})
# OOXML property elements must precede content and follow schema order.
orders={
 'tbl':'tblPr tblGrid tr',
 'tr':'trPr tc',
 'tc':'tcPr p tbl',
 'p':'pPr',
 'r':'rPr',
 'tblPr':'tblStyle tblpPr tblOverlap bidiVisual tblStyleRowBandSize tblStyleColBandSize tblW jc tblCellSpacing tblInd tblBorders shd tblLayout tblCellMar tblLook tblCaption tblDescription tblPrChange',
 'tcPr':'cnfStyle tcW gridSpan hMerge vMerge tcBorders shd noWrap tcMar textDirection tcFitText vAlign hideMark',
 'pPr':'pStyle keepNext keepLines pageBreakBefore framePr widowControl numPr suppressLineNumbers pBdr shd tabs suppressAutoHyphens kinsoku wordWrap overflowPunct topLinePunct autoSpaceDE autoSpaceDN bidi adjustRightInd snapToGrid spacing ind contextualSpacing mirrorIndents suppressOverlap jc textDirection textAlignment textboxTightWrap outlineLvl divId cnfStyle rPr sectPr',
 'rPr':'rStyle rFonts b bCs i iCs caps smallCaps strike dstrike outline shadow emboss imprint noProof snapToGrid vanish webHidden color spacing w kern position sz szCs highlight u effect bdr shd fitText vertAlign rtl cs em lang eastAsianLayout specVanish oMath',
 'sectPr':'headerReference footerReference footnotePr endnotePr type pgSz pgMar paperSrc pgBorders lnNumType pgNumType cols formProt vAlign noEndnote titlePg textDirection bidi rtlGutter docGrid'
}
for element in doc.iter():
 name=element.tag.rsplit('}',1)[-1]
 if name in orders:
  rank={tag(n):i for i,n in enumerate(orders[name].split())}
  children=list(element)
  children.sort(key=lambda x:rank.get(x.tag,999))
  element[:]=children
parts['word/document.xml']=E.tostring(doc,encoding='utf-8',xml_declaration=True)
for prefix,uri in namespaces.items():
 if prefix and prefix!='xml' and ('xmlns:'+prefix+'=').encode() not in parts['word/document.xml']:
  parts['word/document.xml']=parts['word/document.xml'].replace(b'<w:document',('<w:document xmlns:'+prefix+'="'+uri+'"').encode(),1)
with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
 for name,data in parts.items():z.writestr(name,data)
