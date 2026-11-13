# Diário de desenvolvimento — Grand Testament Adventure

Pedido de Alex: registrar cada melhoria para depois construir uma série de Reels.
Este diário guarda fatos verificáveis, decisões e limitações. Não é roteiro aprovado
nem autorização de publicação social. Código publicado e episódio de Reel publicado
são etapas diferentes.

## Linha do tempo comprovável

As datas abaixo são as datas de autoria armazenadas no Git, com seu fuso original.
Não representam duração do trabalho, hora de cada captura nem comprovação nova de
um teste antigo. Handoffs históricos são relatos daquela entrega.

| Data Git | Entrega / commit | O que foi registrado | Evidência e limite |
|---|---|---|---|
| 2026-11-12 21:26:09Z | `1ad6154` — save em nuvem e exportação | Implementação de save/nuvem e contrato para outra engine | Histórico Git e `HANDOFF.md`; nuvem continuou desligada. Não é teste de DLSS. |
| 2026-11-12 21:36:21Z | `84443a7` — handoff da sessão de origem | Apelido e recuperação, continuidade do protótipo | `HANDOFF.md`; build/testes relatados pela sessão de origem, não repetidos aqui por este diário. |
| 2026-11-12 19:10:23−03:00 | `8bc56a0` — continuidade local | Preservação do projeto, pacote de malhas e licenças separadas | `HANDOFF-CODEX.md`, `ASSETS.md`; preparar arquivos não prova sessão Claude autenticada. |
| 2026-11-12 19:28:02−03:00 | `23870fb` — Construa conosco | Formulário de ideias/problemas e composição de issue GitHub | `docs/CONSTRUA-CONOSCO.md`, `shots/feedback/`; nenhum feedback fictício foi publicado. Jogador confirma no GitHub. |
| 2026-11-12 19:59:46−03:00 | `293fc84` — publicação inicial | Link público Vercel e conexão com o repositório correto | `docs/PUBLICACAO.md`, `shots/publicacao/`; cenário ainda usava formas simples. |
| 2026-11-12 20:09:01−03:00 | `917a69d` — evidência da publicação | Build/testes, acesso anônimo e limitações registrados | `docs/PUBLICACAO.md`; separar viewport móvel de telefone físico. |
| 2026-11-12 21:25:18−03:00 | `6e35ff1` — visual R1 | Herói Tripo com rig nativo, 13 malhas de cenário, vila e caminhos | `docs/TRIPO-RUNTIME-R1.md`; `shots/production-r1-{integration,world,episode}/`. 14 assets e três missões verificados naquela versão; NPCs provisórios. |
| 2026-11-12 21:41:08−03:00 | `424a096` — visual R2 | Céu fotográfico CC0, água rasa, reflexos e exposição | `docs/CAFARNAUM-CENARIO.md`; `shots/production-r2-integration/`, incluindo `PUBLICACAO-VERIFICADA.json`. 34 testes no build daquela revisão. |
| R3 — data de commit pendente | Revisão em andamento | Rua menos regular, decoração orientada pela fachada, tecido/pregas dos NPCs e dicas contextuais de jornada | `src/world-layout.ts`, `src/people.ts`, `src/journey.ts`, `src/hud.ts`; capturas `shots/r3-final-*`. Atualizar commit/deploy após a validação final; não presumir publicação. |

Os instantes UTC das duas primeiras linhas antecedem a continuidade local
(18:26 e 18:36 em UTC−3). A diferença de fuso não deve virar uma falsa ordem na edição.

### Evidência local R3, antes da publicação

O relatório `shots/r3-final-build.log` registra **39 testes passando**. A integração
em `shots/r3-final-integration/report.json` registra 14 assets e zero erros de página;
amostra de FPS: desktop WebGPU 87,3–94,7, viewport móvel emulado 47,7–93,9 e WebGL2
89,8–95,5. Transferência de recursos nessa execução local: 17.887.926 bytes.
O cenário contém 158 casas, 20 pátios, 89 jarros, 69 toldos e oito segmentos de
caminho; são contagens do cenário artístico, não demografia histórica.
Esses dados não substituem a conferência pública posterior nem um telefone físico.

### Incremento Claude — HUD móvel (13/11/2026, sobre `4d7cf86`)

Autoria: sessão Claude Code na nuvem, branch `claude/quirky-hamilton-bt0y7w`, PR em rascunho.
Commit e deployment de produção: **pendentes** até revisão/merge; não presumir publicação.

