"""Rebuild the client scope PDF and editable diagrams from repository-root assets."""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import math
import xml.etree.ElementTree as ET
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'WGJS-Connect-Scope-and-Requirements.pdf'
HERE = Path(__file__).resolve().parent
W, H = A4
M = 45
CW = W - 2*M
RED, DARK, GOLD = '#C6252B', '#861D23', '#FAB513'
INK, MUTED, PAPER, LINE = '#303238', '#62666D', '#FAF8F4', '#DEDAD3'
DATE = datetime.now(ZoneInfo('Africa/Johannesburg')).strftime('%d %B %Y')
for name, sub in [('Open','400Regular'),('OpenBold','700Bold'),('OpenSemi','600SemiBold')]:
    font = next((ROOT/'node_modules/@expo-google-fonts/open-sans'/sub).glob('*.ttf'))
    pdfmetrics.registerFont(TTFont(name, str(font)))
pdfmetrics.registerFontFamily('Open', normal='Open', bold='OpenBold', italic='Open', boldItalic='OpenBold')

STYLE = ParagraphStyle('body', fontName='Open', fontSize=10.1, leading=15.4, textColor=HexColor(INK), spaceAfter=0)
def para(c, text, x, top, width, size=10.1, color=INK, bold=False, leading=None):
    style = ParagraphStyle('p', parent=STYLE, fontName='OpenBold' if bold else 'Open', fontSize=size,
                           leading=leading or size*1.52, textColor=HexColor(color))
    p = Paragraph(text, style)
    _, height = p.wrap(width, H)
    if top+height > H-47:
        raise ValueError(f'Content overflows page {c.getPageNumber()}: {text[:80]}')
    p.drawOn(c, x, H-top-height)
    return top+height

def rect(c,x,top,w,h,fill=PAPER,stroke=None,r=10):
    c.setFillColor(HexColor(fill)); c.setStrokeColor(HexColor(stroke or fill))
    c.roundRect(x,H-top-h,w,h,r,fill=1,stroke=bool(stroke))

TITLES = [
 'Scope & requirements', 'Your guide to the scope', 'One connected school community',
 'Who uses the system', 'How the system fits together', 'The complete module landscape',
 'The parent mobile experience', 'Updates that reach the right families', 'From draft to acknowledgement',
 'Calendar and school events', 'Each learner, clearly connected', 'Classroom and pastoral operations',
 'Reports: review before release', 'Resources and school documents', 'School payments and receipts',
 'A payment is confirmed by evidence', 'Forms and parental consent', 'One excursion, one joined-up journey',
 'Conversations with the right team', 'From enquiry to resolution', 'People, settings and accountability',
 'Requirements behind every screen', 'From prototype to production', 'Acceptance and client decisions',
 'Basis, assumptions and document control']

def base(c,n,kicker,title,subtitle=''):
    c.setFillColor(HexColor(PAPER)); c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(HexColor(RED)); c.rect(0,H-6,W,6,fill=1,stroke=0)
    c.drawImage(str(ROOT/'public/logo.png'),M,H-60,34,34,preserveAspectRatio=True,mask='auto',anchor='c')
    para(c,'WYNBERG GIRLS JUNIOR CONNECT',M+45,29,CW-45,8.2,DARK,True)
    para(c,'Scope & requirements  /  Proposed for client review',M+45,43,CW-45,7.3,MUTED)
    c.setStrokeColor(HexColor(LINE)); c.line(M,44,W-M,44)
    c.setFont('Open',7); c.setFillColor(HexColor(MUTED)); c.drawString(M,25,'WGJS CONNECT   |   VERSION 1.0')
    c.setFont('OpenSemi',8); c.setFillColor(HexColor(DARK)); c.drawRightString(W-M,25,f'{n:02d} / 25')
    c.bookmarkPage(f'p{n}'); c.addOutlineEntry(title,f'p{n}',0,False)
    para(c,kicker.upper(),M,91,CW,8.5,RED,True)
    y=para(c,title,M,114,CW,25,DARK,True,30)+12
    if subtitle: y=para(c,subtitle,M,y,CW,10.6,MUTED)+23
    return y

def block(c,y,label,text):
    y=para(c,label,M,y,CW,12,DARK,True)+6
    return para(c,text,M,y,CW)+19

def bullets(c,y,items):
    for text in items:
        c.setFillColor(HexColor(GOLD)); c.circle(M+3,H-y-7,2.4,fill=1,stroke=0)
        y=para(c,text,M+15,y,CW-15)+9
    return y+6

def note(c,y,label,text):
    p=Paragraph(text,ParagraphStyle('note',parent=STYLE,fontSize=9.2,leading=14))
    _,h=p.wrap(CW-30,H)
    height=h+48
    if y+height>H-52: raise ValueError(f'Note overflow {c.getPageNumber()}')
    rect(c,M,y,CW,height,'#FFF1D2')
    para(c,label.upper(),M+15,y+11,CW-30,8, DARK,True)
    p.drawOn(c,M+15,H-y-32-h)
    return y+height+18

def table(c,y,headers,rows,widths):
    style=ParagraphStyle('cell',parent=STYLE,fontSize=9,leading=13)
    data=[[Paragraph(escape(v),ParagraphStyle('th',parent=style,fontName='OpenBold',textColor=white)) for v in headers]]
    data += [[Paragraph(v,style) for v in row] for row in rows]
    t=Table(data,colWidths=widths,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),HexColor(DARK)),('ROWBACKGROUNDS',(0,1),(-1,-1),[white,HexColor('#F1EEE8')]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),11),('RIGHTPADDING',(0,0),(-1,-1),11),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10),('LINEBELOW',(0,-1),(-1,-1),0.5,HexColor(LINE))]))
    _,h=t.wrap(CW,H)
    if y+h>H-52: raise ValueError(f'Table overflow {c.getPageNumber()}')
    t.drawOn(c,M,H-y-h)
    return y+h+20

def module(c,y,code,title,users,features,workflow,rule,acceptance):
    y=para(c,f'{code}   /   {title}',M,y,CW,14,DARK,True)+6
    y=para(c,users,M,y,CW,8.5,RED,True)+10
    for label,text in [('Features',features),('How it works',workflow),('Business rule',rule),('Acceptance',acceptance)]:
        y=para(c,f'<b>{label}.</b> {text}',M,y,CW)+9
    return y+14

