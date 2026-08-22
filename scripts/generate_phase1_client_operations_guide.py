from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, PageBreak, PageTemplate, Paragraph,
    Spacer, Table, TableStyle, KeepTogether,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/pdf/Use_Me_With_Style_Phase_1_Client_Operations_Guide.pdf"
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


def register_fonts():
    pdfmetrics.registerFont(TTFont("Arial", str(FONT_DIR / "Arial.ttf")))
    pdfmetrics.registerFont(TTFont("Arial-Bold", str(FONT_DIR / "Arial Bold.ttf")))


register_fonts()
styles = getSampleStyleSheet()
body = ParagraphStyle("body", fontName="Arial", fontSize=9.2, leading=13.2, textColor=INK, spaceAfter=5)
small = ParagraphStyle("small", parent=body, fontSize=7.8, leading=10.5, textColor=SOFT)
h1 = ParagraphStyle("h1", fontName="Arial-Bold", fontSize=23, leading=27, textColor=INK, spaceAfter=10)
h2 = ParagraphStyle("h2", fontName="Arial-Bold", fontSize=16, leading=20, textColor=INK, spaceBefore=8, spaceAfter=8)
h3 = ParagraphStyle("h3", fontName="Arial-Bold", fontSize=11.5, leading=15, textColor=GOLD_DARK, spaceBefore=6, spaceAfter=5)
label = ParagraphStyle("label", fontName="Arial-Bold", fontSize=7.2, leading=9, textColor=GOLD_DARK)
cover_title = ParagraphStyle("cover", fontName="Arial-Bold", fontSize=25, leading=30, alignment=TA_CENTER, textColor=INK)
cover_sub = ParagraphStyle("cover_sub", fontName="Arial-Bold", fontSize=9, leading=13, alignment=TA_CENTER, textColor=GOLD_DARK)


def P(text, style=body):
    return Paragraph(text, style)


def bullets(items):
    rows = []
    for item in items:
        rows.append(Table([[P("•", body), P(item, body)]], colWidths=[5 * mm, 165 * mm], style=[("VALIGN", (0, 0), (-1, -1), "TOP")]))
    return rows


