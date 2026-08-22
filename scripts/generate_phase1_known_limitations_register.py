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
OUT = ROOT / "output/pdf/Use_Me_With_Style_Phase_1_Known_Limitations_and_Workarounds_Register.pdf"
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

body = ParagraphStyle("body", fontName="Arial", fontSize=8.7, leading=12.4, textColor=INK, spaceAfter=5)
small = ParagraphStyle("small", parent=body, fontSize=7.15, leading=9.6, textColor=SOFT)
h1 = ParagraphStyle("h1", fontName="Arial-Bold", fontSize=22, leading=26, textColor=INK, spaceAfter=9)
h2 = ParagraphStyle("h2", fontName="Arial-Bold", fontSize=15, leading=19, textColor=INK, spaceBefore=7, spaceAfter=7)
h3 = ParagraphStyle("h3", fontName="Arial-Bold", fontSize=10.7, leading=14, textColor=GOLD_DARK, spaceBefore=5, spaceAfter=4)
label = ParagraphStyle("label", fontName="Arial-Bold", fontSize=6.8, leading=8.5, textColor=GOLD_DARK)
cover_title = ParagraphStyle("cover", fontName="Arial-Bold", fontSize=23, leading=28, alignment=TA_CENTER, textColor=INK)
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


def limitation(identifier, title, impact, workaround, monitoring, owner, trigger, exit_condition):
    return [P(f"{identifier}. {title}", h2), table(["Campo", "Registo aprovado"], [
        ("Impacto", impact), ("Solução operacional atual", workaround), ("Monitorização", monitoring),
        ("Responsável", owner), ("Gatilho de escalamento", trigger), ("Condição de saída / fase alvo", exit_condition),
    ], [45 * mm, 125 * mm])]


def header_footer(canvas, doc):
    canvas.saveState(); w, h = A4
    canvas.setStrokeColor(GOLD); canvas.setLineWidth(.8); canvas.line(18 * mm, h - 15 * mm, w - 18 * mm, h - 15 * mm)
    canvas.setFont("Arial", 7); canvas.setFillColor(SOFT)
    canvas.drawString(18 * mm, 12 * mm, "USE ME WITH STYLE - REGISTO DE LIMITAÇÕES E SOLUÇÕES OPERACIONAIS - FASE 1")
    canvas.drawRightString(w - 18 * mm, 12 * mm, f"Página {doc.page}")
    canvas.restoreState()


def page(title, intro=None):
    out = [P(title, h1)]
    if intro: out += [P(intro, body), Spacer(1, 3)]
    return out