# Nodes use a 500 x 330 shared coordinate space for PDF and Draw.io.
DIAGRAMS=[]
def diagram(c,y,name,nodes,edges,height=300):
    DIAGRAMS.append((name,nodes,edges))
    scale=min(CW/500,280/height)
    left=M+(CW-500*scale)/2
    def point(x,t): return left+x*scale,H-y-t*scale
    # Connectors behind nodes; waypoints preserve routing corridors.
    for source,target,side1,side2,via in edges:
        a=nodes[source]; b=nodes[target]
        def pin(n,s):
            x,t,w,h,_,_=n
            return {'b':(x+w/2,t+h),'t':(x+w/2,t),'r':(x+w,t+h/2),'l':(x,t+h/2)}[s]
        pts=[pin(a,side1)]+via+[pin(b,side2)]
        c.setStrokeColor(HexColor('#A28E77')); c.setLineWidth(1.3)
        p=c.beginPath(); p.moveTo(*point(*pts[0]))
        for q in pts[1:]: p.lineTo(*point(*q))
        c.drawPath(p)
        end=point(*pts[-1]); prev=point(*pts[-2]); angle=math.atan2(end[1]-prev[1],end[0]-prev[0])
        p=c.beginPath();p.moveTo(*end)
        for s in [-1,1]: p.lineTo(end[0]-7*math.cos(angle+s*.45),end[1]-7*math.sin(angle+s*.45))
        p.close();c.setFillColor(HexColor('#A28E77'));c.drawPath(p,fill=1,stroke=0)
    for x,t,w,h,text,tone in nodes:
        fill={'red':DARK,'gold':'#FFF1D2','white':'#FFFFFF'}[tone]
        rect(c,left+x*scale,y+t*scale,w*scale,h*scale,fill,LINE if tone!='red' else None,8)
        lines=text.split('|')
        ts=8.5
        # Center the combined text block in the node.
        style=ParagraphStyle('node',parent=STYLE,fontName='OpenSemi',fontSize=ts,leading=12.5,alignment=1,textColor=white if tone=='red' else HexColor(INK))
        p=Paragraph('<br/>'.join(escape(a) for a in lines),style);_,ph=p.wrap(w*scale-14,h*scale)
        if ph>h*scale-12: raise ValueError(f'Diagram label overflow {name}: {text}')
        p.drawOn(c,left+x*scale+7,H-y-(t+h/2)*scale-ph/2)
    return y+height*scale+22

def export_drawio():
    root=ET.Element('mxfile',host='drawio',version='26.0.0')
    for name,nodes,edges in DIAGRAMS:
        d=ET.SubElement(root,'diagram',name=name); model=ET.SubElement(d,'mxGraphModel',page='1',pageWidth='1000',pageHeight='700')
        r=ET.SubElement(model,'root');ET.SubElement(r,'mxCell',id='0');ET.SubElement(r,'mxCell',id='1',parent='0')
        for i,(x,y,w,h,text,tone) in enumerate(nodes):
            fill={'red':DARK,'gold':'#FFF1D2','white':'#FFFFFF'}[tone]
            cell=ET.SubElement(r,'mxCell',id=str(i+2),value=text.replace('|','\n'),vertex='1',parent='1',style=f'rounded=1;whiteSpace=wrap;html=1;fontFamily=Open Sans;fontSize=18;fillColor={fill};fontColor={"#FFFFFF" if tone=="red" else INK};strokeColor={LINE};')
            ET.SubElement(cell,'mxGeometry',x=str(x*2),y=str(y*2),width=str(w*2),height=str(h*2),attrib={'as':'geometry'})
        pins={'b':(0.5,1),'t':(0.5,0),'l':(0,0.5),'r':(1,0.5)}
        for j,(a,b,s1,s2,via) in enumerate(edges):
            ex,ey=pins[s1];ix,iy=pins[s2]
            cell=ET.SubElement(r,'mxCell',id=str(len(nodes)+2+j),parent='1',source=str(a+2),target=str(b+2),edge='1',style=f'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;exitX={ex};exitY={ey};entryX={ix};entryY={iy};strokeColor=#A28E77;')
            g=ET.SubElement(cell,'mxGeometry',relative='1',attrib={'as':'geometry'})
            if via:
                arr=ET.SubElement(g,'Array',attrib={'as':'points'})
                for x,y in via:ET.SubElement(arr,'mxPoint',x=str(2*x),y=str(2*y))
    ET.indent(root);ET.ElementTree(root).write(HERE/'system-diagrams.drawio',encoding='utf-8',xml_declaration=True)

