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
| 2026-11-13 06:48:33−03:00 | `4d7cf86` — visual e jornada R3 | Rua menos regular, decoração orientada pela fachada, tecido/pregas dos NPCs e dicas contextuais de jornada | `shots/r3-final-*` e `shots/production-r3-integration/PUBLICACAO-VERIFICADA.json`; deploy público conferido READY. Sem NPCs Tripo rigados ou teste em telefone físico. |
| 2026-11-13 07:35:41−03:00 | `08785fe` — R4 publicada | Água, Colabore/Pix, prestação de contas e medição de esforço; fauna própria em preparação | 81 testes no build, QA público em WebGPU/WebGL2 e apoio nos dois viewports. Malhas Quaternius rejeitadas, sem fauna ativa entregue. |

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

### Publicação R3 registrada

O commit completo é `4d7cf867945741c4d28c7ce1d8f9fe1cd8f2318f`, com data de autoria
Git `2026-11-13T06:48:33-03:00`. O registro
`shots/production-r3-integration/PUBLICACAO-VERIFICADA.json`, observado em
`2026-11-13T09:54:56.3260697Z`, associa esse SHA ao deployment
`dpl_8FxdsULHRteALFo2zGBNg6TKevHQ`, estado `READY`, HTTP 200 no domínio público.

O registro público lista 14 assets e zero erros de página, avisos ou falhas HTTP
nas execuções desktop WebGPU, viewport móvel WebGPU e desktop WebGL2; cada uma
registrou 16.730.339 bytes transferidos. As três missões completaram nos dois
viewports, com quatro seguidores. Isso preserva a evidência daquela execução,
não uma nova conferência de produção feita ao escrever este diário. O teste de
episódio usa teleporte/ações de debug; viewport móvel usa a GPU do PC.

### R4 publicada — água, colaboração e transparência

O problema visual observado motivou ondulações em duas escalas na água, normal
combinada, rugosidade variável, reflexo do céu e transparência conforme profundidade
e ângulo da câmera. A animação passa a seguir o tempo do jogo e pausa com ele.
O nível da superfície e os dados de terreno foram preservados. É uma aproximação
com material físico e transparência; não é refração em screen space, ray tracing
ou DLSS. Alteração em `src/world.ts`; comparar imagens e movimento reais antes de
concluir que o acabamento melhorou sem regressão de desempenho.

A investigação de fauna encontrou modelos genéricos, mas Alex rejeitou sua
qualidade visual: **Quaternius e derivados não integram a entrega**. A simulação
determinística em `src/fauna-simulation.ts` fica reservada para malhas próprias;
os testes cobrem terreno/água, pausa, estabilidade inicial e separação durante
60 segundos. Os três PNGs próprios de burro, galinha e peixe são referências
para o Tripo, não modelos rigados nem animais presentes no jogo. Fontes e limites
estão em `docs/FAUNA-GALILEIA.md`; não usar contagens do simulador como população
entregue ou reconstrução histórica.

Colabore preserva a composição de issue no GitHub e acrescenta, na mesma página,
apoio voluntário pela chave de e-mail autorizada. Copiar Pix não comprova pagamento.
A prestação de contas usa registros públicos revisados, valores em centavos,
recebimentos anônimos e links de comprovantes reais quando disponíveis. Ainda não
foram informados recebimentos, gastos do jogo ou abertura conferida: os totais
começam como **—**. Claude R$ 799/mês e Codex R$ 999/mês, pagos dia 6 segundo Alex,
ficam como assinaturas gerais; a parcela do jogo não foi definida nem debitada dos
apoios. Detalhes em `docs/APOIE.md`, `src/data/accountability.json` e testes próprios.

A medição de esforço lê apenas metadados autorizados, com cobertura parcial,
intervalos estimados sem dupla contagem e tokens observados com origem. Equivalente
hipotético de API não é despesa paga nem custo da assinatura. Fontes:
`tools/collect_project_usage.mjs`, `tools/project-usage-core.mjs`,
`src/effort.ts`/`src/effortui.ts`; snapshot real em
`public/metrics/development.json`. A branch pública `metrics/development` foi
publicada e lida por HTTP 200; o navegador consultou a fonte remota. O serviço
recebe snapshots e pode ter atraso de cache; não há coleta permanente instalada.
Sem atualização recente, a UI informa desatualização e não extrapola valores.

Ensaios anteriores estão em `shots/r4-world/` e `shots/r4-integration/`. Evidência
final: `shots/r4-final-build.log` (81/81), `shots/r4-final-support/` (abas, Pix,
contas e telemetria, incluindo refresh/fallback sintético separado dos dados reais).
Produção: `shots/production-r4-integration/PUBLICACAO-VERIFICADA.json` associa
`08785fe50b9995b7712a24e2b53bcbbb575d1804` ao deployment
`dpl_BnhY9vLRZA6CPErsZeZeX2b2aZ8r`, READY, HTTP 200 e bundle `index-BKHkIuyv.js`.
`shots/production-r4-support/report.json` confirma apoio nos dois viewports, fonte
remota, zero erros e nenhuma escrita de pagamento. Clipboard foi simulado.

