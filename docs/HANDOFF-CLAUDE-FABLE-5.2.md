# Handoff para Claude — evolução integral do Grand Testament Adventure

Preparado em **13/11/2026**, por pedido de Alex: evoluir o jogo em todas as áreas, com o máximo de
capacidade disponível e entregas reais, verificadas e publicadas. “Fable 5.2” é o nome solicitado por
Alex: selecione o modelo disponível no cliente Claude Code e confira o identificador real. Este Markdown
não seleciona modelo, não comprova suas capacidades e **não inicia nem autentica uma sessão**.

Atualização de contexto: no print enviado às 07h32 de 13/11, a sessão do Alex exibe
**Opus 5.5 Ultracode** e workflow de sete agentes. O nome acima foi preservado como
pedido histórico; não comprova o identificador de API nem o consumo desses agentes.
Esta transferência serve à sessão atual ou à próxima, sem exigir modelo específico.

## 1. Ponto de partida e coordenação obrigatória

- Checkout: `D:/BentoLabs/01-Projetos/grand-testament-adventure`.
- GitHub público: https://github.com/alexpiraginet-bot/-grand-testament-adventure — o hífen inicial faz
  parte do nome.
- Jogo: https://grand-testament-adventure-lexprojects.vercel.app/
- Base pública R4 desta transferência: `08785fe50b9995b7712a24e2b53bcbbb575d1804`.
- **R4 publicada**: água, Colabore/Pix, prestação de contas e instrumentação de esforço.
  Deployment `dpl_BnhY9vLRZA6CPErsZeZeX2b2aZ8r`, `READY`, HTTP 200 e bundle
  `index-BKHkIuyv.js` conferidos no domínio público. Build local: 81 testes passando.
  A conferência visual e seus limites estão no diário; a existência de uma pasta não é prova.
- Consulte `git status`, responsáveis e SHA remoto antes
  de trabalhar. Não sobrescreva arquivos ativos, descarte diffs, execute `reset --hard` ou troque a
  branch deste checkout compartilhado.
- Use um **worktree próprio** e branch `claude/fable52-<incremento>`, a partir da revisão compartilhada
  já commitada. Se R4 continuar sem commit, combine a base; não copie indiscriminadamente o working tree
  nem apresente R3 como se contivesse R4.

Leia primeiro, nesta ordem: `CLAUDE.md`, este documento, `README.md`, `docs/DIARIO-DESENVOLVIMENTO.md`,
`docs/CAFARNAUM-CENARIO.md`, `docs/NARRATIVA.md`, `ASSETS.md`, `docs/TRIPO-RUNTIME-R1.md`,
`docs/FAUNA-GALILEIA.md`, `docs/CONSTRUA-CONOSCO.md` e `docs/APOIE.md`. Consulte `HANDOFF.md` e
`HANDOFF-CODEX.md` como histórico: alguns estados, nomes e bloqueios antigos foram superados. A instrução
mais recente de Alex e a evidência atual prevalecem.

Leia também `docs/ESFORCO-E-CUSTOS.md`. O painel e o protocolo distinguem consumo
registrado, horas estimadas, comparação de API e despesas realmente informadas.
Alex ampliou a visão para um mundo aberto cobrindo a vida de Jesus: ler
`docs/VISAO-MUNDO-ABERTO.md` como direção futura, sem confundir com regiões entregues.
A série de Reels já tem sessão separada e fontes em
`D:/BentoLabs/04-Fotos-e-videos/Grand-Testament-Adventure/Serie-Reels-R1/`.

### Coordenação verificada com a PR #1

Em 13/11 às 07h33, a PR em rascunho #1 estava aberta na branch
`claude/quirky-hamilton-bt0y7w`, SHA `fbaeb0bb7d1e000a04b60131577b6886c3c1051c`.
Há código de joystick móvel, câmera das falas, seis cenas de benchmark e efeitos
opcionais GTAO/bloom/TRAA. A própria PR declara teste gráfico por software e GPU
real pendente. Isso não comprova gráficos máximos nem desempenho da combinação.

Ela sobrepõe `index.html` e `docs/DIARIO-DESENVOLVIMENTO.md` da R4: preservar as
seções Colabore/Pix/contas/esforço ao integrar o controle e combinar os diários.
A água em `src/world.ts` foi alterada só na R4, mas precisa ser testada junto dos
efeitos em `src/main.ts`. Conferir `fx=off/alto/master`, rastros do TRAA e contraste
do GTAO, além de pausa/foco, retrato/paisagem e câmera nas falas. Não houve merge
dessa PR nesta entrega. Reconsultar HEAD e comentários antes de integrar.

