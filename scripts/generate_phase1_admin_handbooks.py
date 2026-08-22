from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image as RLImage, KeepTogether, PageBreak,
    PageTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs/client-delivery/phase-1/administration-handbook"
SHOT_ROOT = OUT_DIR / "assets/screenshots"
ANNOTATED = SHOT_ROOT / "annotated"
PDF_OUT = ROOT / "output/pdf"
ANNOTATED.mkdir(parents=True, exist_ok=True)
PDF_OUT.mkdir(parents=True, exist_ok=True)

GOLD = colors.HexColor("#B58A2A")
GOLD_DARK = colors.HexColor("#765619")
INK = colors.HexColor("#171411")
SOFT = colors.HexColor("#6F685F")
PAPER = colors.HexColor("#FAF6EF")
RULE = colors.HexColor("#D8C9AA")
GREEN = colors.HexColor("#27734B")
RED = colors.HexColor("#9B3737")

LABELS = {
    "safe": {"pt": "AÇÃO SEGURA E ROTINEIRA", "en": "SAFE ROUTINE ACTION", "color": GREEN},
    "review": {"pt": "CONFIRMAR ANTES DE PUBLICAR", "en": "CHECK BEFORE PUBLISHING", "color": GOLD_DARK},
    "contact": {"pt": "CONTACTAR O JOSÉ PRIMEIRO", "en": "CONTACT JOSE FIRST", "color": RED},
    "impact": {"pt": "AÇÃO DE ELEVADO IMPACTO", "en": "HIGH-IMPACT ACTION", "color": RED},
}


def bi(pt: str, en: str) -> dict[str, str]:
    return {"pt": pt, "en": en}


def proc(title_pt: str, title_en: str, steps_pt: list[str], steps_en: list[str], safety="safe", note_pt="", note_en=""):
    return {
        "title": bi(title_pt, title_en), "steps": bi(steps_pt, steps_en),
        "safety": safety, "note": bi(note_pt, note_en),
    }


