# Eletrônicos mobile — aparência e banners

Atualização de 03/09/2026. Referência visual: `JI Imports App.dc.html`, na pasta de design fornecida pelo cliente.

## O que muda

- Celular: fundo preto, azul JI, tipografia Barlow, cartões retangulares e navegação inferior com Início, Buscar, Carrinho e Atendimento.
- A vitrine organiza os eletrônicos em iPhone, Apple Watch, iPad, MacBook, AirPods e Acessórios. Produtos novos que não correspondam a essas famílias ficam em Outros eletrônicos.
- A busca e a ordenação continuam usando os produtos reais cadastrados.
- O banner principal tem espaço próprio no topo e pode fazer parte de um carrossel com até três banners.
- Desktop mantém seu layout. A divisão por famílias também facilita o catálogo no computador.
- Preços, conversão pelo dólar, estoque, encomendas, cupons, cashback e checkout não foram recalculados por esta atualização visual.

## Como editar os banners

1. No painel, abra **Editor da loja** e selecione **Eletrônicos** (`/admin/layout?catalog=electronics`).
2. Em **Banner principal**, edite chamada, título, descrição, texto do botão e destino.
3. Se quiser usar uma arte, clique em **Enviar imagem** ou informe uma URL de imagem.
4. Clique em **Salvar seção**. O envio do arquivo, sozinho, não publica a seção.
5. Para mais banners, abra **Banner rotativo 2** ou **Banner rotativo 3** e prepare o conteúdo.
6. Marque **Exibir no carrossel mobile** e clique em **Salvar seção**.

Os banners 2 e 3 começam desativados. Com apenas um banner ativo, a vitrine mostra uma imagem fixa. Com dois ou três, os controles e a rotação aparecem automaticamente. O intervalo segue a configuração existente `autoBannerSeconds`, com mínimo de três segundos.

O cliente pode arrastar horizontalmente, usar as setas ou escolher um indicador. Há botão de pausa. A rotação também pausa quando a aba está oculta, durante a interação e quando o dispositivo pede movimento reduzido. Ela não fica rodando no desktop, onde o carrossel está oculto.

### Preparação da arte

- Referência recomendada: **1080 × 1350 px**, vertical 4:5, JPG, PNG ou WebP.
- A imagem preenche o espaço e pode sofrer recorte nas bordas conforme a largura do celular. Mantenha o produto e informações importantes no centro.
- Reserve a parte inferior para o texto sobreposto pelo site. Prefira escrever chamada, título e botão no editor, em vez de incorporar tudo à imagem.
- Use títulos e descrições curtos. No mobile, título e descrição têm limite visual de três linhas para não encobrir a imagem.
- Sem imagem no primeiro banner, a loja usa a foto do produto destacado. Seu nome e preço aparecem juntos. Os banners adicionais não reutilizam esse preço.
- Destinos precisam permanecer dentro da própria vitrine, por exemplo `/#catalogo` ou `/#como-comprar`.

## Separação entre as lojas

Os novos blocos usam os identificadores exclusivos `electronics:<tenant>:banner-2` e `electronics:<tenant>:banner-3`, dentro da página de eletrônicos já existente. Nenhuma tabela nova é necessária. Os filtros de escopo impedem que esses blocos sejam enviados à vitrine farmacêutica.

## Limites intencionais

O protótipo possui exemplos de trade-in, comparador, conta do cliente, estoque em lojas físicas e parcelamento. Essas informações não foram transformadas em promessas reais: a atualização preserva somente funções e condições comerciais já existentes no sistema.

## Validação e publicação

O relatório visual desta entrega está em `docs/design-qa/electronics-mobile-2026-09-03/design-qa.md`. O salvamento do editor foi testado com o serviço simulado, sem alterar campanhas ou banners de produção. A conferência do checkout não enviou pedidos nem dados pessoais.