```powershell
Set-Location D:/BentoLabs/01-Projetos/grand-testament-adventure
git status --short
git branch --show-current
git log -5 --oneline
git remote -v
git fetch origin
# Depois de coordenar a revisão-base e conferir que o destino está livre:
git worktree add ../gta-fable52 -b claude/fable52-jornada origin/main
Set-Location ../gta-fable52
```

## 2. O resultado que Alex quer

Um jogo de navegador com qualidade gráfica máxima sustentável, no PC e celular, com ruas estreitas,
irregulares e habitadas, casas próximas, pedras, materiais convincentes, água, vegetação e vida
cotidiana. A referência é a caminhada junto ao lago enviada por Alex; não entregar outro descampado com
objetos espalhados. Não substituir qualidade por quantidade nem inserir malhas ruins para preencher.
Imagem conceitual não é screenshot do jogo; realismo visual não prova arqueologia.

A fatia vertical é **“Pescadores de gente”, Marcos 1:16–20**: chegar à praia, chamar Simão e André,
chamar Tiago e João. Deve ser prazerosa de percorrer e clara sem depender de teleporte de testes.
Melhorar toda a experiência em incrementos concluíveis; não paralisar a entrega procurando uma tecnologia
perfeita.

## 3. Regras editoriais e fontes

- Jesus: adulto, cabelo escuro ondulado aos ombros, túnica off-white, corda, manto terracota sobre o
  ombro esquerdo e sandálias; câmera de terceira pessoa atrás dele. Pessoas do mundo são adultas; sem
  rostos de crianças. Deus nunca aparece como personagem.
- Citações: fragmentos **literais da BLIVRE**, identificados como **“Bíblia Livre · referência”**. Dados
  em `src/data/mc-pescadores.json`; preservar a conferência literal e a atribuição CC BY 4.0 BR.
- Alex autorizou narração e falas autorais inspiradas no episódio, com etiqueta **“Narrativa do jogo”**.
  Nunca apresentar criação nossa como versículo ou fato histórico. Instruções de controle usam
  **“Orientação”**, não uma fala de Jesus.
- Relevo e lugares: preservar DEM e proveniência SRTM/GMTED/ETOPO/Mapzen/OpenBible documentados.
  Povoamento, percursos e distribuição de objetos são composição artística. Não alterar relevo ou
  coordenadas reais para esconder um problema visual.
- Pesquisar detalhes do século I em fontes primárias/institucionais; distinguir descoberta arqueológica,
  texto bíblico e inferência artística. Não copiar a sinagoga posterior ou construções modernas do sítio
  como se fossem do episódio.
- Nada de Rockstar: nomes, logotipos, personagens, músicas, HUD ou material de GTA. O título é **Grand
  Testament Adventure**. Números de interface vêm de dados/código.

## 4. Arquitetura e malhas existentes

Stack vigente: Three.js `0.186.1`, Vite `8.3.5`, TypeScript `7.0.2`, Node 24, versões travadas no lock.
WebGPU quando disponível e fallback WebGL2. Rapier **não está integrado**: colisão atual usa altura e
obstáculos; adicione física só para um comportamento necessário, medido e testado.
`docs/MOTORES-GRAFICOS.md` registra a comparação documental; não migrar engine sem ensaio reproduzível da
mesma cena.

- `src/main.ts`: laço, entrada, colisões e integração; `src/world.ts`: cenário/água;
  `src/world-layout.ts`: distribuição e percurso; `src/people.ts`: personagens;
  `src/journey.ts`/`src/hud.ts`: jornada, radar e orientação. Conferir os nomes atuais antes de editar.
  Preservar os testes de caminho livre, fundações e objetivos.
- R3 tem herói com rig nativo e 13 modelos de cenário. Os seis NPCs Tripo ainda aguardam rig; as pessoas
  provisórias não são prova de personagens profissionais.
- Herói: 65 ossos, 17.481 triângulos, `walk` in-place. Não há `idle`, `run` ou `beckon` próprios
  entregues. Transformar/clonar o ancestral comum da malha e esqueleto, nunca separar o SkinnedMesh.
  Verificar os ossos animando no browser.
