from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, Image, PageBreak, PageTemplate, Paragraph, Spacer, Table


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/pdf/Use_Me_With_Style_Administrator_Training_Record.pdf"
LOGO = ROOT / "src/assets/use-me-logo-black-transparent.png"
FONT_DIR = Path("/System/Library/Fonts/Supplemental")

GOLD = colors.HexColor("#B58A25")
GOLD_DARK = colors.HexColor("#755719")
INK = colors.HexColor("#171411")
SOFT = colors.HexColor("#6D675F")
PAPER = colors.HexColor("#FBF8F1")
RULE = colors.HexColor("#DDCFB0")
GREEN = colors.HexColor("#376A46")
BLUE = colors.HexColor("#315D7A")

pdfmetrics.registerFont(TTFont("Arial", str(FONT_DIR / "Arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", str(FONT_DIR / "Arial Bold.ttf")))

body = ParagraphStyle("body", fontName="Arial", fontSize=8.6, leading=12.2, textColor=INK, spaceAfter=5)
small = ParagraphStyle("small", parent=body, fontSize=7.1, leading=9.5, textColor=SOFT)
h1 = ParagraphStyle("h1", fontName="Arial-Bold", fontSize=22, leading=26, textColor=INK, spaceAfter=9)
h2 = ParagraphStyle("h2", fontName="Arial-Bold", fontSize=14.5, leading=18, textColor=INK, spaceBefore=7, spaceAfter=6)
label = ParagraphStyle("label", fontName="Arial-Bold", fontSize=6.8, leading=8.5, textColor=GOLD_DARK)
cover_title = ParagraphStyle("cover", fontName="Arial-Bold", fontSize=24, leading=29, alignment=TA_CENTER, textColor=INK)
cover_sub = ParagraphStyle("cover_sub", fontName="Arial-Bold", fontSize=8.5, leading=12, alignment=TA_CENTER, textColor=GOLD_DARK)


def P(text, style=body):
    return Paragraph(text, style)


def bullets(items):
    return [Table([[P("•", body), P(item, body)]], colWidths=[5 * mm, 165 * mm], style=[("VALIGN", (0, 0), (-1, -1), "TOP")]) for item in items]


def callout(title, text, tone="gold"):
    palette = {
        "gold": (PAPER, GOLD_DARK, RULE),
        "green": (colors.HexColor("#EEF6F0"), GREEN, colors.HexColor("#B8D3BF")),
        "blue": (colors.HexColor("#EDF4F8"), BLUE, colors.HexColor("#B8CAD5")),
    }
    bg, fg, border = palette[tone]
    return Table([[P(title.upper(), ParagraphStyle("co_l", parent=label, textColor=fg)), P(text, ParagraphStyle("co_b", parent=body, textColor=fg, spaceAfter=0))]], colWidths=[34 * mm, 136 * mm], style=[
        ("BACKGROUND", (0, 0), (-1, -1), bg), ("BOX", (0, 0), (-1, -1), .7, border),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ])


def table(headers, rows, widths, font=small):
    data = [[P(x, ParagraphStyle("th", parent=label, textColor=colors.white)) for x in headers]]
    data += [[P(str(x), font) for x in row] for row in rows]
    return Table(data, colWidths=widths, repeatRows=1, style=[
        ("BACKGROUND", (0, 0), (-1, 0), INK), ("GRID", (0, 0), (-1, -1), .45, RULE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4.5), ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ])


def header_footer(canvas, doc):
    canvas.saveState(); w, h = A4
    canvas.setStrokeColor(GOLD); canvas.setLineWidth(.8); canvas.line(18 * mm, h - 15 * mm, w - 18 * mm, h - 15 * mm)
    canvas.setFont("Arial", 7); canvas.setFillColor(SOFT)
    canvas.drawString(18 * mm, 12 * mm, "USE ME WITH STYLE - REGISTO DE FORMAÇÃO DA ADMINISTRADORA")
    canvas.drawRightString(w - 18 * mm, 12 * mm, f"Página {doc.page}")
    canvas.restoreState()


def build_story():
    s = [Spacer(1, 15 * mm), Image(str(LOGO), width=58 * mm, height=30 * mm), Spacer(1, 8 * mm),
         P("DOCUMENTO CONTROLADO DA CLIENTE", cover_sub), Spacer(1, 4 * mm),
         P("Registo de Formação<br/>da Administradora", cover_title), Spacer(1, 4 * mm),
         P("Agenda, exercícios, evidência e validação de competências", cover_sub), Spacer(1, 12 * mm)]
    s += [table(["Campo", "Valor controlado"], [
        ("Documento", "UMWS-P1-ATR-001"), ("Versão", "1.0"), ("Data de preparação", "22 de agosto de 2026"),
        ("Formador", "José"), ("Administradora / formanda", "Raisa"),
        ("Formato", "Sessão remota, única e abrangente, com gravação"),
        ("Estado", "Preparado - sessão, evidências e assinaturas pendentes"),
        ("Pré-requisitos", "Guião de Operações, Runbook Técnico, Registo de Contas e Registo de Limitações entregues"),
    ], [47 * mm, 123 * mm]), Spacer(1, 7 * mm),
        callout("Regra de fecho", "A preparação deste documento não conclui o Gate 5.7. O gate só pode ser marcado como concluído depois da presença de Raisa, gravação, execução dos exercícios, avaliação das competências e assinatura de ambas as partes.", "blue"),
        Spacer(1, 6 * mm), P("Objetivos da sessão", h2)]
    s += bullets([
        "Permitir que Raisa execute autonomamente as tarefas correntes da loja e do admin.",
        "Confirmar que alterações de produto, stock, homepage, cupões, encomendas, faturas e mensagens são feitas sem comprometer dados ou vendas.",
        "Treinar a resposta a incidentes, incluindo pausa de vendas, checkout WhatsApp de contingência e escalamento técnico.",
        "Registar dúvidas, necessidades de reforço e ações posteriores sem as confundir com defeitos da Fase 1.",
    ])
    s += [PageBreak(), P("1. Sessão, presença e evidência", h1),
          table(["Registo", "Preenchimento na sessão"], [
              ("Data e hora de início", "________________________________________________________"),
              ("Data e hora de fim", "________________________________________________________"),
              ("Plataforma da reunião", "________________________________________________________"),
              ("Formador presente", "José  [  ] Sim   [  ] Não"),
              ("Administradora presente", "Raisa  [  ] Sim   [  ] Não"),
              ("Outros participantes", "________________________________________________________"),
              ("Ligação/local da gravação", "________________________________________________________\n________________________________________________________"),
              ("Consentimento para gravação", "Raisa  [  ] Sim   José  [  ] Sim"),
              ("Materiais utilizados", "Guião de Operações; Runbook; Registos de Contas, Limitações e Adiamentos; ambiente de produção com dados descartáveis/seguros."),
          ], [52 * mm, 118 * mm]), Spacer(1, 7 * mm), P("Agenda recomendada", h2),
          table(["Bloco", "Conteúdo", "Duração"], [
              ("Abertura", "Âmbito da Fase 1, limitações, responsabilidades e segurança de acesso.", "15 min"),
              ("Catálogo", "Produtos, imagens, categorias, variantes, cores, tamanhos, stock e publicação.", "35 min"),
              ("Conteúdo", "Homepage, FAQ, guia de tamanhos, sobre nós, artigos e imagens.", "25 min"),
              ("Comercial", "Cupões, encomenda, checkout WhatsApp, pagamento confirmado, fatura e estados.", "40 min"),
              ("Clientes e mensagens", "Pesquisa, privacidade, mensagens, escalamento humano e limites da automação.", "25 min"),
              ("Emergência", "Incidente, pausa de vendas, evidência, escalamento e recuperação orientada pelo runbook.", "25 min"),
              ("Avaliação e fecho", "Exercícios finais, dúvidas, reforço, ações e assinatura.", "20 min"),
          ], [25 * mm, 125 * mm, 20 * mm])]
    s += [PageBreak(), P("2. Exercícios práticos - catálogo e conteúdo", h1),
          callout("Segurança", "Utilizar um produto de teste aprovado ou alterações reversíveis. Não eliminar definitivamente media, clientes, encomendas ou outros dados de produção durante a formação.", "gold"), Spacer(1, 5 * mm),
          table(["ID", "Exercício e critério observável", "Resultado"], [
              ("E01", "Criar ou editar um produto; preencher nomes PT/EN, preço, mercado, categoria, descrição e estado. Guardar sem campos obrigatórios em falta.", "[  ] Aprovado\n[  ] Reforço"),
              ("E02", "Adicionar variantes de cor/tamanho, associar imagens por cor e confirmar que a imagem geral continua disponível em todas as cores.", "[  ] Aprovado\n[  ] Reforço"),
              ("E03", "Atualizar stock e explicar quando o artigo deve ficar indisponível, sem provocar stock negativo ou sobrescrever o mercado errado.", "[  ] Aprovado\n[  ] Reforço"),
              ("E04", "Carregar e recortar uma imagem; confirmar pré-visualização, texto alternativo e utilização correta para desktop/mobile.", "[  ] Aprovado\n[  ] Reforço"),
              ("E05", "Editar a homepage e guardar conscientemente; validar texto, botão e imagem no storefront AO/PT e PT/EN aplicável.", "[  ] Aprovado\n[  ] Reforço"),
              ("E06", "Localizar e editar FAQ, guia de tamanhos, sobre nós ou artigo; explicar publicação e revisão bilingue.", "[  ] Aprovado\n[  ] Reforço"),
          ], [12 * mm, 128 * mm, 30 * mm]), Spacer(1, 7 * mm),
          P("Notas do formador", h2), P("__________________________________________________________________________________________<br/>__________________________________________________________________________________________<br/>__________________________________________________________________________________________", body)]
    s += [PageBreak(), P("3. Exercícios práticos - operação comercial", h1),
          table(["ID", "Exercício e critério observável", "Resultado"], [
              ("E07", "Criar um cupão controlado, definir mercados/validade/limites, testar o desconto e desativá-lo no final.", "[  ] Aprovado\n[  ] Reforço"),
              ("E08", "Abrir uma encomenda nova; identificar cliente, morada completa, artigos/variantes, subtotal sem IVA, IVA, envio e total.", "[  ] Aprovado\n[  ] Reforço"),
              ("E09", "Explicar o checkout WhatsApp, localizar a referência correta e confirmar que dados sensíveis ficam disponíveis apenas no admin.", "[  ] Aprovado\n[  ] Reforço"),
              ("E10", "Confirmar pagamento de uma encomenda de teste autorizada; validar mudança de estado, e-mail, imagens corretas por variante e fatura.", "[  ] Aprovado\n[  ] Reforço"),
              ("E11", "Avançar processamento e envio; explicar quando o cancelamento fica desativado e como o cliente acompanha a encomenda.", "[  ] Aprovado\n[  ] Reforço"),
              ("E12", "Exportar um relatório de encomendas, inventário ou clientes e explicar o tratamento seguro do ficheiro exportado.", "[  ] Aprovado\n[  ] Reforço"),
          ], [12 * mm, 128 * mm, 30 * mm]), Spacer(1, 7 * mm),
          P("Notas do formador", h2), P("__________________________________________________________________________________________<br/>__________________________________________________________________________________________<br/>__________________________________________________________________________________________", body)]
    s += [PageBreak(), P("4. Mensagens, escalamento e emergência", h1),
          table(["ID", "Exercício e critério observável", "Resultado"], [
              ("E13", "Localizar uma conversa, distinguir resposta automatizada de intervenção humana e assumir/encerrar o atendimento corretamente.", "[  ] Aprovado\n[  ] Reforço"),
              ("E14", "Identificar uma mensagem sensível, reclamação ou falha de automação; suspender a resposta automática e escalar pelo canal acordado.", "[  ] Aprovado\n[  ] Reforço"),
              ("E15", "Simular indisponibilidade do storefront: registar hora/sintoma, recolher evidência, contactar José e evitar alterações não autorizadas.", "[  ] Aprovado\n[  ] Reforço"),
              ("E16", "Simular falha do AppyPay futuro: explicar como Raisa poderá ativar o checkout WhatsApp de contingência depois da respetiva implementação e validação.", "[  ] Aprovado\n[  ] Reforço"),
              ("E17", "Explicar a autoridade de Raisa para suspender vendas, o canal de emergência WhatsApp José/Raisa e a informação mínima do incidente.", "[  ] Aprovado\n[  ] Reforço"),
              ("E18", "Distinguir recuperação operacional da responsabilidade técnica: Raisa executa ações documentadas; José gere infraestrutura, rollback e restauro.", "[  ] Aprovado\n[  ] Reforço"),
          ], [12 * mm, 128 * mm, 30 * mm]), Spacer(1, 7 * mm),
          callout("Contacto", "Canal de emergência: conversa WhatsApp entre José e Raisa. E-mail partilhado para continuidade: usemewithstyle.master@gmail.com. Não colocar palavras-passe, tokens ou códigos 2FA neste registo.", "blue")]
    s += [PageBreak(), P("5. Avaliação de competências", h1),
          P("O formador assinala uma classificação por área. Uma área com 'Requer reforço' deve ter ação, responsável e data definidos antes da aceitação final.", body),
          table(["Área", "Autónoma", "Com apoio", "Requer reforço", "Observações"], [
              ("Produto e stock", "[  ]", "[  ]", "[  ]", "________________________"),
              ("Homepage e conteúdo", "[  ]", "[  ]", "[  ]", "________________________"),
              ("Cupões", "[  ]", "[  ]", "[  ]", "________________________"),
              ("Encomenda e fatura", "[  ]", "[  ]", "[  ]", "________________________"),
              ("Mensagens e escalamento", "[  ]", "[  ]", "[  ]", "________________________"),
              ("Resposta de emergência", "[  ]", "[  ]", "[  ]", "________________________"),
          ], [48 * mm, 22 * mm, 24 * mm, 29 * mm, 47 * mm]), Spacer(1, 7 * mm),
          P("Ações de reforço / acompanhamento", h2),
          table(["Ação", "Responsável", "Prazo", "Evidência de fecho"], [
              ("________________________________", "____________", "____________", "____________________________"),
              ("________________________________", "____________", "____________", "____________________________"),
              ("________________________________", "____________", "____________", "____________________________"),
          ], [68 * mm, 32 * mm, 28 * mm, 42 * mm]), Spacer(1, 7 * mm),
          P("Resultado global", h2),
          table(["Decisão", "Seleção"], [
              ("Competência demonstrada para operação autónoma da Fase 1", "[  ] Sim   [  ] Sim, com ações menores   [  ] Não"),
              ("Gate 5.7", "[  ] Concluído   [  ] Condicional   [  ] Pendente"),
              ("Referência da gravação/evidência", "________________________________________________________"),
          ], [78 * mm, 92 * mm])]
    s += [PageBreak(), P("6. Confirmação e assinaturas", h1),
          callout("Declaração", "As assinaturas confirmam a realização da sessão, os exercícios efetivamente executados, o resultado registado e as ações pendentes. Não certificam áreas não demonstradas nem removem limitações ou adiamentos documentados.", "gold"), Spacer(1, 7 * mm),
          P("Declaração da administradora", h2),
          P("Confirmo que participei na formação, tive oportunidade de executar os exercícios e colocar dúvidas, recebi os documentos de apoio e compreendo os limites da Fase 1, os canais de escalamento e a minha autoridade para suspender vendas.", body),
          table(["Raisa - administradora / cliente", "Preenchimento"], [
              ("Nome completo", "________________________________________________________"),
              ("Assinatura", "________________________________________________________"),
              ("Data e hora", "________________________________________________________"),
              ("Observações / reservas", "________________________________________________________\n________________________________________________________"),
          ], [58 * mm, 112 * mm]), Spacer(1, 8 * mm),
          P("Declaração do formador", h2),
          P("Confirmo que ministrei os conteúdos indicados, observei os exercícios assinalados e registei com exatidão o nível de competência e as ações de reforço.", body),
          table(["José - formador / responsável técnico", "Preenchimento"], [
              ("Nome completo", "________________________________________________________"),
              ("Assinatura", "________________________________________________________"),
              ("Data e hora", "________________________________________________________"),
              ("Observações / reservas", "________________________________________________________\n________________________________________________________"),
          ], [58 * mm, 112 * mm]), Spacer(1, 8 * mm),
          callout("Estado atual", "Documento preparado em 22 de agosto de 2026. Até a sessão, gravação, exercícios e assinaturas existirem, o Gate 5.7 permanece pendente e não deve ser apresentado como concluído.", "blue")]
    return s


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=21 * mm, bottomMargin=18 * mm,
                          title="Use Me With Style - Registo de Formação da Administradora", author="Use Me With Style delivery team")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=header_footer)])
    doc.build(build_story())
    print(OUT)


if __name__ == "__main__":
    main()
