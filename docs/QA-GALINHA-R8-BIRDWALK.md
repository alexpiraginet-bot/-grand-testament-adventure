# Galinha R8 — revisão da malha e caminhada

13/11/2026. Responsável: Codex, agente `r7_visual_audit`. Fonte Tripo preservada; nenhuma chamada de API, geração ou publicação nesta revisão.

## Resultado e limites

**Candidata R2 aprovada para integração controlada em solo plano.** A captura real em Chromium mostra pés alternando, dedos apoiados, asas fechadas e corpo sem estiramento visível nas 18 vistas/fases conferidas. Ainda requer verificação no terreno do jogo, durante curvas/paradas e no iPhone físico. Não é aprovação de toda a fauna nem prova de anatomia/época histórica.

O Walk automático original do Tripo foi rejeitado: o clipe `preset:quadruped:walk` movimentava apenas três ossos da cauda, sem deslocamento dos pés. A primeira correção local R1 também foi rejeitada: girava os dedos junto com a canela. Ambas permanecem preservadas para comparação.

R2 usa as duas cadeias observadas no rig, adiciona um osso de pé a cada uma e transfere gradualmente apenas os pesos inferiores dessas cadeias. A posição neutra dos 5.790 vértices foi preservada com desvio máximo de 0,000000100 m. A malha mantém 7.886 triângulos, passa de 20 a 22 ossos e conserva as três texturas PBR. Não houve reconstrução cega de esqueleto.

## Arquivos e procedência

Arquivos grandes e capturas ficam fora do Git, em `assets-src/fauna-r8/`.

| Arquivo | Bytes | SHA-256 |
| --- | ---: | --- |
| `sources/gta-fauna-galinha-r8-rig-walk.glb` | 2.491.440 | `0eda48666418c7473e308a8667bac8a721dfc6abd7f2756a7c4b9a7d5fe7e1e6` |
| `candidates/chicken-r8-birdwalk-r2-1024.glb` | 1.250.520 | `68acfac44214863cad4252a4bda4a94fed142eec9bef043ce8bf338f7ffd978d` |
| `candidates/chicken-r8-birdwalk-r2-512.glb` | 687.972 | `33c5201a20851cb50fe8a6577bb5c94691969aa1c8cf1055df2da04e04098eb0` |

Job da malha: `eb78abc7-cd1e-4c5d-890e-826c16ba0f09`. Export rig original: `tripo_convert_09d8546f-7b9a-4ed2-817a-79aed0afd6a0.glb`. Os termos da conta Tripo aplicam-se ao asset original e seus derivados; este relatório não altera licença nem coloca a malha sob a licença do código.

## Contrato de integração

- Raiz `chicken-r8-meters` já em metros: **0,45 m de altura neutra**, frente **−Z**, sola em Y≈0. Não aplicar normalização uma segunda vez nem separar a malha do esqueleto.
- Clipe `bird-walk-inplace-r8-r2`, duração 0,96 s, nove canais. Ciclo no lugar; a simulação move o agente.
- Velocidade nominal **0,24 m/s**, percurso por ciclo **0,2304 m**. Usar `timeScale = velocidadeReal / 0.24` quando andando; não continuar o ciclo se o agente parar/bloquear.
- Passada alternada com apoio em 56% do ciclo, pé elevado até 3 cm na fase livre. Corpo baixa 2,5 cm durante caminhada; altura animada máxima observada ≈0,42723 m.
- Transições entre repouso/andar e curvas devem ser suaves. Em desníveis, só posicionar a raiz na altura local não garante contato dos dois pés; usar caminhos suaves e revalidar. Não afirmar IK de terreno implementado.
- Desktop: mapas WebP até 1024²; mobile: até 512². Variante 512 passou validação estrutural; a captura visual desta revisão usa 1024. Não carregar as duas variantes simultaneamente.

## Evidência

- Khronos glTF Validator: **0 erros / 2 avisos** em cada variante. Avisos: tangentes calculadas em runtime e nó de malha skinned não raiz, herdado da estrutura com ancestral comum. Teste real no Three confirma que esqueleto e malha recebem a transformação juntos; não generalizar para todo importador.
- Export final reaberto com o Three.js do projeto (`r186`), AnimationMixer + vértices deformados em **121 fases**. Menor Y entre **0,00048007 e 0,00050003 m**; sem penetração no plano. Movimento máximo de vértice do pé: 0,12907 m. Zero soluções IK fora de alcance na autoria.
- Contato horizontal após somar deslocamento real a 0,24 m/s: deslizamento máximo de osso de pé **0,355 mm** durante apoio. Orientação independente do pé preservada. O teste dos ossos complementa a inspeção de dedos, não substitui vértices/visual.
- Chromium/ANGLE D3D11 na RTX 5060 Ti, uma janela 720×720: **18 capturas**, grade de 5 cm, vídeo de **5 s / 501 frames renderizados**, sem erro JavaScript. Não é benchmark de FPS, teste mobile ou prova da integração no jogo. Navegador encerrado após captura.
- Topologia da fonte tem pequenas bordas/nonmanifold já documentadas; nenhuma costura abriu nas fases renderizadas. Não foi feita correção destrutiva de topologia.

Relatórios: `qa/galinha-r8-birdwalk-r2-{motion,stance,1024-gltf-validation,512-gltf-validation}.json`, `qa/galinha-r8-authored-r2-contact.json`. Inventário de ossos/pesos: `qa/galinha-r8-rig-motion.bones.json` e `qa/galinha-r8-birdwalk-r2-motion.bones.json`.

Capturas e vídeo: `qa/preview-galinha-birdwalk-1024-r2/`, incluindo `report.json` e `page@642affa83ea4504d1d0c576d0c55c696.webm`. Scripts de reprodução: `qa/author-birdwalk-r2.mjs`, `qa/audit-rig-motion.mjs`, `qa/capture-preview.mjs`; ler limites e hash da fonte antes de executar. Fonte original intacta; nenhum arquivo copiado para `public/` por este agente.

A autoria final também está preservada no código aberto em `tools/fauna/author-chicken-walk.mjs`, com parâmetros explícitos e hash obrigatório. A reexportação para pasta nova produziu GLBs 2k/1024/512 byte a byte idênticos aos revisados. Comandos e prova: `tools/fauna/README.md` e `tools/fauna/REPRODUCIBILITY.json`. Os binários continuam com licença separada.
