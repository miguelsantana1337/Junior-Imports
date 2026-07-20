from __future__ import annotations

from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "relatorio-evolucao-junior-imports-lotes-1-a-6.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

PAGE_W, PAGE_H = A4
NAVY = colors.HexColor("#0A1424")
NAVY_2 = colors.HexColor("#101F35")
INK = colors.HexColor("#17253A")
MUTED = colors.HexColor("#617087")
BLUE = colors.HexColor("#277DFF")
BLUE_DARK = colors.HexColor("#145DC4")
BLUE_SOFT = colors.HexColor("#EAF3FF")
CYAN = colors.HexColor("#65C8FF")
GREEN = colors.HexColor("#189A68")
GREEN_SOFT = colors.HexColor("#EAF8F2")
AMBER = colors.HexColor("#B87813")
AMBER_SOFT = colors.HexColor("#FFF5DF")
RED = colors.HexColor("#CE4057")
RED_SOFT = colors.HexColor("#FFF0F2")
LINE = colors.HexColor("#DCE5F0")
PANEL = colors.HexColor("#F6F9FC")
WHITE = colors.white


def register_fonts() -> None:
    regular = "/System/Library/Fonts/Supplemental/Arial.ttf"
    bold = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
    italic = "/System/Library/Fonts/Supplemental/Arial Italic.ttf"
    bold_italic = "/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf"
    pdfmetrics.registerFont(TTFont("ClientSans", regular))
    pdfmetrics.registerFont(TTFont("ClientSans-Bold", bold))
    pdfmetrics.registerFont(TTFont("ClientSans-Italic", italic))
    pdfmetrics.registerFont(TTFont("ClientSans-BoldItalic", bold_italic))
    pdfmetrics.registerFontFamily(
        "ClientSans",
        normal="ClientSans",
        bold="ClientSans-Bold",
        italic="ClientSans-Italic",
        boldItalic="ClientSans-BoldItalic",
    )


register_fonts()
base = getSampleStyleSheet()
styles = {
    "cover_label": ParagraphStyle(
        "cover_label", fontName="ClientSans-Bold", fontSize=8.5, leading=11,
        textColor=CYAN, spaceAfter=8, tracking=1.4,
    ),
    "cover_title": ParagraphStyle(
        "cover_title", fontName="ClientSans-Bold", fontSize=32, leading=35,
        textColor=WHITE, spaceAfter=12,
    ),
    "cover_sub": ParagraphStyle(
        "cover_sub", fontName="ClientSans", fontSize=12, leading=18,
        textColor=colors.HexColor("#C6D5E8"), spaceAfter=18,
    ),
    "cover_note": ParagraphStyle(
        "cover_note", fontName="ClientSans", fontSize=8.5, leading=12,
        textColor=colors.HexColor("#AEC1D9"),
    ),
    "eyebrow": ParagraphStyle(
        "eyebrow", fontName="ClientSans-Bold", fontSize=7.5, leading=10,
        textColor=BLUE_DARK, spaceAfter=5, tracking=1.1,
    ),
    "h1": ParagraphStyle(
        "h1", fontName="ClientSans-Bold", fontSize=23, leading=27,
        textColor=INK, spaceAfter=9,
    ),
    "h2": ParagraphStyle(
        "h2", fontName="ClientSans-Bold", fontSize=15, leading=19,
        textColor=INK, spaceBefore=5, spaceAfter=7,
    ),
    "h3": ParagraphStyle(
        "h3", fontName="ClientSans-Bold", fontSize=10.5, leading=14,
        textColor=INK, spaceAfter=4,
    ),
    "body": ParagraphStyle(
        "body", fontName="ClientSans", fontSize=9, leading=13.2,
        textColor=MUTED, spaceAfter=7,
    ),
    "body_small": ParagraphStyle(
        "body_small", fontName="ClientSans", fontSize=7.8, leading=11,
        textColor=MUTED,
    ),
    "bullet": ParagraphStyle(
        "bullet", fontName="ClientSans", fontSize=8.5, leading=12.3,
        textColor=INK, leftIndent=10, firstLineIndent=-8, spaceAfter=4,
    ),
    "card_title": ParagraphStyle(
        "card_title", fontName="ClientSans-Bold", fontSize=9.3, leading=12,
        textColor=INK, spaceAfter=3,
    ),
    "card_body": ParagraphStyle(
        "card_body", fontName="ClientSans", fontSize=7.8, leading=11,
        textColor=MUTED,
    ),
    "metric": ParagraphStyle(
        "metric", fontName="ClientSans-Bold", fontSize=19, leading=21,
        textColor=WHITE, alignment=TA_CENTER,
    ),
    "metric_label": ParagraphStyle(
        "metric_label", fontName="ClientSans", fontSize=7, leading=9,
        textColor=colors.HexColor("#BFD1E7"), alignment=TA_CENTER,
    ),
    "table_head": ParagraphStyle(
        "table_head", fontName="ClientSans-Bold", fontSize=7.4, leading=9,
        textColor=WHITE,
    ),
    "table": ParagraphStyle(
        "table", fontName="ClientSans", fontSize=7.5, leading=10.2,
        textColor=INK,
    ),
    "table_bold": ParagraphStyle(
        "table_bold", fontName="ClientSans-Bold", fontSize=7.5, leading=10.2,
        textColor=INK,
    ),
    "toc_num": ParagraphStyle(
        "toc_num", fontName="ClientSans-Bold", fontSize=14, leading=17,
        textColor=BLUE,
    ),
    "toc_title": ParagraphStyle(
        "toc_title", fontName="ClientSans-Bold", fontSize=10, leading=13,
        textColor=INK,
    ),
    "toc_desc": ParagraphStyle(
        "toc_desc", fontName="ClientSans", fontSize=7.5, leading=10,
        textColor=MUTED,
    ),
    "quote": ParagraphStyle(
        "quote", fontName="ClientSans-Bold", fontSize=10, leading=15,
        textColor=BLUE_DARK,
    ),
}


def para(text: str, style: str = "body") -> Paragraph:
    return Paragraph(escape(text).replace("\n", "<br/>"), styles[style])


def rich(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, styles[style])


def heading(kicker: str, title: str, intro: str | None = None):
    parts = [para(kicker.upper(), "eyebrow"), para(title, "h1")]
    if intro:
        parts.append(para(intro, "body"))
    parts.append(HRFlowable(width="100%", thickness=1, color=LINE, spaceBefore=2, spaceAfter=11))
    return parts


def bullet_list(items: list[str]):
    return [para(f"- {item}", "bullet") for item in items]


def callout(title: str, body: str, tone: str = "blue"):
    palette = {
        "blue": (BLUE_SOFT, BLUE_DARK),
        "green": (GREEN_SOFT, GREEN),
        "amber": (AMBER_SOFT, AMBER),
        "red": (RED_SOFT, RED),
    }
    bg, accent = palette[tone]
    content = [
        Paragraph(escape(title), ParagraphStyle("callout_title", parent=styles["card_title"], textColor=accent)),
        para(body, "card_body"),
    ]
    table = Table([[content]], colWidths=[170 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.Color(accent.red, accent.green, accent.blue, alpha=0.28)),
        ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 11),
        ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return table


