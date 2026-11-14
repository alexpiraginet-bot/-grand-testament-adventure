# Rede e margem: diagnóstico e busca de água R15

14/11/2026, Codex, verificação CPU encerrada aproximadamente 19:12 BRT.
Complementa `APOIO-CENARIO-R15.md`. Sem GPU, LLM, downloads, edição de GLB,
mudança de terreno, publicação ou alteração do laboratório.

## O que a captura revelou

Captura local examinada: `shots/r15-first-simao.png`, SHA-256
`2b8f851b96da61bff5715addf9859bfb0aa873e0ccb2253c76987b7b2e2b1f9f`.
O tecido dourado aparece recortado pelo chão. O ajuste vertical anterior
colocou a maior parte da rede na linha média da água, mas seu XZ nominal
continua sobre terra. São problemas diferentes de uma rede flutuando no ar.

A fórmula nominal ao lado de Simão produz X=-206,7785027, Z=435,9570668.
O `facing` usado ali deriva do par margem/barco do episódio, não de uma normal
da margem local junto aos dois pescadores. A leitura do terreno é:

| Grade renderizada | Altura no pivô | Intervalo sobre toda a envolvente da rede |
|---|---:|---:|
| 192 | +0,01696 m | -0,00220 a +0,03613 m |
| 256 | +0,02501 m | +0,01157 a +0,03845 m |

Assim, no perfil 256 a envolvente inteira fica sobre solo acima da água Y=0.
O pior vértice baixo da rede corrigida está a -0,2012402 m. Só deslocar o
tecido principal sobre um trecho raso ainda deixa esse peso dentro do chão.

## Helper separado e contrato

`src/cast-net-water-placement.ts` exporta:

```ts
findCastNetWaterPlacement(terrain, bounds, pose, {
  rootY, waterY: 0, maxRadius: 12, clearance: .015,
})
```

- `bounds` são os bounds locais reais da geometria já corrigida verticalmente;
  `pose` recebe x/z, rotação Y e escalas opcionais positivas.
- Testa primeiro a pose inicial. Depois busca círculos de raio crescente a
  cada 0,25 m, 96 ângulos por círculo, até o limite explícito de 12 m. Um limite
  menor não múltiplo de 0,25 também é testado. O teto é 4.609 candidatos.
- Usa a envolvente rotacionada, incluindo pivô deslocado. Todos os cantos
  precisam ficar dentro do DEM, sem depender de clamp fora do mapa.
- Calcula extremos das superfícies triangulares reais 192 e 256. **Ambas**
  devem ficar abaixo de `min(waterY, rootY + bounds.minY * scaleY) - clearance`.
- Retorna x/y/z, rotação, distância, teto permitido, faixas por grade e número
  de candidatos; ou `null`. Não muda os bounds, DEM ou geometria; não deforma
  a rede, não aumenta seu raio e não usa posição terrestre como alternativa.
- A posição retornada é a primeira válida no conjunto finito amostrado. Não
  se afirma ótimo contínuo entre ângulos/raios. Pode omitir um encaixe muito
  estreito que exista entre amostras; o retorno não pode aceitar relevo acima
  do limite só por não ter sido amostrado no pivô.

O caso real retorna **null** dentro dos 12 m quando exigimos terreno abaixo
de -0,2162402 m para preservar o peso baixo com 1,5 cm de folga. A sondagem anterior
só encontrou uma envolvente abaixo de -0,22 m a 16 m do ponto nominal; esse ponto
não é aceito pelo helper e não foi proposto como extensão silenciosa do raio.
O integrador deve omitir a peça quando vier `null` e manter a missão utilizável.
A integração em `main.ts` pertence ao agente principal e já foi observada
usando esse contrato; a comprovação visual posterior pertence à sua rodada.

## Material da rede: pendência distinta

GLB examinado: `public/models/tripo-r1/rede-lancada-233b768b70c4.glb`.
SHA-256 permanece
`233b768b70c4ec77d25da7bf971ea22b9a5303208b8b58c99717b4e3e04bde22`.

O material é `OPAQUE`, com base color WebP de 2048×2048, três canais RGB e
nenhum canal alpha. A média do albedo é aproximadamente (164,68; 131,77; 73,70),
com áreas douradas sólidas no atlas. O fator metálico declarado é1, mas o
canal metálico da textura tem média6,85/255; o dourado é principalmente do
albedo, não prova de material realmente metálico. Rugosidade média 163,74/255.

Bytes originais das imagens foram extraídos, sem transformação, para revisão
em `shots/r15-net-diagnostic/albedo.webp` e `orm.webp`. O atlas foi observado
visualmente. Não existe máscara de furos comprovada nesse material. Não foi
inventado alpha a partir de brilho, uma grade procedural, nem aplicado um
tom diferente como se isso resolvesse a geometria de uma rede de corda.
Uma malha/UV/máscara corretas ainda precisam de revisão artística própria.

## Por que a margem fica angular

`public/world/cafarnaum.json` declara 3072 m de lado, 257 amostras e 12 m por célula.
`world.ts:groundMesh()` cria o terreno em `PlaneGeometry`, e `main.ts` passa
192 segmentos no perfil baixo e 256 nos demais. Isso gera células visíveis
de 16 m/12 m, cujas diagonais são 22,63 m/16,97 m. O encontro do nível da água com
esses triângulos produz segmentos retos longos. Uma textura mais detalhada
não altera essa silhueta geométrica.

`lake-surface.ts` já prevê espaçamento de 3 m desktop/6 m mobile junto à margem
e ondas de até 4,5 cm. Aumentar só os vértices da água não refina o chão que
recorta a água. Dobrar o terreno inteiro para 512 segmentos quadruplica os
triângulos em relação a 256, para 524.288, sem criar medição geográfica nova.

Próxima correção sugerida: malha local de margem com transição contínua,
superfície única e critério compartilhado com posicionamento/colisão. Uma
sobreposição sem costura pode criar z-fighting e discordância de apoio. Essa
mudança não foi implementada hoje, pois requer comparação visual e de custo
no navegador, inclusive no celular; não há prova de desempenho nesta análise.

## Verificação

```powershell
node --test test/cast-net-water-placement.test.ts
node node_modules/typescript/bin/tsc --noEmit
git diff --check
```

Sete testes do helper passaram: pose já segura, peso em água rasa, primeiro
raio válido, footprint rotacionado/descentrado, limite de 12 m/fora do mapa,
necessidade independente das duas grades (também com ordem invertida) e o
caso real que deve ser omitido. O teste real levou cerca de 36 ms nesta rodada
CPU, número de uma execução local, não benchmark/FPS. Os testes anteriores
de apoio e pose continuam documentados em `APOIO-CENARIO-R15.md`.

AABB é conservadora: exige folga até nos vazios entre fios, podendo omitir
poses que uma colisão por triângulo aceitaria. Nenhuma simulação hidrodinâmica,
interação da rede, estabilidade Safari ou aprovação estética é alegada aqui.
