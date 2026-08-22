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
OUT = ROOT / "output/pdf/Use_Me_With_Style_Phase_2_3_Deferral_Register.pdf"
LOGO = ROOT / "src/assets/use-me-logo-black-transparent.png"
FONT_DIR = Path("/System/Library/Fonts/Supplemental")

GOLD = colors.HexColor("#B58A25")
GOLD_DARK = colors.HexColor("#755719")
INK = colors.HexColor("#171411")
SOFT = colors.HexColor("#6D675F")
PAPER = colors.HexColor("#FBF8F1")
RULE = colors.HexColor("#DDCFB0")
GREEN = colors.HexColor("#376A46")
RED = colors.HexColor("#9B3B32")
BLUE = colors.HexColor("#315D7A")

pdfmetrics.registerFont(TTFont("Arial", str(FONT_DIR / "Arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", str(FONT_DIR / "Arial Bold.ttf")))

body = ParagraphStyle("body", fontName="Arial", fontSize=8.65, leading=12.3, textColor=INK, spaceAfter=5)
small = ParagraphStyle("small", parent=body, fontSize=7.1, leading=9.55, textColor=SOFT)
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
        "gold": (PAPER, GOLD_DARK, RULE), "green": (colors.HexColor("#EEF6F0"), GREEN, colors.HexColor("#B8D3BF")),
        "red": (colors.HexColor("#FBEFEE"), RED, colors.HexColor("#DEB8B4")), "blue": (colors.HexColor("#EDF4F8"), BLUE, colors.HexColor("#B8CAD5")),
    }
    bg, fg, border = palette[tone]
    return Table([[P(title.upper(), ParagraphStyle("co_l", parent=label, textColor=fg)), P(text, ParagraphStyle("co_b", parent=body, textColor=fg, spaceAfter=0))]], colWidths=[32 * mm, 138 * mm], style=[
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


def deferral(identifier, title, source, reason, dependency, workaround, reentry, phase, acceptance):
    return [P(f"{identifier}. {title}", h2), table(["Campo", "Decisão controlada"], [
        ("Data e fonte da decisão", source), ("Motivo", reason), ("Dependências", dependency),
        ("Solução atual", workaround), ("Critérios de reentrada", reentry), ("Fase alvo", phase),
        ("Aceitação da cliente", acceptance),
    ], [45 * mm, 125 * mm])]


def header_footer(canvas, doc):
    canvas.saveState(); w, h = A4
    canvas.setStrokeColor(GOLD); canvas.setLineWidth(.8); canvas.line(18 * mm, h - 15 * mm, w - 18 * mm, h - 15 * mm)
    canvas.setFont("Arial", 7); canvas.setFillColor(SOFT)
    canvas.drawString(18 * mm, 12 * mm, "USE ME WITH STYLE - REGISTO DE ADIAMENTOS DAS FASES 2 E 3")
    canvas.drawRightString(w - 18 * mm, 12 * mm, f"Página {doc.page}")
    canvas.restoreState()


def page(title, intro=None):
    out = [P(title, h1)]
    if intro: out += [P(intro, body), Spacer(1, 3)]
    return out


def build_story():
    accepted = "Aceite por José e Raisa para o fecho da Fase 1; aprovação final do pacote por Raisa."
    source = "13 de agosto de 2026 - checklist atualizado e decisões de fecho confirmadas em 20-22 de agosto de 2026."
    s = [Spacer(1, 16 * mm), Image(str(LOGO), width=58 * mm, height=30 * mm), Spacer(1, 8 * mm),
         P("REGISTO CONTROLADO DA CLIENTE", cover_sub), Spacer(1, 4 * mm),
         P("Adiamentos para as<br/>Fases 2 e 3", cover_title), Spacer(1, 4 * mm),
         P("Dependências, soluções atuais e critérios de reentrada", cover_sub), Spacer(1, 13 * mm)]
    s += [table(["Campo", "Valor controlado"], [
        ("Documento", "UMWS-P1-DR-001"), ("Versão", "1.0"), ("Data de emissão", "22 de agosto de 2026"),
        ("Linha de base", "Checklist atualizado de 13 de agosto de 2026"),
        ("Responsáveis", "José e Raisa"), ("Aprovadora final", "Raisa"),
        ("Estado", "Adiamentos aceites para não bloquear a entrega da Fase 1"),
        ("Regra", "Nenhum item regressa ao âmbito sem cumprir os critérios de reentrada"),
    ], [45 * mm, 125 * mm]), Spacer(1, 8 * mm),
         callout("Objetivo", "Este registo evita que funcionalidades adiadas sejam esquecidas ou apresentadas como concluídas. Cada item mantém a decisão, o motivo, as dependências, a solução atual, os critérios de reentrada, a fase alvo e a aceitação da cliente.", "blue"),
         Spacer(1, 7 * mm), P("Princípios", h2)]
    s += bullets(["Adiado não significa cancelado nem automaticamente comprometido para uma data.", "A fase alvo é uma intenção de planeamento, sujeita a prioridade e dependências.", "Credenciais, decisões legais e aprovação contabilística não podem ser substituídas por desenvolvimento.", "O checkout WhatsApp mantém-se como contingência mesmo depois da ativação do AppyPay.", "Mudança de âmbito requer decisão escrita, plano de testes e atualização deste PDF."])
    s += [PageBreak()]

    s += page("1. Pagamentos e faturação certificada")
    s += deferral("D01", "AppyPay em produção para Angola", source, "A integração de código existe, mas os passos burocráticos e de onboarding do comerciante ainda não permitem ativação responsável.", "Aprovação da conta/entidade; credenciais live; configuração do comerciante; webhooks; processo de reconciliação; aprovação operacional.", "Checkout manual por WhatsApp; encomenda e confirmação de pagamento geridas no admin.", "Credenciais de produção; testes controlados de sucesso, falha, cancelamento e timeout; idempotência; reconciliação; alertas; rollback e autorização de Raisa.", "Fase 2", accepted)
    s += deferral("D02", "Pagamentos online em Portugal", source, "A entidade legal portuguesa ainda não está disponível. Paybird é a direção preferida, mas a contratação e solução final dependem da entidade e do fornecedor.", "Entidade legal; conta bancária/merchant; KYC; contrato Paybird ou decisão alternativa; métodos de pagamento; política de chargebacks e reconciliação.", "Checkout manual por WhatsApp na loja PT.", "Entidade e conta aprovadas; seleção final do provedor; sandbox; fluxos success/failure/cancel/refund; reconciliação, fiscalidade, alertas e UAT.", "Fase 2", accepted)
    s += deferral("D03", "Faturação fiscal certificada em Angola", source, "A cliente decidiu lançar a Fase 1 com os documentos comerciais internos enquanto se avaliam SWEG e FactPlus.", "Respostas técnicas/comerciais; seleção do fornecedor; aprovação do contabilista/advogado; credenciais sandbox/live; séries, impostos, notas de crédito e cancelamentos.", "PDF interno não fiscal emitido pela aplicação e processo contabilístico manual aprovado.", "Fornecedor selecionado; contrato; mapeamento de produtos/IVA; idempotência; documentos/retificações; sandbox; reconciliação e runbook aprovados.", "Fase 2", accepted)
    s += [PageBreak()]

    s += page("2. Portugal, fiscalidade e pós-venda")
    s += deferral("D04", "Faturação fiscal certificada em Portugal", source, "Sem entidade legal portuguesa não é possível concluir a configuração fiscal. Moloni Flex é a solução prevista, sujeita a validação final.", "Entidade legal; contabilista; conta Moloni; séries e impostos; dados legais; integração e processo de correções/reembolsos.", "Documento comercial interno e operação limitada de acordo com aprovação legal/contabilística.", "Entidade criada; Moloni contratado; configuração fiscal aprovada; sandbox; emissão, nota de crédito, cancelamento, reconciliação e UAT.", "Fase 2", accepted)
    s += deferral("D05", "Conclusão do lançamento comercial completo em Portugal", source, "A base técnica PT existe, mas a operação comercial completa depende de estrutura legal, pagamentos, faturação e validação regulatória.", "Entidade legal; provedor de pagamentos; faturação certificada; termos finais; Livro de Reclamações/ADR e aprovação jurídica.", "Loja PT tecnicamente disponível com checkout manual, sem representar integrações adiadas como ativas.", "Checklist legal assinado; pagamentos e faturação ativos/testados; políticas públicas coerentes; responsáveis e suporte definidos.", "Fase 2", accepted)
    s += deferral("D06", "Devoluções e trocas self-service V2", source, "A primeira implementação não era suficientemente robusta para entrega; o código/rotas foram retirados da Fase 1.", "Modelo de domínio; verificação do cliente; seleção parcial de artigos; troca de tamanho; provas; auditoria; stock; reembolso e integração de pagamento.", "Pedido por canal de suporte e gestão manual por Raisa segundo a política aprovada.", "Especificação aprovada; estados e permissões; testes E2E; prevenção de duplicados; reconciliação de stock/valores; UAT de Raisa.", "Fase 2", accepted)
    s += [PageBreak()]

    s += page("3. Experiência do cliente e crescimento")
    s += deferral("D07", "Contas completas de cliente e wishlist", source, "A Fase 1 priorizou compra, consulta segura da encomenda e operação leve sem acrescentar autenticação/recuperação complexa.", "Modelo de conta; consentimento e privacidade; migração de clientes; autenticação, recuperação e segurança; desenho de wishlist.", "Consulta de encomenda por número/e-mail e registos leves no admin.", "Requisitos e UX aprovados; threat model; recuperação; migração; testes de privacidade e E2E; suporte definido.", "Fase 2", accepted)
    s += deferral("D08", "Programa de fidelização e segmentação VIP", source, "Não é necessário para a operação segura da Fase 1 e depende de uma base de clientes, métricas e consentimentos maduros.", "Contas/identidade; regras comerciais; consentimento; analytics; benefícios e prevenção de abuso.", "Segmentação e acompanhamento manual quando necessário.", "Objetivos/KPIs; base legal; regras de elegibilidade; orçamento; integração com clientes/cupões; testes e aprovação.", "Fase 3", accepted)
    s += deferral("D09", "Campanhas avançadas, Meta Ads e automação de marketing", source, "O âmbito da Fase 1 mantém mensagens limitadas e supervisionadas; publicidade e campanhas exigem governação, consentimento e métricas.", "Contas Meta estáveis; permissões; pixel/consentimento; catálogo elegível ou estratégia sem catálogo; conteúdo; orçamento; atribuição.", "Conteúdo orgânico, artigos e mensagens com aprovação humana.", "Estratégia e KPIs aprovados; consentimento; permissões; contas; eventos/atribuição verificados; revisão humana e limites de gasto.", "Fase 3", accepted)
    s += [PageBreak()]

    s += page("4. Operações, reporting e media")
    s += deferral("D10", "Reporting e exportações avançadas", source, "A Fase 1 entrega resumos e CSV/PDF essenciais; relatórios agendados, filtros avançados e modelos contabilísticos exigem desenho adicional.", "Definições de métricas; necessidades de Raisa/contabilista; períodos; impostos; permissões; formatos e retenção.", "Dashboard, exportação de encomendas, inventário, clientes e PDFs individuais existentes.", "Dicionário de métricas; amostras aprovadas; filtros e reconciliação; testes de grandes volumes; proteção de dados e UAT.", "Fase 2", accepted)
    s += deferral("D11", "Permissões avançadas, equipas e múltiplos armazéns", source, "A operação da Fase 1 é de uma pequena equipa com Raisa como administradora principal; RBAC e stock multi-local acrescentariam complexidade prematura.", "Papéis e responsabilidades; modelo de autorização; auditoria; locais de stock; transferência e reconciliação.", "Acesso administrativo controlado e stock por mercado AO/PT.", "Matriz RBAC; contas nomeadas; testes de autorização; modelo de armazém e migração; auditoria e formação.", "Fase 3", accepted)
    s += deferral("D12", "Biblioteca Media - reutilização, deduplicação e relações avançadas", source, "A biblioteca atual suporta a Fase 1, mas os pontos 3-6 do plano de melhoria foram deixados em notas de código para desenvolvimento posterior.", "Hash/identidade de ficheiro; índice de utilizações; seleção/reutilização; políticas de substituição/eliminação; migração e UX.", "Verificação manual da biblioteca, utilizações e imagens; evitar carregamentos repetidos; proteção contra eliminação em uso.", "Especificação dos itens anotados; migração sem quebrar URLs; testes de relações; recuperação R2 e UAT.", "Fase 2", accepted)
    s += [PageBreak()]

    s += page("5. Arquitetura, ambientes e automação")
    s += deferral("D13", "Ambientes persistentes development/staging/production", source, "A Fase 1 termina com produção operacional; a Fase 2 terá features end-to-end que não devem ser validadas sobre clientes/dados reais.", "Projetos Vercel/Railway; bases e buckets separados; branches; credenciais sandbox; dados de teste; promoção e rollback.", "Branch focada, PR, CI/builds, previews quando disponíveis, histórico de deployments e backups isolados.", "Criar staging isolado; separar DB/media/secrets; sandbox de integrações; smoke/E2E; política de promoção para main e acesso de Raisa.", "Início da Fase 2", accepted)
    s += deferral("D14", "Migração para Next.js ou serviços separados", source, "A arquitetura atual satisfaz a Fase 1. Uma migração sem benefício mensurável criaria risco e custo desnecessários.", "Caso de negócio/técnico; requisitos de SSR/SEO; serviços; dados; autenticação; hosting; plano de migração e rollback.", "Vite/React no Vercel com API same-origin para o CMS Railway; SEO técnico já implementado no modelo atual.", "Métrica/problema comprovado; ADR; protótipo; paridade funcional; testes SEO/performance; migração incremental e rollback.", "Fase 3 ou quando os critérios técnicos justificarem", accepted)
    s += deferral("D15", "Automação alargada de IA e operações", source, "A automação atual é intencionalmente limitada; decisões financeiras, sensíveis e de suporte exigem controlo humano.", "Políticas, dados de qualidade, permissões, métricas, auditoria, custos, fallback e aprovação humana.", "Sugestões supervisionadas, bot pausável e escalamento humano.", "Casos de uso e riscos aprovados; evals; logs/auditoria; limites; monitorização; testes de segurança e UAT de Raisa.", "Fase 3", accepted)
    s += [PageBreak()]

    s += page("6. Regras de reentrada e aceitação")
    s += [P("Um item só regressa ao âmbito quando", h2)] + bullets(["O responsável confirma que as dependências externas estão concluídas.", "Existe especificação atualizada, owner, critérios de aceitação e plano de rollback.", "Development/staging e credenciais sandbox estão disponíveis quando aplicável.", "A segurança, privacidade, fiscalidade e contabilidade foram aprovadas pelas pessoas competentes.", "Testes unitários, integração, E2E e UAT foram definidos antes da ativação live.", "Runbook, alertas, reconciliação e suporte entram no mesmo release da funcionalidade.", "Raisa aprova a ativação comercial; José aprova a prontidão técnica."])
    s += [P("Não incluído como promessa", h2), callout("Sem data implícita", "A indicação Fase 2 ou Fase 3 não constitui uma data de entrega nem aprovação automática de orçamento. O planeamento será confirmado depois do fecho formal da Fase 1 e da priorização com Raisa.", "gold")]
    s += [P("Resumo por fase", h2), table(["Fase", "Itens previstos"], [
        ("Fase 2", "AppyPay AO; pagamentos PT; fiscalidade AO/PT; Portugal completo; devoluções V2; contas/wishlist; reporting; Media; ambientes separados."),
        ("Fase 3", "Fidelização/VIP; campanhas/Meta Ads; RBAC/múltiplos armazéns; automação alargada; migração arquitetural apenas se justificada."),
        ("Mantido sempre", "Checkout WhatsApp como fallback; supervisão humana; autoridade de Raisa para suspender vendas; documentação e testes antes de produção."),
    ], [35 * mm, 135 * mm])]
    s += [Spacer(1, 5 * mm), callout("Aceitação", "José e Raisa aceitaram estes adiamentos para permitir a entrega controlada da Fase 1. Raisa aprova o pacote final. Qualquer alteração é versionada e nunca apaga a decisão anterior.", "green")]
    return s


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=21 * mm, bottomMargin=18 * mm,
                          title="Use Me With Style - Registo de Adiamentos das Fases 2 e 3", author="Use Me With Style delivery team")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=header_footer)])
    doc.build(build_story())
    print(OUT)


if __name__ == "__main__":
    main()
