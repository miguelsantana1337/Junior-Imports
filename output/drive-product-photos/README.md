# Atualizacao de fotos dos produtos

Origem: pasta do Google Drive fornecida pelo cliente em 19/07/2026.

- 50 imagens baixadas e revisadas visualmente.
- 44 imagens confirmadas para 42 SKUs do catalogo.
- 6 imagens mantidas em `unmatched/` por divergencia de marca, dose ou apresentacao.
- O arquivo `product-photo-map.json` registra cada associacao e o motivo de cada bloqueio.
- `before-product-images.json` preserva as referencias anteriores do banco.
- `update-result.json` registra o resultado confirmado apos a publicacao.

As imagens confirmadas substituem a foto principal e a galeria anterior de cada produto correspondente. Quando o Drive possui duas fotos seguras do mesmo produto, ambas formam a nova galeria, na ordem indicada no mapa.