- **Problema observado:** no celular o joystick só aparecia onde o dedo tocava e o botão de ação
  era um círculo com texto; `docs/ALTO-NIVEL.md` pedia joystick sempre visível e ícone de mão.
  Na paisagem 844×390, o botão de ação (posição anterior) cobria a linha "MARCOS 1:16-20" da placa.
- **Mudança:** joystick em repouso fixo no canto inferior esquerdo. Toque perto dele o conduz
  a partir do centro fixo; toque longe, ainda no lado esquerdo, traz a base para baixo do dedo
  durante o gesto e ela volta ao soltar. Raio do controle lido do layout. Botão com mão em SVG
  desenhado no código (sem emoji, `aria-hidden`), nome acessível = verbo da ação ("Chamar").
  Na paisagem, joystick e botão descem às bordas; em telas deitadas de até 340 px de altura
  o joystick fica com 96 px e a linha de referência da placa é omitida (a referência segue na legenda).
- **Arquivos:** `src/joystick.ts` (novo), `src/input.ts`, `src/hud.ts`, `src/hud.css`, `index.html`,
  `test/joystick.test.ts` (novo), `tools/check_touch.mjs` (novo), README e este diário.
- **Fontes/licenças:** nenhuma fonte externa nova; o desenho da mão é código deste repositório (MIT).
- **Evidência:** build completo com assets verificados por SHA-256 e 41/41 testes. `tools/check_touch.mjs`
  em 390×844, 844×390 (toque) e 1280×800, todos sobre `4d7cf86`: controle fixo e recentrado andam, soltar para o herói,
  `AnimationMixer` real com `walk` ≥ 0,9 de peso e ossos mudando, toque real no botão da mão
  dispara a fala, sem sobreposição com missão, radar, links e legenda, zero erros de página/HTTP.
  Varredura de layout de 320×568 a 932×430 em retrato e paisagem. Capturas e relatório em
  `shots/touch-r1/` (fora do Git).
- **Limites:** Chromium sem GPU (WebGL2 por software, cerca de 0,5–1 fps); FPS dessa máquina
  não representa jogo nem telefone. Viewport emulado não é celular físico. Em 568×320 o botão
  encosta (0 px) na última linha da placa do radar, sem cobri-la.
- **Possível Reel:** antes/depois do HUD de celular. Ainda sem gravação de vídeo nem aprovação.

### Sessão Claude na nuvem de 13/11/2026 — todas as mudanças e o consumo