def feature_cards(items: list[tuple[str, str]], columns: int = 2):
    rows = []
    for index in range(0, len(items), columns):
        row = []
        for title, body in items[index:index + columns]:
            row.append([para(title, "card_title"), para(body, "card_body")])
        while len(row) < columns:
            row.append("")
        rows.append(row)
    width = 170 * mm
    gap = 4 * mm
    col_width = (width - gap * (columns - 1)) / columns
    table_rows = []
    for row_index, row in enumerate(rows):
        table_rows.append(row)
        if row_index < len(rows) - 1:
            table_rows.append(["" for _ in range(columns)])
    table = Table(table_rows, colWidths=[col_width] * columns, rowHeights=None)
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]
    for row_index in range(0, len(table_rows), 2):
        for column in range(columns):
            if table_rows[row_index][column] != "":
                commands += [
                    ("BACKGROUND", (column, row_index), (column, row_index), PANEL),
                    ("BOX", (column, row_index), (column, row_index), 0.7, LINE),
                    ("ROUNDEDCORNERS", (column, row_index), (column, row_index), 8),
                ]
    for gap_row in range(1, len(table_rows), 2):
        commands += [
            ("TOPPADDING", (0, gap_row), (-1, gap_row), 2),
            ("BOTTOMPADDING", (0, gap_row), (-1, gap_row), 2),
            ("LEFTPADDING", (0, gap_row), (-1, gap_row), 0),
            ("RIGHTPADDING", (0, gap_row), (-1, gap_row), 0),
        ]
    table.setStyle(TableStyle(commands))
    return table


def data_table(headers: list[str], rows: list[list[str]], widths: list[float] | None = None):
    payload = [[para(item, "table_head") for item in headers]]
    for row in rows:
        payload.append([para(item, "table_bold" if column == 0 else "table") for column, item in enumerate(row)])
    table = Table(payload, colWidths=widths, repeatRows=1)
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY_2),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    for row_index in range(1, len(payload)):
        if row_index % 2 == 0:
            commands.append(("BACKGROUND", (0, row_index), (-1, row_index), PANEL))
    table.setStyle(TableStyle(commands))
    return table


def chapter_label(number: str, title: str, description: str):
    table = Table([[
        para(number, "toc_num"),
        [para(title, "toc_title"), para(description, "toc_desc")],
    ]], colWidths=[14 * mm, 151 * mm])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), PANEL),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return table


def page_decor(canvas, doc):
    canvas.saveState()
    if doc.page == 1:
        canvas.setFillColor(NAVY)
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor("#122C53"))
        canvas.circle(PAGE_W + 8 * mm, PAGE_H - 25 * mm, 65 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor("#173B70"))
        canvas.circle(PAGE_W - 4 * mm, PAGE_H - 18 * mm, 34 * mm, fill=1, stroke=0)
        canvas.setStrokeColor(colors.Color(CYAN.red, CYAN.green, CYAN.blue, alpha=0.25))
        canvas.setLineWidth(0.8)
        for index in range(6):
            canvas.circle(PAGE_W - 15 * mm, PAGE_H - 31 * mm, (17 + index * 7) * mm, fill=0, stroke=1)
        canvas.setFillColor(BLUE)
        canvas.roundRect(20 * mm, PAGE_H - 30 * mm, 16 * mm, 16 * mm, 5 * mm, fill=1, stroke=0)
        canvas.setFillColor(WHITE)
        canvas.setFont("ClientSans-Bold", 12)
        canvas.drawCentredString(28 * mm, PAGE_H - 24.5 * mm, "JI")
        canvas.setFont("ClientSans-Bold", 10)
        canvas.drawString(40 * mm, PAGE_H - 22 * mm, "JUNIOR IMPORTS")
        canvas.setFont("ClientSans", 7)
        canvas.setFillColor(colors.HexColor("#A9BDD7"))
        canvas.drawString(40 * mm, PAGE_H - 27 * mm, "ECOSSISTEMA DE COMERCIO E GESTAO")
    else:
        canvas.setFillColor(NAVY)
        canvas.rect(0, PAGE_H - 13 * mm, PAGE_W, 13 * mm, fill=1, stroke=0)
        canvas.setFillColor(BLUE)
        canvas.roundRect(18 * mm, PAGE_H - 10 * mm, 7 * mm, 7 * mm, 2.2 * mm, fill=1, stroke=0)
        canvas.setFillColor(WHITE)
        canvas.setFont("ClientSans-Bold", 6.4)
        canvas.drawCentredString(21.5 * mm, PAGE_H - 7.7 * mm, "JI")
        canvas.setFont("ClientSans-Bold", 7.3)
        canvas.drawString(28 * mm, PAGE_H - 8.2 * mm, "JUNIOR IMPORTS")
        canvas.setFillColor(colors.HexColor("#AFC1D8"))
        canvas.setFont("ClientSans", 6.6)
        canvas.drawRightString(PAGE_W - 18 * mm, PAGE_H - 8.2 * mm, "RELATORIO DE EVOLUCAO E MANUAL FUNCIONAL")
        canvas.setStrokeColor(LINE)
        canvas.line(18 * mm, 14 * mm, PAGE_W - 18 * mm, 14 * mm)
        canvas.setFillColor(MUTED)
        canvas.setFont("ClientSans", 6.6)
        canvas.drawString(18 * mm, 9 * mm, "Versao de 18/07/2026 - Documento para apresentacao ao cliente")
        canvas.drawRightString(PAGE_W - 18 * mm, 9 * mm, f"Pagina {doc.page}")
    canvas.restoreState()


doc = SimpleDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    rightMargin=20 * mm,
    leftMargin=20 * mm,
    topMargin=23 * mm,
    bottomMargin=20 * mm,
    title="Relatorio de evolucao Junior Imports - Lotes 1 a 6",
    author="Junior Imports",
    subject="Evolucao do sistema e manual funcional",
)

story = []

# Cover
story += [
    Spacer(1, 47 * mm),
    para("RELATORIO EXECUTIVO E MANUAL FUNCIONAL", "cover_label"),
    rich("Evolucao da plataforma<br/>do Lote 1 ao Lote 6", "cover_title"),
    para(
        "Um panorama completo das entregas, dos recursos operacionais e da experiencia atual da Junior Imports - da vitrine ao painel administrativo.",
        "cover_sub",
    ),
]
metrics = [
    [para("6", "metric"), para("21", "metric"), para("161", "metric"), para("42", "metric")],
    [para("lotes concluidos", "metric_label"), para("areas administrativas", "metric_label"), para("testes aprovados", "metric_label"), para("cenarios E2E mapeados", "metric_label")],
]
metric_table = Table(metrics, colWidths=[42.5 * mm] * 4)
metric_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), colors.Color(1, 1, 1, alpha=0.055)),
    ("BOX", (0, 0), (-1, -1), 0.7, colors.Color(1, 1, 1, alpha=0.16)),
    ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.Color(1, 1, 1, alpha=0.12)),
    ("TOPPADDING", (0, 0), (-1, 0), 10),
    ("BOTTOMPADDING", (0, 0), (-1, 0), 1),
    ("TOPPADDING", (0, 1), (-1, 1), 1),
    ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
]))
story += [metric_table, Spacer(1, 15 * mm)]
status_table = Table([[
    Paragraph("STATUS", ParagraphStyle("cover_status", parent=styles["cover_label"], textColor=WHITE, alignment=TA_CENTER)),
    para("Lotes 1 a 6 versionados. Pacote complementar de robustez e notificacoes pronto no codigo, aguardando migracao e publicacao.", "cover_note"),
]], colWidths=[28 * mm, 142 * mm])
status_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (0, 0), BLUE),
    ("BACKGROUND", (1, 0), (1, 0), colors.Color(1, 1, 1, alpha=0.06)),
    ("BOX", (0, 0), (-1, -1), 0.6, colors.Color(1, 1, 1, alpha=0.16)),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ("TOPPADDING", (0, 0), (-1, -1), 9),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
]))
story += [status_table, Spacer(1, 16 * mm), para("Preparado em 18 de julho de 2026", "cover_note"), PageBreak()]

