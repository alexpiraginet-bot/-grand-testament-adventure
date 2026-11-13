# Abertura e recuperação no Safari — 13/11/2026

Alex relatou encerramento repetido da página no Safari de um iPhone 17 Pro Max.
A causa exata no aparelho não foi medida. O caminho anterior carregava muitas
texturas simultaneamente e recarregava automaticamente após perda do dispositivo
gráfico. Esta revisão reduz pressão de memória e remove essa repetição.

- Abertura HTML antes do renderer, arte identificada como conceito, cruz animada
  e progresso por etapas reais. Começar só habilita após renderizar o primeiro quadro.
- iOS: WebGL2, DPR até 1,25, sombras 1024; um GLB/uma imagem por vez. Cenário
  limitado a 512 px, herói a 1024 antes do upload. Desktop mantém mapas 2048/WebGPU.
- SHA-256/tamanho dos downloads preservados; deadlines, cancelamento comum,
  descarte tardio e erro terminal. Retry/modo compatível exigem clique do jogador.
- Intro e documento oculto não executam render contínuo da cena.
- Marfim, bordô e dourado aprovados por Alex, com referência no tema Dia da
  Bíblia Conectada: abertura, Colabore, Pix, contas, voluntários e painéis auxiliares.

## Verificação antes de publicar

Build, TypeScript e **109/109 testes** passaram. Sete cenários Chrome passaram:
rede lenta desktop/mobile, falha de mundo, falha de GLB, modo compatível e perda
real de contexto durante/depois da inicialização (extensão WEBGL_lose_context).
Painéis/retorno ao jogo/foco/overflow em 1280×800, 390×844 e 320×740 passaram.
WebKit Windows abriu os 14 modelos e entrou na cena antes da revisão final da
paleta/cancelamento; a rechecagem pública será registrada separadamente.

| Amostra local Chrome, 2 s após começar | Desktop | iPhone emulado |
|---|---:|---:|
| Backend | WebGPU | WebGL2 |
| FPS observados | 54,99 / 100,01 | 97,99 / 100,01 |
| Pixels decodificados nos 14 GLBs | 176.160.768 | 13.369.344 |
| Estimativa de texturas do renderer, bytes | 1.215.005.917 | 196.061.824 |
| Resource Timing, bytes transferidos | 18.222.536 | 18.222.536 |

Pixels dos GLBs caíram 92,4%; o download é igual, pois a redução é na decodificação.
A estimativa de texturas não é toda a memória do navegador/GPU. FPS do PC não
prevê o telefone. Amostra curta não substitui teste prolongado nem diagnóstico
de encerramento de processo iOS. Decodes nativos de céu/terreno podem terminar
após cancelamento; resultados são descartados.

Evidências privadas: `shots/startup-final-chrome`, `shots/startup-theme`,
`shots/startup-webkit`, `shots/startup-final-build.log`. A primeira tentativa com
conflito de menus.css também foi preservada. Origem/condições da arte em ASSETS.md.
Tokens lidos em `biblia-conectada-audience/site/src/styles/tokens.css`;
nenhum arquivo daquele projeto foi alterado. Não há recursos Sony/Rockstar/NVIDIA.
Publicação autorizada por Alex; teste no iPhone físico permanece pendente.