Nessa amostra pública: PC WebGPU 89,1–95,5 FPS; viewport móvel no PC 49,6–94,8;
WebGL2 88,3–96,0. Cada caso carregou 14 assets e 16.739.661 bytes, com zero erros,
avisos ou falhas HTTP. São amostras curtas do script, não percentis de benchmark
contínuo ou teste em telefone físico. A PR #1 do Claude permanece separada,
incluindo seus efeitos opcionais; estes números não medem a PR combinada com R4.

### Série de Reels e expansão do mundo

Alex pediu uma sessão separada para produzir os bastidores desde os primeiros
vídeos e os conceitos até o jogo real, sempre com link para jogar. Handoff local:
`D:/BentoLabs/04-Fotos-e-videos/Grand-Testament-Adventure/Serie-Reels-R1/HANDOFF-SERIE.md`.
As quatro referências recebidas em 13/11 incluem uma captura e conceitos de
deserto, pesca e Caná; não anunciar essas regiões ou “24 capítulos” como entregues.
A visão de mundo completo foi registrada em `docs/VISAO-MUNDO-ABERTO.md` como
expansão por etapas. A criação de sessão não equivale a Reel renderizado ou postado.

### R5 — metas revisáveis e colaboração voluntária

Alex ampliou o escopo para dezenas de missões nos quatro Evangelhos e pediu uma
estimativa para a campanha e para 200 voluntários. O plano usa uma referência de
caixa de R$300 mil, faixa de R$200–500 mil, com trabalho principal não remunerado
excluído. Primeiro marco de R$15 mil incluído, sem somar ao total. São hipóteses
de planejamento sem cotações ou gastos. Prazo com núcleo pequeno: 36–60 meses;
com 200 pessoas ativas e coordenação suficiente: 12–24 meses. Não são garantias
nem contagem de colaboradores existentes. As premissas estão em
`docs/ESTIMATIVA-PROJETO.md`, com dados validados em `src/data/project-plan.json`.

Colabore ganhou a aba Participe da equipe: nove frentes, disponibilidade e portfólio
opcional. O envio abre um rascunho GitHub com consentimento público; o candidato
confirma lá e os mantenedores analisam. Não há inscrição/contratação automática,
coleta de telefone/e-mail nem concessão de permissão. O template direto do GitHub
e o fluxo estão em `docs/VOLUNTARIOS.md`.

Build local: 92 testes. `shots/r5-community/` verifica os valores reais do plano,
navegação de três abas, pausa/foco e composição de candidatura nos dois viewports.
O rascunho de QA é sintético, window.open foi interceptado e nenhuma candidatura
foi enviada. `shots/r5-support/` cobre a regressão de Pix, contas e uso observado.
Publicada em `3d3f9c8f74e9aff0b74c32f86acce5327039ad22`, deployment
`dpl_Bg7HYru687BvoPAgK7sKzkwbD8eb` READY. Conferidos no domínio público os bundles
`index-CSnHhZh8.js` e `index-CZGO82_i.css`. QA público de colaboração e apoio passou
em 1280×800 e 390×844: `shots/production-r5-community/` e
`shots/production-r5-support/`, sem publicação de issue ou pagamento.
São viewports no PC, não testes em telefone físico. Prova completa:
`shots/production-r5-community/PUBLICACAO-VERIFICADA.json`.

Arquivo privado do diário: `INDEX-1b9aab97db4d.md`, com 42 arquivos R5 verificados
por hash, sem vídeos novos. O conjunto R5 tem SHA próprio e não relabela R4.

Por novo pedido de Alex, foram separados 13 arquivos de imagem para a série e
uma eventual proposta ao Tripo: oito capturas da ferramenta, uma referência de
entrada, duas capturas do GLB e duas do jogo. Fontes e cópias foram comparadas
por SHA-256. A pasta privada `Serie-Reels-R1/Fontes-Tripo` contém manifesto e
limites de uso; a sessão de Reels recebeu o caminho. Não há captura dedicada
da tela de rig nem gravação contínua da geração. Os prints brutos exigem recorte
de informações pessoais. `PROPOSTA-PATROCINIO-TRIPO.md` é rascunho local não enviado,
sem patrocínio confirmado e sem autorização implícita de postagem social.

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
- Gravação contínua da R4 publicada; build, commit, deploy e QA público já estão registrados acima.
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
# Depois do commit da R5, informar seu SHA completo e verificado:
node tools/archive_development.mjs --r5-commit SHA_COMPLETO_DA_R5
```

R3 permanece fixa em `4d7cf867945741c4d28c7ce1d8f9fe1cd8f2318f`.
`--commit` associa somente a R4, fixada por padrão em `08785fe50b9995b7712a24e2b53bcbbb575d1804`.
`--r5-commit` associa somente a R5; sem esse argumento, R5 recebe `working-tree`.
Seleções de evidência de futuras revisões
devem ser adicionadas separadamente, sem relabelar capturas históricas.
Snapshots, manifests e índices recebem identificadores de conteúdo e são imutáveis:
uma cópia divergente causa erro, não sobrescrita. Fontes ausentes ficam como pendência.
O programa imprime o caminho do índice mais recente. Não faz upload, não publica
redes sociais, não gera vídeo e não modifica memórias do assistente.