# Executive summary
story += heading(
    "Visao executiva",
    "O que a plataforma entrega hoje",
    "A Junior Imports evoluiu de uma administracao de catalogo para uma plataforma operacional integrada, com produtividade, relacionamento, marketing, estoque, inteligencia, colaboracao e seguranca.",
)
story.append(feature_cards([
    ("Operacao centralizada", "Pedidos, CRM, clientes, estoque, compras, financeiro e relatorios trabalham sobre a mesma base de dados."),
    ("Experiencia premium", "Interface responsiva, modo escuro, carregamento estilizado, motion, drag and drop e atalhos de teclado."),
    ("Crescimento com cashback", "Cashback por produto, carteira do cliente, extrato, validade, campanhas segmentadas e analise de recompra."),
    ("Marketing com governanca", "Calendario, fluxo de aprovacao, agendamento, versoes, rollback, automacoes e historico de execucao."),
    ("Equipe coordenada", "Tarefas, discussoes, mencoes, aprovacoes, presenca online e protecao contra edicao concorrente."),
    ("Confiabilidade operacional", "Saude do sistema, backups criptografados, auditoria, isolamento por empresa, MFA e notificacoes prioritarias."),
]))
story += [Spacer(1, 6 * mm), callout(
    "Limite comercial atual",
    "O site nao processa pagamento online e nao executa logistica ou entrega automatizada. O pedido e registrado, os termos sao aceitos e o atendimento continua pelo WhatsApp para confirmar pagamento, disponibilidade e envio.",
    "amber",
), Spacer(1, 6 * mm)]
story.append(data_table(
    ["Entrega", "Situacao", "Disponibilizacao"],
    [
        ["Lotes 1 a 6", "Concluidos e versionados", "Base principal do projeto"],
        ["Robustez pos-Lote 6", "Implementada e validada", "Requer migration 007 e deploy"],
        ["Central de notificacoes", "Implementada e validada", "Requer migration 008 e deploy"],
    ],
    [45 * mm, 55 * mm, 70 * mm],
))
story.append(PageBreak())

# Contents
story += heading("Guia do documento", "Como este relatorio esta organizado")
chapters = [
    ("01", "Evolucao por lote", "Escopo, funcoes adicionadas e beneficio de negocio dos Lotes 1 a 6."),
    ("02", "Pacote complementar", "Robustez operacional, seguranca de dados, colaboracao endurecida e central de notificacoes."),
    ("03", "Jornada da loja", "Como o cliente navega, consulta produtos, usa o carrinho e finaliza pelo WhatsApp."),
    ("04", "Manual administrativo", "Explicacao das 21 areas do painel e dos recursos globais de produtividade."),
    ("05", "Seguranca e arquitetura", "MFA, permissoes, isolamento multiempresa, auditoria, backup e continuidade."),
    ("06", "Qualidade e publicacao", "Validacoes executadas, limites atuais e passos para disponibilizar o pacote final."),
]
for index, item in enumerate(chapters):
    story.append(chapter_label(*item))
    if index < len(chapters) - 1:
        story.append(Spacer(1, 3 * mm))
story += [Spacer(1, 7 * mm), callout(
    "Leitura recomendada para o cliente",
    "As paginas de evolucao mostram o valor entregue. O manual funcional pode ser usado como material de apresentacao, treinamento e consulta da equipe.",
    "blue",
), PageBreak()]

# Timeline
story += heading(
    "Evolucao por lote",
    "Da produtividade individual a uma operacao coordenada",
    "Os seis lotes foram planejados como camadas. Cada entrega utiliza a fundacao anterior e amplia o alcance do sistema sem introduzir pagamento online ou logistica automatizada.",
)
story.append(data_table(
    ["Lote", "Foco", "Resultado principal"],
    [
        ["Lote 1", "Produtividade", "Menos cliques, busca global, favoritos e preferencias pessoais."],
        ["Lote 2", "Confiabilidade", "Saude do ambiente, backup criptografado e recuperacao controlada."],
        ["Lote 3", "Cashback e Cliente 360", "Carteira promocional, campanhas e relacionamento orientado por dados."],
        ["Lote 4", "Marketing", "Calendario, governanca de publicacao e automacoes auditaveis."],
        ["Lote 5", "Inteligencia", "Previsao de estoque, sugestao de compra e relatorios exportaveis."],
        ["Lote 6", "Colaboracao e IA", "Discussoes, aprovacoes, presenca e Copiloto somente leitura."],
        ["Complementar", "Robustez e alertas", "Operacoes atomicas, menor exposicao de dados e notificacoes prioritarias."],
    ],
    [25 * mm, 45 * mm, 100 * mm],
))
story += [Spacer(1, 7 * mm), para("Principio do programa", "h2"), para(
    "Cada lote foi implementado com persistencia por empresa, permissoes administrativas, modo demonstrativo seguro e cobertura automatizada. A experiencia premium continua transversal a todas as areas.",
    "body",
), feature_cards([
    ("Visivel para a operacao", "Recursos aparecem no menu e nos fluxos diarios, com atalhos e estados vazios explicativos."),
    ("Protegido no servidor", "As areas respeitam autenticacao, tenant selecionado e permissoes do usuario."),
    ("Auditavel", "Alteracoes criticas mantem contexto, autor, data e historico operacional."),
    ("Evolutivo", "A arquitetura permite adicionar novos clientes, canais e integracoes sem refazer a base."),
]), PageBreak()]

# Lot 1
story += heading(
    "Lote 1 - Produtividade",
    "O painel passou a trabalhar no ritmo do administrador",
    "O primeiro lote reduziu a distancia entre uma intencao e a tela certa, preservando preferencias individuais para tornar o uso recorrente mais rapido.",
)
story.append(feature_cards([
    ("Central de comandos", "Atalho Cmd/Ctrl + K para abrir areas, criar registros e buscar produtos, pedidos e clientes."),
    ("Busca operacional", "Resultados por nome, SKU, categoria, cliente, telefone, e-mail, codigo do pedido e palavras relacionadas."),
    ("Favoritos", "Areas frequentes podem ser marcadas e passam a aparecer primeiro na central de comandos."),
    ("Visualizacoes salvas", "Filtros de produtos podem ser nomeados e reutilizados, incluindo pesquisa, categoria e visibilidade."),
    ("Densidade de tabelas", "Alternancia entre visual confortavel e compacto de acordo com a preferencia do usuario."),
    ("Preferencias individuais", "Favoritos, densidade e visualizacoes ficam separados por usuario no dispositivo."),
    ("Auditoria visual", "A area de dados compara alteracoes e apresenta contexto antes/depois quando a permissao permite."),
    ("Protecao contra demo em producao", "O sistema identifica o ambiente e evita que dados demonstrativos sejam confundidos com uma operacao real."),
]))
story += [Spacer(1, 7 * mm), callout(
    "Beneficio do lote",
    "Menos navegacao manual, menos repeticao e uma interface que se adapta ao modo de trabalho de cada membro da equipe.",
    "green",
), PageBreak()]

