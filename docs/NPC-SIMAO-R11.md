# Simão R11 — primeiro candidato com rig local

13/11/2026. Responsável: Codex. Derivado local de uma malha já gerada pelo
Alex no Tripo; nenhuma geração, compra ou chamada de API nova. Esta entrega
não altera o catálogo de produção: o jogo continua sem NPC humano até a
integração de um ator aprovado. O candidato passou pela revisão visual em
viewer próprio e está apto à próxima integração controlada, ainda sem
validação dentro do jogo.

## Fonte e arquivos preservados

Pasta de trabalho fora do Git:
`D:/BentoLabs/01-Projetos/GRAND-TESTAMENT-ASSETS-R1-20261112/11-NPC-R11-20261113`.

- Fonte: `../05-Assets-source/pescador-simao-r1-source.glb`, 3.123.660 bytes;
  SHA-256 `9634330882c91e871ccd38344c8f33ea4f79823434e731071b3b1078f38d64fc`.
- Candidato R1: `candidate-r1/simao-r11-rig-candidate.glb`, 3.281.800 bytes;
  SHA-256 `1a7aca8ebaf995ee409eca8a67c35b3534cca4d1ba8c09ce43af1970cd494793`.
- Fonte editável: `candidate-r1/simao-r11-rig-candidate.blend`.
- Autoria reproduzível: `author_simao_r11.py`; QA: `qa_simao_cpu.py` e
  `qa-viewer.mjs`. Logs e medições acompanham a pasta do candidato.

Os GLB/BLEND e suas texturas mantêm a licença própria da malha. Não são
incluídos nem relicenciados pelo repositório público MIT do jogo.

## O que foi criado

Rig de 23 ossos no Blender, com 22 articulações deformantes exportadas;
11.460 triângulos, quatro influências por vértice no máximo e pesos
normalizados. A fonte em T foi preservada. O candidato tem braços relaxados
e dois clipes próprios: espera de 3,2 s e caminhada de 1,2 s, no lugar,
concebida para deslocamento de 0,70 m/s. Metros, eixo Y para cima no GLB e
frente em −Z; essas convenções ainda passam pela inspeção no Three.

A passada inicialmente cogitada de 0,80 m/s foi reduzida após o cálculo
de alcance das pernas; não se força o joelho além do comprimento da cadeia.
O rig não usa os 11 ossos provisórios de `src/rig.ts`.

## Verificações e limites

O GLB foi reimportado e amostrado em 121 instantes por clipe. A QA CPU
relatou zero vértices sem peso, continuidade de loop, aproximadamente 2 mm
de deslizamento dos vértices dos pés durante apoio, até 3,2 mm de penetração
no plano e cerca de 9,25 cm de elevação na passada. São resultados deste
ensaio geométrico, não aprovação da animação vista por uma pessoa.

Validador glTF: zero erros e dois avisos, sobre tangentes ausentes e uma
skin sob ancestral comum. O viewer compara fonte/candidato, materiais,
escala, mangas, túnica, pés e transformações no carregador real do Three.

Foram gravados 40,24 s no Three/Chromium e inspecionadas sequências de frente,
perfil, costas, mangas, joelhos e troca caminhada/espera. Duas revisões de
imagens não encontraram rasgos grandes, explosão da skin, joelhos invertidos
ou pose T residual. O vídeo integral está disponível para revisão humana;
não se confunde essa inspeção por quadros com validação completa em terreno.
Zero erros JS/HTTP foram registrados no viewer. Os braços, mãos e tecido
ainda têm movimento simples, sem pretensão de captura de movimento.

Evidência: `candidate-r1/visual-2026-11-13T19-37-46-403Z/`, com
`simao-r11-review.mp4`, dez vistas e sequências extraídas. Na captura
comparativa inicial, a legenda esquerda/direita ficou invertida pela câmera;
reconhecer a fonte pela pose T e o candidato pelos braços relaxados. As
evidências antigas foram preservadas, e o texto do viewer foi corrigido para
identificar as poses sem prometer uma posição lateral fixa.

Não há dedos articulados,
expressões faciais, fala labial, simulação de tecido, corrida, gesto de
chamar, carregar objetos, montar animais ou IK sobre o terreno do jogo.
Essas capacidades não são inferidas de um clipe de caminhada.

## Integração posterior à aprovação

1. Conferir animações contínuas de frente, perfil e costas, além da troca
   entre espera/caminhada. Corrigir interseções e pesos em nova revisão.
2. Gerar o derivado com orçamento de textura explícito, registrar hash e
   medir download e memória; preservar o candidato de autoria.
3. Usar skin/AnimationMixer reais, sem `bakedGeometry`, `people.ts`, pose
   estática ou fallback humano geométrico. Falha de asset mantém o ator
   ausente, com o encontro narrativo ainda utilizável.
4. Integrar somente Simão no lugar de Simão, conciliar seguidores,
   cinemática e colisão com a branch do Claude e testar E/toque, reload e
   missão. Não apresentar um único ator aprovado como os quatro discípulos.
