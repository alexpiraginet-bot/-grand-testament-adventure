# Simão R12 — perfis de textura para integração controlada

13/11/2026. Codex, continuação da revisão [Simão R11](NPC-SIMAO-R11.md).
Esta etapa reduz somente as imagens do candidato já rigado. Não simplifica a malha, não gera personagem novo
e não modifica pose, esqueleto, UV, materiais, hierarquia ou animações. Nenhum crédito, API, renderer ou upload.

## Fonte, licença e estado

Fonte preservada no acervo:
`D:/BentoLabs/01-Projetos/GRAND-TESTAMENT-ASSETS-R1-20261112/11-NPC-R11-20261113/candidate-r1/simao-r11-rig-candidate.glb`.

- 3.281.800 bytes; SHA-256 `1a7aca8ebaf995ee409eca8a67c35b3534cca4d1ba8c09ce43af1970cd494793`.
- Malha própria de Alex, gerada previamente no Tripo; rig/clipes locais R11. Licença separada do código MIT.
  GLB, BLEND e imagens não passam a ser MIT/CC0 e continuam ignorados pelo Git.
- Estado do catálogo: `reviewed-integration-candidate`. A fonte passou por duas leituras visuais no viewer R11;
  isso habilita a etapa de integração controlada, não aprova automaticamente os novos perfis em qualquer aparelho.
- Escala/orientação herdadas: metros, Y para cima, frente −Z, chão nominal Y=0 e altura autoral 1,76 m.
  Preservar o ancestral comum da skin/rig. Não transformar só o SkinnedMesh separando-o do esqueleto.

## Artefatos e orçamento

Catálogo versionado: `src/data/npc-assets.json`. Binários para QA local: `public/models/npc-r12/` (ignorados).
Pacote de origem dos derivados/validação: `assets-src/npc-r12-prepared/` (ignorado).

| Perfil | Arquivo | GLB | Imagens embutidas | RGBA8 + mipmaps estimados |
|---|---|---:|---:|---:|
| desktop, 1024 px | `simao-r12-1024-c199f4ff942a.glb` | 1.763.628 B | 1.238.570 B | 16.777.218 B, aproximadamente 16 MiB |
| mobile, 512 px | `simao-r12-512-a11a3f7fc8eb.glb` | 924.912 B | 399.972 B | 4.194.306 B, aproximadamente 4 MiB |

Hashes completos:

- Desktop: `c199f4ff942a2a76bb80511d2ef546fcecc52d7504704f918c2f5af307345e29`.
- Mobile: `a11a3f7fc8eb60555e84dbf193301047f07b40f0e38957b8ad5789786987c3a7`.

O orçamento de download do catálogo é 2.000.000 B para desktop e 1.000.000 B para mobile. Não há mudança de
triângulos entre perfis: 1 mesh/primitive, 7.099 vértices exportados, 11.460 triângulos, 1 skin de 22 joints,
128 accessors e 1 material com 3 mapas. Máximo de quatro influências por vértice, herdado da autoria R11.

Os três mapas originais 2048² foram reduzidos para 1024²/512². Cor usa WebP qualidade 92; normal e
metallic/roughness usam WebP **lossless depois do resize**. Os pixels redimensionados desses dois mapas foram
comparados byte a byte ao resultado decodificado; não se afirma ausência de perda frente ao original 2048².
As ligações de materiais/UV, samplers, fatores e índices permanecem iguais. A única extensão adicionada é
`EXT_texture_webp`, obrigatória, sem JPEG/PNG redundante no arquivo.

**WebP reduz transferência, não comprime a textura decodificada na GPU como KTX2.** A coluna de memória é
uma estimativa conservadora RGBA8 com cadeia de mipmaps, não medição de VRAM nem o consumo total do ator.
O loader ainda deve respeitar os limites de textura, abortar/dispor falhas e carregar o ator opcional em fila.

## Contrato de animação e identidade

- Ator único `simao-r12`, exclusivamente para Simão; não substituir os outros discípulos pela mesma malha.
- Idle: `simao-idle-r11`, duração armazenada 3,2000000477 s, 66 canais.
- Walk: `simao-walk-r11`, duração armazenada 1,2000000477 s, 66 canais; passada nominal **0,70 m/s**, no lugar.
- Usar AnimationMixer/skin reais. Ajuste de deslocamento e mistura entre clipes pertencem à integração.
- Não há atuação facial, dedos articulados, beckon, corrida, fala labial, simulação de tecido ou IK sobre terreno.
  Falha de carga deve manter o ator ausente, sem fallback humano de formas simples ou pose de geração.

## Validação e reprodução

O script `tools/npc/prepare_simao_r12.mjs` exige o hash da fonte revisada e um diretório de saída novo/vazio.
Não aceita outro modelo por engano, não sobrescreve fontes/artefatos e não segue link simbólico como saída.

Verificações realizadas em cada perfil:

1. GLB completo e autocontido, limites/alinhamento dos chunks e bufferViews; nenhuma URL externa de imagem.
2. JSON de asset/scene/nodes/meshes/skins/animations/accessors/materials/samplers idêntico ao original.
   **128 bufferViews não-imagem idênticos byte a byte**, incluindo geometria, pesos, matrizes e keyframes.
   Digest da estrutura preservada: `6722346b1b11de176a21ffc700a05ea0ac23bf2b95e03f678ed37931cd3b6916`.