def build():
    c=canvas.Canvas(str(OUT),pagesize=A4,pageCompression=1)
    c.setTitle('Wynberg Girls Junior Connect | Scope and Requirements')
    c.setAuthor('Wynberg Girls Junior Connect');c.setSubject('Proposed completed-system scope for client review')
    # 01 Cover
    c.setFillColor(HexColor(PAPER));c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(HexColor(DARK));c.rect(0,0,19,H,fill=1,stroke=0)
    c.setFillColor(HexColor(GOLD));c.rect(19,0,5,H,fill=1,stroke=0)
    c.bookmarkPage('p1');c.addOutlineEntry(TITLES[0],'p1')
    c.drawImage(str(ROOT/'public/logo.png'),M, H-204,112,140,preserveAspectRatio=True,mask='auto')
    para(c,'WYNBERG GIRLS JUNIOR SCHOOL',M,232,CW,10,DARK,True)
    para(c,'Honor Before Honours',M,254,CW,10,MUTED)
    para(c,'School life.\nConnected.'.replace('\n','<br/>'),M,310,CW,43,DARK,True,49)
    para(c,'Wynberg Girls Junior Connect',M,430,CW,18,DARK,True)
    para(c,'Scope & requirements',M,466,CW,26,RED,True)
    para(c,'A clear view of the completed parent mobile app,<br/>school web portal and the services that connect them.',M,519,CW,12,MUTED)
    rect(c,M,625,CW,104,'#FFFFFF',LINE)
    para(c,'VERSION 1.0  /  PROPOSED FOR CLIENT REVIEW',M+18,642,CW-36,9,RED,True)
    para(c,f'{DATE}<br/>Business functionality, system diagrams and delivery boundaries',M+18,665,CW-36,10,INK)
    para(c,'ANDROID  /  iOS  /  WEB',M,771,CW,8,DARK,True)
    c.showPage()
    # 02 Contents
    y=base(c,2,'Document map',TITLES[1],'A business view of what the system will do, who will use it, and what completion means.')
    groups=[('01  PURPOSE & SYSTEM DESIGN',[(3,'Business outcomes'),(4,'Users and proposed access'),(5,'System context diagram'),(6,'Module landscape diagram')]),('02  PARENT & SCHOOL WORKFLOWS',[(7,'Mobile experience'),(8,'Updates and publishing'),(9,'Message lifecycle diagram'),(10,'Calendar and events'),(11,'Learners and profiles'),(12,'Attendance, conduct and classes'),(13,'Reports and release'),(14,'Resources and documents'),(15,'Payments and receipts'),(16,'Payment lifecycle diagram'),(17,'Forms and consent'),(18,'Excursion journey diagram'),(19,'Departmental enquiries'),(20,'Enquiry workflow diagram')]),('03  OPERATIONS & DELIVERY',[(21,'People, settings and audit'),(22,'Cross-system requirements'),(23,'Delivery boundaries'),(24,'Acceptance and client decisions'),(25,'Basis and document control')])]
    for heading,items in groups:
        y=para(c,heading,M,y,CW,9,RED,True)+9
        for page,label in items:
            para(c,label,M,y,CW-40,9.3)
            c.setFont('OpenSemi',9);c.setFillColor(HexColor(DARK));c.drawRightString(W-M,H-y-10,str(page).zfill(2))
            c.linkRect('',f'p{page}',(M,H-y-16,W-M,H-y+1),relative=0,thickness=0)
            y+=18
        y+=13
    c.showPage()
    # 03 Vision
    y=base(c,3,'Purpose & outcomes',TITLES[2],'One place for school communication, family actions and learner information.')
    y=block(c,y,'The intended outcome','Families should know what is happening, what needs attention and where to find school information. School teams should publish once, direct information to the right audience, and follow up on responses through a shared operational workspace.')
    y=table(c,y,['For families','For the school'],[
      ('Relevant updates for linked children, with clear dates and next steps.','Audience-based communication, review workflows and traceable acknowledgement.'),
      ('School events, documents and learner records in one familiar interface.','A consistent place to manage events, resources, reports and learner operations.'),
      ('Consent, payment status and enquiries without fragmented conversations.','Response tracking, verified payment outcomes and departmental ownership.')],[CW/2,CW/2])
    y=block(c,y,'What “completed” means','The mobile app and web portal operate on persistent, authorised school data. A change made by an authorised staff member becomes available to eligible families; a family response becomes visible to the responsible school team. Actions remain recorded after refresh, sign-out and device changes.')
    note(c,y,'How to read this document','The following pages describe proposed production requirements. The current implementation is a frontend prototype with local mock data. “Prototype today” notes explain where the demonstration differs. This document is a review baseline, not evidence that production services are already connected.')
    c.showPage()
    # 04 Roles
    y=base(c,4,'Users & responsibilities',TITLES[3],'Proposed access model for school approval before production implementation.')
    y=table(c,y,['Role','Intended responsibilities'],[
      ('Parent / guardian','View linked learners and published information; acknowledge updates; submit consent; pay eligible charges; view receipts; manage own enquiries and preferences.'),
      ('Teacher','Work with assigned classes; draft targeted updates; record attendance and conduct; review learner information and reports within allocated responsibilities.'),
      ('Principal','Oversee communication and learner operations; review and approve publication/report release; inspect school-level information and relevant audit history.'),
      ('Finance','Review charges, payment status, receipts and reconciliation exceptions; respond to finance enquiries. No automatic access to confidential pastoral notes.'),
      ('Administrator','Maintain approved accounts, learner links, classes, departments and settings; operate invitations and school information; inspect relevant audit history.')],[110,CW-110])
    y=block(c,y,'Access follows responsibility','The backend must enforce each role, assigned class and guardian-to-learner relationship on every read and write. Hiding a menu item is insufficient. Staff with multiple responsibilities receive explicit permissions rather than unrestricted access by default.')
    note(c,y,'Prototype today','The web demo has five fictional profiles and basic parent/staff visibility. It does not provide production authentication or granular staff permissions. Mobile currently opens a fictional parent experience; mobile staff workflows are outside this core scope.')
    c.showPage()
    # 05 Context diagram
    y=base(c,5,'Diagram 01 / System context',TITLES[4],'Target architecture: two client experiences, one authorised source of school information.')
    nodes=[(0,0,220,50,'Parents & guardians|Android / iOS / parent web','gold'),(280,0,220,50,'School staff|Role-based web portal','gold'),(0,90,220,60,'Parent experience|Updates, learners, actions','white'),(280,90,220,60,'School workspace|Publish, manage, follow up','white'),(95,190,310,64,'Shared school services|Identity, access, data & audit','red'),(0,300,145,56,'Secure files|Reports & documents','white'),(177,300,146,56,'Payment provider|Verified confirmations','white'),(355,300,145,56,'Notification services|Push / email delivery','white')]
    edges=[(0,2,'b','t',[]),(1,3,'b','t',[]),(2,4,'b','t',[(110,173),(250,173)]),(3,4,'b','r',[(390,170),(435,170),(435,222)]),(4,5,'l','t',[(72.5,222)]),(4,6,'b','t',[]),(4,7,'r','t',[(427.5,222)])]
    y=diagram(c,y,'System context',nodes,edges,356)
    y=block(c,y,'Information moves through authorised services','Clients request data through shared domain contracts and backend adapters. The production backend is responsible for validation, permissions, persistent records and external service integration. Sensitive records and payment secrets stay outside client bundles.')
    note(c,y,'Architecture direction','Convex is the prepared backend direction, with an empty scaffold today. Identity, payment and notification providers still require selection and configuration. Web and mobile currently have independent in-memory state; this diagram describes the completed system.')
    c.showPage()
    # 06 Modules diagram
    y=base(c,6,'Diagram 02 / Functional landscape',TITLES[5],'Shared information connects a focused family app with the school’s operational workspace.')
    nodes=[(0,0,220,45,'FAMILY EXPERIENCE','red'),(280,0,220,45,'SCHOOL OPERATIONS','red'),(0,80,220,60,'Stay informed|Updates, calendar, resources','white'),(280,80,220,60,'Communicate|Messages, events, documents','white'),(0,175,220,60,'Follow each learner|Profiles, reports, records','white'),(280,175,220,60,'Manage learners|Classes, attendance, conduct','white'),(0,270,220,60,'Take action|Consent, payments, enquiries','gold'),(280,270,220,60,'Track outcomes|Responses, finance, enquiries','gold')]
    edges=[(0,2,'b','t',[]),(1,3,'b','t',[]),(2,4,'b','t',[]),(3,5,'b','t',[]),(4,6,'b','t',[]),(5,7,'b','t',[]),(3,2,'l','r',[]),(5,4,'l','r',[]),(6,7,'r','l',[])]
    y=diagram(c,y,'Module landscape',nodes,edges,330)
    y=block(c,y,'School-wide foundations','People and invitations establish accounts and learner links. School settings define approved identity, contacts and module availability. Audit records retain important changes. Authentication and permissions apply across every module.')
    y=block(c,y,'Platform responsibilities','The parent mobile app prioritises quick reading, learner context and family actions. The responsive web portal supports parents and school staff. Mobile uses five primary tabs; staff administration stays in the web workspace.')
    note(c,y,'Reading the connections','Horizontal arrows show information published to families or actions returned to school teams. Vertical arrows group related capabilities; they are not a mandatory sequence of screens.')
    c.showPage()
    # 07 Mobile
    y=base(c,7,'Mobile / Navigation & home',TITLES[6],'An Android and iOS app designed for short, useful visits throughout the school day.')
    y=table(c,y,['Primary tab','Required functionality'],[
      ('Home','Child selector, unread updates, upcoming events, forms awaiting response, outstanding activity amounts and direct action links.'),('Updates','Published school feed, search, categories, detail, attachments, read state and acknowledgement.'),('Calendar','Month and agenda views, relevant dates, event details and related actions.'),('Children','Linked learners, class and teacher details, released reports, attendance, conduct and timetable.'),('More','Payments, forms and consent, resources, contact school, profile and external uniform-store access.')],[91,CW-91])
    y=block(c,y,'MOB-01 / Family context','Choose all linked children or one learner. Relevant notices, events, resources, forms and activity balances must follow that selection. Counters must use the same saved records as their destination modules. A completed action updates the dashboard without manual correction.')
    y=block(c,y,'MOB-02 / Usability and continuity','Retain context while moving between tabs and details. Support readable type, clear status labels, safe areas, keyboard-aware forms and accessible touch targets of at least 44 points. Show useful loading, empty, failure and retry states. Respect reduced-motion preferences.')
    note(c,y,'Acceptance','A parent selects one learner, opens an outstanding form, submits it and returns Home: the correct count changes. Unrelated learner records remain inaccessible. Reloading or using another authorised device preserves the production response.')
    c.showPage()
    # 08 Updates
    y=base(c,8,'Communication / Features',TITLES[7],'A controlled publishing process and a parent feed built around relevance.')
    y=module(c,y,'COM-01','Parent updates','PARENT MOBILE + WEB','Search published notices; filter by category and learner; open full text and attachments; see urgent indicators; mark read on opening and explicitly acknowledge when required.','A parent opens an eligible notice, reads its information, then follows a consent or event action when present.','Draft, review and scheduled content is not parent-visible. Read and acknowledgement are different records; each belongs to the recipient.','An eligible family sees a newly published notice; an unrelated family cannot retrieve it by direct link. Acknowledgement remains saved.')
    y=module(c,y,'COM-02','Compose, review and publish','AUTHORISED SCHOOL STAFF / WEB','Create and edit title, body, category, audience, urgency and attachments; preview; save draft; request review; approve publication now or schedule it.','An author prepares content, the authorised reviewer checks it, and publication makes it available to the selected audience.','Production scheduling must run on the server in the school timezone. Custom group editing and rich-media composition are future options.','Scheduled content remains private until its release time. A failed release is visible to responsible staff and can be retried safely.')
    note(c,y,'Prototype today','The web preview supports local drafts, review/publication states and scheduling controls. It has no persistent scheduler or real delivery service. Displayed delivery totals are samples.')
    c.showPage()
    # 09 Message workflow
    y=base(c,9,'Diagram 03 / Message lifecycle',TITLES[8],'Publishing, delivery, reading and acknowledgement are distinct events.')
    nodes=[(0,0,145,54,'1. Draft|Author prepares notice','white'),(177,0,146,54,'2. Review|Authorised approval','gold'),(355,0,145,54,'3. Release|Now or scheduled','white'),(355,105,145,60,'4. Publish|Eligible audience only','red'),(177,105,146,60,'5. Notify|Provider accepts job','white'),(0,105,145,60,'6. Open|Recipient read record','white'),(0,220,220,60,'7. Acknowledge|Explicit recipient response','gold'),(280,220,220,60,'8. Staff follow-up|Delivery & response history','white')]
    edges=[(0,1,'r','l',[]),(1,2,'r','l',[]),(2,3,'b','t',[]),(3,4,'l','r',[]),(4,5,'l','r',[]),(5,6,'b','t',[(72.5,192),(110,192)]),(6,7,'r','l',[])]
    y=diagram(c,y,'Message lifecycle',nodes,edges,280)
    y=block(c,y,'COM-03 / Delivery reporting','Staff must be able to distinguish a notice being published, a notification being accepted by a provider, a provider-reported delivery outcome where available, a recipient opening the notice, and an explicit acknowledgement. Provider acceptance must never be labelled as proof of reading.')
    y=block(c,y,'Follow-up without guesswork','The staff view identifies response gaps for the selected audience. Failed notification attempts need a visible outcome and controlled retry. Notification failure does not remove a notice from the eligible family’s in-app feed.')
    note(c,y,'Acceptance','Publish one notice to a class, open it as an eligible parent, and acknowledge it. Staff see the separate read and acknowledgement records. Another recipient remains unread until that recipient acts; sample aggregate counts are replaced by actual records.')
    c.showPage()
    # 10 Calendar
    y=base(c,10,'Planning / Calendar',TITLES[9],'Give families the date, place and actions they need before an event.')
    y=module(c,y,'CAL-01','Family calendar','PARENT MOBILE + WEB','Browse month and agenda views; select dates; filter relevant events by learner; open event time, venue, category and audience; follow related consent or payment links.','A parent finds an upcoming activity, checks the practical information and opens any linked family action. The web calendar also provides an event calendar-file download.','Use Africa/Johannesburg for display and scheduling. A calendar-file download is an export, not a two-way personal-calendar synchronisation.','An event appears on the correct date in both views. Related actions open the right learner’s records; empty days show a helpful state.')
    y=module(c,y,'CAL-02','School event management','AUTHORISED SCHOOL STAFF / WEB','Create and maintain event title, date, start/end time, location, category and audience. Associate relevant information and actions where needed.','Staff prepare the event, verify its details and publish it to eligible families. Saved changes become visible in the shared calendar.','Consent and payment are separate tracked actions. Attending an event must not automatically imply consent or successful payment.','An authorised edit persists and appears in the family view. Ineligible families cannot retrieve a restricted event.')
    note(c,y,'Prototype today','Calendar demonstrations use fixed sample dates. Live event persistence, cross-client updates and production authorisation still require the backend.')
    c.showPage()
    # 11 Children
    y=base(c,11,'Learners / Family view',TITLES[10],'A parent sees the school information for the learners linked to their account.')
    y=module(c,y,'LRN-01','Learner profiles and records','PARENT MOBILE + WEB','View learner identity, grade, class and teacher; open released reports; review attendance, published conduct information and timetable.','Choose Children, open a linked learner and select the relevant record area. Contact the school through an enquiry when information needs correction.','Parents have read-only school records. Unreleased reports and staff-private notes remain hidden, including through direct URLs and file links.','A guardian can retrieve only authorised learners. Switching learner changes the displayed records without exposing another family’s information.')
    y=block(c,y,'LRN-02 / Timetable and school context','Present the school-maintained timetable in a readable learner view. Class and teacher information should reflect the current school allocation. Timetable population and ongoing school maintenance must be agreed during data setup; automatic timetable generation is outside this scope.')
    y=block(c,y,'LRN-03 / Reliable relationships','The school establishes and maintains guardian-to-learner links. Access changes when a link or account is revoked. No learner association may be created simply by a parent changing a screen selection or entering an identifier.')
    note(c,y,'Prototype today','Profiles, attendance summaries, timetable entries and report previews are fictional or sample records. The production system needs approved school data and relationship-based access controls.')
    c.showPage()
    # 12 Staff records
    y=base(c,12,'Learners / School operations',TITLES[11],'Staff record information within their assigned school responsibilities.')
    y=block(c,y,'CLS-01 / Groups and assigned classes','Show school-managed classes, grade audiences and activity groups, with assigned staff and eligible recipients. Start a targeted message from the relevant group. Keep membership and authoring permissions consistent with school-managed learner allocations. Custom self-service audience-group editing is a future option.')
    y=block(c,y,'ATT-01 / Attendance registers','Teachers open the assigned class and date, record present/absent status and save the register. Store the learner, date, author and change history. Authorised corrections update the record; relevant parent attendance views reflect saved information. Absence reasons and publication rules must follow the approved school process.')
    y=block(c,y,'CON-01 / Conduct and recognition','Authorised staff record merits, achievements and pastoral/conduct entries against the correct learner. Store the entry type, description, author and date. Publish only information approved for parent access; staff-private pastoral information must remain separately restricted.')
    y=table(c,y,['Acceptance check','Expected result'],[
      ('Assigned class','A teacher can save the allocated register and cannot alter another teacher’s restricted class.'),('Persistent records','Saved attendance and conduct survive reload and appear only in authorised views.'),('Visibility','A parent sees published information for a linked learner; confidential notes are not returned by the service.')],[140,CW-140])
    note(c,y,'Prototype today','Class cards, attendance toggles and conduct entries are interactive mock workflows. Production class permissions, dated record storage and confidential-note controls are proposed requirements.')
    c.showPage()
    # 13 Reports
    y=base(c,13,'Learners / Academic reports',TITLES[12],'School staff control when a report becomes available to a family.')
    y=module(c,y,'RPT-01','Report preparation and release','AUTHORISED SCHOOL STAFF / WEB','Add an already prepared report document; associate it with learner, year and term; review the document and metadata; release it through an authorised action.','Staff check the learner association and report content before release. The release creates a parent-visible record and a traceable school action.','Draft report files remain private. Automated mark capture, grading, report generation, bulk import and PDF data parsing are not included in the core scope.','A draft is inaccessible to the parent. After release, the correct guardian can view the correct document; an unrelated guardian cannot access its file URL.')
    y=module(c,y,'RPT-02','Family report access','PARENT MOBILE + WEB','Browse available reports by learner and term; open a readable document preview; obtain a permitted download where supported.','The family opens Children, selects a learner and views a published report. If nothing is released, the app shows a clear waiting state.','Report retrieval must apply the same guardian permissions as the learner profile. A notification never substitutes for access control.','A released report is readable on a phone and in the web portal, while unreleased reports remain hidden across both clients.')
    note(c,y,'Prototype today','Current report review and release use mock state and sample previews. Actual document storage, PDF rendering and release audit records are production work.')
    c.showPage()
    # 14 Resources
    y=base(c,14,'Information / Documents',TITLES[13],'A consistent place for newsletters, school policies and useful learning information.')
    y=module(c,y,'RES-01','Resource library','PARENT MOBILE + WEB','Search titles, browse categories, view document type and size, open a real document preview, and download permitted files. Relevant resources respect learner/audience context.','A family searches or selects a category, opens a document and returns to the library with its context retained.','Unavailable files produce a useful error and retry path. File permission must be checked independently of the visible resource listing.','An eligible parent finds and reads a published document. A restricted document cannot be opened by guessing its address.')
    y=module(c,y,'RES-02','Resource publication','AUTHORISED SCHOOL STAFF / WEB','Upload approved files, set a clear title and category, assign the intended audience and publish. Maintain the current document and its metadata.','The school team checks the file and audience before publication. The backend stores the file and serves an authorised preview/download.','Set supported types and size limits during storage integration. Scan or validate uploads according to the selected file service. Gallery/video publishing and rich-media blocks are future options.','The file, title, category and audience remain saved. Failed uploads do not create a resource that appears ready to read.')
    note(c,y,'Prototype today','Current previews are samples; no real PDF document service or file-upload storage is connected. The external uniform-store link opens an independent website; there is no native shop or integrated order tracking.')
    c.showPage()
    # 15 Payments
    y=base(c,15,'Finance / Family and school views',TITLES[14],'Clear charges for families and verified outcomes for the finance team.')
    y=module(c,y,'PAY-01','Charge details and checkout','PARENT MOBILE + WEB','View learner/family charge descriptions, due dates, ZAR amounts, outstanding status and payment history. Open hosted checkout, return to the app, and view pending, paid or failed status.','The parent selects an eligible charge and uses the chosen provider’s secure checkout. The backend confirms the result before the balance changes.','Card details are handled by the payment provider. Checkout return alone cannot mark a charge Paid. Pending and failed amounts remain outstanding.','A cancelled or failed checkout retains the due amount and offers a safe retry. A verified success produces one recorded payment and receipt.')
    y=module(c,y,'PAY-02','Finance oversight','AUTHORISED FINANCE STAFF / WEB','Review charges, payment status, receipt references and reconciliation exceptions. Follow up unmatched or failed confirmations using controlled finance actions.','The finance view identifies pending confirmations or mismatches. Authorised staff resolve exceptions with evidence and recorded reasons.','Core scope is charge/payment tracking, not full accounting, payroll or a general ledger. Charge loading and reconciliation inputs depend on the agreed school finance process.','A duplicate provider notification does not duplicate a payment or receipt. Families cannot manually change their charge to Paid.')
    note(c,y,'Prototype today','Checkout, verification, failures and receipts are simulated. No money is processed. Production payments require a selected provider, merchant setup and verified server callbacks.')
    c.showPage()
    # 16 Payment diagram
    y=base(c,16,'Diagram 04 / Payment lifecycle',TITLES[15],'The payment service, rather than the browser return, establishes the final result.')
    nodes=[(0,0,145,54,'1. Due charge|Parent selects item','white'),(177,0,146,54,'2. Secure checkout|Payment provider','white'),(355,0,145,54,'3. Return to app|Pending verification','gold'),(177,112,146,65,'4. Backend verifies|Reference & amount','red'),(0,237,145,60,'5A. Paid|Receipt available','white'),(177,237,146,60,'5B. Failed|Amount remains due','white'),(355,237,145,60,'5C. Still pending|Finance follow-up','gold')]
    edges=[(0,1,'r','l',[]),(1,2,'r','l',[]),(2,3,'b','t',[(427.5,82),(290,82),(290,95),(250,95)]),(1,3,'b','t',[]),(3,4,'l','t',[(72.5,144.5)]),(3,5,'b','t',[]),(3,6,'r','t',[(427.5,144.5)])]
    y=diagram(c,y,'Payment lifecycle',nodes,edges,297)
    y=block(c,y,'PAY-03 / Confirmation and receipt integrity','Validate provider callbacks on the server, match the charge and amount, and process repeated notifications safely. Store a provider reference and payment record. Issue a receipt only after verified success. Never infer success from an app screen or a parent-supplied status.')
    y=block(c,y,'PAY-04 / Interruption and recovery','Closing checkout or leaving the payment screen must not lose the transaction’s server record. Returning later shows the latest confirmed state. A retry must avoid a second charge while a previous attempt is still being resolved.')
    note(c,y,'Acceptance','Exercise success, failure, cancellation, delayed confirmation and duplicate callback cases. Check the parent balance, finance exception view and receipt record agree. Provider-specific refunds and accounting integration require separate scope agreement.')
    c.showPage()
    # 17 Consent
    y=base(c,17,'Family actions / Forms',TITLES[16],'Permission is recorded for the correct learner and visible to the responsible school team.')
    y=module(c,y,'FRM-01','Excursion consent','PARENT MOBILE + WEB','Read the activity details, deadline and permission wording; confirm consent; provide an emergency contact number; submit and review the saved response.','An eligible guardian opens the form from a notice, event or Forms. The service validates the response, saves it and updates the family’s outstanding actions.','Require explicit permission and a valid emergency contact. The current minimum is ten digits; final country-format rules follow school-approved contact requirements. Do not silently submit a partially completed form.','Missing permission or contact information produces a clear validation message. A valid submission persists and is associated with the correct guardian, learner and activity.')
    y=module(c,y,'FRM-02','Response tracking','AUTHORISED SCHOOL STAFF / WEB','View eligible learners, response status and submitted permission details. Identify families still requiring follow-up.','Staff review the activity’s response list before the event and use the communication/enquiry process for outstanding cases.','Store response wording/version, responder and timestamp for traceability. Consent and payment remain separate records. This is not a general-purpose form builder or qualified electronic-signature service.','One learner’s response does not complete another learner’s form. A successful payment does not automatically grant consent.')
    note(c,y,'Prototype today','The mobile form validates permission and emergency-contact length, but saves only local demo state. Durable consent evidence, deadlines and school access require production services.')
    c.showPage()
    # 18 Excursion diagram
    y=base(c,18,'Diagram 05 / Connected journey',TITLES[17],'A practical example of modules working together without losing their separate responsibilities.')
    nodes=[(0,0,220,52,'1. School prepares activity|Event, audience, charge & form','red'),(280,0,220,52,'2. School publishes notice|Eligible families are informed','white'),(280,105,220,55,'3. Parent opens activity|Correct learner context','gold'),(0,210,220,60,'4A. Submit consent|Permission & emergency contact','white'),(280,210,220,60,'4B. Complete payment|Server-verified outcome','white'),(130,320,240,56,'5. School checks readiness|Consent status + payment status','red')]
    edges=[(0,1,'r','l',[]),(1,2,'b','t',[]),(2,3,'l','t',[(250,132.5),(250,185),(110,185)]),(2,4,'b','t',[]),(3,5,'b','l',[(110,348)]),(4,5,'b','r',[(390,348)])]
    y=diagram(c,y,'Excursion journey',nodes,edges,376)
    y=block(c,y,'Shared activity, separate records','The notice links families to the same activity, learner, form and charge. A parent may complete the form before payment or payment before the form. Staff readiness views must show each result accurately; neither action completes the other.')
    note(c,y,'Acceptance','Run the journey with two linked learners, one eligible for the activity. Submit consent and verify a payment. Check that the eligible learner’s actions update across clients, while the other learner’s records and counters remain unchanged.')
    c.showPage()
    # 19 Enquiries
    y=base(c,19,'Communication / Two-way contact',TITLES[18],'Keep a school conversation together from the first question to its resolution.')
    y=module(c,y,'ENQ-01','Family enquiries','PARENT MOBILE + WEB','Create an enquiry with department, subject and message; browse own threads; read staff replies; send a follow-up and view status.','The parent chooses the responsible department and submits a message. Replies remain in the same thread, with clear authors and timestamps.','Subject/message validation prevents empty enquiries and replies. A family can access only its authorised conversations. This module is not an emergency-response service.','A valid enquiry persists in the family view and the right school inbox. A reply appears in the same thread without exposing another family’s conversation.')
    y=module(c,y,'ENQ-02','School inbox and ownership','AUTHORISED SCHOOL STAFF / WEB','Search/filter enquiries by status; open a thread; assign responsibility; reply and mark resolved.','The department receives the enquiry, a responsible staff member is assigned, and the school responds until the matter is resolved.','Open, Assigned and Resolved states must reflect saved actions. Department access and assignment rules follow the school’s approved responsibilities. No response-time guarantee is implied.','An assignment is visible to authorised staff. Parent and staff views show the same replies and status after reload.')
    note(c,y,'Prototype today','Threads and replies are local demonstrations and are not delivered to school staff. Production inbox routing, notifications and durable conversation history still need integration.')
    c.showPage()
    # 20 Enquiry diagram
    y=base(c,20,'Diagram 06 / Enquiry workflow',TITLES[19],'Parents and staff share one conversation, with clear departmental ownership.')
    nodes=[(0,0,220,55,'1. Parent submits|Department, subject & message','white'),(280,0,220,55,'2. Department receives|Status: Open','gold'),(280,115,220,60,'3. School assigns owner|Status: Assigned','white'),(0,115,220,60,'4. Staff replies|Saved in shared thread','red'),(0,230,220,60,'5. Parent reads / replies|Conversation continues','white'),(280,230,220,60,'6. School resolves|Status: Resolved','gold')]
    edges=[(0,1,'r','l',[]),(1,2,'b','t',[]),(2,3,'l','r',[]),(3,4,'b','t',[]),(4,5,'r','l',[])]
    y=diagram(c,y,'Enquiry workflow',nodes,edges,290)
    y=block(c,y,'ENQ-03 / Conversation continuity','Each reply belongs to the original enquiry. Replies identify the author and time, and follow the same access controls as the thread. Staff can continue the conversation before resolution; the diagram shows the main hand-off rather than limiting the thread to one exchange.')
    y=block(c,y,'Notifications support the thread','Where enabled and permitted, notify the relevant recipient of a new message. The saved in-app conversation remains the record of the enquiry. A push or email delivery failure must not erase or duplicate the reply.')
    note(c,y,'Acceptance','Submit to a department, assign an owner, exchange replies and resolve the enquiry. Confirm the family cannot assign staff or resolve school-owned status through an unauthorised request, and another department cannot see restricted threads.')
    c.showPage()
    # 21 Admin
    y=base(c,21,'School administration',TITLES[20],'Operational controls keep the school’s people, identity and records coherent.')
    y=block(c,y,'ADM-01 / People and invitations','Maintain approved parent/staff accounts, assigned roles and learner relationships. Send a real invitation through the selected identity/email service; show pending and accepted status. Permit authorised revocation and access changes. Bulk CSV import and automatic synchronisation with an existing school system are future options, not assumed integrations.')
    y=block(c,y,'ADM-02 / School settings','Maintain approved school identity, contact details, departments and supported module availability. Preserve school naming, supplied crest, Open Sans and red/gold identity. A setting must persist and affect supported behaviour; preview-only switches must not imply that an unimplemented module is delivered.')
    y=block(c,y,'ADM-03 / Audit history','Capture important backend actions such as publication, report release, consent submission, payment confirmation and permission changes. Record the acting identity, timestamp, action and affected record. Restrict audit access and prevent ordinary clients from altering recorded history.')
    y=block(c,y,'PRF-01 / Profile and preferences','Let users view their account identity, linked children, notification preferences and sign out. Handle session expiry clearly. Production account corrections must use an authorised identity workflow; unrestricted edits to roles or learner relationships are not permitted.')
    note(c,y,'Acceptance and current status','Invite and revoke a test account, change an approved setting and inspect recorded actions. Access and settings must persist. Current invitations, settings and audit rows are previews; the mobile notification toggle saves a local preference only.')
    c.showPage()
    # 22 Non-functional
    y=base(c,22,'Production foundations',TITLES[21],'These requirements apply across modules, even when they are not visible as separate screens.')
    y=table(c,y,['Area','Required outcome'],[
      ('SEC / Identity & privacy','Authenticate users, enforce roles and learner links server-side, secure sessions and file access, and protect secrets. School approval is required for data access and retention policies.'),
      ('DAT / Shared records','Persist records in a shared backend; validate writes; prevent duplicate submissions; keep web/mobile views consistent. Distinguish confirmed data from pending requests.'),
      ('NOT / Notifications','Connect push and invitation/transactional email where required; request device permission; store preferences and delivery outcomes. Open links into authorised module details. No SMS service is assumed.'),
      ('UX / Accessibility','Provide readable text and contrast, labelled controls, keyboard access on web, accessible touch targets and useful loading/error states. Respect reduced-motion settings.'),
      ('REL / Recovery','Handle network loss and failed requests without false success. Online completion is required for writes; background offline editing and automatic queued sync are excluded.'),
      ('OPS / Operations','Separate test and live environments; monitor service errors and failed integrations; define backup/restore, retention and support ownership before launch. Agree performance targets against expected school usage.')],[107,CW-107])
    note(c,y,'Privacy and release readiness','The scope requires school-approved handling of learner and family information. It does not claim certified security, legal compliance or a completed privacy assessment. Device testing, permission review and operational readiness checks are required before production use.')
    c.showPage()
    # 23 Delivery
    y=base(c,23,'Delivery boundaries',TITLES[22],'The existing frontend is a foundation for the completed service, with clear integration work remaining.')
    y=table(c,y,['Stage','Completion outcome'],[
      ('1 / Confirm baseline','Approve modules, roles, contacts, learner data sources, consent wording, report ownership and finance process. Select identity, payment, storage and notification services.'),
      ('2 / Connect services','Implement persistent backend records, authorisation, real files, scheduling, notifications, invitation delivery and verified payments behind shared domain adapters.'),
      ('3 / Validate journeys','Exercise parent/staff workflows across web, Android and iOS with approved test data. Check privacy, recovery, duplicates and cross-client consistency.'),
      ('4 / Prepare release','Complete school acceptance, support and recovery preparation, merchant activation, native signing and store-submission work. Go live only after release approval.')],[120,CW-120])
    y=block(c,y,'Included production completion','Persistent versions of the documented core modules; secure family/staff access; shared web/mobile information; real document retrieval; controlled publication and report release; consent evidence; departmental conversations; verified payment status; operational records and audit history.')
    y=block(c,y,'Future options requiring separate agreement','Full accounting; native clothing shop and order tracking; elections; AI assistant; custom modules; rich-text/gallery/video blocks; self-service custom audience editing; bulk CSV/import parsing; automated report generation; existing-system synchronisation; two-way personal-calendar sync; refunds and additional payment methods beyond the chosen integration.')
    note(c,y,'Commercial boundary','No price, delivery date, hosting budget, provider contract or app-store approval is implied by this scope. These follow the approved scope and selected integrations. Existing web hosting does not provision the backend or publish native apps.')
    c.showPage()
    # 24 Acceptance
    y=base(c,24,'Review & acceptance',TITLES[23],'Use observable outcomes to decide whether the agreed system is ready.')
    y=table(c,y,['Acceptance scenario','Evidence of completion'],[
      ('AC-01 / Correct access','Parent cannot read another family’s learners, reports or threads. Teacher cannot modify an unassigned restricted class. Revoked access is enforced by services.'),
      ('AC-02 / Communicate','A reviewed/scheduled notice reaches the right feed; read and acknowledgement are distinct recipient records visible to staff.'),
      ('AC-03 / Family actions','Consent validation works; the saved response updates staff and parent views; payment pending/failure never clears a balance; verified success issues one receipt.'),
      ('AC-04 / School records','Attendance/conduct saves persist; private notes stay private; released reports and permitted resources open on web and phone.'),
      ('AC-05 / Conversations','Enquiry routing, assignment, replies and resolution remain consistent for authorised participants across devices.'),
      ('AC-06 / Resilience & release','Invalid inputs, interrupted requests, duplicate callbacks, expired sessions and notification failures behave clearly. Physical Android/iOS and responsive-web journeys are reviewed.')],[139,CW-139])
    y=block(c,y,'Client decisions needed before build completion','Confirm the role matrix and publication authority; guardian linking and data ownership; school contacts and departments; consent wording; report release responsibility; fee/charge source and merchant provider; notification channels; retention rules; supported devices and support ownership.')
    note(c,y,'Approval record','This version is proposed for review. Scope acceptance, any exclusions, commercial terms and release approval must be recorded separately by the authorised school representative and delivery team. No approval is assumed.')
    c.showPage()
    # 25 Basis
    y=base(c,25,'Document control & basis',TITLES[24],'Prepared from the actual frontend modules and repository contracts.')
    y=table(c,y,['Control','Value'],[('Product','Wynberg Girls Junior Connect'),('School / phone label','Wynberg Girls Junior School / WGJS Connect'),('Version / status',f'1.0 / Proposed for client review / {DATE}'),('Coverage','Completed-system core scope, parent mobile app and parent/staff web portal'),('Presentation','Static A4 PDF with six system/workflow diagrams; no animated companion')],[129,CW-129])
    y=block(c,y,'Repository evidence','Reviewed: <b>FRONTEND.md</b> and <b>README.md</b>; web modules in <b>src/features/school/</b>; mobile modules in <b>apps/expo/src/features/school/</b>; shared types in <b>packages/school-core/src/index.ts</b>; and <b>packages/backend/AGENTS.md</b>. The roadmap is a planning aid, not proof of delivery.')
    y=block(c,y,'Assumptions','One school, English-language presentation, ZAR currency and Africa/Johannesburg timezone. Parents may have multiple linked learners. Mobile staff administration, offline write queues and unlisted integrations are excluded. Real school records, contacts, files and approved policies must replace demonstration content.')
    y=block(c,y,'Brand and source treatment','The supplied crest, colours and naming follow repository branding guidance. Prior d6 research informed module organisation; no equivalence, affiliation or parity is claimed. External websites were not re-verified for this document.')
    note(c,y,'Maintaining the scope','Reproducible source and editable diagrams: documents/scope/. Keep requirements, acceptance and boundaries aligned through agreed revisions. Creating this document does not change application behaviour.')
    c.showPage()
    c.save();export_drawio()
    print(f'Created {OUT} ({OUT.stat().st_size:,} bytes); six editable diagrams.')

if __name__=='__main__':build()
