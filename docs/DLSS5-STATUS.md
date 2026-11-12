# DLSS 5 — estado verificado em 12/11/2026

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