3. Leitura pelo glTF Transform 4.5.1 com extensões, clips e skin presentes; decode completo das imagens por Sharp.
4. Khronos glTF Validator 2.0.0-dev.3.10: **0 erros / 2 avisos** em fonte e derivados. Avisos herdados:
   tangentes não armazenadas (`MESH_PRIMITIVE_GENERATED_TANGENT_SPACE`) e skin sob ancestral
   (`NODE_SKINNED_MESH_NON_ROOT`). O viewer R11 já havia revisado a fonte; conferir o carregamento real novamente.
5. Segunda execução em `assets-src/npc-r12-reproduction/` produziu GLBs **byte a byte idênticos** aos primeiros.
   `REPRODUCIBILITY.json` também confirma as cópias em `public/models/npc-r12` por hash.

`PROVENANCE.json` registra fonte, dimensões, hashes das imagens originais/derivadas/pixels, perfil de compressão,
versões de Sharp/libvips, Node, validador e resultados. Relatórios não são copiados para `public`; só os dois GLBs.

Com dependências fixadas no `package-lock` e o validador Khronos já disponível:

```powershell
node tools/npc/prepare_simao_r12.mjs `
  --input 'D:/BentoLabs/01-Projetos/GRAND-TESTAMENT-ASSETS-R1-20261112/11-NPC-R11-20261113/candidate-r1/simao-r11-rig-candidate.glb' `
  --output 'assets-src/npc-r12-nova-reproducao' `
  --source-sha256 1a7aca8ebaf995ee409eca8a67c35b3534cca4d1ba8c09ce43af1970cd494793 `
  --validator-module 'D:/BentoLabs/01-Projetos/GRAND-TESTAMENT-ASSETS-R1-20261112/07-Preview/vendor/gltf-validator'
```

Os caminhos são argumentos, não constantes do script. Um colaborador deve fornecer a fonte licenciada correta
e seu caminho de validador; não se baixa nem publica o modelo automaticamente. Não houve instalação de pacote
ou uso de IA local nesta transformação determinística. As skills de produção/vendoring foram consultadas;
como `game-dev` não estava instalado, a cadeia local autorizada preservou pacote, hashes, licença e recibos,
sem alegar um recibo `game-dev vendor admit` inexistente.

## Próxima prova e limites

`tools/fetch_npc_assets.ts` entra em `npm run assets` e `npm run build`, depois dos assets base/fauna. Lê o mesmo
catálogo e baixa serialmente somente os dois arquivos do host revisado `https://grand-testament-assets.vercel.app/`.
Confere SHA-256/tamanho, fonte/estado, orçamento, nome com hash, GLB completo com BIN, ausência de URIs e os dois
clipes/skin. Reutiliza a guarda de recursos autocontidos da fauna sem alterar o fetcher dela. Não segue redirects,
paths arbitrários, symlinks/junctions de saída; tem timeout e cancelamento, verifica todos os arquivos existentes
antes de baixar e usa gravação exclusiva/publicação por hard link para não sobrescrever concorrência. Divergência
local interrompe o build preservando o arquivo, nunca o substitui automaticamente.

Os 10 testes próprios e os 11 da fauna passaram juntos: download/reuso, limites, caminhos, falhas HTTP,
truncamento/corrupção, URI externa, junction, timeout/abort e criação concorrente. A chamada real local confirmou
2 arquivos / 2.688.540 bytes, com **0 bytes baixados**. Isso verifica os bytes locais; não atesta upload ou host remoto.

### Download novo do host publicado — 13/11/2026

Depois da publicação informada pela integração (`dpl_4BF685t2G3vGWhd71ZBwVz2t7Qk8`), uma execução real de
`fetchNpcAssets` baixou os dois perfis de `https://grand-testament-assets.vercel.app/` para uma pasta nova e vazia,
`shots/r12-fresh-assets/public`. Não reutilizou `public/models/npc-r12` nem as cópias do acervo.

- Início/fim: **20:24:29–20:24:30 UTC**, Node **24.19.0**.
- **2.688.540 bytes baixados e verificados**; ambos os GLBs passaram as guardas de estrutura e integridade do fetcher.
- Desktop: **1.763.628 bytes**, SHA-256 `c199f4ff942a2a76bb80511d2ef546fcecc52d7504704f918c2f5af307345e29`.
- Mobile: **924.912 bytes**, SHA-256 `a11a3f7fc8eb60555e84dbf193301047f07b40f0e38957b8ad5789786987c3a7`.
- TLS permaneceu verificado: `NODE_USE_SYSTEM_CA=1` usou o repositório de certificados do Windows somente no processo de verificação.
- Recibo local: `shots/r12-fresh-assets/RESULT.json`; script da prova: `shots/r12-fresh-assets/check.mjs`.

Essa prova confirma a disponibilidade e os bytes dos dois caminhos no alias remoto naquele momento; não é uma
medição de carregamento ou de imagem no navegador.

Carregamento WebP no Three/Chrome/WebKit, nitidez do rosto/roupa em 512 px, normal mapping, transição idle/walk,
velocidade, pés no relevo, sombras, colisores, missão e cinemática pertencem à QA de integração. Nenhuma captura
de runtime ou prova de iPhone físico foi produzida pela etapa de transformação. A prova remota acima complementa
o catálogo; a avaliação visual e funcional no jogo permanece no registro de QA integrado.