Branch `claude/quirky-hamilton-bt0y7w`, PR em rascunho
[#1](https://github.com/alexpiraginet-bot/-grand-testament-adventure/pull/1), base `4d7cf86`.
Nada desta sessão está em produção até a PR ser revisada e integrada.

**Mudanças, na ordem dos commits:**

| Commit | O que mudou | Evidência | Limite |
|---|---|---|---|
| `a21d215` | Joystick sempre visível no celular (`src/joystick.ts`), botão de ação com mão em SVG provisório, paisagem sem cobrir a placa do radar, `tools/check_touch.mjs` | 41/41 testes no build com assets; `check_touch` em 390×844, 844×390 e 1280×800 sobre `4d7cf86`; varredura de layout 320×568 a 932×430 | viewport emulado; ícone provisório |
| `feb946b` | Diário do HUD, README, tabela de referência; pedido de arte do ícone ao Codex/Higgsfield em `ASSETS.md` | — | — |
| `4a61f47` | Mesma cena medida (`src/bench.ts`, `?bench`, `tools/bench.mjs`) e pós-processamento sob medição (`src/postfx.ts`, `?fx=alto/master`, desligado por padrão); `docs/GRAFICO-MASTER.md` | 44/44 testes; bench roda as variantes e grava imagens | sem GPU aqui: nenhum FPS vale para o jogo |
| `87ef481` | Registro da repetição 1280×800 no diário | relatório `shots/touch-r1/report.json` (local) | — |
| `dab8a9f` | Correção: o GTAO precisa de um amostrador de normal; nomes `packNormalToRGB`/`unpackRGBToNormal` da r186 | antes: `fx=alto` com 2 erros de console (`normalNode.sample is not a function`); depois: `alto` e `master` percorrem a rota com 0 erros | a oclusão não funcionava no primeiro commit |
| `d0eeb85` | Plano cinematográfico nas falas (`src/cinematic.ts`): dois planos escolhidos ao começar a fala, faixas de cinema, HUD recolhido, sai ao andar, respeita movimento reduzido | 48/48 testes (4 novos); conferência de navegador registrada na PR | conferido só em viewport emulado |
| `fbaeb0b` | Barra de qualidade AAA de mundo aberto, pilar por pilar, sem copiar nada da Rockstar (título retitulado depois, ver `docs/PLANO-AAA.md`) | — | plano, não entrega |
| `2a8a8e1` | Conferências determinísticas em renderizador lento: captura atômica do plano, `__gta.freeze()` (só `?debug`, segura o relógio da história), gesto reto no joystick, bench espera 24 quadros por foto | 48/48 testes; repetição da conferência registrada na PR | ver "Tentativas" abaixo |
| (este registro) | `tools/session_usage.py`: soma do consumo de tokens pelo transcrito e valor equivalente em preço de API | executado nesta sessão | ver nota de valor |
| `906ff83` | Correção do diagnóstico do `fx=master`: o TRAA derruba a água transparente na maioria dos quadros; `master` bloqueado | curva de cor quadro a quadro; duas hipóteses refutadas e uma isolada (ver "Tentativas") | causa exata em aberto |
| `072ca70` | A mira do plano cinematográfico acompanha o grupo enquanto os chamados andam até Jesus; `framed` exige os três no quadro; caminhadas do teste partem do corredor da missão | `check_touch` verde em 390×844, 844×390 e 1280×800: plano entra, 3/3 no quadro, sai ao andar (PC), 0 erros, 17.897.302 bytes servidos localmente | viewport emulado; NPCs ainda são formas provisórias |

Fora do Git: ambiente de nuvem pessoal "Grand Testament + Bíblia Conectada" criado com aprovação do Alex,
liberando só `grand-testament-assets.vercel.app` e `grand-testament-adventure-lexprojects.vercel.app`.
A PR #1 foi aberta como rascunho. Nenhuma issue, cobrança, migração de banco ou deploy de produção foi feito.

**Tentativas que falharam, com causa raiz (material honesto para os Reels):**

1. `fx=alto` e `fx=master` no primeiro commit (`4a61f47`) davam 2 erros de console e rodavam **sem oclusão**: o GTAO
   amostra a normal com `.sample(uv)` e recebeu um valor já desempacotado. Corrigido em `dab8a9f`.
2. A conferência do plano cinematográfico falhou três vezes. Hipóteses testadas uma de cada vez: obstáculos sem
   altura (falsa: todos têm `top`), qualidade alta (falsa: o plano entra também), corrida no teste (verdadeira: o
   estado era lido numa segunda chamada, depois de a fala de ~7 quadros acabar). Corrigido em `2a8a8e1`.
3. Uma repetição falhou antes, na caminhada: o herói parou num jarro da viela porque o gesto empurrava levemente para
   a direita. Colisão parar a animação é o jogo funcionando; o teste passou a empurrar reto.
4. As fotos do bench em `fx=master` saíram sem a água do raso. **Primeiro diagnóstico (errado, registrado no commit
   `2a8a8e1`):** histórico do TRAA atravessando o corte de câmera. A curva de cor quadro a quadro (água G>R, chão R>G)
   desmentiu: a água fica ausente na maioria dos quadros e aparece em quadros isolados, mesmo 24 quadros depois.
   Testado e refutado: reiniciar o histórico do TRAA no corte (`setSize`, duas variações) e entregar cor com alfa 1.
   Isolado: sem TRAA (com velocidade no MRT e sem MSAA) a água aparece. **Bloqueio aberto:** o `master` (TRAA) não
   desenha direito superfícies transparentes como a água; `fx=master` não deve virar padrão até resolver.

**Bench neste contêiner (sem GPU, Chromium com WebGL 2 por software, 640×400, `tools/bench.mjs` às 10:26 UTC):**
draw calls por plano (vila, viela, margem, pescadores, barco, panorama) — `fx=off` 174/78/174/203/123/41,
`fx=alto` 187/91/187/216/136/54, `fx=master` 189/93/189/218/138/56; memória de textura informada pelo renderer
1.206 / 1.210 / 1.218 MB; zero erros. Tempos de quadro dessa execução não valem para o jogo (software, ~0,5 fps).

**Consumo de tokens desta sessão (retrato no momento deste registro, 8 arquivos; respostas de 2026-11-13T09:39:24.792Z a 2026-11-13T11:02:47.196Z):**

| grupo | modelo | velocidade | respostas | input | output | cache_read | cache_write_5m | cache_write_1h | cache_write_sem_ttl | usd_equivalente_api |
|---|---|---|---|---|---|---|---|---|---|---|
| principal | claude-opus-5-5 | standard | 197 | 413 | 214.524 | 74.495.859 | 0 | 560.883 | 0 | 23.68 |
| workflow | claude-opus-5-5 | standard | 294 | 588 | 313.323 | 56.838.981 | 1.393.382 | 0 | 0 | 24.60 |

Total equivalente em preço de API: US$ 48.28. O valor é **equivalente em preço de lista da API** (claude-opus-5-5: entrada US$ 4,00, saída US$ 20,00,
leitura de cache US$ 0,20 por milhão; escrita de cache 1,25× a entrada com TTL de 5 min e 2× com TTL de 1 h), não
fatura: a sessão roda no plano da conta claude.ai, cobrado pelo plano. Conversão para reais não feita (precisa de
uma cotação com fonte). Reproduzir: `python3 -I tools/session_usage.py <pasta-do-transcrito-da-sessão>`.
O workflow do plano de qualidade AAA ainda estava rodando neste retrato; o total final entra no fechamento da sessão.

## Seis possíveis episódios, ainda sem roteiro ou publicação

1. **“Começamos com formas simples: o que já precisava funcionar?”** Mostrar a
   primeira publicação, controles e missões. Fonte: `shots/publicacao/episodio/`.
   Não chamar o protótipo de versão final.
2. **“Como o personagem ganhou movimento?”** Comparar o personagem provisório
   com o herói R1 e mostrar o clip de caminhada real. Fontes: R0 e
   `shots/production-r1-integration/`. Só há walk próprio; não anunciar uma biblioteca
   completa de animações ou seis NPCs Tripo rigados.
3. **“Por que a cidade parecia vazia?”** Comparar composição R1 e R3: densidade,
   orientação das portas, percursos e recuos. Fontes: `production-r1-world` e
   `r3-final-world`. A vila é composição artística sobre relevo; contagem de casas
   não é dado arqueológico de população.
4. **“Um céu de 307 kB mudou a cena?”** Mostrar comparação R1/R2 com mesma câmera,
   nuvens, reflexos e transparência no raso. Fonte: `public/textures/sky/LICENSE.json`
   (306.662 bytes nos dois derivados) e capturas R1/R2. É panorama LDR, não ray tracing.
5. **“Uma missão clara precisa de mais que uma seta.”** Mostrar as dicas de direção,
   aproximação e interação na R3, com as falas literais BLIVRE preservadas. Fonte:
   `src/journey.ts`, testes e capturas do episódio R3. Não atribuir texto de interface a Jesus.
6. **“Quem joga pode construir junto.”** Mostrar Construa conosco e uma revisão
   que passou por código, teste e deploy. Fonte: `docs/CONSTRUA-CONOSCO.md`, relatórios
   e commits. Não fingir comentários de jogadores, aprovação ou uma issue já enviada.

## O que ainda falta para editar os Reels

- Gravação contínua de gameplay nas mesmas posições antes/depois; screenshots são
  quadros reais, mas não substituem vídeo de movimento. O arquivador só copia vídeos
  existentes e informa quando a contagem é zero.
- R3: commit e deployment final, mais confirmação no link público quando concluídos.
- Performance em iPhone/Android físicos. Os números atuais vêm do PC e seus viewports.
- NPCs Tripo rigados, acabamento final de vegetação/arquitetura e animações adicionais.
- Contribuição do Claude identificada por branch/commit/arquivo real antes de atribuir autoria.
- Seleção editorial dos trechos, narração, trilha licenciada, legendas e aprovação de Alex.
- Nada de DLSS ativo, reconstrução arqueológica exata ou qualidade da imagem-conceito
  como se fossem recursos já entregues.

## Preservação de cada próximo passo

Para cada incremento, registrar: problema observado; hipótese; arquivos alterados;
fontes/licenças; evidência antes/depois; teste e suas limitações; commit; deployment
quando houver; estado editorial do possível Reel. Guardar falhas relevantes também,
com rótulo claro, sem substituir uma referência por uma imagem gerada como prova.

O script `tools/archive_development.mjs` copia somente capturas, vídeos, relatórios
e logs selecionados já existentes. Confere SHA-256 na origem e na cópia. Originais
permanecem no projeto; o destino é:

`D:/BentoLabs/04-Fotos-e-videos/Grand-Testament-Adventure/Diario`

```powershell
node tools/archive_development.mjs
# Depois do commit da R3, informar o SHA completo e verificado:
node tools/archive_development.mjs --commit SHA_COMPLETO_DA_REVISAO
```

Sem `--commit`, a R3 recebe `working-tree`, nunca o SHA anterior por suposição.
Snapshots, manifests e índices recebem identificadores de conteúdo e são imutáveis:
uma cópia divergente causa erro, não sobrescrita. Fontes ausentes ficam como pendência.
O programa imprime o caminho do índice mais recente. Não faz upload, não publica
redes sociais, não gera vídeo e não modifica memórias do assistente.
