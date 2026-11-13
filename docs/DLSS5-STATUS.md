# DLSS 5 — estado do projeto e conceito visual

## Atualização de 13/11/2026

A existência do DLSS 5 foi novamente confirmada na [página oficial da NVIDIA](https://www.nvidia.com/en-eu/geforce/news/dlss-5-3d-guided-neural-rendering/).
A tecnologia usa dados do motor para reconstrução neural temporalmente estável;
gerar uma imagem estática não é executar essa integração no jogo.

Por pedido de Alex, foi criada uma imagem aspiracional com `image_gen`, baseada
na captura real R6 do convite. Ela mostra a direção desejada de materiais, luz,
água e personagens, com o rótulo **CONCEITO VISUAL • META DE QUALIDADE**.
Não altera o jogo, não é resultado DLSS e não é uma peça oficial NVIDIA.
O enquadramento é aproximado, não uma comparação pixel a pixel.

Fonte privada da série: `Serie-Reels-R1/Fontes-R6/Conceito-Convite-R1/` no acervo
de vídeos. SHA-256 da imagem: `EBEB0DD9D579A0886A9244F2358A38805E1C245574905BA6661DEE50DC9C016B`.
A montagem solicitada alterna 3–5 segundos de gameplay real, congelamento e
conceito identificado. FPS do gameplay não deve acompanhar a imagem gerada.

## Teste experimental de 12/11/2026

O pedido é qualidade gráfica máxima com a RTX 5060 Ti. **Não existe resultado
DLSS 5 ON comprovado neste projeto.** Não apresentar render convencional como DLSS.

O Codex executou a demo experimental pública
https://dlss5-webgpu.dlss5-webgpu-standalone.workers.dev/ no Chrome 156, com adaptador
WebGPU NVIDIA/Blackwell e RTX 5060 Ti (16 GB, driver 616.92). A cena padrão falhou
ao buscar `view.json` no servidor de recursos do autor (HTTP 401). A importação do
nosso GLB falhou ao carregar `studio_small_08_1k.hdr`: **Unable to load Neutral
studio · soft**. O indicador permaneceu **DLSS 5 OFF**.

Captura e relatório locais: `assets-src/tripo-r1/qa/dlss5-experiment/`. Não há FPS de
inferência, ganho de qualidade ou comparação ON/OFF medidos. O teste do herói no
viewer Three.js foi separado e funcionou, mas não usa DLSS.

O código experimental inspecionado foi
https://github.com/maanHimself/OpenDLSS-NR, commit
`9d08f4184bbcb9d858e2fb7a7834ec0837a9d2f1`. A licença MIT do código não concede os
direitos de pesos/software da NVIDIA, conforme o NOTICE do repositório.

Em 09/11/2026, a NVIDIA informou no fórum que o SDK de Neural Rendering DLSS 5
ainda estava restrito a parceiros, sem preview público:
https://forums.developer.nvidia.com/t/official-dlss-5-neural-rendering-plugin-access-for-unreal-engine-5-8-2/382731/11

Para continuar, obter acesso legítimo aos recursos/SDK necessários e validar uma
cena local. Não alterar drivers, baixar pesos não autorizados ou chamar DLSS 2/4
de DLSS 5. O caminho experimental WebGPU e o caminho nativo são trabalhos distintos.