def steps(items):
    rows = []
    for i, item in enumerate(items, 1):
        rows.append(Table([[P(str(i), label), P(item, body)]], colWidths=[8 * mm, 162 * mm], style=[
            ("BACKGROUND", (0, 0), (0, 0), PAPER), ("BOX", (0, 0), (0, 0), .5, RULE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        rows.append(Spacer(1, 2))
    return rows


def callout(title, text, tone="gold"):
    palette = {"gold": (PAPER, GOLD_DARK, RULE), "green": (colors.HexColor("#EEF6F0"), GREEN, colors.HexColor("#B8D3BF")), "red": (colors.HexColor("#FBEFEE"), RED, colors.HexColor("#DEB8B4"))}
    bg, fg, border = palette[tone]
    return Table([[P(title.upper(), ParagraphStyle("co_l", parent=label, textColor=fg)), P(text, ParagraphStyle("co_b", parent=body, textColor=fg, spaceAfter=0))]], colWidths=[30 * mm, 140 * mm], style=[
        ("BACKGROUND", (0, 0), (-1, -1), bg), ("BOX", (0, 0), (-1, -1), .7, border),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ])


def simple_table(headers, rows, widths):
    data = [[P(x, ParagraphStyle("th", parent=label, textColor=colors.white)) for x in headers]]
    data += [[P(str(x), small) for x in row] for row in rows]
    return Table(data, colWidths=widths, repeatRows=1, style=[
        ("BACKGROUND", (0, 0), (-1, 0), INK), ("GRID", (0, 0), (-1, -1), .45, RULE),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ])


def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setStrokeColor(GOLD); canvas.setLineWidth(.8); canvas.line(18 * mm, h - 15 * mm, w - 18 * mm, h - 15 * mm)
    canvas.setFont("Arial", 7); canvas.setFillColor(SOFT)
    canvas.drawString(18 * mm, 12 * mm, "USE ME WITH STYLE - GUIA DE OPERAÇÕES DA CLIENTE - FASE 1")
    canvas.drawRightString(w - 18 * mm, 12 * mm, f"Página {doc.page}")
    canvas.restoreState()


def page(title, intro=None):
    items = [P(title, h1)]
    if intro: items += [P(intro, body), Spacer(1, 3)]
    return items


def build_story():
    s = []
    s += [Spacer(1, 16 * mm), Image(str(LOGO), width=58 * mm, height=30 * mm), Spacer(1, 8 * mm),
          P("GUIA CONTROLADO DA CLIENTE", cover_sub), Spacer(1, 4 * mm),
          P("Guia de Operações<br/>Fase 1", cover_title), Spacer(1, 4 * mm),
          P("Administração diária da loja Use Me With Style", cover_sub), Spacer(1, 14 * mm)]
    s += [simple_table(["Campo", "Valor"], [
        ("Documento", "UMWS-P1-OG-001"), ("Versão", "1.0"), ("Data", "22 de agosto de 2026"),
        ("Responsável pelas operações", "Raisa"), ("Responsável técnico", "José"),
        ("Mercados", "Angola e Portugal"), ("Âmbito", "Operações aprovadas da Fase 1"),
    ], [42 * mm, 128 * mm]), Spacer(1, 8 * mm),
          callout("Importante", "Este guia explica a operação corrente. Pagamentos integrados, faturação fiscal certificada e devoluções self-service estão previstos para uma fase posterior. O checkout manual por WhatsApp permanece ativo como solução corrente e futura contingência."),
          Spacer(1, 8 * mm), P("Como utilizar este guia", h2)]
    s += bullets(["Execute apenas operações para as quais tem autorização.", "Confirme sempre o mercado correto (AO ou PT), os valores, o stock e o destinatário antes de guardar.", "Em caso de dúvida, não repita ações irreversíveis; contacte o responsável técnico.", "Nunca partilhe palavras-passe, tokens ou códigos de recuperação em mensagens ou documentos."])
    s += [PageBreak()]

    s += page("1. Acesso, navegação e rotina diária", "A administração da loja está disponível através do Storefront Admin. O Payload CMS existe como ferramenta técnica de suporte; a operação diária deve ser feita no Storefront Admin sempre que a função estiver disponível.")
    s += [P("Acesso seguro", h2)] + steps([
        "Abra o endereço oficial do Storefront Admin e confirme que o domínio está correto.",
        "Inicie sessão com a conta autorizada. Não guarde credenciais em computadores partilhados.",
        "Escolha PT ou EN no seletor do menu. Esta escolha altera a interface de administração, não o conteúdo público já guardado.",
        "No final, termine a sessão, sobretudo num dispositivo que não seja exclusivamente seu.",
    ])
    s += [P("Menu principal", h2), simple_table(["Área", "Utilização"], [
        ("Dashboard", "Resumo diário, alertas operacionais e exportação do resumo."),
        ("Encomendas", "Consulta, validação e evolução do estado das encomendas."),
        ("Produtos", "Catálogo, preços, variantes, stock, imagens e exportação de inventário."),
        ("Artigos", "Conteúdos editoriais e programa de estilo/blogue."),
        ("Definições", "Homepage, conteúdos institucionais e configurações operacionais."),
        ("Clientes", "Pesquisa e exportação dos registos de clientes."),
        ("Mensagens", "Caixa de entrada do Instagram e escalamento humano."),
        ("Faturas", "Consulta e descarga dos documentos comerciais internos."),
        ("Media", "Biblioteca de imagens e verificação das utilizações."),
        ("Cupões", "Criação e gestão de códigos promocionais."),
    ], [35 * mm, 135 * mm])]
    s += [P("Rotina recomendada", h2)] + bullets(["Verificar encomendas novas e em revisão.", "Verificar produtos sem stock ou com stock baixo.", "Ler mensagens não lidas e concluir as que exigem resposta humana.", "Confirmar se existem faturas com falha e exportar apenas quando necessário.", "No fim do dia, confirmar que as encomendas alteradas ficaram no estado correto."])
    s += [PageBreak()]

    s += page("2. Produtos, variantes e stock", "Cada produto deve ter conteúdo aprovado, preço por mercado, variantes reais, imagens adequadas e stock coerente antes de ficar ativo.")
    s += [P("Criar ou editar um produto", h2)] + steps([
        "Abra Produtos. Para criar, use a ação de novo produto; para editar, selecione o produto existente.",
        "Preencha nome, descrições PT/EN, categoria, tipo de produto e informação de tamanho/ajuste.",
        "Defina os mercados disponíveis, preços AO/PT e, se aplicável, preço promocional e período da promoção.",
        "Configure cores e tamanhos. Introduza o stock por combinação de cor e tamanho para Angola e Portugal.",
        "Adicione imagens, associe cada imagem à cor correta ou marque-a como geral para aparecer em todas as cores.",
        "Confirme peso de expedição, elegibilidade de devolução e notas relevantes.",
        "Ative o produto apenas depois de rever a pré-visualização e guardar sem erros.",
    ])
    s += [callout("Regra de stock", "Nunca aumente stock sem confirmação física. O stock é controlado por variante e mercado. Uma encomenda cancelada só deve repor stock de acordo com o comportamento automático validado; confirme o resultado antes de fazer qualquer correção manual.", "red"),
          P("Imagens de produto", h2)]
    s += bullets(["Escolha a fotografia com melhor representação do produto como imagem principal.", "Use o editor de recorte para manter o enquadramento consistente e responsivo.", "Associe fotografias específicas às respetivas cores; fotografias gerais aparecem em todas as cores.", "Preencha texto alternativo descritivo quando necessário e evite nomes genéricos.", "Não carregue imagens repetidas sem verificar primeiro a biblioteca Media."])
    s += [P("Desativar em vez de eliminar", h2), P("Quando um artigo deixa temporariamente de ser vendido, desative-o. Elimine apenas registos de teste ou incorretos e confirme previamente se não existem encomendas, imagens ou referências dependentes.")]
    s += [PageBreak()]

    s += page("3. Media, categorias e homepage")
    s += [P("Biblioteca Media", h2)] + bullets(["A biblioteca mostra imagens carregadas independentemente de um produto específico.", "Antes de eliminar, consulte onde a imagem é utilizada.", "A eliminação pode remover a imagem de todos os locais associados. Pare se a utilização não for clara.", "O sistema otimiza as imagens, mas uma fotografia original nítida e bem iluminada continua a ser essencial."])
    s += [P("Categorias", h2)] + steps([
        "Abra Definições e a área de categorias/conteúdo correspondente.",
        "Selecione a categoria criada pelo administrador ou crie a categoria necessária.",
        "Preencha título e texto introdutório em PT e EN; confirme o identificador/slug.",
        "Escolha a imagem e ajuste o recorte no editor responsivo.",
        "Guarde e confirme a categoria nas lojas AO e PT antes de a divulgar.",
    ])
    s += [P("Homepage", h2)] + steps([
        "Abra Definições e selecione o separador Conteúdo/Homepage.",
        "Atualize eyebrow, título, subtítulo, botão e destino para PT e EN.",
        "Carregue a imagem hero. Ajuste separadamente o enquadramento desktop e mobile.",
        "Revise as coleções e categorias em destaque e confirme que os produtos associados estão ativos.",
        "Clique em Guardar. Aguarde a confirmação e valide a homepage pública em desktop e mobile.",
    ])
    s += [callout("Não publicar às cegas", "Uma confirmação de gravação não substitui a validação visual. Depois de alterar imagem ou texto, abra sempre a homepage pública AO e PT e confirme PT/EN, enquadramento, ligações e legibilidade.", "green")]
    s += [PageBreak()]

    s += page("4. Conteúdo institucional e artigos")
    s += [P("Páginas institucionais", h2), P("Em Definições, a área de Conteúdo permite manter FAQ, Guia de Tamanhos, Sobre Nós e outros textos operacionais sem recorrer ao Payload CMS. Preserve a estrutura existente e mantenha versões PT e EN coerentes.")]
    s += [P("Procedimento", h3)] + steps([
        "Escolha a página ou secção correta.", "Atualize primeiro o texto em português e depois a versão inglesa.",
        "Confirme ligações, contactos, prazos e políticas; não publique condições legais sem aprovação.",
        "Guarde e valide a página nas duas línguas e nos dois mercados.",
    ])
    s += [P("Artigos / guia de estilo", h2)] + bullets(["Use títulos claros e fotografias aprovadas.", "Defina resumo, conteúdo, imagem, estado e data de publicação.", "Associe produtos apenas quando a relação for verdadeira e os produtos estiverem ativos.", "Reveja metadados, texto alternativo e ligações antes de publicar.", "Despublique conteúdos desatualizados em vez de os deixar com informação incorreta."])
    s += [callout("Conteúdo sensível", "Preços, prazos de entrega, devoluções, pagamentos e afirmações legais devem coincidir com a operação real. Se houver conflito, pare a publicação e confirme com Raisa e José.", "red")]
    s += [PageBreak()]

    s += page("5. Encomendas e checkout manual por WhatsApp", "Na Fase 1, o cliente conclui os dados da encomenda na loja e continua a conversa no WhatsApp. O sistema cria a encomenda; o pagamento é confirmado manualmente pelo administrador.")
    s += [P("Fluxo do cliente", h2)] + steps([
        "O cliente adiciona produtos ao carrinho e preenche o checkout.",
        "A loja cria o número de encomenda e apresenta Continuar no WhatsApp.",
        "A mensagem preparada inclui os dados operacionais da encomenda para a Use Me identificar o pedido.",
        "A Use Me confirma disponibilidade, entrega e forma de pagamento na conversa.",
        "Depois de validar o pagamento real, o administrador confirma o pagamento na encomenda.",
    ])
    s += [P("Tratar uma encomenda", h2)] + steps([
        "Abra Encomendas e selecione o número correto. Confirme nome, mercado, artigos, variantes, valores, morada e contacto.",
        "Enquanto o estado for Nova, pode cancelar se a encomenda não deve prosseguir. Depois da confirmação de pagamento, o cancelamento fica bloqueado.",
        "Só confirme o pagamento depois de o valor ter sido efetivamente recebido e reconciliado.",
        "Passe para Em processamento quando iniciar a preparação.",
        "Passe para Enviada apenas depois da entrega ao transportador e registe os dados disponíveis.",
        "Passe para Entregue quando houver confirmação de entrega.",
    ])
    s += [callout("Ação financeira", "Confirmar pagamento emite o documento comercial interno e envia comunicações ao cliente. Verifique duas vezes o número da encomenda e o montante; não use esta ação como simulação.", "red"),
          P("Morada e campos editáveis", h2), P("Quando corrigir telefone, morada ou nota, confirme todas as linhas, incluindo a segunda linha de morada. Guarde os campos e volte a abrir a encomenda para confirmar a persistência.")]
    s += [PageBreak()]

    s += page("6. Fulfilment, estados e comunicações")
    s += [P("Sequência normal", h2), simple_table(["Estado", "Quando utilizar", "Verificação"], [
        ("Nova", "Encomenda criada, ainda sem pagamento confirmado.", "Dados, disponibilidade e contacto."),
        ("Em revisão de pagamento", "Quando é necessária validação adicional.", "Comprovativo e valor recebido."),
        ("Em processamento", "Pagamento confirmado; preparação iniciada.", "Stock, picking e embalagem."),
        ("Enviada", "Entregue ao transportador.", "Destino, contacto e informação de envio."),
        ("Entregue", "Entrega confirmada.", "Confirmação do cliente/transportador."),
        ("Cancelada", "Apenas enquanto Nova e quando não prossegue.", "Reposição de stock e ausência de pagamento."),
    ], [29 * mm, 78 * mm, 63 * mm])]
    s += [P("E-mails automáticos", h2)] + bullets(["Confirmação e atualizações são enviadas para o e-mail guardado na encomenda.", "Os botões de seguimento abrem a consulta com os dados pré-preenchidos quando aplicável.", "As imagens devem corresponder à cor/variante comprada.", "Se o envio falhar, não altere estados repetidamente. Registe o problema e contacte José."])
    s += [P("Checklist antes de expedir", h2)] + bullets(["Produto, cor, tamanho e quantidade conferidos.", "Nome, telefone e morada completos, incluindo segunda linha.", "Documento comercial emitido sem falha.", "Embalagem e conteúdo correspondem à encomenda.", "Estado e informação de transporte atualizados apenas depois da expedição real."])
    s += [PageBreak()]

    s += page("7. Cupões, preços promocionais e documentos comerciais")
    s += [P("Cupões", h2)] + steps([
        "Abra Cupões e escolha Novo ou Editar.", "Defina código, tipo de desconto, valor e regras aplicáveis.",
        "Defina datas e limite de utilização quando necessário.", "Guarde e teste num carrinho controlado antes de comunicar o código.",
        "Desative o cupão quando terminar; elimine apenas registos de teste sem utilização.",
    ])
    s += [P("Diferença entre promoção e cupão", h2), simple_table(["Mecanismo", "Onde é definido", "Como aparece"], [
        ("Preço promocional", "No produto e por mercado.", "O artigo mostra preço anterior e preço de venda."),
        ("Cupão", "Na área Cupões.", "O desconto é aplicado no carrinho/checkout após validação do código."),
    ], [40 * mm, 60 * mm, 70 * mm])]
    s += [P("Documentos comerciais internos", h2), P("A área Faturas lista os documentos emitidos e permite descarregar o PDF. Estes documentos são internos e não constituem faturação fiscal certificada. A integração com um fornecedor fiscal está adiada para uma fase posterior.")]
    s += bullets(["Confirme número da encomenda, cliente, artigos, IVA, transporte e total.", "O resumo separa subtotal sem IVA, IVA, total dos produtos com IVA, transporte isento e total pago.", "A tabela identifica a taxa/valor de IVA e indica visualmente artigos em promoção.", "Se o estado for Falha, não recrie manualmente sem diagnóstico; contacte José."])
    s += [PageBreak()]

    s += page("8. Clientes, mensagens e escalamento")
    s += [P("Clientes", h2)] + bullets(["Pesquise por nome, e-mail, telefone ou referência disponível.", "Abra o detalhe para consultar histórico e contexto operacional.", "Utilize a exportação apenas para finalidade autorizada e proteja o ficheiro.", "Não use dados de clientes para campanhas sem base legal e aprovação."])
    s += [P("Mensagens Instagram", h2)] + steps([
        "Abra Mensagens e trate primeiro conversas não lidas ou assinaladas como prioridade.",
        "Leia o histórico e o contexto do cliente antes de responder.",
        "Quando existir sugestão de IA, confirme produto, stock, política, cupão e mercado. Edite ou rejeite se necessário.",
        "Use resposta humana para pagamentos, reclamações, dados sensíveis, exceções ou qualquer resposta incerta.",
        "Marque a conversa como Precisa de resposta, Prioridade ou Concluída conforme o estado real.",
        "Pause o bot quando a conversa exigir controlo exclusivamente humano.",
    ])
    s += [callout("Regra da IA", "Uma sugestão de IA não é uma decisão. Raisa continua responsável por confirmar factos, preços, stock, políticas e tom antes do envio em assuntos que exijam aprovação.", "red"),
          P("Canal indisponível", h2), P("Se o Instagram ou outro canal não estiver disponível, registe a ocorrência e utilize o canal de suporte aprovado. Não prometa resposta automática nem integração que não esteja operacional.")]
    s += [PageBreak()]

    s += page("9. Exportações e proteção de dados")
    s += [P("Exportações disponíveis", h2), simple_table(["Área", "Saída", "Utilização"], [
        ("Dashboard", "Resumo PDF/CSV conforme ação disponível", "Revisão operacional e comercial."),
        ("Encomendas", "CSV filtrado", "Acompanhamento, reconciliação e análise."),
        ("Produtos", "Inventário CSV", "Stock por produto, variante e mercado."),
        ("Clientes", "Lista CSV", "Operação autorizada e contacto necessário."),
        ("Faturas", "PDF individual", "Documento comercial interno da encomenda."),
    ], [32 * mm, 48 * mm, 90 * mm])]
    s += [P("Procedimento seguro", h2)] + steps([
        "Aplique os filtros pretendidos e confirme o número de registos.",
        "Exporte apenas os dados necessários para a finalidade definida.",
        "Guarde o ficheiro numa localização controlada; não envie por canais pessoais ou públicos.",
        "Apague cópias locais desnecessárias depois de concluída a tarefa, respeitando a política de conservação.",
    ])
    s += [callout("Dados pessoais", "As exportações podem conter dados pessoais. Partilhe apenas com pessoas autorizadas, nunca as coloque em Notion público, GitHub, mensagens abertas ou ferramentas sem aprovação.", "red")]
    s += [PageBreak()]

    s += page("10. Trocas, devoluções e limitações da Fase 1")
    s += [P("Processo atual", h2), P("A funcionalidade self-service de trocas e devoluções não faz parte da Fase 1 publicada. O cliente deve contactar a Use Me através do canal de suporte aprovado. Raisa avalia o pedido, confirma a política aplicável e gere manualmente os passos e registos necessários.")]
    s += [P("Ao receber um pedido", h3)] + steps([
        "Identifique a encomenda e valide a identidade/contacto do cliente.",
        "Confirme data de entrega, artigo, variante, motivo e condição do produto.",
        "Aplique a política aprovada do mercado; em Angola, o prazo operacional acordado é de 14 dias.",
        "Registe a decisão e as comunicações num local operacional autorizado.",
        "Não altere stock, pagamento ou estado da encomenda sem confirmação do processo e, quando necessário, orientação técnica.",
    ])
    s += [P("Principais limitações aceites", h2)] + bullets(["Sem pagamentos online integrados: checkout manual por WhatsApp.", "Documentos da aplicação não são faturas fiscais certificadas.", "Fulfilment em Angola é coordenado manualmente.", "Sem conta completa de cliente ou wishlist; utiliza-se consulta de encomenda.", "Mensagens automatizadas permanecem limitadas e sob supervisão humana.", "Devoluções self-service, etiquetas e reembolsos automáticos ficam para a Fase 2."])
    s += [PageBreak()]

    s += page("11. Falhas comuns e resposta inicial")
    s += [simple_table(["Sintoma", "Primeira verificação", "Ação"], [
        ("Não consegue iniciar sessão", "Domínio, ligação, credenciais e 2FA.", "Não repita indefinidamente; contacte José."),
        ("Alteração não aparece", "Confirmação de gravação, mercado, língua e cache.", "Atualize uma vez; não duplique o registo."),
        ("Imagem não carrega", "Formato, tamanho, ligação e utilização existente.", "Tente ficheiro aprovado; contacte José se persistir."),
        ("Stock incorreto", "Variante, mercado, encomendas recentes e cancelamentos.", "Pare novas alterações e reconcilie fisicamente."),
        ("E-mail não chegou", "E-mail do cliente, spam e estado da encomenda.", "Não repita estados; escale para José."),
        ("Fatura com falha", "Estado na área Faturas e dados da encomenda.", "Não invente número; escale para José."),
        ("Mensagem não envia", "Estado do canal e conversa correta.", "Use canal aprovado e informe José."),
        ("Loja indisponível", "AO, PT e domínio principal.", "Contacte José; Raisa pode autorizar pausa de vendas."),
    ], [42 * mm, 61 * mm, 67 * mm])]
    s += [P("Princípios de resposta", h2)] + bullets(["Preservar evidência: hora, página, encomenda/produto e mensagem de erro.", "Evitar repetir ações que enviam e-mails, alteram stock ou confirmam pagamento.", "Não apagar registos para esconder a falha.", "Raisa tem autoridade para pausar vendas; José é o responsável técnico e de infraestrutura.", "O canal de emergência é a conversa WhatsApp entre Raisa e José."])
    s += [PageBreak()]

    s += page("12. Escalamento e checklist de encerramento")
    s += [P("Níveis práticos", h2), simple_table(["Prioridade", "Exemplos", "Resposta"], [
        ("Crítica", "Loja/CMS indisponível, pagamento confirmado incorretamente, exposição de dados, perda de stock generalizada.", "Parar a ação, contactar José de imediato; Raisa decide pausa de vendas."),
        ("Alta", "E-mails/faturas falham, encomenda bloqueada, canal de mensagens indisponível.", "Registar evidência e contactar José no próprio período operacional."),
        ("Normal", "Texto, imagem, apresentação ou dúvida operacional sem impacto imediato.", "Registar e tratar na próxima janela acordada."),
    ], [25 * mm, 85 * mm, 60 * mm])]
    s += [P("Informação a enviar", h2)] + bullets(["Data e hora.", "Área e endereço da página.", "Número da encomenda ou nome do produto, sem expor dados desnecessários.", "Passos executados imediatamente antes.", "Mensagem de erro e captura de ecrã.", "Impacto: quantos clientes/mercados e se a venda deve continuar."])
    s += [P("Checklist diário de saída", h2)] + bullets(["Encomendas novas revistas.", "Pagamentos confirmados apenas quando recebidos.", "Encomendas expedidas/entregues com estado correto.", "Mensagens prioritárias tratadas ou atribuídas.", "Stock crítico identificado.", "Falhas de fatura/e-mail registadas e escaladas.", "Exportações protegidas e sessão terminada."])
    s += [Spacer(1, 5 * mm), callout("Aprovação", "Responsável operacional: Raisa. Responsável técnico e de infraestrutura: José. Este guia será validado durante uma sessão remota abrangente, gravada, com assinatura de ambos.", "green")]
    return s


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=21 * mm, bottomMargin=18 * mm,
                          title="Use Me With Style - Guia de Operações da Cliente - Fase 1", author="Use Me With Style delivery team")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=header_footer)])
    doc.build(build_story())
    print(OUT)


if __name__ == "__main__":
    main()
