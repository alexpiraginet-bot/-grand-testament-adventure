# Casas R10 — proporção, fachada e contato com o terreno

13/11/2026. Codex, subtarefa de geometria/posicionamento na branch
`codex/village-quality-r10`, base `a1c5b21`. Alex autorizou prosseguir com a
direção R9. Fontes preservadas: os GLBs, seus mapas, o catálogo, o DEM e as
rotas não foram editados. Nenhuma geração Tripo, gasto ou publicação nesta
subtarefa. Integração e revisão visual de navegador pertencem à sessão principal.

## Mudança concreta

O código anterior ajustava largura, altura e profundidade independentemente,
deformando os três modelos. `src/village-houses.ts` aplica agora uma única
escala: o menor fator que cabe na largura, profundidade e altura do lote já
existente. Colisores, detalhes da fachada e habitats recebem as dimensões reais.

O centro muda somente no eixo local Z para preservar a posição da fachada
`+Z`. Isso evita alargar a rua quando a casa ocupa menos profundidade. O novo
footprint continua inteiramente contido no lote anterior, em qualquer rotação.
O maior deslocamento medido foi 1,900 m; não é um deslocamento da fachada ou
de uma rota. A margem horizontal dos colisores permanece 0,35 m.

**A proporção preservada é a do GLB runtime catalogado.** A preparação R1 em
`tools/prepare_tripo.mjs` já ajustava as fontes brutas com fatores diferentes
por eixo para os `target.sizeMeters`. Esta revisão não refaz essas fontes nem
afirma recuperar automaticamente as proporções originais do Tripo.

O bloco retangular liso foi substituído por uma saia contínua cuja borda segue
o chão. O contorno vem do casco convexo dos vértices nos 12% inferiores da
malha, recuado 1,5%; assim o beiral do telhado não vira a largura da base.
São 20 vértices no contorno A e 12 nos contornos B/C, antes das subdivisões
necessárias para acompanhar o relevo. Não há centenas de novas pedras soltas.

A fundação reaproveita **os mesmos objetos de textura** de pedra/cascalho do
terreno: albedo, normal e rugosidade. Não há imagem nova, clone de textura,
requisição adicional ou mudança de `repeat`/sampler global. O material tem
metalness zero, roughness 1 e normalScale 0,4; UVs são medidas em metros, com
tile de 1,8 m. É um embasamento de agregado/rubble, não uma nova alvenaria
detalhada. O atlas fragmentado de `muro-pedra` foi examinado e não foi usado
como textura repetível, pois seus recortes produziriam manchas falsas.

## Contato mensurável, sem alterar a elevação

`src/village-house-placement.ts` calcula a faixa de altura do footprint
rotacionado usando dois referenciais:

- O `Terrain.heightAt` bilinear usado pela lógica do jogo.
- Os triângulos reais de `PlaneGeometry`, em 256 segmentos ou 192 no perfil
  `low`, amostrados a partir do mesmo DEM.

O cálculo inclui vértices internos da grade, cruzamentos com suas linhas e
diagonais e extremos quadráticos nas bordas do interpolante bilinear. A base
da casa fica 2,5 cm acima do maior desses valores. A borda inferior da saia
fica 8 cm abaixo do menor valor local e é subdividida nas quebras de triângulo,
com trechos de no máximo 1,5 m. O topo entra 1,2 cm na malha da casa para
reduzir frestas numéricas. O terreno não é achatado, elevado ou regravado.

## Medidas CPU da cena real

Medição com `public/world/cafarnaum*.json`, os três GLBs catalogados e os
lotes/rotas atuais. Arquivo bruto local: `shots/village-r10-cpu/metrics.json`.
`shots/` é evidência local ignorada pelo Git.

| Dado | Valor |
| --- | ---: |
| Casas preservadas | 158 |
| Triângulos dos modelos de casa, contando instâncias | 607.320 |
| Escala uniforme mínima / máxima | 0,75319 / 1,13125 |
| Largura resultante mínima / máxima | 4,138 / 8,555 m |
| Altura resultante mínima / máxima | 2,260 / 3,394 m |
| Profundidade resultante mínima / máxima | 3,311 / 5,632 m |
| Batches de casas / de fundação | 3 / 1 |
| Fundação, grade 256 | 12.483 triângulos; 29.127 vértices |
| Fundação, grade 192 | 13.167 triângulos; 30.723 vértices |
| Altura exposta da base, grade 256 | 0,037–1,967 m |
| Altura exposta da base, grade 192 | 0,037–1,278 m |

A base anterior tinha 1.896 triângulos (158 cubos). A nova base acrescenta
10.587 triângulos na grade 256, aproximadamente 1,74% sobre o conjunto
anterior de casas e bases. Os batches desse conjunto continuam quatro,
antes das passagens de sombra e dos detalhes domésticos. Isso é contagem
de geometria/código, **não uma medição de ganho ou perda de FPS**. A malha
única da fundação troca baixo número de draw calls por culling grosseiro;
uma divisão espacial pode ser avaliada depois, com evidência de desempenho.

## Contrato de integração

```ts
houses(terrain, cap.x, cap.z, routes, assets, {
  map: groundTextures.albedo,
  normalMap: groundTextures.normal,
  roughnessMap: groundTextures.roughness,
  groundSegments: quality === 'low' ? 192 : 256,
});
// -> { group, boxes, plans, diagnostics }
```

`plans` contém os centros e dimensões finais; os detalhes já o usam dentro
do módulo. A integração de fauna deve recebê-lo também, em vez de recalcular
`settlementLayout`. `diagnostics` registra contagens, escalas, geometria,
grade, variantes ausentes e presença das texturas compartilhadas. A sessão
principal expõe esses dados no diagnóstico do jogo. Um GLB de casa ausente
remove suas instâncias/colisores; não produz uma casa de cubo sem textura.

## Verificação e limites

`node --test test/village-houses.test.ts`: **8/8 passaram**.
`npm run typecheck`: **passou** após a integração de assinatura pelo root.
Os testes cobrem:

- Razão entre três eixos para A/B/C, quatro rotações, fachada e contenção no lote.
- Fontes deslocadas da origem e relação entre dimensão real e colisor.
- Pico interno da grade e sela bilinear que o teste apenas dos cantos perderia.
- Diferença real entre interpolação bilinear e os triângulos desenhados.
- Ausência de frestas sob a saia, em múltiplas rotações e duas grades.
- Contorno convexo, escala física de UV, triângulos voltados para fora/cima.
- Faixa inteira das rotas com raio de jogador, alturas no DEM real e hash
  byte a byte do DEM inalterado após a operação.
- Ausência de casas/colisores fictícios se o modelo não carregar.

As casas continuam com aproximadamente 3–5 mil triângulos e os mesmos
atlas/texturas. Pedras angulosas, repetição entre três variantes, nitidez
limitada em close e a qualidade da autoria original não foram corrigidas
por esta mudança. Em encostas ainda existe fundação alta, até 1,97 m nesta
cena; esconder esse fato exigiria repensar arquitetura/implantação, não só
um material. O casco convexo é uma aproximação conservadora da base, não
uma reconstrução de interiores. Casas não se tornam visitáveis por isso.

Esta subtarefa **não executou GPU nem declarou aprovação estética**. A
comparação A/B no navegador é feita pelo agente de QA usando os mesmos
pontos, horários e câmeras; aprovação visual, FPS e iPhone físico precisam
das respectivas evidências, sem inferir uma coisa da outra.