CHAPTERS = [
    {
        "title": bi("1. Começar em segurança", "1. Start safely"),
        "summary": bi(
            "Este manual foi escrito para uma utilizadora sem experiência prévia em plataformas de comércio eletrónico. Use primeiro a administração própria da loja. O Payload CMS é uma área técnica e excecional.",
            "This handbook assumes no previous ecommerce administration experience. Use the storefront admin first. Payload CMS is a technical, exceptional area.",
        ),
        "image": "admin/01-dashboard-overview.jpg",
        "callouts": bi(
            "1 Navegação principal. 2 Pesquisa, notificações e exportação. 3 Indicadores e ações prioritárias.",
            "1 Main navigation. 2 Search, notifications and exports. 3 Metrics and priority actions.",
        ),
        "procedures": [
            proc("Iniciar e terminar sessão", "Sign in and sign out", [
                "Abra https://ao.usemewithstyle.shop/admin ou https://pt.usemewithstyle.shop/admin.",
                "Introduza o endereço de email e a palavra-passe entregues separadamente.",
                "Confirme que o nome da conta aparece no fundo da barra lateral.",
                "No final, escolha Terminar sessão, sobretudo num computador partilhado.",
            ], [
                "Open https://ao.usemewithstyle.shop/admin or https://pt.usemewithstyle.shop/admin.",
                "Enter the email address and password supplied separately.",
                "Confirm that the account name appears at the bottom of the sidebar.",
                "When finished, choose Log out, especially on a shared computer.",
            ]),
            proc("Mudar o idioma da administração", "Change the admin language", [
                "Use PT ou EN por baixo do logótipo. Esta escolha altera os rótulos da administração, não o idioma publicado na loja.",
                "Ao editar conteúdo bilingue, preencha sempre os campos Português e English quando existirem.",
            ], [
                "Use PT or EN under the logo. This changes admin labels, not the language published on the storefront.",
                "When editing bilingual content, always complete both Portuguese and English fields when available.",
            ]),
            proc("Interpretar os rótulos de segurança", "Interpret safety labels", [
                "Ação segura e rotineira: pode executar no trabalho diário.",
                "Confirmar antes de publicar: rever texto, preço, imagem e mercado antes de guardar.",
                "Contactar o José primeiro: pagamentos, IVA, infraestrutura, integrações ou comportamento inesperado.",
                "Ação de elevado impacto: eliminação, despublicação ou mudança que afete clientes existentes.",
            ], [
                "Safe routine action: suitable for everyday operations.",
                "Check before publishing: review copy, price, image and market before saving.",
                "Contact Jose first: payments, VAT, infrastructure, integrations or unexpected behavior.",
                "High-impact action: deletion, unpublishing or a change affecting existing customers.",
            ], safety="review"),
        ],
    },
    {
        "title": bi("2. Rotina diária e painel", "2. Daily routine and dashboard"),
        "summary": bi(
            "O painel resume encomendas, receita paga, confirmações pendentes, processamento, stock baixo, desempenho por mercado e saúde operacional.",
            "The dashboard summarizes orders, paid revenue, pending confirmations, processing, low stock, market performance and operational health.",
        ),
        "image": "admin/01-dashboard-overview.jpg",
        "callouts": bi("1 Cartões de hoje. 2 Período de 7/30/90 dias. 3 Fila de atenção e tendências.", "1 Today's cards. 2 7/30/90-day period. 3 Attention queue and trends."),
        "procedures": [
            proc("Verificação da manhã", "Morning check", [
                "Abra o Dashboard e verifique Necessitam confirmação, Em processamento e Stock baixo.",
                "Abra cada cartão em Ver detalhes para aplicar automaticamente o filtro correto.",
                "Veja a Fila de atenção. Trate primeiro pagamentos, encomendas atrasadas e variantes sem stock.",
                "Compare Angola e Portugal sem somar Kz e EUR. São moedas e mercados separados.",
            ], [
                "Open Dashboard and check Needs confirmation, Processing and Low stock.",
                "Open each card through View details to apply the correct filter automatically.",
                "Review the Attention queue. Handle payments, overdue orders and out-of-stock variants first.",
                "Compare Angola and Portugal without adding Kz and EUR together. They are separate currencies and markets.",
            ]),
            proc("Mudar o período", "Change the reporting period", [
                "Escolha 7d, 30d ou 90d no bloco Desempenho por mercado ou Tendência de receita.",
                "Selecione Receita ou Encomendas para mudar o gráfico.",
                "Clique numa barra diária para abrir as encomendas desse dia.",
            ], [
                "Choose 7d, 30d or 90d in Market performance or Revenue trend.",
                "Choose Revenue or Orders to change the chart.",
                "Click a daily bar to open that day's orders.",
            ]),
            proc("Exportar o resumo", "Export the summary", [
                "Escolha Exportar resumo para um relatório rápido do período atual.",
                "Escolha Descarregar CSV detalhado quando precisar de linhas para análise.",
                "Guarde os ficheiros com segurança: podem incluir dados pessoais e comerciais.",
            ], [
                "Choose Export summary for a quick report for the current period.",
                "Choose Download detailed CSV when row-level analysis is needed.",
                "Store files securely: they may include personal and commercial data.",
            ], safety="review"),
        ],
    },
    {
        "title": bi("3. Encomendas, pagamento e expedição", "3. Orders, payment and fulfilment"),
        "summary": bi(
            "A lista de encomendas permite pesquisar, filtrar, exportar e abrir cada encomenda. O detalhe controla pagamento, processamento, expedição, entrega e documentos.",
            "The orders list supports search, filtering, export and order detail access. The detail page controls payment, processing, shipment, delivery and documents.",
        ),
        "image": "admin/02-orders-list.jpg",
        "callouts": bi("1 Pesquisa e filtros. 2 Estado, pagamento e mercado. 3 Exportação e abertura do detalhe.", "1 Search and filters. 2 Status, payment and market. 3 Export and detail access."),
        "procedures": [
            proc("Encontrar uma encomenda", "Find an order", [
                "Abra Encomendas.", "Pesquise pelo número, nome ou email.",
                "Use mercado, estado, pagamento e datas para reduzir a lista.",
                "Remova os filtros quando terminar para não esconder novas encomendas.",
            ], [
                "Open Orders.", "Search by order number, name or email.",
                "Use market, status, payment and date filters to narrow the list.",
                "Clear filters when finished so new orders are not hidden.",
            ]),
            proc("Confirmar pagamento manual", "Confirm a manual payment", [
                "Abra uma encomenda em Revisão de pagamento.",
                "Confirme fora da aplicação que o pagamento foi realmente recebido.",
                "Selecione Confirmar pagamento apenas uma vez.",
                "A aplicação regista o pagamento, prepara a encomenda para processamento, gera o documento comercial interno e envia a confirmação por email.",
                "Verifique o registo do evento, a fatura e o email. Não volte a clicar se a página demorar; atualize e confirme primeiro o estado.",
            ], [
                "Open an order in Payment review.",
                "Confirm outside the application that payment was genuinely received.",
                "Choose Confirm payment once only.",
                "The application records payment, moves the order into fulfilment, generates the internal commercial document and sends confirmation email.",
                "Check the event history, invoice and email. Do not click again if the page is slow; refresh and verify the state first.",
            ], safety="impact", note_pt="No lançamento com AppyPay, siga o estado confirmado pelo gateway. O fluxo WhatsApp permanece apenas como alternativa ativável.", note_en="At AppyPay launch, follow the gateway-confirmed state. WhatsApp remains only as an activatable fallback."),
            proc("Processar e expedir", "Process and ship", [
                "Depois do pagamento, marque a encomenda como Em processamento.",
                "Compare artigos, variantes, quantidades e morada. A segunda linha da morada deve aparecer separadamente.",
                "Prepare a encomenda e, quando sair, introduza o código CTT se aplicável.",
                "Marque como Enviada. O cliente recebe o email de expedição.",
                "Marque como Entregue apenas após confirmação de entrega.",
            ], [
                "After payment, mark the order as Processing.",
                "Compare items, variants, quantities and address. Address line 2 should appear separately.",
                "Prepare the parcel and enter the CTT tracking code when applicable.",
                "Mark it Shipped. The customer receives the shipping email.",
                "Mark it Delivered only after delivery is confirmed.",
            ]),
            proc("Cancelar", "Cancel", [
                "Uma encomenda só pode ser cancelada enquanto estiver em Novo.",
                "Depois da confirmação do pagamento, o botão fica indisponível. Não force uma alteração por outro sistema.",
                "Se existir pagamento confirmado, contacte o José para o procedimento correto; devoluções robustas ficam para a Fase 2.",
            ], [
                "An order can only be cancelled while it is New.",
                "After payment confirmation, the cancel button is unavailable. Do not force a change through another system.",
                "If payment was confirmed, contact Jose for the correct procedure; the robust returns workflow is deferred to Phase 2.",
            ], safety="contact"),
            proc("Imprimir e consultar documentos", "Print and view documents", [
                "Use a guia de preparação para separar os artigos do armazém.",
                "Abra a Fatura/PDF no registo da encomenda ou em Faturas.",
                "O documento atual é comercial e interno; não é faturação fiscal certificada.",
            ], [
                "Use the packing slip to pick items from inventory.",
                "Open the Invoice/PDF from the order or Invoices page.",
                "The current document is an internal commercial document; it is not certified fiscal invoicing.",
            ], safety="review"),
        ],
        "extra_images": ["admin/03-order-detail-review.jpg", "admin/03b-order-detail-processing.jpg", "admin/03c-order-detail-shipped.jpg", "admin/03d-order-detail-delivered.jpg"],
    },
    {
        "title": bi("4. Produtos, imagens, preços e stock", "4. Products, images, prices and stock"),
        "summary": bi(
            "Produtos controla tudo o que o cliente vê e pode comprar: fotografia, nomes bilingues, categoria, etiquetas, preços, promoção, variantes, stock e mercados.",
            "Products controls everything the customer sees and can buy: photography, bilingual names, category, badges, prices, sale, variants, stock and markets.",
        ),
        "image": "admin/05-product-editor.jpg",
        "callouts": bi("1 Galeria e associações de cor. 2 Dados comerciais e variantes. 3 Publicação, mercados e Guardar alterações.", "1 Gallery and colour assignments. 2 Commercial data and variants. 3 Publishing, markets and Save changes."),
        "procedures": [
            proc("Criar um produto", "Create a product", [
                "Abra Produtos e escolha Novo produto.",
                "Preencha os nomes em português e inglês. O slug é criado automaticamente e não deve ser alterado.",
                "Escolha Produto padrão ou Kit. Um produto padrão precisa de pelo menos uma variante; um kit precisa de componentes.",
                "Escolha categoria, etiquetas de merchandising e guia de tamanhos quando aplicável.",
                "Mantenha como Rascunho até terminar imagens, preços, descrições, stock e mercados.",
            ], [
                "Open Products and choose New product.",
                "Complete Portuguese and English names. The slug is generated automatically and must not be changed.",
                "Choose Standard product or Product kit. A standard product requires at least one variant; a kit requires components.",
                "Choose category, merchandising tags and a size guide where applicable.",
                "Keep it as Draft until images, prices, descriptions, stock and markets are complete.",
            ], safety="review"),
            proc("Adicionar e recortar fotografias", "Add and crop photographs", [
                "Escolha Adicionar fotografia e selecione JPG, PNG ou WebP dentro dos limites apresentados.",
                "No editor, ajuste enquadramento e zoom. Confirme a versão pedida antes de guardar.",
                "A pré-visualização aparece antes da gravação. A fotografia só passa a fazer parte do produto depois de Guardar alterações.",
                "Defina uma descrição alternativa útil. Se ficar vazia, a aplicação usa o nome do produto como alternativa.",
                "Associe uma fotografia a uma cor quando só deva aparecer nessa cor. Deixe Geral para aparecer em todas as cores.",
                "Escolha a fotografia de capa e ordene as restantes.",
            ], [
                "Choose Add photo and select JPG, PNG or WebP within the displayed limits.",
                "In the editor, adjust framing and zoom. Confirm the requested version before saving.",
                "A preview appears before persistence. The photo only becomes part of the product after Save changes.",
                "Enter useful alternative text. If left blank, the application falls back to the product name.",
                "Assign a photo to a colour when it should only appear for that colour. Leave it General to show across all colours.",
                "Choose the cover photo and reorder the remainder.",
            ], safety="review"),
            proc("Definir preço e promoção", "Set price and sale", [
                "Introduza separadamente o preço AO em Kz e o preço PT em EUR.",
                "O preço promocional tem de ser inferior ao preço normal.",
                "As datas de início e fim são opcionais. Sem datas, a promoção fica ativa enquanto existir preço promocional.",
                "Confirme no produto da loja que o preço normal aparece riscado e o promocional destacado.",
            ], [
                "Enter the AO price in Kz and PT price in EUR separately.",
                "A sale price must be lower than the regular price.",
                "Start and end dates are optional. Without dates, the sale remains active while a sale price exists.",
                "Confirm on the storefront product that the regular price is struck through and the sale price is highlighted.",
            ], safety="review"),
            proc("Gerir variantes e stock", "Manage variants and stock", [
                "Indique se o produto tem cores e/ou outra opção como tamanho ou capacidade.",
                "Escolha as cores e introduza os valores separados por vírgulas.",
                "Preencha stock AO e PT em cada combinação. São inventários independentes.",
                "Zero significa esgotado nessa variante. Stock igual ou inferior a dois entra no alerta de stock baixo.",
                "Nunca reduza stock para corrigir uma encomenda sem confirmar primeiro o histórico.",
            ], [
                "Specify whether the product has colours and/or another option such as size or capacity.",
                "Select colours and enter comma-separated option values.",
                "Complete AO and PT stock for every combination. They are independent inventories.",
                "Zero means sold out for that variant. Stock of two or less appears in the low-stock alert.",
                "Never reduce stock to correct an order without checking its history first.",
            ]),
            proc("Publicar por mercado", "Publish by market", [
                "Ative Publicado quando o produto estiver pronto.",
                "Use Disponível em Angola e Disponível em Portugal para controlar cada loja.",
                "Guarde e abra as duas lojas para confirmar nome, preço, stock, imagens e descrição.",
            ], [
                "Enable Published when the product is ready.",
                "Use Available in Angola and Available in Portugal to control each storefront.",
                "Save and open both stores to confirm name, price, stock, images and description.",
            ], safety="review"),
            proc("Eliminar ou despublicar", "Delete or unpublish", [
                "Prefira despublicar quando o artigo poderá regressar.",
                "Eliminar remove o produto da administração e pode afetar ligações, artigos ou histórico operacional.",
                "Antes de eliminar, confirme dependências e faça uma cópia dos dados necessários.",
            ], [
                "Prefer unpublishing when the item may return.",
                "Deletion removes the product from the admin and may affect links, articles or operational history.",
                "Before deleting, confirm dependencies and preserve any required data.",
            ], safety="impact"),
        ],
        "extra_images": ["admin/04-products-list.jpg", "storefront/02-ao-product.jpg", "storefront/03-pt-product.jpg", "storefront/06-mobile-product.jpg"],
    },
    {
        "title": bi("5. Categorias, etiquetas, cores e guias de tamanhos", "5. Categories, tags, colours and size guides"),
        "summary": bi(
            "Em Definições > Produtos pode criar estruturas reutilizáveis que passam automaticamente a estar disponíveis no editor de produto.",
            "Settings > Products contains reusable structures that automatically become available in the product editor.",
        ),
        "image": "admin/19-settings-product-taxonomies.jpg",
        "callouts": bi("1 Tipos de definição. 2 Lista e criação. 3 Efeito no produto e na navegação da loja.", "1 Definition types. 2 List and creation. 3 Effect on products and storefront navigation."),
        "procedures": [
            proc("Criar uma categoria", "Create a category", [
                "Abra Definições > Produtos > Categorias.",
                "Introduza nome PT, nome EN e texto introdutório em ambos os idiomas.",
                "Adicione a imagem de mosaico e ajuste o recorte.",
                "Guarde. A categoria fica disponível nos produtos e na navegação/filtros da loja.",
                "Uma categoria em uso não pode ser eliminada até os produtos serem reatribuídos.",
            ], [
                "Open Settings > Products > Categories.",
                "Enter PT name, EN name and introductory copy in both languages.",
                "Add the tile image and adjust the crop.",
                "Save. The category becomes available to products and storefront navigation/filters.",
                "A category in use cannot be deleted until products are reassigned.",
            ], safety="review"),
            proc("Gerir etiquetas e cores", "Manage tags and colours", [
                "Crie etiquetas bilingues para distintivos como Novidade ou Bestseller.",
                "Crie cores com nomes PT/EN e valor visual. A identidade interna permanece estável mesmo que o nome mude.",
                "Associe etiquetas e cores no produto. Verifique cartões, seletores e galerias no storefront.",
            ], [
                "Create bilingual tags for badges such as New or Bestseller.",
                "Create colours with PT/EN names and a visual value. Internal identity remains stable if the name changes.",
                "Assign tags and colours to products. Verify cards, selectors and galleries on the storefront.",
            ]),
            proc("Gerir guias de tamanhos", "Manage size guides", [
                "Crie uma tabela reutilizável com rótulos e medidas.",
                "Associe-a a todos os artigos de vestuário relevantes.",
                "Use a nota de ajuste do produto para recomendações específicas.",
                "Confirme o produto e a página pública Guia de tamanhos.",
            ], [
                "Create a reusable table with labels and measurements.",
                "Assign it to all relevant apparel products.",
                "Use the product fit note for specific recommendations.",
                "Confirm the product and public Size guide page.",
            ], safety="review"),
        ],
        "extra_images": ["storefront/01-ao-category.jpg", "storefront/05-mobile-category.jpg"],
    },
    {
        "title": bi("6. Clientes", "6. Customers"),
        "summary": bi(
            "Clientes é um registo operacional leve criado a partir das encomendas. Não é um sistema de contas de cliente.",
            "Customers is a lightweight operational record created from orders. It is not a customer-account system.",
        ),
        "image": "admin/07-customers-list.jpg",
        "callouts": bi("1 Pesquisa e exportação. 2 Dados de contacto. 3 Histórico de encomendas.", "1 Search and export. 2 Contact details. 3 Order history."),
        "procedures": [
            proc("Consultar e corrigir um cliente", "View and correct a customer", [
                "Abra Clientes e pesquise por nome ou email.",
                "Abra o detalhe para ver contacto, mercado e encomendas associadas.",
                "Corrija apenas erros confirmados. A alteração do cliente não reescreve automaticamente as moradas históricas das encomendas.",
                "Use Exportar clientes apenas para uma finalidade operacional legítima.",
            ], [
                "Open Customers and search by name or email.",
                "Open the detail to see contact information, market and related orders.",
                "Correct confirmed errors only. Editing the customer does not automatically rewrite historical order addresses.",
                "Use Export customers only for a legitimate operational purpose.",
            ], safety="review"),
            proc("Proteger dados pessoais", "Protect personal data", [
                "Não partilhe exportações por canais públicos.",
                "Não copie moradas, telefones ou emails para o manual ou capturas de ecrã.",
                "Elimine ficheiros exportados quando deixarem de ser necessários.",
            ], [
                "Do not share exports through public channels.",
                "Do not copy addresses, telephone numbers or emails into handbooks or screenshots.",
                "Delete exported files when they are no longer required.",
            ], safety="impact"),
        ],
        "extra_images": ["admin/08-customer-detail.jpg"],
    },
    {
        "title": bi("7. Mensagens e assistência por Instagram", "7. Messages and Instagram support"),
        "summary": bi(
            "Mensagens reúne conversas de Instagram, estado da conversa, prioridades, relação com cliente/encomenda e apoio de rascunho por IA quando disponível.",
            "Messages brings together Instagram conversations, conversation status, priorities, customer/order links and AI draft assistance where available.",
        ),
        "image": "admin/09-messages.jpg",
        "callouts": bi("1 Lista de conversas. 2 Prioridade e estado. 3 Resposta, nota interna e associação.", "1 Conversation list. 2 Priority and status. 3 Reply, internal note and associations."),
        "procedures": [
            proc("Tratar uma conversa", "Handle a conversation", [
                "Abra Mensagens e trate primeiro Prioridade e Necessita resposta.",
                "Leia todo o contexto e confirme se existe cliente ou encomenda associada.",
                "Use notas internas para informação que não deve ser enviada ao cliente.",
                "Se existir rascunho de IA, confirme produto, preço, stock, mercado e política antes de aprovar.",
                "Depois de responder, marque A aguardar cliente ou Concluída conforme o caso.",
            ], [
                "Open Messages and handle Priority and Needs reply first.",
                "Read the full context and check for a related customer or order.",
                "Use internal notes for information that must not be sent to the customer.",
                "If an AI draft exists, verify product, price, stock, market and policy before approval.",
                "After replying, mark Waiting on customer or Done as appropriate.",
            ], safety="review"),
            proc("Enviar uma resposta", "Send a reply", [
                "Escreva uma mensagem clara e profissional no idioma do cliente.",
                "Não prometa stock, preço, prazo ou reembolso sem confirmação no sistema.",
                "Ao enviar, a mensagem é transmitida para Instagram e fica registada na conversa.",
            ], [
                "Write a clear, professional message in the customer's language.",
                "Do not promise stock, price, timing or refunds without confirmation in the system.",
                "On send, the message is transmitted to Instagram and recorded in the conversation.",
            ], safety="review"),
            proc("Falha de webhook ou envio", "Webhook or delivery failure", [
                "Não tente alterar tokens ou configurações técnicas.",
                "Registe a hora, utilizador, texto do erro e captura de ecrã.",
                "Contacte o José pelo canal de emergência acordado.",
            ], [
                "Do not attempt to change tokens or technical settings.",
                "Record the time, user, error text and a screenshot.",
                "Contact Jose through the agreed emergency channel.",
            ], safety="contact"),
        ],
    },
    {
        "title": bi("8. Faturas internas", "8. Internal invoices"),
        "summary": bi(
            "A página Faturas lista documentos comerciais internos gerados pela aplicação. Pode filtrar por estado e mercado e abrir o PDF imutável.",
            "Invoices lists internal commercial documents generated by the application. Filter by status and market and open the immutable PDF.",
        ),
        "image": "admin/10-invoices.jpg",
        "callouts": bi("1 Filtros. 2 Número, cliente e encomenda. 3 Estado, total e PDF.", "1 Filters. 2 Number, customer and order. 3 Status, total and PDF."),
        "procedures": [
            proc("Consultar uma fatura", "View an invoice", [
                "Abra Faturas e filtre por Emitida/Falhou e por mercado.",
                "Confirme número, encomenda, cliente, total e data.",
                "Abra PDF para ver linhas, IVA, subtotal, envio e total pago.",
                "Se o documento falhar, não gere números manualmente; contacte o José.",
            ], [
                "Open Invoices and filter by Issued/Failed and market.",
                "Confirm number, order, customer, total and date.",
                "Open PDF to review lines, VAT, subtotal, shipping and total paid.",
                "If generation fails, do not create numbers manually; contact Jose.",
            ], safety="contact"),
            proc("Limite da Fase 1", "Phase 1 limitation", [
                "O PDF atual é um documento comercial interno para apoio contabilístico.",
                "Não é uma fatura fiscal certificada. A integração SWEG/FactPlus será uma decisão futura.",
            ], [
                "The current PDF is an internal commercial document for accounting support.",
                "It is not a certified fiscal invoice. SWEG/FactPlus integration is a future decision.",
            ], safety="review"),
        ],
    },
    {
        "title": bi("9. Biblioteca de multimédia", "9. Media library"),
        "summary": bi(
            "A biblioteca apresenta cada imagem uma vez, as suas utilizações e o texto alternativo. A eliminação pode removê-la de vários locais.",
            "The media library shows each image once, its assignments and alternative text. Deletion may remove it from several locations.",
        ),
        "image": "admin/11-media-library.jpg",
        "callouts": bi("1 Pesquisa e carregamento. 2 Pré-visualização e texto alternativo. 3 Locais de utilização e eliminação.", "1 Search and upload. 2 Preview and alt text. 3 Usage locations and deletion."),
        "procedures": [
            proc("Carregar e reutilizar", "Upload and reuse", [
                "Carregue JPG, PNG ou WebP dentro dos limites apresentados.",
                "A aplicação otimiza o ficheiro. Confirme nitidez e enquadramento no local de utilização.",
                "Antes de voltar a carregar uma imagem, pesquise se já existe.",
                "Use o registo de utilizações para saber onde aparece.",
            ], [
                "Upload JPG, PNG or WebP within the displayed limits.",
                "The application optimizes the file. Confirm sharpness and framing where it is used.",
                "Before uploading an image again, search for an existing copy.",
                "Use the usage list to understand where it appears.",
            ]),
            proc("Eliminar uma imagem", "Delete an image", [
                "Abra as utilizações e confirme todos os produtos, categorias ou conteúdos associados.",
                "Substitua primeiro a imagem nos locais que devem continuar publicados.",
                "Elimine apenas quando todas as consequências forem compreendidas.",
            ], [
                "Open usage information and confirm all related products, categories or content.",
                "Replace the image first wherever content must remain published.",
                "Delete only after every consequence is understood.",
            ], safety="impact"),
        ],
    },
    {
        "title": bi("10. Descontos e códigos promocionais", "10. Discounts and promotional codes"),
        "summary": bi(
            "Descontos gere códigos percentuais, valores fixos e entrega grátis, com mercados, datas, limites e utilização mínima.",
            "Discounts manages percentage, fixed-amount and free-delivery codes with markets, dates, limits and minimum values.",
        ),
        "image": "admin/12-discounts.jpg",
        "callouts": bi("1 Lista e estado. 2 Tipo e valor. 3 Mercados, limites e datas.", "1 List and status. 2 Type and value. 3 Markets, limits and dates."),
        "procedures": [
            proc("Criar um código", "Create a code", [
                "Escolha Novo desconto e introduza um código simples; será guardado em maiúsculas.",
                "Escolha Percentagem, Valor fixo ou Entrega grátis.",
                "Defina Angola/Portugal, valores mínimos, datas, limite total e limite por email.",
                "Guarde como ativo apenas depois de rever a campanha.",
                "Teste no checkout dos mercados autorizados e confirme o resumo antes de anunciar.",
            ], [
                "Choose New discount and enter a simple code; it is stored in uppercase.",
                "Choose Percentage, Fixed amount or Free delivery.",
                "Set Angola/Portugal, minimum values, dates, total limit and per-email limit.",
                "Save as active only after reviewing the campaign.",
                "Test in the authorized markets' checkout and confirm the summary before announcement.",
            ], safety="review"),
            proc("Desativar em vez de eliminar", "Disable instead of delete", [
                "Desative o código para terminar a campanha mantendo o histórico nas encomendas.",
                "Elimine apenas códigos de teste sem utilização e sem valor histórico.",
            ], [
                "Disable the code to end a campaign while preserving order history.",
                "Delete only unused test codes with no historical value.",
            ], safety="impact"),
        ],
    },
    {
        "title": bi("11. Artigos e guia de estilo", "11. Articles and style guide"),
        "summary": bi(
            "Artigos publica conteúdo editorial bilingue para captar procura, explicar a marca e ajudar clientes a escolher produtos.",
            "Articles publishes bilingual editorial content to capture demand, explain the brand and help customers choose products.",
        ),
        "image": "admin/06-articles.jpg",
        "callouts": bi("1 Rascunho/publicado. 2 Conteúdo bilingue estruturado. 3 SEO e disponibilidade por mercado.", "1 Draft/published. 2 Structured bilingual content. 3 SEO and market availability."),
        "procedures": [
            proc("Criar e publicar um artigo", "Create and publish an article", [
                "Crie um artigo e preencha título, resumo, blocos e SEO em português e inglês.",
                "Use secções com título, parágrafos e listas. Ordene os blocos na sequência de leitura.",
                "Escolha os mercados onde deve aparecer.",
                "Mantenha Rascunho durante a revisão. Publique e abra /estilo e o artigo nas duas lojas.",
                "Confirme título, descrição, estrutura, ligações e leitura em telemóvel.",
            ], [
                "Create an article and complete title, excerpt, blocks and SEO in Portuguese and English.",
                "Use titled sections, paragraphs and lists. Order blocks in reading sequence.",
                "Choose the markets where it should appear.",
                "Keep Draft during review. Publish and open /estilo and the article on both stores.",
                "Confirm title, description, structure, links and mobile readability.",
            ], safety="review"),
        ],
        "extra_images": ["storefront/04-ao-article.jpg"],
    },
    {
        "title": bi("12. Conteúdo institucional", "12. Institutional content"),
        "summary": bi(
            "Definições > Conteúdo controla textos institucionais como Sobre nós, FAQ, Guia de tamanhos e outros conteúdos apresentados pela loja.",
            "Settings > Content controls institutional copy such as About us, FAQ, Size guide and other storefront content.",
        ),
        "image": "admin/13-settings-content.jpg",
        "callouts": bi("1 Área de conteúdo. 2 Campos PT/EN. 3 Guardar e confirmar na página pública.", "1 Content area. 2 PT/EN fields. 3 Save and verify on the public page."),
        "procedures": [
            proc("Editar conteúdo público", "Edit public content", [
                "Escolha a secção e altere apenas o texto necessário.",
                "Preencha português e inglês. Não copie HTML ou formatação de fontes desconhecidas.",
                "Guarde e abra a página pública correspondente em AO e PT.",
                "Confirme títulos, acentos, ligações, espaçamento e versão móvel.",
            ], [
                "Choose the section and change only the required copy.",
                "Complete Portuguese and English. Do not paste HTML or formatting from unknown sources.",
                "Save and open the corresponding public page in AO and PT.",
                "Confirm headings, accents, links, spacing and mobile rendering.",
            ], safety="review"),
        ],
    },
    {
        "title": bi("13. Mercados, pagamento, entrega e IVA", "13. Markets, payment, delivery and VAT"),
        "summary": bi(
            "As definições de mercado afetam checkout, métodos, preços de entrega, limites e mensagens. Uma alteração incorreta pode impedir vendas ou cobrar valores errados.",
            "Market settings affect checkout, methods, delivery prices, thresholds and messages. An incorrect change can block sales or charge the wrong amount.",
        ),
        "image": "admin/14-settings-markets.jpg",
        "callouts": bi("1 Angola. 2 Portugal. 3 WhatsApp alternativo, métodos e Guardar.", "1 Angola. 2 Portugal. 3 WhatsApp fallback, methods and Save."),
        "procedures": [
            proc("Alterar uma definição de mercado", "Change a market setting", [
                "Registe o valor atual antes de alterar.",
                "Mude apenas uma área de cada vez e verifique o botão Guardar.",
                "Teste o checkout AO e PT até ao resumo, sem concluir uma compra real.",
                "Confirme método, moeda, preço de entrega, limite grátis e instruções.",
            ], [
                "Record the current value before changing it.",
                "Change one area at a time and verify the Save button.",
                "Test AO and PT checkout through the summary without completing a real purchase.",
                "Confirm method, currency, delivery price, free threshold and instructions.",
            ], safety="contact"),
            proc("Ativar WhatsApp alternativo", "Enable the WhatsApp fallback", [
                "O fluxo WhatsApp deve permanecer configurado como alternativa caso AppyPay tenha um incidente.",
                "Ative-o apenas com autorização operacional, confirme número e mensagem e faça um teste controlado.",
                "Quando AppyPay recuperar, reverta a opção e teste novamente.",
            ], [
                "The WhatsApp flow remains configured as a fallback for an AppyPay incident.",
                "Enable it only with operational authorization, confirm the number and message, and perform a controlled test.",
                "When AppyPay recovers, revert the setting and test again.",
            ], safety="contact"),
            proc("Alterar IVA", "Change VAT", [
                "Não altere taxas por tentativa. Confirme a obrigação legal e a região aplicável.",
                "Registe a fonte, data de entrada em vigor e aprovação.",
                "Teste um exemplo de preço e confirme subtotal sem IVA, IVA, total com IVA e entrega isenta.",
            ], [
                "Do not change rates by trial and error. Confirm the legal obligation and applicable region.",
                "Record the source, effective date and approval.",
                "Test a price example and confirm subtotal excluding VAT, VAT, product total including VAT and VAT-exempt shipping.",
            ], safety="contact"),
        ],
    },
    {
        "title": bi("14. Políticas, faturação e conteúdo legal", "14. Policies, invoicing and legal content"),
        "summary": bi(
            "Estas áreas controlam políticas públicas, dados do emitente, IVA, instruções de pagamento, privacidade e termos.",
            "These areas control public policies, issuer details, VAT, payment instructions, privacy and terms.",
        ),
        "image": "admin/15-settings-policies.jpg",
        "callouts": bi("1 Políticas por mercado e idioma. 2 Dados de faturação. 3 Conteúdo legal.", "1 Policies by market and language. 2 Invoicing data. 3 Legal content."),
        "procedures": [
            proc("Editar políticas", "Edit policies", [
                "Abra Definições > Políticas e escolha a área correta.",
                "Mantenha consistência entre Portugal e inglês, sem prometer algo que a operação não consegue cumprir.",
                "Guarde e confirme Ajuda, FAQ, rodapé e checkout.",
            ], [
                "Open Settings > Policies and choose the correct area.",
                "Keep Portuguese and English consistent without promising anything operations cannot deliver.",
                "Save and verify Help, FAQ, footer and checkout.",
            ], safety="review"),
            proc("Editar faturação", "Edit invoicing", [
                "Confirme nome legal, NIF, morada, prefixo, IVA e dados bancários com documentos oficiais.",
                "Nunca altere o prefixo ou sequência de documentos já emitidos sem orientação contabilística e técnica.",
                "Faça um documento de teste e valide todas as linhas antes de usar em produção.",
            ], [
                "Verify legal name, tax ID, address, prefix, VAT and bank details against official documents.",
                "Never change the prefix or sequence of issued documents without accounting and technical guidance.",
                "Generate a test document and validate every line before production use.",
            ], safety="contact"),
            proc("Editar privacidade e termos", "Edit privacy and terms", [
                "Use apenas texto aprovado.",
                "Guarde uma cópia da versão anterior e registe a data de vigência.",
                "Confirme as páginas públicas em ambos os idiomas.",
            ], [
                "Use approved wording only.",
                "Keep a copy of the previous version and record the effective date.",
                "Verify the public pages in both languages.",
            ], safety="contact"),
        ],
        "extra_images": ["admin/16-settings-invoicing.jpg", "admin/17-settings-legal.jpg"],
    },
    {
        "title": bi("15. Página inicial", "15. Home page"),
        "summary": bi(
            "Definições > Página inicial controla o hero, coleções e categorias apresentadas. As imagens desktop e mobile são enquadradas separadamente.",
            "Settings > Home controls the hero, collections and featured categories. Desktop and mobile images are framed separately.",
        ),
        "image": "admin/18-settings-home.jpg",
        "callouts": bi("1 Texto bilingue e ligação. 2 Imagens desktop/mobile. 3 Seleção de categorias/coleções e versões.", "1 Bilingual copy and link. 2 Desktop/mobile images. 3 Category/collection selection and versions."),
        "procedures": [
            proc("Atualizar o hero", "Update the hero", [
                "Preencha sobrancelha, título, subtítulo e botão em PT/EN.",
                "Escolha a ligação do botão para catálogo, categoria ou destino suportado.",
                "Carregue a imagem e ajuste primeiro desktop e depois mobile no editor.",
                "Confirme as duas pré-visualizações. A imagem só é aplicada ao guardar o hero.",
                "Abra a página inicial em desktop e telemóvel antes de terminar.",
            ], [
                "Complete eyebrow, headline, subtitle and button in PT/EN.",
                "Choose the button link to catalogue, category or another supported destination.",
                "Upload the image and adjust desktop first, then mobile, in the editor.",
                "Confirm both previews. The image is only applied when the hero is saved.",
                "Open the home page on desktop and mobile before finishing.",
            ], safety="review"),
            proc("Gerir versões", "Manage versions", [
                "Cada gravação conserva versões anteriores da área apresentada.",
                "Use Restaurar para voltar a uma versão confirmada.",
                "Elimine versões antigas apenas quando tiver certeza de que não serão necessárias.",
            ], [
                "Each save retains earlier versions for the displayed area.",
                "Use Restore to return to a confirmed version.",
                "Delete old versions only when certain they are no longer required.",
            ], safety="impact"),
        ],
    },
    {
        "title": bi("16. Instagram e apoio de IA", "16. Instagram and AI assistance"),
        "summary": bi(
            "A área Instagram escolhe o destaque e associa produtos. A área de IA controla assistência limitada a mensagens, não decisões autónomas de venda.",
            "Instagram selects the highlighted post and product associations. AI settings control limited message assistance, not autonomous sales decisions.",
        ),
        "image": "admin/20-settings-instagram.jpg",
        "callouts": bi("1 Publicação destacada. 2 Associação de produtos/variantes. 3 Estado e regras de IA.", "1 Highlighted post. 2 Product/variant association. 3 AI status and rules."),
        "procedures": [
            proc("Destacar uma publicação", "Highlight a post", [
                "Abra Definições > Instagram e aguarde o carregamento das publicações recentes.",
                "Escolha uma publicação para o mosaico maior e associe produtos corretos.",
                "Para variantes, confirme cor e tamanho exatos.",
                "Guarde e confirme Shop Instagram em AO e PT.",
            ], [
                "Open Settings > Instagram and wait for recent posts to load.",
                "Choose a post for the large tile and associate the correct products.",
                "For variants, confirm the exact colour and size.",
                "Save and verify Shop Instagram in AO and PT.",
            ], safety="review"),
            proc("Configurar assistência de IA", "Configure AI assistance", [
                "Use apenas as opções disponibilizadas. Não altere tokens, modelos ou webhooks fora da administração.",
                "Mantenha revisão humana para preço, stock, pagamentos, políticas, reclamações e dados sensíveis.",
                "Se as respostas parecerem erradas, pause a automação e contacte o José.",
            ], [
                "Use only the available settings. Do not change tokens, models or webhooks outside the admin.",
                "Keep human review for price, stock, payments, policies, complaints and sensitive data.",
                "If replies appear incorrect, pause automation and contact Jose.",
            ], safety="contact"),
        ],
        "extra_images": ["admin/21-settings-ai-messaging.jpg"],
    },
    {
        "title": bi("17. Resolução de problemas", "17. Troubleshooting"),
        "summary": bi(
            "Faça primeiro verificações seguras. Não tente corrigir infraestrutura, base de dados, tokens, webhooks ou pagamentos diretamente.",
            "Perform safe first-line checks. Do not attempt direct repairs to infrastructure, database, tokens, webhooks or payments.",
        ),
        "procedures": [
            proc("Uma gravação não aparece", "A saved change does not appear", [
                "Confirme se apareceu a mensagem de sucesso.",
                "Recarregue a página da administração e verifique se o valor persistiu.",
                "Abra a loja correta, AO ou PT, e confirme o idioma.",
                "Atualize a loja uma vez. Se continuar incorreto, registe URL, hora, passos e captura.",
            ], [
                "Confirm that a success message appeared.",
                "Reload the admin page and verify that the value persisted.",
                "Open the correct AO or PT storefront and confirm the language.",
                "Refresh the storefront once. If still incorrect, record URL, time, steps and screenshot.",
            ]),
            proc("Uma imagem está desfocada ou cortada", "An image is blurred or cropped", [
                "Confirme o ficheiro original, formato e dimensões.",
                "Reabra o editor de recorte e ajuste desktop/mobile separadamente quando disponível.",
                "Evite ampliar uma imagem pequena para preencher uma área grande.",
            ], [
                "Confirm the original file, format and dimensions.",
                "Reopen the crop editor and adjust desktop/mobile separately where available.",
                "Avoid enlarging a small image to fill a large area.",
            ]),
            proc("Erro técnico ou indisponibilidade", "Technical error or outage", [
                "Não repita ações de pagamento, eliminação ou envio.",
                "Registe mercado, URL, utilizador, hora, mensagem de erro e captura.",
                "Contacte o José por WhatsApp. A Raisa tem autoridade para pausar vendas quando necessário.",
            ], [
                "Do not repeat payment, deletion or send actions.",
                "Record market, URL, user, time, error message and screenshot.",
                "Contact Jose through WhatsApp. Raisa has authority to pause sales when necessary.",
            ], safety="contact"),
        ],
    },
    {
        "title": bi("18. Uso restrito do Payload CMS", "18. Restricted Payload CMS use"),
        "summary": bi(
            "O Payload CMS em https://cms.usemewithstyle.shop/admin é a camada técnica de conteúdo e dados. A administração da loja deve ser usada para o trabalho diário.",
            "Payload CMS at https://cms.usemewithstyle.shop/admin is the technical content and data layer. The storefront admin must be used for daily work.",
        ),
        "procedures": [
            proc("Quando entrar", "When to enter", [
                "Entre apenas quando uma tarefa necessária não existir na administração da loja e depois de confirmar com o José.",
                "Não altere coleções técnicas, relações, utilizadores, configurações ou dados históricos por tentativa.",
                "Nunca execute eliminação em massa, migração ou alteração de infraestrutura.",
            ], [
                "Enter only when a required task is unavailable in the storefront admin and after confirming with Jose.",
                "Do not experiment with technical collections, relationships, users, settings or historical data.",
                "Never perform bulk deletion, migration or infrastructure changes.",
            ], safety="contact"),
        ],
    },
    {
        "title": bi("19. Funcionalidades diferidas e aceitação", "19. Deferred capabilities and acceptance"),
        "summary": bi(
            "A Fase 1 não inclui devoluções robustas, faturação fiscal certificada, pagamentos finais AppyPay/Paybird, contas completas, wishlist, fidelização, VIP, campanhas avançadas ou funções/roles avançadas.",
            "Phase 1 does not include robust returns, certified fiscal invoicing, final AppyPay/Paybird payments, full accounts, wishlist, loyalty, VIP, advanced campaigns or advanced roles.",
        ),
        "procedures": [
            proc("Aceitação do manual", "Handbook acceptance", [
                "A Raisa executa tarefas representativas usando apenas o manual português durante a sessão gravada.",
                "O José corrige qualquer hesitação causada por instrução incompleta ou imagem desatualizada.",
                "O José aprova exatidão técnica; a Raisa aprova linguagem, facilidade e apresentação.",
                "As duas versões recebem o mesmo número de versão e registo de alterações.",
            ], [
                "Raisa completes representative tasks using only the Portuguese handbook during the recorded session.",
                "Jose corrects any hesitation caused by incomplete instruction or an outdated image.",
                "Jose approves technical accuracy; Raisa approves language, usability and presentation.",
                "Both language versions receive the same version number and change log.",
            ], safety="review"),
        ],
    },
]