# Lot 2
story += heading(
    "Lote 2 - Confiabilidade",
    "Saude, backup e recuperacao deixam de ser tarefas invisiveis",
    "A operacao ganhou instrumentos para identificar falhas e recuperar informacoes com um processo documentado.",
)
story.append(feature_cards([
    ("Central de saude", "Verifica banco de dados, autenticacao, auditoria, backups e ambiente de execucao."),
    ("Estados de severidade", "Cada verificacao informa se esta saudavel, em atencao ou critica, com explicacao do problema."),
    ("Backup criptografado", "Gera pacote protegido por chave, com dados do tenant, configuracoes, historicos e midias."),
    ("Checksum e manifesto", "O pacote registra contagens e assinatura para detectar arquivo incompleto ou alterado."),
    ("Verificacao antes de restaurar", "O modo de comparacao permite entender o impacto antes de aplicar uma restauracao."),
    ("Restauracao controlada", "A ordem das tabelas respeita dependencias para reduzir inconsistencias durante a recuperacao."),
    ("Runbook operacional", "Documento com criacao, validacao, restauracao, testes periodicos e limitacoes do backup."),
    ("Historico de execucoes", "O banco registra os backups realizados e permite que a central de saude avalie sua atualidade."),
]))
story += [Spacer(1, 6 * mm), callout(
    "O que nao entra no backup",
    "Senhas, sessoes e segredos MFA pertencem ao Supabase Auth. Presenca online e travas temporarias de edicao sao recriadas automaticamente e tambem nao fazem parte do pacote.",
    "amber",
), PageBreak()]

# Lot 3
story += heading(
    "Lote 3 - Cashback e Cliente 360",
    "O incentivo promocional ganhou regras, saldo e rastreabilidade",
    "O cashback deixou de ser apenas um valor no produto e passou a compor uma carteira completa, conectada ao relacionamento com cada cliente.",
)
story.append(feature_cards([
    ("Cashback por produto", "O cadastro define quanto cada unidade devolve ao cliente e a loja exibe o beneficio na vitrine."),
    ("Cashback do pedido", "O total previsto e calculado no carrinho, no checkout e na mensagem enviada ao WhatsApp."),
    ("Carteira por cliente", "Saldo disponivel, saldo pendente, valor utilizado e valor expirado aparecem no perfil do cliente."),
    ("Extrato imutavel", "Creditos, debitos, ajustes, consumo e expiracao mantem um historico rastreavel."),
    ("Consumo FIFO", "Os creditos com vencimento mais proximo sao utilizados primeiro, reduzindo perda de saldo."),
    ("Validade", "Creditos podem expirar e o sistema distingue valor disponivel de valor vencido."),
    ("Ajustes auditaveis", "Usuarios autorizados podem creditar ou debitar valores com motivo registrado."),
    ("Campanhas segmentadas", "Regras por segmento, periodo, prioridade, valor minimo, produtos e multiplicador de bonus."),
    ("Cliente 360", "Pedidos, produtos preferidos, contatos, tarefas, etiquetas, consentimentos e cashback em uma unica visao."),
    ("Recompra", "Indicadores ajudam a identificar clientes e produtos com potencial de novo contato."),
]))
story += [Spacer(1, 5 * mm), callout(
    "Quando o credito e liberado",
    "O valor mostrado no site e previsto. A liberacao depende da confirmacao operacional do pedido, evitando prometer saldo sobre uma solicitacao ainda nao validada.",
    "blue",
), PageBreak()]

# Lot 4
story += heading(
    "Lote 4 - Marketing e automacao",
    "Campanhas passaram a ter calendario, aprovacao e historico",
    "O Marketing Studio organiza o que entra no ar, quem aprovou, quando deve ser publicado e como as automacoes se comportam.",
)
story.append(feature_cards([
    ("Calendario unificado", "Reune banners, cupons, cashback, mensagens e publicacoes coordenadas na mesma agenda."),
    ("Visao por periodo", "A equipe identifica conflitos, sobreposicoes e lacunas de comunicacao antes da publicacao."),
    ("Rascunho e revisao", "Uma publicacao pode ser preparada, enviada para revisao e aprovada antes de ficar ativa."),
    ("Agendamento", "Conteudos aprovados podem receber data e hora para ativacao planejada."),
    ("Versoes", "Cada alteracao relevante cria historico para consulta e comparacao."),
    ("Rollback", "Uma versao anterior pode ser restaurada quando a publicacao atual precisa ser revertida."),
    ("Construtor de automacoes", "Fluxos combinam gatilho, condicoes e acoes como mensagem, tarefa ou etiqueta."),
    ("Teste seguro", "A automacao pode ser simulada sobre um pedido sem executar uma comunicacao externa real."),
    ("Tentativas e retry", "Falhas registram motivo, limite de tentativas e possibilidade de reprocessamento."),
    ("Logs operacionais", "O historico mostra quando a regra executou, o resultado e o conteudo gerado."),
]))
story += [Spacer(1, 5 * mm), callout(
    "Governanca antes de velocidade",
    "O fluxo evita que uma campanha importante seja publicada sem revisao, preserva o contexto da decisao e oferece retorno a uma versao estavel.",
    "green",
), PageBreak()]

# Lot 5
story += heading(
    "Lote 5 - Inteligencia de estoque e relatorios",
    "Dados operacionais passaram a orientar decisoes",
    "O quinto lote adicionou previsao, priorizacao e exportacoes reais para que a equipe dependa menos de planilhas paralelas.",
)
story.append(feature_cards([
    ("Radar de ruptura", "Cruza saldo, estoque minimo, giro, lead time e compras em transito para destacar riscos."),
    ("Sugestao de compra", "Calcula uma quantidade revisavel e permite criar um rascunho para o processo de reposicao."),
    ("Lotes e vencimentos", "Prioriza produtos vencidos ou proximos do vencimento, com quantidade e referencia do lote."),
    ("Baixo giro", "Identifica itens com pouca ou nenhuma saida para orientar promocao, ajuste ou compra."),
    ("Margem baixa", "Compara preco e custo para localizar produtos que exigem revisao comercial."),
    ("Inconsistencias", "Aponta cadastros sem custo, SKU, estoque minimo ou dados necessarios para a analise."),
    ("Construtor de relatorios", "Relatorios de vendas, financeiro, estoque, clientes, cashback e compras com periodo comparativo."),
    ("Configuracoes salvas", "Consultas recorrentes podem ser nomeadas, compartilhadas e abertas novamente."),
    ("Exportacoes reais", "Gera arquivos CSV, Excel e PDF e registra quem exportou, quando e qual configuracao foi usada."),
    ("Permissao de relatorios", "Acesso a consultas e exportacoes respeita o papel e as permissoes administrativas."),
]))
story += [Spacer(1, 5 * mm), callout(
    "Beneficio do lote",
    "A operacao sai de uma leitura apenas descritiva e passa a receber uma fila de prioridades com proxima acao recomendada.",
    "green",
), PageBreak()]