- Fontes: `assets-src/tripo-r1/`; catálogo `src/data/tripo-assets.json`; manifesto
  `assets-src/tripo-r1/handoff/MANIFEST.json`. `tools/prepare_tripo.mjs` deriva; `tools/fetch_assets.mjs`
  baixa/confronta hashes. Host separado: https://grand-testament-assets.vercel.app/ . Preservar originais
  e hashes.
- Código público MIT; dados, fontes e malhas têm licenças próprias. GLBs não viram MIT/CC0 por estarem no
  jogo; não inserir fontes binárias no Git público. Revalidar termos e origem antes de ampliar a
  redistribuição ou fazer nova afirmação comercial.

## 5. Fauna própria: próxima entrega de assets

Alex rejeitou explicitamente malhas low-poly genéricas. **Quaternius e os derivados investigados ficam
fora do build**; não reativá-los como atalho. A simulação pura `src/fauna-simulation.ts` e seus testes
são infraestrutura reservada, não fauna ativa.

Há **3 PNGs próprios**, com prompts irmãos `-prompt.txt`, em:
`D:/BentoLabs/01-Projetos/GRAND-TESTAMENT-ASSETS-R1-20261112/02-Referencias/Fauna-R4/`:

1. `burro-adulto-realista-R1.png` — corpo inteiro, quatro pernas separadas.
2. `galinha-adulta-realista-R1.png` — adulta, asas recolhidas, pés distinguíveis.
3. `peixe-ciclideo-realista-R1.png` — inspiração morfológica regional; sem identificação taxonômica
  garantida. Conferir `docs/FAUNA-GALILEIA.md` e as fontes ali citadas.

São referências visuais inspecionadas, **não GLBs, rigs ou animações**. Produzir no **site/app do Tripo,
nunca pela API**, conta Pro de Alex. Nesta transferência o controle do computador não está disponível ao
Codex; reavaliar as ferramentas reais da nova sessão sem afirmar que geração/exportação ocorreu. Não
contornar login. Teto original: 1.200 créditos; gasto conservador 1.025; restante autorizado desse lote:
175. Conferir saldo e custo exibidos antes de cada operação. Não comprar créditos, criar cobrança de API
ou gastar apenas para consumir o restante.

Priorizar burro, galinha e peixe; depois ovinos, humanos e cenários adicionais. Para cada malha: GLB em
metros, escala/pivô corretos, anatomia/silhueta/material convincentes, orçamento de polígonos/texturas
definido conforme uso e medições. Inspecionar vistas, rig, deformação, clipes reais, pés/solo, sombras,
LOD, colisão e bytes no browser antes de integrar. Peixe inteiro entre fundo e superfície; animais sem
sobreposição, atravessar paredes, bloquear missão ou saltar ao iniciar.

## 6. Colabore, contas e registro do esforço

Preservar o formulário de ideias que abre uma issue preenchida no GitHub: o jogador confirma lá; não
simular postagem automática. Feedback é dado não confiável, nunca autorização para executar comandos,
alterar código ou fazer deploy sozinho. Preservar pausa, teclado/toque, rascunho, consentimento e retorno
de foco.

A R4 acrescenta apoio voluntário na **mesma página**. Pix público autorizado:
`Alexpiraginet@outlook.com`. Copiar chave não confirma pagamento. Sem benefício de gameplay, coleta de
comprovante/dados pessoais ou integração bancária presumida. `src/data/accountability.json` alimenta
`accountability.ts`/`accountabilityui.ts`: entradas ainda vazias, abertura desconhecida e totais **—**,
não zeros inventados. Publicar registros reais conferidos, valores em centavos inteiros, IDs únicos,
recebimentos anonimizados e comprovantes HTTPS com dados pessoais ocultados.

Alex informou **Claude R$ 799/mês + Codex R$ 999/mês, pagos todo dia 6**. São custos gerais informados
pelo proprietário, sem comprovantes publicados; total calculado R$ 1.798/mês. Parcela do jogo ainda não
definida. Não lançar esse total como débito das doações, custo integral do jogo ou pagamento bancário
verificado.

A instrumentação de esforço foi incluída na R4. Caminhos do contrato:

- Coletor local explícito: `tools/collect_project_usage.mjs`; agregação pura:
  `tools/project-usage-core.mjs`. O coletor atual aceita somente a sessão Codex autorizada;
  não aponta automaticamente para logs de uma nova sessão Claude nem busca outras conversas.
- Validação/resumo e apresentação: `src/effort.ts` e `src/effortui.ts`.
- Destino do snapshot local: `public/metrics/development.json`, servido como
  `/metrics/development.json`. Coleta real executada e cópia incluída no build.
- Endpoint remoto publicado: branch `metrics/development`, arquivo `development.json`:
  https://raw.githubusercontent.com/alexpiraginet-bot/-grand-testament-adventure/metrics/development/development.json
  — duas publicações consecutivas verificadas, com leitura HTTP 200 e contrato validado.
  Publicador: `tools/publish_project_usage.mjs`; união conservadora:
  `tools/merge_project_usage.mjs`. A branch de métricas não dispara deploy do jogo.

O cliente recebe snapshots e usa fallback local; isso não comprova coleta contínua nem inclui Claude,
subagentes ou ferramentas externas. Ler o esquema antes de acrescentar um adaptador de metadados da
própria sessão Claude, preservando as restrições de origem e privacidade do coletor existente.
Toda nova sessão Claude deve registrar seu próprio esforço e evidência:

- Intervalos de atividade com início/fim, fuso, sessão, responsável e fonte; estimativa de horas
  claramente rotulada. Unir intervalos sobrepostos para não somar duas vezes o tempo de parede de agentes
  paralelos; separar horas de agente.
- Tokens reais somente quando fornecidos pelo runtime/relatório, com proveniência, modelo e escopo. Se
  ausentes, **desconhecido**; não converter caracteres em uso real.
- Estimativas/referências de preço rotuladas, datadas e separadas de despesa paga. Assinatura, crédito,
  token e custo incremental de API não são equivalentes.
- Extrair apenas metadados necessários da sessão autorizada; sem copiar prompts, conversas privadas,
  segredos, PINs, `.env`, cookies ou perfis de outras sessões.

## 7. Roadmap de execução: capacidade máxima com entregas finitas

**P0 — continuidade e baseline.** Coordenar R4, reproduzir build/testes, registrar SHA e cenas
equivalentes. Levantar os três maiores defeitos visuais e três de gameplay com evidência. Não chamar o
screenshot-alvo de visual já alcançado.

**P1 — caminhada e jornada.** Melhorar câmera nas vielas, contato dos pés, animações, interações
legíveis, ritmo dos encontros, seguidores, objetivos/radar e toque. Jogar o trajeto completo sem debug;
manter as três missões e falas verificadas.

**P2 — direção de arte e vida.** Materiais com escala coerente, variação de fachadas, ruas próximas e
irregulares, luz/sombra/atmosfera, margem e água, barcos/redes, vegetação e assets próprios aprovados.
Densidade visual sem corredor bloqueado, estampas repetitivas, objetos flutuantes ou explosão de draw
calls/memória.

**P3 — mundo e produto.** NPCs/animais plausíveis, som ambiente e interação com licença/origem
registrada, opções de áudio/qualidade/acessibilidade, carregamento, save/recuperação, menus e créditos.
Nuvem continua desligada até migração realmente autorizada/testada. Não adicionar serviço pago, coleta ou
multiplayer por suposição.

**P4 — escala e manutenção.** LOD/instancing/culling, streaming e compressão conforme perfil real;
regressão automatizada, revisão de dependências, organização modular, documentação de contribuição,
triagem GitHub e balanço transparente. Novos episódios só após uma vertical coerente e um escopo
editorial definido.

Use agentes em paralelo para áreas/arquivos distintos: arte/assets, gameplay, performance,
QA/acessibilidade e documentação. Delegue contratos e provas esperadas; o integrador revisa e testa tudo.
Ferramentas locais/IA podem ajudar se trouxerem ganho concreto; não são prova. Não rodar vários
benchmarks GPU simultaneamente. “Capacidade máxima” não autoriza despesas, acessos adicionais ou uso sem
limite.

## 8. Gates de qualidade, publicação e diário

