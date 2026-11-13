# Fauna R8 — distribuição dos binários

Responsável por esta ferramenta: Codex, subtarefa de verificação, 13/11/2026.
O código do jogo permanece aberto; GLBs gerados no Tripo e suas correções têm
licença/proveniência próprias. Não são automaticamente MIT, CC0 ou assets
livres para redistribuição. A publicação para uso no jogo e uma licença geral
de download são decisões distintas.

## Fonte única de seleção

`src/fauna-assets-manifest.ts` define os perfis explicitamente aprovados por
espécie, separados em desktop e móvel. Perfil móvel ausente não usa o de
desktop por substituição. A inspeção visual, animação, escala, apoio e decisão
de aprovação continuam com a produção; o downloader não aprova uma malha.

`tools/fetch_fauna_assets.ts` lê esse mesmo catálogo em Node 24, sem credencial,
conta, API de geração ou pacote adicional. Só processa `status: approved`.
Exige, para cada variante, SHA-256, tamanho exato e URL local neste formato:

```text
/models/fauna-r8/nome-<12 primeiros caracteres do SHA-256>.glb
```

Os downloads usam exclusivamente o host já declarado pelo projeto:
`https://grand-testament-assets.vercel.app/`. O build serve a cópia validada
pela origem do próprio jogo. O runtime não precisa de um token para carregá-la.

## Regras da cópia

- Rejeita caminho fora de `models/fauna-r8`, travessia, URL externa, query,
  fragmento, separador Windows, host diferente e redirecionamento HTTP.
- Até 32 MiB por arquivo e 128 MiB no catálogo de variantes deduplicadas.
  Download serial, prazo de 30 segundos, tamanho conferido durante a leitura.
- Confere SHA-256, cabeçalho GLB v2, JSON e ausência de URI externa/data URI
  nas imagens/buffers. Não equivale a validar texturas ou animação visualmente.
- Se o destino já existir, confere sem baixar. Divergência causa erro e
  preserva os bytes existentes. A publicação local usa arquivo temporário
  exclusivo e hard link, sem substituir um destino criado em paralelo.
- Recusa junction/symlink nos diretórios de destino. Os GLBs permanecem
  cobertos pelos ignores de `public/models/` e `*.glb`, fora do Git do jogo.

```powershell
node tools/fetch_fauna_assets.ts
node --test test/fauna-fetch.test.ts
```

O script não publica no host. A manutenção deve copiar os derivados aprovados
para o projeto de assets, preservar os 14 modelos existentes, verificar o
download público por hash e só então habilitar esse comando no build do jogo.
É necessário manter procedência e hashes de fonte/derivado no catálogo de
produção. Nunca marcar como aprovado apenas para satisfazer um build.

## Verificação desta alteração

Onze testes CPU passaram: seleção/deduplicação, ausência de fallback móvel,
pending sem I/O, caminhos e host proibidos, orçamento, conflito de catálogo,
download íntegro e reuso, preservação de divergentes, HTTP/redirect, corpo
truncado/excessivo/hash incorreto, timeout, URI externa e destino concorrente.
`npm run typecheck` passou. Os testes usam respostas locais simuladas; não
provam que as novas URLs já foram publicadas nem medem a rede da Vercel.

O fetch anterior (`tools/fetch_assets.mjs`) continua responsável pelos 14
arquivos `tripo-r1`; não foi alterado nesta subtarefa. Seu uso de arrayBuffer e
redirecionamento padrão foi identificado durante a revisão, mas não expandido
para a fauna. O fetch novo limita os corpos e recusa redirects. Nenhum commit,
upload ou deploy foi feito por esta ferramenta.