def build_story():
    s = [Spacer(1, 16 * mm), Image(str(LOGO), width=58 * mm, height=30 * mm), Spacer(1, 8 * mm),
         P("REGISTO CONTROLADO DA CLIENTE", cover_sub), Spacer(1, 4 * mm),
         P("Limitações Conhecidas e<br/>Soluções Operacionais - Fase 1", cover_title), Spacer(1, 4 * mm),
         P("Impacto, mitigação, monitorização e condições de saída", cover_sub), Spacer(1, 13 * mm)]
    s += [table(["Campo", "Valor controlado"], [
        ("Documento", "UMWS-P1-LW-001"), ("Versão", "1.0"), ("Data de emissão", "22 de agosto de 2026"),
        ("Responsáveis", "José e Raisa"), ("Responsável pelas operações", "Raisa"),
        ("Responsável técnico", "José"), ("Estado", "Limitações e soluções aceites por José e Raisa"),
        ("Âmbito", "Produto e operação aprovados para a Fase 1"),
    ], [45 * mm, 125 * mm]), Spacer(1, 8 * mm),
         callout("Definição", "Uma limitação aceite permite uma operação segura através de uma solução conhecida e controlada. Uma falha que comprometa vendas, dados, recuperação, conteúdo aprovado ou aceitação formal não pode ser escondida neste registo como limitação.", "blue"),
         Spacer(1, 7 * mm), P("Critérios de aceitação", h2)]
    s += bullets(["O impacto é compreendido e comunicado.", "Existe uma solução operacional segura e executável.", "Há responsável, monitorização e gatilho de escalamento.", "A condição de saída ou fase futura está definida.", "Raisa conserva a autoridade para suspender vendas quando a operação deixa de ser segura."])
    s += [PageBreak()]

    s += page("1. Pagamentos e documentos comerciais")
    s += limitation("L01", "Sem pagamentos online integrados", "O cliente não conclui o pagamento automaticamente no website. A confirmação e reconciliação exigem intervenção humana.", "Checkout manual por WhatsApp nos mercados AO e PT. A encomenda é criada no sistema; Raisa confirma disponibilidade, pagamento e seguimento. O fluxo permanece como contingência futura do AppyPay.", "Fila de encomendas, estados de pagamento, stock reservado e reconciliação manual. Monitorização técnica cobre loja, CMS e inventário, não o provedor ainda desativado.", "Raisa - operação e decisão de venda; José - integridade técnica do fluxo.", "Pagamento ou encomenda não pode ser reconciliado; stock/total divergente; WhatsApp indisponível sem canal alternativo seguro.", "Fase 2: AppyPay após conclusão burocrática, credenciais de produção, testes sucesso/falha/cancelamento, webhooks, reconciliação e alertas." )
    s += limitation("L02", "Documentos emitidos pela aplicação não são faturas fiscais certificadas", "O PDF confirma comercialmente a encomenda e os valores, mas não substitui a faturação fiscal exigida pela entidade competente.", "Identificar o documento como registo comercial interno não fiscal. Raisa segue o processo contabilístico aprovado e não apresenta o PDF como fatura certificada.", "Verificar emissão, numeração interna, IVA, descontos, transporte e estado. Falhas são escaladas; não se inventam números ou documentos fora do processo.", "Raisa / contabilista - tratamento comercial e fiscal; José - emissão técnica interna.", "Cliente ou autoridade exige documento fiscal; divergência de IVA/total; falha de emissão; alteração legal/contabilística.", "Fase 2: selecionar SWEG ou FactPlus para Angola e Moloni Flex para Portugal, após decisão, aprovação contabilística/legal, sandbox e procedimento operacional." )
    s += [PageBreak()]

    s += page("2. Devoluções, clientes e fulfilment")
    s += limitation("L03", "Sem devoluções self-service", "O cliente não inicia nem acompanha devoluções/trocas automaticamente na página de consulta da encomenda.", "O cliente utiliza o canal de suporte aprovado. Raisa valida a encomenda, prazo, motivo e condição do artigo e gere manualmente o processo. Em Angola, o prazo operacional aprovado é de 14 dias.", "Registo manual da comunicação, decisão e alterações autorizadas. Confirmar que stock, pagamento e estado da encomenda não são alterados sem validação.", "Raisa - decisão e comunicação; José - apoio técnico quando houver impacto no sistema.", "Política contraditória; pedido fora da capacidade manual; disputa de pagamento; necessidade de reposição/reembolso não segura.", "Fase 2: devoluções robustas com pedido verificado, seleção de artigos, troca de tamanho, prova, auditoria, etiquetas e reembolsos quando aplicável." )
    s += limitation("L04", "Fulfilment de Angola é manual", "Não existe integração com transportadora, etiqueta automática ou tracking de operador em tempo real.", "Raisa coordena a entrega, confirma morada/telefone e atualiza os estados Em processamento, Enviada e Entregue com base em eventos reais.", "Encomendas pagas em processamento, tempo desde expedição, contactos do cliente e confirmação de entrega.", "Raisa.", "Entrega perdida/atrasada; morada incompleta; cliente inacessível; incapacidade de demonstrar a custódia do envio.", "Fase posterior: automatização quando o processo e o fornecedor de transporte justificarem integração." )
    s += limitation("L05", "Sem conta completa de cliente ou wishlist", "O cliente não dispõe de perfil persistente completo, histórico autenticado ou lista de desejos.", "Consulta segura da encomenda por número e e-mail; registos leves de cliente no admin; carrinho local sincronizado entre separadores do mesmo navegador.", "Taxa de falha/limitação da consulta, pedidos de suporte e incidentes de privacidade. Nunca expor detalhes sem verificação.", "Raisa - apoio ao cliente; José - segurança e funcionamento da consulta.", "Consulta revela dados indevidos; volume de suporte torna o processo inviável; necessidade comercial de conta persistente.", "Fase 2: decisão e implementação de contas/wishlist após requisitos de privacidade, recuperação e migração." )
    s += [PageBreak()]

    s += page("3. Mensagens, media e operação administrativa")
    s += limitation("L06", "Automação de mensagens permanece limitada e supervisionada", "A cobertura de canais e a autonomia da IA são deliberadamente restritas. Nem toda conversa pode ser tratada automaticamente.", "Sugestões de IA são revistas; assuntos sensíveis, pagamentos, reclamações e incerteza passam para resposta humana. Raisa pode pausar o bot e usar o canal aprovado.", "Webhook Meta, mensagens não lidas, conversas prioritárias, falhas de envio e estado do token. O teste live inbound/outbound exige autorização separada.", "Raisa - comunicação; José - webhook, token e diagnóstico técnico.", "Assinatura/webhook falha; token expira; resposta incorreta; mensagem sensível sem controlo humano; canal indisponível.", "Fase 2/3: expansão apenas com permissões estáveis, UAT autorizado, métricas, aprovação humana e regras de segurança." )
    s += limitation("L07", "Sem alertas específicos de pagamentos e faturação fiscal", "Não há sinalização de provedores que ainda não estão ativos em produção.", "Monitorizar apenas serviços correntes: loja, CMS, inventário, Resend e webhook Meta. A fila de encomendas e os documentos internos continuam sob revisão operacional.", "GitHub Actions, caixa master e revisão diária do admin.", "José - monitorização; Raisa - operação.", "Ativação de AppyPay ou fornecedor fiscal sem alertas/reconciliação; falha atual do checkout manual ou documento interno.", "Fase 2: criar alertas, reconciliação e runbooks específicos no mesmo release que ativa cada provedor." )
    s += limitation("L08", "Limitações da biblioteca Media", "Reutilização/deduplicação e gestão central de relações ainda não cobrem toda a experiência ideal; carregamentos repetidos podem exigir revisão manual.", "Utilizar a biblioteca existente, consultar utilizações antes de eliminar, evitar duplicados e confirmar imagens em produto/categoria/homepage após guardar.", "Imagens em falta, duplicadas, sem associação correta de cor, enquadramento ou texto alternativo.", "Raisa - conteúdo; José - falhas técnicas e recuperação R2.", "Imagem desaparece em vários locais; eliminação/associação ambígua; perda de objeto; impacto na venda.", "Fase 2: melhorias de reutilização, deduplicação, pesquisa, relações e eliminação segura conforme notas existentes no código." )
    s += [PageBreak()]

    s += page("4. Engenharia e modelo de entrega")
    s += limitation("L09", "Testes de migração PostgreSQL condicionais", "Parte dos testes de migração requer PostgreSQL descartável e pode ser ignorada quando o ambiente não está disponível.", "Registar os testes ignorados, executar num PostgreSQL isolado antes de alterações significativas de esquema e preservar backup/restauro comprovados.", "Resultado dos testes, migrações incluídas, logs Railway e integridade de tabelas/linhas.", "José.", "Release altera esquema sem teste descartável; migração falha; rollback de código seria incompatível com dados.", "Antes de trabalho de esquema intensivo da Fase 2: automatizar ambiente descartável e validar todos os caminhos relevantes." )
    s += limitation("L10", "Avisos de dependências sem exposição runtime confirmada", "Alguns pacotes transitivos podem apresentar avisos de segurança mesmo quando o componente afetado não está exposto pelo servidor de produção.", "Manter disposição técnica escrita por aviso, limitar exposição, acompanhar versões upstream e atualizar apenas com testes de regressão.", "npm audit, alterações de advisories, árvore de dependências, build e testes. Crítico/alto novo exige triagem antes do release.", "José.", "Exploit runtime aplicável; advisory muda de âmbito; correção segura disponível; dependência passa a estar exposta.", "Atualização na primeira janela segura com testes completos; não adiar avisos com exposição real." )
    s += limitation("L11", "Sem ambiente persistente separado de staging na entrega da Fase 1", "Alterações da Fase 2 não devem ser experimentadas diretamente sobre clientes ou dados reais; a separação persistente ainda será formalizada.", "Uma branch focada por repositório, PR verificado, builds/testes, previews quando disponíveis, releases conhecidos e recuperação através do histórico Vercel/Railway e backups isolados.", "Estado de PR/CI, deployment ligado ao commit, monitor de produção e evidência de release.", "José.", "Feature de Fase 2 requer mutações end-to-end, credenciais sandbox, migração de dados ou UAT de Raisa.", "Início da Fase 2: implementar ambientes development/staging/production, bases e media separados, sandbox de integrações e promoção controlada para main." )
    s += [PageBreak()]

    s += page("5. Exceções de validação e limites de aceitação")
    s += limitation("L12", "Round trip live de mensagens não incluído no UAT autorizado", "O handshake técnico do webhook está monitorizado, mas o Gate 4 não representa uma conversa Instagram live completa como aprovada/testada.", "Tratar o canal como limitado; utilizar controlo humano e canal de suporte aprovado. Executar inbound/outbound apenas com autorização e conta de teste segura.", "Handshake Meta, logs sanitizados, mensagens no admin e expiração do token.", "Raisa / proprietária Meta para autorização; José para execução técnica.", "Mensagens são apresentadas como totalmente validadas; webhook passa mas conversas falham; cliente fica sem resposta.", "Próxima janela autorizada ou Fase 2: UAT live controlado, evidência e atualização deste registo." )
    s += [P("Não são limitações aceites", h2), callout("Gaps de fecho", "Os itens abaixo bloqueiam ou condicionam a aceitação quando aplicáveis. Não podem ser reclassificados como limitações apenas para concluir a entrega.", "red")]
    s += bullets(["Produtos vendáveis sem imagens e conteúdo aprovados por Raisa.", "Políticas públicas contraditórias, incluindo prazos de devolução diferentes de 14 dias em Angola.", "Vulnerabilidades críticas/altas sem triagem de exposição e disposição escrita.", "Incapacidade de monitorizar ou recuperar loja, CMS, base de dados, media ou inventário.", "Documentação operacional inexistente ou com instruções não executáveis.", "Falha crítica de encomendas, stock, IVA, documentos ou privacidade.", "Aceitação final e exceções sem assinatura da pessoa autorizada."])
    s += [PageBreak()]

    s += page("6. Governação, revisão e aceitação")
    s += [P("Regra de escalamento", h2), P("Raisa é a única autoridade para suspender vendas. José fornece a avaliação técnica e lidera a resposta. O canal de emergência é a conversa WhatsApp direta entre ambos. Recomenda-se suspensão quando checkout, encomendas, inventário, privacidade ou recuperação deixam de ser demonstravelmente seguros.")]
    s += [P("Revisão do registo", h2)] + bullets(["Rever no início de cada fase e antes de qualquer ativação de provedor.", "Atualizar após incidente, alteração legal/contabilística ou mudança de solução operacional.", "Fechar uma limitação apenas quando a condição de saída estiver comprovada.", "Transferir funcionalidades adiadas para o registo de Fase 2/3 com fonte, dependência e critérios de reentrada.", "Emitir nova versão, manter a anterior como substituída e obter nova aceitação quando o impacto mudar."])
    s += [P("Resumo de propriedade", h2), table(["Área", "Responsável principal", "Escalamento"], [
        ("Operações, clientes, fulfilment e suspensão de vendas", "Raisa", "José quando há impacto técnico"),
        ("Infraestrutura, segurança, releases e recuperação", "José", "Raisa para decisão operacional"),
        ("Contabilidade e enquadramento fiscal", "Raisa / contabilista", "José para integração técnica"),
        ("Registo e aceitação das limitações", "José e Raisa", "Raisa aprova o pacote final"),
    ], [62 * mm, 58 * mm, 50 * mm])]
    s += [Spacer(1, 5 * mm), callout("Aceitação", "José e Raisa aceitaram as limitações e exceções indicadas para a Fase 1. A aceitação não cobre defeitos não divulgados, não dispensa aprovação legal/contabilística e não impede Raisa de suspender vendas.", "green")]
    return s


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=21 * mm, bottomMargin=18 * mm,
                          title="Use Me With Style - Registo de Limitacoes e Solucoes Operacionais - Fase 1", author="Use Me With Style delivery team")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=header_footer)])
    doc.build(build_story())
    print(OUT)


if __name__ == "__main__":
    main()