# Lot 6
story += heading(
    "Lote 6 - Colaboracao e Copiloto",
    "A equipe passou a trabalhar com contexto compartilhado",
    "Discussoes, decisoes e presenca foram incorporadas ao painel, enquanto o Copiloto Junior oferece orientacao e consultas sem alterar dados.",
)
story.append(feature_cards([
    ("Caixa de entrada da equipe", "Combina tarefas abertas, mencoes e aprovacoes pendentes em uma lista priorizada."),
    ("Discussoes por entidade", "Topicos podem ser vinculados a produto, cliente, pedido, publicacao, relatorio ou compra."),
    ("Comentarios e mencoes", "Mensagens preservam autor, data, contexto e pessoas chamadas para participar."),
    ("Aprovacoes", "Itens podem ser enviados a um revisor, com prazo, justificativa, aprovacao ou rejeicao."),
    ("Presenca online", "A equipe visualiza quem esta ativo e em qual area do painel esta trabalhando."),
    ("Edicao concorrente", "Um lease temporario avisa quando outra pessoa esta editando o mesmo produto e reduz sobrescritas."),
    ("Copiloto Junior", "Painel lateral com atalho Cmd/Ctrl + J para consultar estoque, pedidos, cashback e ajuda da tela."),
    ("Modo somente leitura", "O Copiloto gera respostas e atalhos, mas nao executa alteracoes nem envia dados a uma IA externa."),
    ("Transparencia", "A interface explica as fontes usadas, o modo local seguro e a ausencia de mutacoes automaticas."),
    ("Uso auditavel", "A estrutura registra telemetria necessaria para acompanhar uso e evolucao futura do assistente."),
]))
story += [Spacer(1, 5 * mm), callout(
    "Limite seguro do Copiloto",
    "A linguagem generativa externa ainda depende de uma chave configurada no servidor. A versao atual usa regras locais auditaveis e permanece somente leitura.",
    "amber",
), PageBreak()]

# Post lot 6
story += heading(
    "Pacote complementar",
    "Robustez operacional depois do Lote 6",
    "A revisao posterior concentrou-se em fechar lacunas de autorizacao, atomicidade, privacidade de dados, acessibilidade e continuidade.",
)
story.append(feature_cards([
    ("Colaboracao atomica", "Criacao de topico e primeiro comentario ocorre na mesma transacao; respostas atualizam o topico sem etapas soltas."),
    ("Leitura duravel de mencoes", "Uma mencao aberta fica registrada como lida por usuario e nao reaparece indevidamente."),
    ("Aprovacoes protegidas", "O servidor valida solicitante, revisor e decisor; o solicitante comum nao aprova o proprio pedido."),
    ("Diretorio de revisores", "A lista mostra apenas membros ativos e autorizados para colaboracao dentro da empresa atual."),
    ("Compras atomicas", "Cabecalho e itens da ordem sao salvos juntos e o total e recalculado a partir dos itens no banco."),
    ("Leitura por permissao", "O painel deixa de consultar dominios que o usuario nao pode acessar, reduzindo exposicao desnecessaria."),
    ("Backup ampliado", "Inclui discussoes, comentarios, leituras, aprovacoes, notificacoes e telemetria do Copiloto."),
    ("Midias em subpastas", "O backup percorre pastas e paginas de arquivos, inclusive volumes acima de mil itens."),
    ("CSP mais restrita", "A producao deixa de permitir avaliacao dinamica de scripts, mantendo a flexibilizacao apenas no desenvolvimento."),
    ("Acessibilidade de dialogos", "Foco inicial, fechamento por Escape, retorno do foco e rotulos acessiveis foram reforcados."),
    ("Modo escuro refinado", "Ajustes de contraste e empilhamento melhoram a leitura de paineis, modais e elementos sobrepostos."),
    ("Dependencias endurecidas", "Versoes vulneraveis ou inconsistentes foram substituidas por configuracoes controladas."),
]))
story += [Spacer(1, 5 * mm), callout(
    "Status deste pacote",
    "As melhorias estao implementadas e validadas no codigo local. Para disponibilizacao online, a migration 202607180007_operational_hardening.sql deve ser aplicada antes do deploy.",
    "blue",
), PageBreak()]

# Notifications
story += heading(
    "Pacote complementar",
    "Central de notificacoes importantes",
    "O sino do painel foi transformado em uma central operacional com prioridade, destino, leitura, adiamento e preferencias individuais.",
)
story.append(feature_cards([
    ("Estoque", "Produto sem saldo, estoque abaixo do minimo, lote vencido e lote a vencer em ate 30 dias."),
    ("Pedidos", "Solicitacao nova aguardando contato; torna-se critica quando ultrapassa 24 horas."),
    ("CRM", "Tarefa atribuida ao usuario vencida ou com prazo nas proximas 24 horas."),
    ("Compras", "Ordem com chegada em ate tres dias, recebimento parcial pendente ou prazo atrasado."),
    ("Cashback", "Creditos proximos do vencimento e campanha ativa terminando nos proximos tres dias."),
    ("Marketing", "Automacao com falha ou retry e publicacao agendada proxima ou atrasada."),
    ("Equipe", "Mencoes nao lidas e aprovacoes que aguardam decisao do usuario."),
    ("Seguranca", "Novo MFA, remocao de autenticador e mudancas recentes de acesso administrativo."),
    ("Sistema", "Alertas de banco, autenticacao, auditoria, backup e saude do ambiente de producao."),
    ("Prioridades", "Classificacao critica, importante ou informativa, com ordenacao automatica."),
    ("Acoes", "Abrir a area correta, marcar como lida ou nao lida, adiar por 24 horas e marcar todas."),
    ("Preferencias", "Cada usuario escolhe categorias visiveis e se alertas informativos entram no contador do sino."),
    ("Sincronizacao", "Leitura e adiamento acompanham o usuario entre dispositivos por meio do Supabase Realtime."),
    ("Fallback local", "No modo demonstrativo, os estados sao mantidos no navegador sem depender do banco."),
]))
story += [Spacer(1, 5 * mm), callout(
    "Status desta central",
    "Implementada, testada em desktop, celular e modo escuro. Para uso online, deve-se aplicar a migration 202607180008_admin_notifications.sql e publicar a nova versao.",
    "blue",
), PageBreak()]

