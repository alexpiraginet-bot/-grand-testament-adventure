# Burro R8 — malha detalhada, caminhada e repouso

13/11/2026. Codex, agente `r7_visual_audit`. **Aprovado para integração controlada em solo plano**, com limites abaixo. Nenhuma geração/API/publicação por este agente; fontes copiadas pelo responsável e conferidas por hash.

## Correção realizada

O primeiro burro de 1.418 triângulos segue rejeitado para close. A fonte detalhada tem **17.688 triângulos e 11.073 vértices**, textura de pelagem e silhueta melhores em seis renders PBR/clay. A análise de posições soldadas encontrou um componente, zero triângulos degenerados, zero bordas abertas e zero arestas nonmanifold.

O rig automático detalhado veio com 23 ossos. Sua classificação confundiu uma pata dianteira (`Spine_2 → bone_8 → bone_9`) com coluna e um ramo `Left_Limb` com cauda. O preset Walk movia as patas de modo desigual e chegou a penetrar ≈4,8 cm no piso na escala escolhida. Esse preset foi substituído **somente nas cópias derivadas**.

A correção usa as quatro cadeias anatômicas observadas, resolve o apoio dos cascos, mantém sua orientação e acrescenta movimento discreto de cabeça/cauda. Não muda vértices, pesos ou contagem de ossos da fonte. O repouso mantém quatro apoios, evitando congelar uma pata erguida ao parar.

## Artefatos finais

Os GLBs permanecem fora do Git em `assets-src/fauna-r8/` até a integração deliberada do responsável. A licença do asset Tripo é separada da licença do código.

| Arquivo | Bytes | SHA-256 |
| --- | ---: | --- |
| `sources/gta-fauna-burro-r8-detail-source.glb` | 4.708.992 | `3a12ba3c627780fe20f48aa39a8d6ef76d598a67e4e82a8d8c4ad54b74f1c9d3` |
| `sources/gta-fauna-burro-r8-detail-rig-walk.glb` | 2.874.308 | `9d6723abfde81f027cc3d7dfc4ac1f9c4bcc06f07d12a99a285981bfbe508a41` |
| `candidates/donkey-r8-walk-1024.glb` | 1.807.872 | `de6552cc3150efd81b75059bc95347d7a58c4bd54f54d683ff8a6121e42e034b` |
| `candidates/donkey-r8-walk-512.glb` | 1.095.040 | `25bd1f401968c7dcbfef983854004b7b009a434e574fc90d434e0c0229b3ac02` |

Rig original de Downloads: `tripo_convert_475a5e27-87c9-487f-8a2b-40b94b1607e8.glb`. Nenhuma fonte foi sobrescrita.

## Contrato de integração

- Raiz `donkey-r8-meters`, **frente −Z**, altura neutra total **1,30 m**. Trata-se de escala artística escolhida para o jogo, não de medida histórica comprovada. A fonte olhava para −X; a cópia aplica Y=−π/2 ao ancestral comum da malha/esqueleto.
- `donkey-walk-inplace-r8`: 1,2 s, 16 canais, **0,38 m/s**, 0,456 m por ciclo, apoio em 70% do ciclo. A simulação fornece deslocamento; usar `timeScale = velocidadeReal / 0.38`.
- `donkey-idle-r8`: 2,4 s, 16 canais, deslocamento zero, quatro apoios. Usar ao parar; não congelar uma fase aleatória de caminhada.
- Mapas WebP até 1024² no desktop e 512² no mobile. Escolher uma variante, sem baixar as duas. As três texturas PBR são preservadas em resolução reduzida; não duplicar escala/normalização.
- Envelope observado nos dois clips: X **−0,31854 a +0,31853 m**, Z **−0,79471 a +0,79453 m**; largura ≈0,6371 m e comprimento ≈1,5893 m. Altura animada máxima ≈1,25864 m.
- Para colisão circular conservadora ao redor da origem, **raio 0,91 m** inclui o retângulo completo do corpo/cauda e margem de 5 cm. Para colisão orientada, semieixos com a mesma margem: **0,37 m lateral × 0,85 m longitudinal**. Não confundir largura corporal com raio circular que precisa cobrir giros.

## Evidência

- Khronos glTF Validator no GLB final de cada variante: **0 erros / 2 avisos** (tangentes geradas no runtime e nó skinned sob ancestral). Three.js r186 carrega malha e esqueleto juntos; não generalizar a todo importador.
- GLB final reimportado, AnimationMixer e vértices deformados em **138 fases por clip**, com tempos diferentes dos 121 quadros da autoria. Caminhada: menor Y **0,9928–0,9996 mm** acima do plano. Repouso: **0,9994–0,9996 mm**. Zero soluções IK fora do alcance.
- Quatro âncoras anatômicas, com deslocamento mundial −Z a 0,38 m/s: deslizamento durante apoio **<0,002 mm** na amostragem; cabeças dos cascos mantêm orientação. Os renders conferem deformação além dos números dos ossos.
- Chromium/ANGLE D3D11 na RTX 5060 Ti: **22 capturas**, 5 s de caminhada com 501 frames renderizados e 3 s de repouso com 302 frames, zero erros JavaScript. Silhueta, pernas e quatro apoios conferidos; sem estiramento visível nas fases inspecionadas. Navegador encerrado. Não é benchmark, teste no jogo ou teste de iPhone.
- Caminho das evidências finais: `qa/preview-burro-walk-idle-final/`, incluindo `report.json` com hash do GLB final e vídeo `page@95b024b118f57ae900ce9832498849f3.webm`.

## Limites explícitos

Um teste de 88 combinações de crossfade walk→idle encontrou penetração transitória de **até 6,23 mm** a 50% dos pesos. Os clips isolados não apresentam esse problema. Essa limitação foi comunicada e aceita pelo responsável para integração controlada; não alegar contato perfeito durante a mistura. Não foi acrescentado IK completo de terreno.

Ainda verificar curvas, desaceleração, colisões, terreno irregular, iluminação da cena e aparelho físico. A variante 512 tem validação estrutural; a revisão visual isolada usa 1024. Não afirmar equivalência visual em close no mobile.

## Reprodução e rastreabilidade

Script de autoria: `qa/author-donkey-walk.mjs`, com hash obrigatório da fonte. Inspeção: `qa/audit-rig-motion.mjs` (altura, quantidade de amostras e índice de clip como argumentos), `qa/audit-donkey-transitions.mjs` e `qa/capture-preview.mjs` no modo `rig-donkey`.

Relatórios: `qa/burro-r8-final-{walk-motion,idle-motion,walk-stance,idle-stance,transitions,1024-gltf-validation,512-gltf-validation}.json`, `qa/burro-r8-authored-contact.json`. Inventário dos ossos e influências originais: `qa/burro-r8-detail-rig-130-motion.bones.json`. Relatórios anteriores à inclusão de idle têm outro hash; as evidências finais são as explicitadas acima.

A autoria final também está preservada no código aberto em `tools/fauna/author-donkey-walk.mjs`, com parâmetros explícitos e hash obrigatório. A reexportação para pasta nova produziu GLBs 2k/1024/512 byte a byte idênticos aos revisados. Comandos e prova: `tools/fauna/README.md` e `tools/fauna/REPRODUCIBILITY.json`. Nenhuma dependência foi acrescentada.
