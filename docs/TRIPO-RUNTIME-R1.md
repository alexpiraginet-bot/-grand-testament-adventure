# Integração visual R1 — 12/11/2026

Responsável: Codex, a pedido de Alex, branch `codex/tripo-runtime-r1`, base `917a69d`.
Não foi iniciada outra sessão Claude Code nem geração paga no Tripo nesta revisão.

## Resultado

- Herói: esqueleto nativo de 65 ossos, 17.481 triângulos, AnimationMixer e `walk` in-place.
  Malha, esqueleto e ancestral de normalização permanecem juntos. Conversão +Z para -Z no grupo inteiro.
- Parada: pose calculada a partir da média do ciclo; não é um clip idle entregue pelo Tripo.
  Shift acelera a caminhada; não existe run ou beckon específico. O rig provisório não é usado no herói.
- Treze cenários: casas A/B/C, oliveiras A/B, árvore espinhosa, arbusto seco, junco,
  pedras, muro, barco, rede amontoada e rede lançada. Escalas/pivôs tratados nos derivados, fontes preservadas.
- Vegetação em pools instanciados por modelo, com detalhe próximo e geometria simples distante.
  Uma tentativa com muitas células gerou travadas ao mudar a vista e foi substituída antes da entrega.
- Cenário ampliado a pedido de Alex: 131 construções, 30 pátios, 48 jarros; 1.320 grupos de
  pedras distribuídos na área do jogo e maior densidade ao longo da caminhada. Quantidades
  extraídas de `window.__gta.world`, não indicam o total simultaneamente visível nem dados históricos.
  Caminhos estreitos sobre terra firme, câmera com obstrução e chão PBR CC0 em 2K.
  Referências e limites em `docs/CAFARNAUM-CENARIO.md`.
- Qualidade alta é o padrão também no viewport móvel. Mantidas texturas 2048² (WebP qualidade 88),
  antialiasing e sombras 4096² no desktop / 2048² no toque. `?q=low` continua disponível.
- Corrigida orientação do barco para usar a mesma tangente da margem usada pelas posições dos NPCs.
- Caminhada usa deslocamento realizado, de modo que uma colisão não deixe as pernas caminhando paradas.
- Contador técnico corrigido: draw calls por frame, não a contagem cumulativa de renders do Three.js.

## Recursos e publicação

`src/data/tripo-assets.json` contém hashes, bytes, orçamento e status dos 20 modelos. Somente 14 têm
status runtime. Seis NPCs em pose A permanecem fora do carregamento até receber rig e animações.

`tools/prepare_tripo.mjs` reproduz os derivados a partir do lote em `assets-src/tripo-r1/`, verificando os
hashes das fontes. Texturas mantêm a resolução original; a compressão reduz banda sem simplificar o rig.
`tools/fetch_assets.mjs` baixa os 14 binários do host separado e verifica tamanho e SHA-256 antes de escrever.
Arquivos existentes divergentes são preservados e causam erro; não são substituídos silenciosamente.
O build falha se um asset faltar ou divergir, evitando uma publicação sem as malhas.

Host: https://grand-testament-assets.vercel.app/ . Projeto Vercel `grand-testament-assets`,
`prj_FGDYyltEPY0mWrTyUqTnI6nNuNwq`, equipe `lexprojects`, independente do repositório de código.
Primeiro deploy de recursos: `dpl_DTuJEs3qt4K5MTfu4yMV193g2xFK`.
Os 14 arquivos foram baixados anonimamente desse host e conferidos por SHA-256.
O build do jogo os serve na mesma origem; não precisa de token no frontend.

Os binários continuam fora do Git e da licença MIT. Foram gerados na conta Pro de Alex.
Os [termos oficiais do Tripo, seção 5.2.2](https://www.tripo3d.ai/terms), consultados em 12/11/2026,
preveem direitos sobre outputs de usuários pagos, sujeitos às condições do serviço. Não concedemos uma nova
licença geral de redistribuição dos modelos. A publicação é para uso no jogo autorizado por Alex.

## Verificação

- `npm run build`: TypeScript, 34 testes e Vite passaram. O teste de assets abre todos os 14 GLBs,
  verifica hash, bytes, orçamento de triângulos/texturas e a presença do esqueleto/clip do herói.
- `tools/check_tripo.mjs`: Chrome/WebGPU em 1280×800 e 390×844 (toque), mais WebGL2 desktop.
  WASD / toque CDP, animação realmente mudando os ossos, parada, pausa do formulário, quatro orientações,
  limites finitos, todos os recursos carregados, zero erros de página/rede/console na execução final.
- `tools/shots.mjs`: as três missões concluídas nos dois viewports, com os quatro seguidores.
  Usa teleporte e ações de depuração nas missões; não é uma caminhada manual completa.
- RTX 5060 Ti neste PC: teste de integração final desktop WebGPU 85,3–95,9 FPS;
  viewport móvel 59,9–94,7; WebGL2 75,9–94,8. Ao final, 166 draw calls / ~1,66 milhão de triângulos.
  Transferência local sem cache: ~17,58 MB de recursos. Carregamento local ~2 s WebGPU / 5,6 s WebGL2.
  Esses tempos não representam a rede pública nem FPS de um telefone físico.
- `tools/check_world.mjs`: corredor de cinco segmentos sem bloqueios de cenário/água;
  capturas de vila, pátios, caminho e margem nos dois viewports. NPCs da área de interação
  são excluídos desse predicado de cenário. Na amostragem parada: ~93–95 FPS, até ~3,14 milhões
  de triângulos (inclui os passes contados pelo renderer); instâncias evitam um draw por objeto.
- Medição de texturas do renderer: até ~1,16 GB no desktop e ~0,99 GB no viewport móvel.
  É uma configuração exigente; ainda falta prova em Safari/iPhone e Android reais.
- Evidência local, fora do Git: `shots/tripo-r1-release/`, `shots/cafarnaum-r1-release/`,
  `shots/episode-r1-release/`. Registros anteriores são preservados em suas pastas históricas.

Referência de implementação: [AnimationAction, Three.js](https://threejs.org/docs/pages/AnimationAction.html).
Consulta auxiliar ao Gemma local não substituiu testes nem revisão das capturas.

## Próximas etapas e limites

Rig dos seis NPCs, idle/run/beckon próprios e revisão artística da vegetação (silhuetas ainda bastante facetadas).
Não foram alterados os dados do relevo para aproximar as casas da água. Nuvem continua desligada;
DLSS 5 não está ativo nem foi demonstrado funcionando. O código público e os assets externos têm licenças separadas.
O conector GitHub continua respondendo indisponível; a branch/diff ficam preservados, mas não declarar PR criada
sem um número real. O Git nativo autenticado continua sendo usado para os pushes autorizados.