# Storefront journey
story += heading(
    "Manual funcional - Loja",
    "A jornada do cliente, do link ao WhatsApp",
    "A vitrine foi desenhada como catalogo privado compartilhavel por indicacao, Instagram, WhatsApp ou link direto. Ela permanece bloqueada para indexacao em mecanismos de busca.",
)
journey_rows = [
    ["1. Descoberta", "O cliente abre o link e encontra banners institucionais, mensagens de confianca e acesso ao catalogo."],
    ["2. Exploracao", "Produtos aparecem separados por categoria, com atalhos, carrosseis, preco, beneficio e disponibilidade."],
    ["3. Produto", "A pagina individual mostra galeria, descricao, marca, estoque, cashback e orientacoes de pedido."],
    ["4. Carrinho", "O cliente ajusta quantidades, revisa subtotal, cashback previsto e aplica um cupom valido."],
    ["5. Checkout", "Dados pessoais sao validados e o resumo de garantia e termos exige aceite explicito."],
    ["6. Atendimento", "O pedido e registrado e o WhatsApp abre com codigo, itens, valores, cashback e confirmacao dos termos."],
]
story.append(data_table(["Etapa", "Como funciona"], journey_rows, [37 * mm, 133 * mm]))
story += [Spacer(1, 6 * mm)]
story.append(feature_cards([
    ("Banners responsivos", "Artes separadas para desktop e celular, com rotacao, navegacao manual, links e texto alternativo."),
    ("Conteudo institucional", "Beneficios, itens de confianca, paginas e perguntas frequentes explicam a operacao."),
    ("Categorias", "O catalogo cria grupos ordenados e exibe apenas produtos ativos e adequados para consulta."),
    ("Cashback visivel", "Valor por unidade e total previsto aparecem no produto, carrinho, checkout e confirmacao."),
    ("Cupons", "Validacao no servidor considera periodo, limite total, limite por cliente e valor minimo."),
    ("Termos obrigatorios", "O checkout registra versao e data do aceite e reforca a exigencia de video sem cortes para garantia."),
]))
story += [Spacer(1, 5 * mm), callout(
    "Confirmacao manual",
    "Pagamento, disponibilidade final, frete e envio sao confirmados pela equipe no WhatsApp. O site nao captura cartao, Pix ou pagamento e nao contrata transportadora automaticamente.",
    "amber",
), PageBreak()]

# Global admin
story += heading(
    "Manual funcional - Painel",
    "Recursos presentes em todas as areas",
    "O painel combina uma navegacao consistente com atalhos, preferencias e mecanismos de seguranca que acompanham o usuario durante toda a operacao.",
)
story.append(feature_cards([
    ("Menu por area", "Operacao, gestao, catalogo, loja, marketing e sistema aparecem agrupados conforme permissao."),
    ("Central de comandos", "Cmd/Ctrl + K pesquisa areas, criacoes, produtos, pedidos e clientes."),
    ("Criacao rapida", "Menu superior abre cadastro de produto, cupom, banner, pagina, automacao ou usuario."),
    ("Favoritos e views", "A equipe preserva atalhos, densidade e filtros recorrentes por usuario."),
    ("Modo escuro", "Alternancia visual persistente, com contraste especifico para tabelas, modais e paineis."),
    ("Motion e carregamento", "Splash inicial, transicao entre paginas, skeletons e feedback visual reduzem a sensacao de espera."),
    ("Drag and drop", "Reordenacao de secoes, banners e imagens quando a ordem influencia a vitrine."),
    ("PWA administrativa", "O painel pode ser instalado como aplicativo, sem armazenar paginas administrativas sensiveis offline."),
    ("Central de alertas", "Prioridades operacionais ficam no sino, com leitura, adiamento, destino e preferencias."),
    ("Copiloto Junior", "Atalho Cmd/Ctrl + J para consultar dados e aprender a usar a tela em modo somente leitura."),
    ("Permissoes", "A navegacao e as consultas sao reduzidas ao papel e aos modulos autorizados para o usuario."),
    ("Feedback seguro", "Dialogos, toasts, confirmacoes e estados de erro informam o resultado das operacoes."),
]))
story += [Spacer(1, 6 * mm), callout(
    "Experiencia responsiva",
    "Dashboard, menus, tabelas, formulários, notificacoes e modais foram ajustados para desktop e celular. A navegacao lateral se transforma em menu movel sem perder as funcoes principais.",
    "green",
), PageBreak()]

# Operation modules
story += heading("Manual funcional - Operacao", "Visao geral, CRM, Pedidos e Central da equipe")
story.append(feature_cards([
    ("Visao geral", "Resume pedidos, receita estimada, produtos, cupons, clientes e recompra; mostra prioridades, atividade, grafico semanal, atalhos, saude da loja e checklist."),
    ("CRM", "Organiza clientes por etapa de relacionamento, registra tarefas, contatos e proximas acoes e destaca oportunidades de recompra."),
    ("Pedidos", "Pesquisa e filtra solicitacoes, abre detalhes, cria pedido manual, ajusta itens, registra notas internas, codigo de rastreio e status."),
    ("Reserva de estoque", "A criacao e a evolucao do pedido atualizam reservas e movimentos conforme as regras operacionais configuradas."),
    ("Central da equipe", "Reune caixa de entrada, tarefas, mencoes, discussoes, aprovacoes e presenca online."),
    ("Discussao contextual", "Cada topico pode acompanhar uma entidade e preservar comentarios, decisao, prioridade, autor e data."),
    ("Fluxo de aprovacao", "Um item recebe solicitante, revisor, prazo, justificativa e decisao protegida no servidor."),
    ("Edicao concorrente", "Ao editar um produto, a equipe e avisada sobre outro usuario ativo no mesmo registro."),
]))
story += [Spacer(1, 7 * mm), data_table(
    ["Area", "Uso diario", "Resultado"],
    [
        ["Dashboard", "Abrir o dia e revisar prioridades", "Visao rapida da operacao"],
        ["CRM", "Planejar contatos e tarefas", "Relacionamento consistente"],
        ["Pedidos", "Registrar, acompanhar e documentar", "Atendimento rastreavel"],
        ["Equipe", "Discutir, mencionar e aprovar", "Decisao com contexto"],
    ],
    [32 * mm, 68 * mm, 70 * mm],
), PageBreak()]

# Management modules
story += heading("Manual funcional - Gestao", "Financeiro, Estoque, Compras, Relatorios e Clientes")
story.append(feature_cards([
    ("Financeiro", "Registra receitas e despesas, organiza caixa, apresenta DRE gerencial e compara margem por produto."),
    ("Estoque e lotes", "Registra entradas, saidas e ajustes; acompanha saldo, custo, responsavel, lote e validade."),
    ("Inteligencia de estoque", "Prioriza ruptura, vencimento, baixo giro, margem baixa e inconsistencias e sugere compra."),
    ("Compras", "Cadastra fornecedores, cria ordens, acompanha previsao, recebe total ou parcialmente e atualiza o estoque."),
    ("Relatorios", "Monta consultas por dominio e periodo, compara periodos, salva configuracoes e compartilha com a equipe."),
    ("Exportacoes", "Gera CSV, Excel e PDF reais e registra o historico por usuario e configuracao."),
    ("Clientes", "Pesquisa, segmenta e abre a visao 360 com historico de pedidos, produtos, contatos, tarefas, tags e consentimentos."),
    ("Carteira de cashback", "Mostra saldo e extrato, permite ajuste autorizado e administra campanhas e vencimentos."),
]))
story += [Spacer(1, 7 * mm), callout(
    "Integracao entre areas",
    "O recebimento de uma compra pode gerar movimento e atualizar saldo. A mudanca de um pedido pode gerar financeiro, estoque, cashback e automacao, mantendo os dominios conectados.",
    "blue",
), PageBreak()]