def annotate_image(src: Path, dst: Path, points: list[tuple[float, float]]) -> None:
    im = Image.open(src).convert("RGB")
    draw = ImageDraw.Draw(im)
    radius = max(18, int(im.width * 0.018))
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", int(radius * 1.15))
    except OSError:
        font = ImageFont.load_default()
    for number, (x_ratio, y_ratio) in enumerate(points, 1):
        x, y = int(im.width * x_ratio), int(im.height * y_ratio)
        draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill="#B58A2A", outline="white", width=max(2, radius//7))
        text = str(number)
        box = draw.textbbox((0, 0), text, font=font)
        draw.text((x-(box[2]-box[0])/2, y-(box[3]-box[1])/2-2), text, fill="white", font=font)
    im.save(dst, quality=88, optimize=True)


CALLOUT_POINTS = [(0.12, 0.20), (0.53, 0.15), (0.78, 0.48)]


def prepare_annotated() -> dict[str, Path]:
    result = {}
    image_refs = set()
    for chapter in CHAPTERS:
        if chapter.get("image"):
            image_refs.add(chapter["image"])
    for ref in image_refs:
        src = SHOT_ROOT / ref
        dst = ANNOTATED / ref.replace("/", "__")
        if src.exists():
            annotate_image(src, dst, CALLOUT_POINTS)
            result[ref] = dst
    return result


def build_styles():
    styles = getSampleStyleSheet()
    return {
        "cover": ParagraphStyle("cover", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=28, leading=32, textColor=INK, alignment=TA_CENTER, spaceAfter=10),
        "cover_sub": ParagraphStyle("cover_sub", parent=styles["BodyText"], fontName="Helvetica", fontSize=12, leading=17, textColor=SOFT, alignment=TA_CENTER),
        "h1": ParagraphStyle("h1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=INK, spaceBefore=6, spaceAfter=10),
        "h2": ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=INK, spaceBefore=10, spaceAfter=5),
        "body": ParagraphStyle("body", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.4, leading=13.5, textColor=INK, spaceAfter=6),
        "small": ParagraphStyle("small", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.8, leading=10.5, textColor=SOFT),
        "caption": ParagraphStyle("caption", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.7, leading=10, textColor=SOFT, alignment=TA_LEFT, spaceAfter=8),
        "step": ParagraphStyle("step", parent=styles["BodyText"], fontName="Helvetica", fontSize=9, leading=12.5, leftIndent=12, firstLineIndent=-12, spaceAfter=4),
        "toc": ParagraphStyle("toc", parent=styles["BodyText"], fontName="Helvetica", fontSize=10, leading=14, textColor=INK),
    }


class HandbookDocTemplate(BaseDocTemplate):
    def __init__(self, filename, lang, **kwargs):
        self.lang = lang
        super().__init__(filename, **kwargs)
        frame = Frame(18*mm, 18*mm, A4[0]-36*mm, A4[1]-34*mm, id="normal")
        self.addPageTemplates([PageTemplate(id="handbook", frames=frame, onPage=self._header_footer)])

    def _header_footer(self, canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(RULE)
        canvas.line(18*mm, A4[1]-13*mm, A4[0]-18*mm, A4[1]-13*mm)
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(SOFT)
        title = "Manual de Administração - Fase 1" if self.lang == "pt" else "Administration Handbook - Phase 1"
        canvas.drawString(18*mm, A4[1]-10*mm, title)
        canvas.drawRightString(A4[0]-18*mm, 10*mm, str(doc.page))
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == "h1":
            text = flowable.getPlainText()
            key = f"h{self.seq.nextf('heading')}"
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, level=0, closed=False)
            self.notify("TOCEntry", (0, text, self.page, key))


def image_flow(path: Path, max_h=150*mm):
    with Image.open(path) as im:
        w, h = im.size
    max_w = A4[0] - 38*mm
    scale = min(max_w / w, max_h / h)
    return RLImage(str(path), width=w*scale, height=h*scale)


def safety_box(lang, key, styles):
    label = LABELS[key]
    p = Paragraph(f"<b>{escape(label[lang])}</b>", ParagraphStyle("safety", parent=styles["small"], textColor=colors.white, alignment=TA_CENTER))
    tbl = Table([[p]], colWidths=[70*mm])
    tbl.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), label["color"]), ("BOX", (0,0), (-1,-1), 0.5, label["color"]), ("LEFTPADDING", (0,0), (-1,-1), 6), ("RIGHTPADDING", (0,0), (-1,-1), 6), ("TOPPADDING", (0,0), (-1,-1), 4), ("BOTTOMPADDING", (0,0), (-1,-1), 4)]))
    return tbl