```powershell
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
npm run preview -- --host 127.0.0.1
# Em outro terminal, sequencialmente, com preview aberto:
node tools/check_tripo.mjs http://127.0.0.1:4173/ shots/fable52-integration
node tools/check_world.mjs http://127.0.0.1:4173/ shots/fable52-world
node tools/shots.mjs http://127.0.0.1:4173/ shots/fable52-episode
node tools/check_feedback.mjs http://127.0.0.1:4173/ shots/fable52-feedback
node tools/check_support.mjs http://127.0.0.1:4173/ shots/fable52-support
```

Confira o contrato/argumentos atuais de cada script antes de executar; o último depende da R4 integrada.
Playwright deve estar resolvível no ambiente; use `PLAYWRIGHT_PATH` se necessário. Não desative TLS nem
instale pacotes por rotina. Teste 1280×800 e 390×844, WebGPU **e** WebGL2, teclado/mouse/toque,
pausa/save, missões e formulários. Leia as screenshots; logs verdes sozinhos não aprovam arte. Meça
FPS/frame time p95/p99, draw calls, memória quando observável, bytes de rede com cache frio e tempo de
carga. Compare mesma rota/câmera/hardware/revisão; não chamar corpo descomprimido de tráfego. GPU do PC
em viewport móvel não é celular. Registrar Safari/iPhone/Android físicos como pendentes até testes reais;
não extrapolar a RTX. Testes de missão por teleporte não provam uma caminhada completa.

DLSS 5 experimental **não foi demonstrado funcionando**: `docs/DLSS5-STATUS.md` e
`assets-src/tripo-r1/qa/dlss5-experiment/`. Não anunciar ON/OFF, ray tracing ou melhoria por DLSS sem
execução válida. Engine nova exige comparação reproduzível, não promessa de marketing, e preservação dos
dados, saves, missões e compatibilidade.

Alex autorizou publicar cada melhoria verificada. Preparar alteração, evidência e revisão; commit
pequeno/PR em rascunho conforme acesso real, integrar somente após gates. Verificar SHA remoto,
deployment READY e comportamento anônimo no link público. Um push não prova deploy. Não sobrescrever
código de outro responsável.

Em **cada incremento**, atualizar `docs/DIARIO-DESENVOLVIMENTO.md`: problema, hipótese, decisão,
tentativa/falha, arquivos, fonte/licença, antes/depois, testes e limites, SHA/deploy e registro de
esforço. Preservar evidências em `shots/`. O arquivador `tools/archive_development.mjs` fixa R0–R3
nos respectivos commits e aplica `--commit` somente à R4; sem argumento, R4 fica working-tree.
Para uma revisão Fable posterior, acrescentar seleção própria antes de usar outro SHA. Nunca rotular
capturas históricas com um commit novo. Destino de arquivo:
`D:/BentoLabs/04-Fotos-e-videos/Grand-Testament-Adventure/Diario`. Referências existentes:
`shots/r3-final-*`, `shots/production-r3-integration/`, `shots/production-r3-episode/`; R4 possui ensaios
locais em `shots/r4-*` e provas públicas em `shots/production-r4-integration/` e
`shots/production-r4-support/`. O índice `INDEX-ee298de7eef9.md` preserva 186 arquivos,
50 da R4, todos com hash; nenhum vídeo novo foi gerado por esse arquivamento.
Diário e vídeos preservados não autorizam postagem social. Não inventar teste,
comentário de jogador, recebimento, autoria de agente ou conclusão de outra sessão.

## 9. Primeira mensagem para colar no Claude Code

> Leia CLAUDE.md e docs/HANDOFF-CLAUDE-FABLE-5.2.md. Assuma a evolução do Grand Testament Adventure com a
> capacidade máxima do modelo realmente selecionado. Confira a base pública e coordene os diffs R4 antes
> de criar seu worktree claude/fable52-*. Preserve o trabalho em andamento. Registre esforço com fonte e
> atualize o diário por incremento. Faça baseline reproduzível e escolha uma melhoria concreta de grande
> impacto visual e uma de jogabilidade, distribuindo arquivos entre agentes sem conflitos. Implemente,
> teste e mostre o jogo real em 390×844 e 1280×800, WebGPU/WebGL2, medindo performance e bytes; publique
> cada incremento aprovado nos gates, como Alex autorizou. Não use fauna rejeitada, não invente métricas
> nem gastos e não troque engine sem comparação. Fale com Alex em PT-BR, direto e natural, e feche cada
> rodada com O que mudou / Como verifiquei / Riscos / Próximo passo. Continue executando, não pare só no
> plano.