# Catalog modules
story += heading("Manual funcional - Catalogo", "Produtos, Categorias e Importacao")
story.append(feature_cards([
    ("Lista de produtos", "Busca, filtros, visualizacoes salvas, densidade, status, destaque, estoque e acesso rapido a edicao."),
    ("Cadastro principal", "Nome, slug, SKU, categoria, marca, descricao, badge, ingrediente, apresentacao e dados regulatorios."),
    ("Fotos", "Galeria com upload, imagem principal, reordenacao e suporte a midia responsiva."),
    ("Preco e custo", "Preco atual, comparativo, custo, margem, estoque, estoque minimo e limite operacional."),
    ("Cashback do produto", "Valor por unidade retornado ao cliente, refletido automaticamente na jornada da loja."),
    ("Publicacao", "Produto pode ficar ativo, oculto ou em destaque e recebe avisos quando faltam informacoes relevantes."),
    ("Categorias", "Cria grupos, define ordem e visibilidade e impede exclusao quando ainda existem produtos vinculados."),
    ("Importar planilha", "Baixa modelo, valida linhas, apresenta revisao e importa produtos ou saldo de estoque em lote."),
    ("Historico de importacao", "Registra arquivo, data, modo, quantidade e resultado para consulta posterior."),
    ("Protecoes de catalogo", "Slugs unicos, regras de publicacao e separacao entre produto ativo e item apenas consultavel."),
]))
story += [Spacer(1, 5 * mm), callout(
    "Boa pratica operacional",
    "O estoque minimo, o custo e o SKU devem ser preenchidos para que os alertas, a margem, os relatorios e a sugestao de compra tenham maior precisao.",
    "green",
), PageBreak()]

# Store content
story += heading("Manual funcional - Loja e conteudo", "Editor da loja, Home e Banners")
story.append(feature_cards([
    ("Editor da loja", "Cria paginas institucionais modulares e organiza containers de texto, imagem, chamada e outros blocos."),
    ("Paginas", "Define titulo, slug, status e ordem para conteudos como quem somos, politicas e orientacoes."),
    ("Blocos modulares", "A equipe adiciona, edita, remove e reordena containers sem alterar o codigo da aplicacao."),
    ("Conteudo da home", "Organiza secoes publicadas, titulos, subtitulos, categorias destacadas e ordem da vitrine."),
    ("Banners", "Cadastra titulo, destaque, texto, botao, link, cores, imagens e estado ativo."),
    ("Desktop e mobile", "Cada banner aceita arte especifica para 1920 x 800 e 1080 x 1350, evitando cortes inadequados."),
    ("Banner somente imagem", "A arte pode carregar toda a mensagem e funcionar como link acessivel para uma pagina ou categoria."),
    ("Reordenacao", "Drag and drop e controles de posicao definem a sequencia exibida ao visitante."),
    ("Institucional e FAQ", "Mensagens de confianca, beneficios e perguntas frequentes orientam como comprar e como o atendimento funciona."),
    ("Preview compartilhavel", "Logo, favicon, titulo, descricao e imagem social formam a apresentacao do link nos mensageiros."),
]))
story += [Spacer(1, 5 * mm), callout(
    "Catalogo privado por link",
    "Metadados, robots.txt e cabecalho HTTP orientam buscadores a nao indexar a vitrine. Isso reduz descoberta por busca, mas qualquer pessoa com o link ainda consegue acessar o catalogo.",
    "amber",
), PageBreak()]

# Marketing modules
story += heading("Manual funcional - Marketing", "Cupons e Marketing Studio")
story.append(feature_cards([
    ("Cupons", "Cria desconto percentual ou fixo, periodo, valor minimo, limite total e limite por cliente."),
    ("Utilizacoes", "Registra resgates e ajuda a acompanhar consumo e disponibilidade da promocao."),
    ("Calendario", "Apresenta em uma agenda os eventos de banner, cupom, cashback, mensagem e publicacao."),
    ("Workflow", "Controla rascunho, revisao, aprovacao, agendamento, publicacao, pausa e arquivamento."),
    ("Versoes e rollback", "Preserva historico da publicacao e permite restaurar uma versao anterior."),
    ("Automacoes", "Configura evento de entrada, condicoes, acoes e limite de tentativas."),
    ("Simulacao", "Testa a regra sobre um pedido selecionado e mostra a saida sem enviar comunicacao externa."),
    ("Execucoes", "Lista status, tentativa, erro e proxima acao e permite retry de falhas autorizadas."),
    ("Mensagens", "Templates usam variaveis do pedido e registram o conteudo produzido para auditoria."),
    ("Tarefas e etiquetas", "Uma automacao tambem pode criar tarefa de CRM ou classificar um cliente."),
]))
story += [Spacer(1, 5 * mm), callout(
    "Canais externos",
    "A infraestrutura prepara mensagens e registra simulacoes. Envio real por provedor de WhatsApp ou e-mail depende de credencial, contrato e integracao de canal.",
    "amber",
), PageBreak()]

# System modules
story += heading("Manual funcional - Sistema", "Usuarios, MFA, Configuracoes e Dados")
story.append(feature_cards([
    ("Usuarios", "Cria, edita e suspende membros, define cargo, permissoes, nome e estado da conta."),
    ("Redefinicao de senha", "Administrador autorizado gera senha temporaria; recuperacao por e-mail usa fluxo seguro com codigo."),
    ("Seguranca e MFA", "Cadastra novo autenticador, confirma codigo, substitui dispositivo e remove fator com auditoria."),
    ("Cargos e permissoes", "Owner, gerente e demais perfis recebem acesso modular; o servidor reforca as mesmas regras."),
    ("Configuracoes da loja", "Nome, logotipo, favicon, cores, contatos, WhatsApp, mensagem de pedido e identidade visual."),
    ("Destino do checkout", "Define o fluxo de confirmacao; no modelo atual, a operacao continua pelo WhatsApp."),
    ("Parametros operacionais", "Configuracoes de frete servem para comunicacao e estimativa, sem contratar entrega automaticamente."),
    ("Dados", "Exporta, importa, compara, limpa pedidos de teste e restaura o estado permitido."),
    ("Central de saude", "Mostra disponibilidade do banco, autenticacao, auditoria, backup e ambiente."),
    ("Auditoria", "Registra autor, entidade, acao, data e valores relevantes antes/depois, conforme permissao."),
    ("Backup", "Scripts geram, verificam e restauram pacote criptografado seguindo um runbook."),
    ("Alertas", "A central de notificacoes liga eventos de seguranca e saude diretamente as telas de resolucao."),
]))
story += [Spacer(1, 5 * mm), callout(
    "MFA obrigatorio na operacao real",
    "As politicas sensiveis do banco exigem nivel AAL2, obtido apos a verificacao do autenticador. Redefinir um fator deve ser uma excecao administrativa auditada.",
    "red",
), PageBreak()]

# Architecture and SaaS
story += heading(
    "Arquitetura e expansao",
    "Uma base multiempresa, pronta para outras vitrines",
    "A Junior Imports e a primeira operacao de uma plataforma white-label. Uma unica instalacao pode atender outros clientes mantendo dados, equipe, identidade e pedidos isolados.",
)
story.append(feature_cards([
    ("Next.js", "Entrega a vitrine, o painel, rotas protegidas, APIs e renderizacao responsiva em uma unica aplicacao."),
    ("Supabase", "Fornece autenticacao, Postgres, RLS, Realtime, funcoes transacionais e armazenamento de midias."),
    ("Tenant", "Cada empresa possui identificador proprio e todas as tabelas operacionais sao filtradas por esse escopo."),
    ("RLS", "Politicas do banco impedem que um membro ativo consulte ou altere dados de outra empresa."),
    ("Console SaaS", "Administrador da plataforma pode provisionar clientes e gerenciar a loja selecionada."),
    ("Rotas individuais", "Cada cliente recebe /loja/[cliente] e pode evoluir para subdominio ou dominio personalizado."),
    ("Modo local", "Sem Supabase, o projeto oferece uma demonstracao no navegador para testes sem afetar producao."),
    ("Instalacao isolada", "Quando necessario, um script gera uma copia dedicada da base para uma operacao separada."),
]))
story += [Spacer(1, 7 * mm)]
story.append(data_table(
    ["Camada", "Responsabilidade"],
    [
        ["Interface", "Loja, checkout, painel, componentes e experiencia responsiva."],
        ["Dominio", "Validacao, estoque, cashback, cupons, relatorios, automacoes e notificacoes."],
        ["Aplicacao", "Autenticacao, autorizacao, APIs e operacoes transacionais."],
        ["Dados", "Postgres, RLS, Realtime, Storage, auditoria e backups."],
    ],
    [43 * mm, 127 * mm],
))
story.append(PageBreak())