def build_pdf(lang: str, annotated: dict[str, Path]) -> Path:
    styles = build_styles()
    filename = "Use_Me_With_Style_Manual_Administracao_Fase_1_PT.pdf" if lang == "pt" else "Use_Me_With_Style_Phase_1_Administration_Handbook_EN.pdf"
    output = PDF_OUT / filename
    doc = HandbookDocTemplate(str(output), lang, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=18*mm, bottomMargin=18*mm, title=filename, author="Use Me With Style")
    story = []
    emblem = Path("/Users/josenogueira/Downloads/Untitled design (1)-photoaidcom-cropped.png")
    if emblem.exists():
        story += [Spacer(1, 20*mm), RLImage(str(emblem), width=42*mm, height=42*mm), Spacer(1, 8*mm)]
    story.append(Paragraph("Manual de Administração" if lang == "pt" else "Administration Handbook", styles["cover"]))
    story.append(Paragraph("Fase 1 - Operações da loja" if lang == "pt" else "Phase 1 - Store operations", styles["cover_sub"]))
    story.append(Spacer(1, 8*mm))
    meta = [
        ["Versão" if lang == "pt" else "Version", "1.0"],
        ["Data" if lang == "pt" else "Date", "22 August 2026" if lang == "en" else "22 de agosto de 2026"],
        ["Operações" if lang == "pt" else "Operations owner", "Raisa"],
        ["Responsável técnico" if lang == "pt" else "Technical owner", "José"],
        ["Aprovação" if lang == "pt" else "Approval", "Technical: José | Client-facing: Raisa"],
    ]
    mt = Table(meta, colWidths=[45*mm, 95*mm])
    mt.setStyle(TableStyle([("BACKGROUND", (0,0), (0,-1), PAPER), ("TEXTCOLOR", (0,0), (-1,-1), INK), ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"), ("FONTNAME", (1,0), (1,-1), "Helvetica"), ("FONTSIZE", (0,0), (-1,-1), 8.5), ("GRID", (0,0), (-1,-1), 0.4, RULE), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 7), ("RIGHTPADDING", (0,0), (-1,-1), 7), ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6)]))
    story += [mt, Spacer(1, 8*mm), Paragraph(
        "Guia oficial, introdutório e orientado por tarefas para todas as capacidades visíveis e publicadas da Fase 1. As palavras-passe são entregues separadamente." if lang == "pt" else
        "Official beginner-friendly, task-based guide to every visible and released Phase 1 capability. Passwords are supplied separately.", styles["cover_sub"]), PageBreak()]

    story.append(Paragraph("Índice" if lang == "pt" else "Contents", styles["h1"]))
    toc = TableOfContents(); toc.levelStyles = [styles["toc"]]
    story += [toc, PageBreak()]

    for chapter in CHAPTERS:
        story.append(Paragraph(escape(chapter["title"][lang]), styles["h1"]))
        story.append(Paragraph(escape(chapter["summary"][lang]), styles["body"]))
        ref = chapter.get("image")
        if ref and ref in annotated:
            story.append(image_flow(annotated[ref]))
            story.append(Paragraph(escape(chapter["callouts"][lang]), styles["caption"]))
        for procedure in chapter["procedures"]:
            blocks = [Paragraph(escape(procedure["title"][lang]), styles["h2"]), safety_box(lang, procedure["safety"], styles), Spacer(1, 2*mm)]
            for idx, step in enumerate(procedure["steps"][lang], 1):
                blocks.append(Paragraph(f"<b>{idx}.</b> {escape(step)}", styles["step"]))
            if procedure["note"][lang]:
                blocks.append(Table([[Paragraph(escape(procedure["note"][lang]), styles["small"])]], colWidths=[A4[0]-44*mm], style=TableStyle([("BACKGROUND", (0,0), (-1,-1), PAPER), ("BOX", (0,0), (-1,-1), 0.6, RULE), ("LEFTPADDING", (0,0), (-1,-1), 7), ("RIGHTPADDING", (0,0), (-1,-1), 7), ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6)])))
            story.append(KeepTogether(blocks))
        for extra in chapter.get("extra_images", []):
            path = SHOT_ROOT / extra
            if path.exists():
                story.append(Spacer(1, 3*mm)); story.append(image_flow(path, max_h=120*mm)); story.append(Paragraph(
                    "Exemplo verificado na aplicação de produção durante a janela controlada de formação." if lang == "pt" else "Example verified in the production application during the controlled training window.", styles["caption"]))
        story.append(PageBreak())

    doc.multiBuild(story)
    return output


def build_markdown(lang: str) -> Path:
    filename = "Manual_Administracao_Fase_1_PT.md" if lang == "pt" else "Phase_1_Administration_Handbook_EN.md"
    path = OUT_DIR / filename
    lines = [
        "# " + ("Manual de Administração - Fase 1" if lang == "pt" else "Administration Handbook - Phase 1"),
        "",
        ("**Versão:** 1.0  \n**Data:** 22 de agosto de 2026  \n**Responsável operacional:** Raisa  \n**Responsável técnico:** José" if lang == "pt" else "**Version:** 1.0  \n**Date:** 22 August 2026  \n**Operations owner:** Raisa  \n**Technical owner:** Jose"),
        "",
    ]
    for chapter in CHAPTERS:
        lines += ["## " + chapter["title"][lang], "", chapter["summary"][lang], ""]
        if chapter.get("image"):
            lines += [f"![{chapter['title'][lang]}](assets/screenshots/annotated/{chapter['image'].replace('/', '__')})", "", chapter["callouts"][lang], ""]
        for procedure in chapter["procedures"]:
            lines += ["### " + procedure["title"][lang], "", f"> **{LABELS[procedure['safety']][lang]}**", ""]
            for idx, step in enumerate(procedure["steps"][lang], 1):
                lines.append(f"{idx}. {step}")
            if procedure["note"][lang]: lines += ["", f"> {procedure['note'][lang]}"]
            lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def build_coverage() -> Path:
    path = OUT_DIR / "Phase_1_Admin_Coverage_Matrix.md"
    rows = ["# Phase 1 Admin Coverage Matrix", "", "| Visible area | Handbook chapter | Admin evidence | Storefront consequence |", "|---|---|---|---|"]
    mapping = [
        ("Dashboard", "1-2", "01-dashboard-overview", "Operational metrics and filters"),
        ("Orders + detail", "3", "02-orders-list; 03* lifecycle", "Email, fulfilment, tracking and order lookup"),
        ("Products + editor", "4", "04-products-list; 05-product-editor", "AO/PT product pages and mobile"),
        ("Product taxonomies", "5", "19-settings-product-taxonomies", "Navigation, category copy, colour/size selection"),
        ("Customers", "6", "07-customers-list; 08-customer-detail", "Operational record only"),
        ("Messages", "7", "09-messages", "Instagram replies and audit trail"),
        ("Invoices", "8", "10-invoices", "Internal commercial PDF"),
        ("Media", "9", "11-media-library", "Shared images and alt text"),
        ("Discounts", "10", "12-discounts", "Checkout discount or free shipping"),
        ("Articles", "11", "06-articles", "Style article"),
        ("Settings: Content", "12", "13-settings-content", "About, FAQ, size guide and public copy"),
        ("Settings: Markets", "13", "14-settings-markets", "Checkout, delivery and payment availability"),
        ("Settings: Policies", "14", "15-settings-policies", "Help, footer and checkout policy copy"),
        ("Settings: Invoicing", "14", "16-settings-invoicing", "Invoice issuer, VAT and payment details"),
        ("Settings: Legal", "14", "17-settings-legal", "Privacy and terms pages"),
        ("Settings: Home", "15", "18-settings-home", "Responsive hero, categories and collections"),
        ("Settings: Instagram", "16", "20-settings-instagram", "Shop Instagram highlight and associations"),
        ("Settings: AI messaging", "16", "21-settings-ai-messaging", "Assisted message drafts and guardrails"),
        ("Payload CMS", "18", "Restricted guidance", "Technical exception only"),
    ]
    for area, chapter, admin, effect in mapping:
        rows.append(f"| {area} | {chapter} | {admin} | {effect} |")
    path.write_text("\n".join(rows) + "\n", encoding="utf-8")
    return path


if __name__ == "__main__":
    annotated = prepare_annotated()
    outputs = [build_markdown("pt"), build_markdown("en"), build_coverage(), build_pdf("pt", annotated), build_pdf("en", annotated)]
    for output in outputs:
        print(output)
