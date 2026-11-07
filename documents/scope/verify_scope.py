"""Structural verification and complete rendered-page QA for the client PDF."""
from pathlib import Path
import json
import xml.etree.ElementTree as ET
import fitz
from PIL import Image, ImageOps, ImageDraw
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[2]
PDF=ROOT/'WGJS-Connect-Scope-and-Requirements.pdf'
QA=ROOT/'.cache/scope-qa'
QA.mkdir(parents=True,exist_ok=True)
doc=fitz.open(PDF)
reader=PdfReader(PDF)
assert len(doc)==25, f'Unexpected page count: {len(doc)}'
assert len(doc.get_toc())==25, 'Missing bookmarks'
text='\n'.join(p.get_text() for p in doc)
required=['COM-01','COM-02','COM-03','CAL-01','CAL-02','LRN-01','LRN-02','LRN-03',
          'CLS-01','ATT-01','CON-01','RPT-01','RPT-02','RES-01','RES-02',
          'PAY-01','PAY-02','PAY-03','PAY-04','FRM-01','FRM-02','ENQ-01','ENQ-02','ENQ-03',
          'ADM-01','ADM-02','ADM-03','PRF-01','MOB-01','MOB-02',
          'AC-01','AC-02','AC-03','AC-04','AC-05','AC-06',
          'Parent','Teacher','Principal','Finance','Administrator','future options',
          'Proposed for client review','Africa/Johannesburg','ZAR']
missing=[s for s in required if s.lower() not in text.lower()]
assert not missing, f'Missing coverage: {missing}'
for forbidden in ['ParentDemo!26','EXPO_TOKEN','Jamie Williams','Emma Williams','Noah Williams']:
    assert forbidden not in text, f'Unwanted demo/private content: {forbidden}'
fonts=set()
for i,page in enumerate(doc):
    assert abs(page.rect.width-595.276)<1 and abs(page.rect.height-841.89)<1
    for block in page.get_text('dict')['blocks']:
        if 'lines' not in block: continue
        for line in block['lines']:
            for span in line['spans']:
                x0,y0,x1,y1=span['bbox']
                assert x0>=18 and y0>=0 and x1<=page.rect.width-18 and y1<=page.rect.height-10, (i+1,span)
    for link in page.get_links():
        if link['kind']==fitz.LINK_GOTO: assert 0<=link['page']<25
    assert len(page.get_text().strip())>150, f'Blank page {i+1}'
    for _,fontref in reader.pages[i]['/Resources']['/Font'].items():
        font=fontref.get_object();name=str(font.get('/BaseFont',''))
        if 'OpenSans' in name:
            descriptor=font['/FontDescriptor'].get_object()
            assert '/FontFile2' in descriptor, f'Unembedded font {name}'
            fonts.add(name)
    page.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(QA/f'page-{i+1:02}.png')
assert len(fonts)>=3
links=doc[1].get_links()
assert len(links)==23
for expected, link in enumerate(links,start=3):
    # MuPDF reports ReportLab's direct page destinations as LINK_NAMED in
    # some versions; inspect the canonical PDF destination instead.
    annotation=reader.pages[1]['/Annots'][expected-3].get_object()
    destination=annotation['/Dest']
    assert destination[0].idnum==reader.pages[expected-1].indirect_reference.idnum
xml=ET.parse(ROOT/'documents/scope/system-diagrams.drawio')
assert len(xml.findall('diagram'))==6
for diagram in xml.findall('diagram'):
    cells=diagram.findall('.//mxCell');ids=[c.attrib['id'] for c in cells]
    assert len(ids)==len(set(ids))
    for cell in cells:
        if cell.get('edge')=='1':
            assert cell.get('source') in ids and cell.get('target') in ids
            assert cell.find('mxGeometry') is not None
for start in range(0,25,4):
    sheet=Image.new('RGB',(1440,2070),'#E4E0D9')
    draw=ImageDraw.Draw(sheet)
    for idx in range(start,min(start+4,25)):
        im=Image.open(QA/f'page-{idx+1:02}.png');im=ImageOps.contain(im,(700,990))
        slot=idx-start;x=10+(slot%2)*720;y=28+(slot//2)*1030
        draw.text((x,y-20),f'PAGE {idx+1:02}',fill='#303238')
        sheet.paste(im,(x,y))
    sheet.save(QA/f'review-{start//4+1:02}.png')
report={'pages':len(doc),'bookmarks':len(doc.get_toc()),'contents_links':len(links),'embedded_fonts':sorted(fonts),'requirements_checked':len(required),'editable_diagrams':6,'file_bytes':PDF.stat().st_size,'visual_review_sheets':7}
(QA/'verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