# Security
story += heading("Seguranca e continuidade", "Controles que protegem acesso, dados e operacao")
story.append(feature_cards([
    ("Login protegido", "Rate limit e verificacao no servidor reduzem tentativas abusivas e acesso indevido."),
    ("Recuperacao segura", "Fluxos de senha usam codigo, prova de recuperacao e sessoes controladas."),
    ("MFA AAL2", "Operacoes sensiveis exigem segundo fator verificado no Supabase Auth."),
    ("RBAC", "Cargos e permissoes definem menu, consultas e operacoes autorizadas."),
    ("RLS por empresa", "O banco aplica isolamento por tenant mesmo quando uma requisicao tenta contornar a interface."),
    ("Service role no servidor", "A chave administrativa nao e exposta no navegador e fica limitada a rotas privilegiadas."),
    ("CSP e cabecalhos", "Politicas reduzem injecao de scripts, framing e carregamento de origens nao previstas."),
    ("Auditoria", "Mudancas administrativas e eventos de seguranca preservam autoria e contexto."),
    ("Backup criptografado", "Dados e midias podem ser protegidos, verificados e restaurados com processo conhecido."),
    ("Saude operacional", "Sinais de banco, Auth, auditoria, backup e deploy ficam visiveis para administradores."),
    ("Privacidade do Copiloto", "Na versao atual, consultas permanecem no painel e nao sao enviadas a um provedor externo."),
    ("Notificacoes pessoais", "Leitura e adiamento pertencem ao usuario autenticado e exigem acesso ativo a empresa."),
]))
story += [Spacer(1, 6 * mm), callout(
    "Responsabilidade compartilhada",
    "A seguranca tambem depende de MFA ativo, revisao periodica de usuarios, rotacao de segredos, backup externo, monitoramento e aplicacao ordenada das migrations.",
    "red",
), PageBreak()]

# Quality and deployment
story += heading(
    "Qualidade e publicacao",
    "Validacao atual e proximos passos",
    "O pacote foi revisado com validacao estatica, testes automatizados, build de producao e inspecao visual responsiva da central de notificacoes.",
)
story.append(data_table(
    ["Verificacao", "Resultado", "Cobertura"],
    [
        ["Lint", "Aprovado", "Padroes e problemas estaticos do codigo"],
        ["TypeScript", "Aprovado", "Contratos e tipos de toda a aplicacao"],
        ["Testes automatizados", "161 aprovados", "50 arquivos de regras e integracoes"],
        ["Build de producao", "Aprovado", "24 paginas estaticas e rotas dinamicas/APIs"],
        ["Cenarios E2E", "42 mapeados", "Desktop e mobile para painel, loja e checkout"],
        ["Revisao visual", "Aprovada", "Notificacoes em desktop, celular e modo escuro"],
    ],
    [48 * mm, 37 * mm, 85 * mm],
))
story += [Spacer(1, 7 * mm), para("Passos para publicar o pacote complementar", "h2")]
story += bullet_list([
    "Revisar e versionar as alteracoes locais do pacote complementar.",
    "Aplicar a migration 202607180007_operational_hardening.sql no Supabase.",
    "Aplicar a migration 202607180008_admin_notifications.sql no Supabase.",
    "Executar novamente lint, TypeScript, testes e build com o ambiente de producao.",
    "Realizar deploy na Vercel e validar login MFA, permissoes, colaboracao e notificacoes.",
    "Acompanhar a Central de saude e executar um backup verificado apos a publicacao.",
])
story += [Spacer(1, 6 * mm), callout(
    "Conclusao",
    "A Junior Imports possui hoje uma base completa para catalogo privado, atendimento por WhatsApp e gestao operacional. Os seis lotes estao concluidos; o pacote de robustez e notificacoes fecha a proxima etapa de maturidade assim que for publicado.",
    "green",
), PageBreak()]

# Quick reference appendix
story += heading("Referencia rapida", "Mapa completo das areas do painel")
story.append(data_table(
    ["Grupo", "Area", "Funcao principal"],
    [
        ["Operacao", "Visao geral", "Resumo, prioridades, atividade, grafico, atalhos e checklist."],
        ["Operacao", "CRM", "Tarefas, contatos, oportunidades e recompra."],
        ["Operacao", "Pedidos", "Solicitacoes, pedido manual, status, notas e rastreio."],
        ["Operacao", "Central da equipe", "Inbox, discussoes, mencoes, aprovacoes e presenca."],
        ["Gestao", "Financeiro", "Caixa, receitas, despesas, DRE e margem."],
        ["Gestao", "Estoque e lotes", "Movimentos, saldos, custos, lotes, validades e radar."],
        ["Gestao", "Compras", "Fornecedores, ordens, previsao e recebimento."],
        ["Gestao", "Relatorios", "Analises, comparativos, configuracoes e exportacoes."],
        ["Gestao", "Clientes", "Cliente 360, consentimentos, tarefas e cashback."],
        ["Catalogo", "Produtos", "Cadastro, imagens, preco, estoque, cashback e publicacao."],
        ["Catalogo", "Categorias", "Organizacao, ordem e visibilidade do catalogo."],
        ["Catalogo", "Importar planilha", "Carga em lote de produtos e estoque."],
        ["Loja", "Editor da loja", "Paginas institucionais e blocos modulares."],
        ["Loja", "Conteudo da home", "Secoes, destaques e ordem da pagina inicial."],
        ["Loja", "Banners", "Artes desktop/mobile, links, textos e reordenacao."],
        ["Marketing", "Cupons", "Descontos, periodo, limites e utilizacoes."],
        ["Marketing", "Marketing Studio", "Calendario, publicacao, versoes e automacoes."],
        ["Sistema", "Usuarios", "Contas, cargos, permissoes, senha e suspensao."],
        ["Sistema", "Seguranca e MFA", "Autenticadores, substituicao, remocao e auditoria."],
        ["Sistema", "Configuracoes", "Marca, contatos, WhatsApp e parametros da loja."],
        ["Sistema", "Dados", "Saude, auditoria, exportacao, importacao e restauracao."],
    ],
    [28 * mm, 44 * mm, 98 * mm],
))
story += [Spacer(1, 6 * mm), para(
    "Documento elaborado a partir do roadmap de execucao, do historico versionado, das migrations Supabase, das rotas atuais e da cobertura automatizada do projeto.",
    "body_small",
)]

doc.build(story, onFirstPage=page_decor, onLaterPages=page_decor)
print(OUTPUT)
