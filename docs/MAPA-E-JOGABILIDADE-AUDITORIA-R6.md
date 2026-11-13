# Auditoria de mapa e jogabilidade R6

Auditoria em 13/11/2026, de 11:23:00 a 11:27:12 UTC. Responsável: Codex,
subagente de QA. Alvo: [produção](https://grand-testament-adventure-lexprojects.vercel.app/),
baseline de publicação informado pelo integrador: `d6539ae`.

**Este relatório é sobre a produção anterior ao redesign e ao mapa de visão geral
R6.** O novo `worldmap.ts` do working tree não foi testado aqui. Nenhum arquivo do
jogo foi alterado. Chrome com contextos temporários; requisições diferentes de
GET/HEAD foram bloqueadas. Não houve tentativa de escrita de rede, issue,
pagamento ou salvamento externo. Saves locais ficaram no contexto descartado. Os caminhos de evidência abaixo ficam no acervo privado local; shots não integra o repositório público.

## Resultado principal

As três missões foram concluídas numa sequência contínua com **mouse, W, Shift
e E reais pelo Playwright**, sem teleporte, atribuição de posição/câmera ou chamada
de ação por debug nessa sequência. O debug foi usado para observar estado,
coordenadas e escolher o próximo trecho do percurso. Isso comprova a travessia
física e as transições; não é teste cego da facilidade de orientação de um jogador.

O percurso levou 201,763 segundos, incluindo paradas, movimentos de câmera e
capturas. Foram observados cerca de 732,10 m de deslocamento em 132 amostras.
O estado final foi `done`, com Simão, André, Tiago e João na lista de seguidores.
Não houve bloqueio permanente no caminho, pageerror ou resposta HTTP de erro.

- Relatório JSON completo: `shots/r6-gameplay-audit/report.json`
- Início na vila: `shots/r6-gameplay-audit/pc-start.png`
- Chegada à praia / missão 2: `shots/r6-gameplay-audit/pc-route-3.png`
- Fala de Marcos 1:17: `shots/r6-gameplay-audit/pc-mission-2-line.png`
- Conclusão / quatro discípulos: `shots/r6-gameplay-audit/pc-route-final.png`

## O tamanho que existe hoje

Medidas lidas dos dados efetivamente carregados na produção e conferidas no código:

| Elemento | Medida / natureza |
|---|---|
| Terreno próximo | 3.072 × 3.072 m; 9,437 km² de superfície quadrada, incluindo água |
| Grade de alturas | 257 × 257; passo de 12 m; valores de altura em centímetros convertidos para metros |
| Eixos | X cresce para leste; Z para sul; Y=0 é a superfície do lago |
| Limite de movimento | ±1.476 m por eixo, pois há margem lógica de 60 m em cada borda |
| Quadrado dentro desse limite | 2.952 × 2.952 m; 8,714 km², ainda incluindo água e obstáculos |
| Horizonte distante | 30.000 m; grade 161 × 161, cenário distante, não uma segunda região jogável |
| Rota das três missões | 8 segmentos; 741,82 m entre os pontos definidos; faixa preservada com raio 1,35 m de cada lado |
| Movimento | 2,5 m/s andando; 5,2 m/s correndo; multiplicador 0,55 na água rasa |
| Água | Colisão quando o solo fica abaixo de -0,55 m; não existe sistema de natação nesta versão |

Amostragem complementar do predicado de colisão a cada 24 m: 15.376 posições,
9.382 livres, equivalentes a aproximadamente **5,404 km²** nessa estimativa por
amostragem. Não é área navegável conectada exata, não inclui ocupação por NPCs e
não prova que cada metro quadrado foi percorrido. O teste do eixo dos caminhos e
faixas laterais de ±0,8 m não encontrou pontos bloqueados pelo cenário.

| Área | Coordenadas / conteúdo observado |
|---|---|
| Vila e partida | Início (-9,1; 35,1), centro geográfico de Cafarnaum (0; 0) |
| Descida | Trilha com pequenas curvas entre a vila e a praia (-12; 335) |
| Pesca de Simão e André | (-204,5; 433,8), alcançado pela margem |
| Chamada de Tiago e João | Objetivo na margem (-368; 533,4); barco em (-386,5; 551,8) |
| Interior ao norte/oeste | Terreno alcançável e vegetação esparsa; em (-500; -500) não há distrito ou atividade identificável |
| Borda norte | Em (0; -1.476), parada por limite lógico sem comunicação diegética |

Contagens do runtime: 158 casas, 20 pátios, 89 vasos, 69 toldos, 1.085 árvores,
2.150 arbustos, 1.320 pedras, 758 conjuntos de juncos e 8.500 tufos de grama.
São instâncias geradas, não variedade de modelos nem prova de população ativa.
As atividades atuais continuam concentradas num corredor de aproximadamente
742 m. Portanto, o principal vazio é de conteúdo conectado e variedade, não de
quilômetros disponíveis.

As fontes declaradas são terreno AWS/Mapzen com SRTM/GMTED2010 USGS e ETOPO1 NOAA,
OpenBible.info para o ponto geográfico e Bíblia Livre para o texto. A cota usada
do lago é -213 m; a malha do leito, implantação das casas e trajetos locais são
recriação. Relevo moderno e estas coordenadas não provam ruas do século I.

## Achados com prioridade e reprodução

**Nenhum P1 de progressão foi reproduzido nesta sequência.**

### P2 — discípulos desembarcam atravessando a água a pé

Reprodução sem teleporte: completar a descida, chamar Simão/André, seguir o
percurso até o objetivo de Tiago/João e pressionar E. Os NPCs saem do barco e
avançam diretamente pela água. Captura: `shots/r6-gameplay-audit/pc-route-final.png`.

O laço de seguidores em `src/main.ts` interpola X/Z diretamente até uma formação
perto do jogador, sem consultar a rota/collision, e limita a altura a
`Math.max(ground, -0.6)`. O comportamento é coerente com a captura. Recomenda-se
um ponto de desembarque com caminho válido até a margem antes de ativar a formação;
a travessia pode ser encenada por aproximação do barco ou passarela apropriada.
Depois, seguidores devem reutilizar uma navegação que respeite água e obstáculos.

### P2 — borda invisível e continuidade visual quebrada

Teste complementar: posicionamento por teleporte em (0; -1474), orientação para
norte, depois W real por 1,5 s. Parou em Z=-1475,99825, com o ciclo de caminhada
reduzido praticamente a zero. Não há indicação do limite e a captura mostra
um recorte claro do terreno ao longe.
Captura da borda: `shots/r6-gameplay-audit/pc-north-edge.png`.

Recomendação: definir limites por setor com relevo/barreiras coerentes e orientação
de retorno. Fazer transição visual entre terreno próximo e distante. Não remover
o limite atual sem adicionar dados, colisão e gerenciamento dos próximos setores.

### P2 — interior amplo, mas sem lugares ou atividades conectados

Teste complementar em (-500; -500): W real percorreu 3,79 m, sem travamento; a
superfície é uma extensão muito uniforme com vegetação esparsa, sem ponto de
interesse. Captura: `shots/r6-gameplay-audit/pc-inland-empty.png`.

Recomendação: adicionar primeiro um circuito lateral da vila e uma pequena área
de trabalho/pátio com propósito narrativo, conectados por dois acessos. Variar
silhueta, material do solo e enquadramentos, mantendo referências registradas.
Mais casas em toda a grade não resolve a falta de destinos e interações.

### P2 — nível de acabamento inconsistente no núcleo das missões

O herói texturizado contrasta com pescadores feitos de formas simples; a margem
apresenta segmentos angulares e a água tem um padrão de superfície visivelmente
repetido. Isso não impediu jogar, mas fica abaixo da referência visual de Alex.
Ver pescadores/margem: `shots/r6-gameplay-audit/pc-mission-2-line.png` e
praia: `shots/r6-gameplay-audit/pc-route-3.png`.

Priorizar NPCs próprios aprovados, roupa/rig/animação consistentes e um trecho de
margem detalhada. Preservar o relevo macro e separar detalhe artístico local da
fonte geográfica. Não reinserir fauna simplificada rejeitada para preencher espaço.

## Controles e câmera

No PC, arrastar o mouse orientou a câmera ao longo da trilha; W/Shift percorreu
os oito segmentos; E acionou as duas chamadas. Uma inspeção complementar com
quatro ângulos na vila não mostrou câmera presa dentro das paredes nas posições
testadas. Não foi auditada toda combinação possível de pátio/porta/câmera.

No viewport **390 × 844 emulado no PC**, o gesto nativo de joystick percorreu
10,61 m; o arrasto do lado direito alterou yaw e pitch. Abrir Colabore congelou
posição e tempo, e Escape fechou. O botão de ação por toque iniciou a fala no
objetivo de Simão/André após posicionamento por teleporte.

Esse teste de toque é de controles e endpoint, **não conclusão do episódio por
toque**. A rápida mudança de objetivo por teleporte pode ainda mostrar o aviso
transitório de conclusão anterior no HUD; não usar essa captura isolada como
prova de dessincronização durante o percurso normal.
Caminhada por toque: `shots/r6-gameplay-audit/mobile-native-touch-walk.png` ·
Câmera por toque: `shots/r6-gameplay-audit/mobile-native-touch-look.png` ·
Ação por toque: `shots/r6-gameplay-audit/mobile-touch-action-line.png`.

A sondagem na água avançou de Z=334 para 339,35 em X=-12, demonstrando entrada
na água rasa. Não se manteve W até parar nessa sondagem; o limite profundo foi
conferido no código/predicado, não por tentativa contínua de natação.

## Desempenho e limites da evidência

Chrome/WebGPU, qualidade `high`, deviceScaleFactor=1, GPU deste PC. Na sequência
real de caminhada, as 132 amostras pontuais de FPS ficaram entre 92,90 e 99,63,
mediana 93,97. Não são percentis de tempo de quadro nem FPS de celular físico.
O início mostrou intervalos entre aproximadamente 0,88 e 4,84 FPS antes do regime
estável. O botão ficou disponível em 8,08 s no PC e 6,81 s no contexto móvel.

O renderer informou 1.215.005.917 bytes de texturas / 2.884.728 triângulos na cena
PC final e 1.106.004.541 bytes / 2.435.918 triângulos no endpoint móvel emulado.
Esses são contadores do renderer, **não medição nativa de VRAM**. Mesmo com FPS
alto neste PC, essa ordem de grandeza pede orçamento de memória e teste físico
antes de aumentar a quantidade de assets carregados simultaneamente.

Resource Timing expôs 16.746.783 bytes transferidos e 18.831.459 bytes decodificados
de recursos no documento observado de cada contexto. Isso não inclui uma captura
de rede completa: recursos sem Timing-Allow-Origin podem omitir bytes e o
documento HTML não entra nesse somatório. O valor é observável, não garantia do
download total. Nenhum backend externo de save foi exercitado.

## Próximo incremento de mapa, sem colidir com a PR #1 do Claude

1. Preservar o terreno georreferenciado de 3.072 m, a sequência de missões e seus
   pontos. Criar um manifesto de distritos/POIs com coordenadas, fontes, origem
   artística, objetivos e conexões. Essa tarefa é de dados e level design;
   não precisa refatorar o renderer ou efeitos que a PR #1 está estudando.
2. Produzir um circuito pequeno e completo junto à vila: dois acessos, um pátio
   habitado, uma atividade, variação do chão e um marco visível. Medir percurso
   real, legibilidade do objetivo e qualidade visual antes de replicar o padrão.
3. Separar colisões e navegação de assets visuais. Corrigir desembarque e caminho
   de seguidores; transformar entradas visuais em passagens realmente testadas
   quando um interior for implementado, mantendo portas fechadas coerentes nos demais.
4. Preparar setores de aproximadamente 256 m como hipótese técnica, com assets
   compartilhados, instâncias por setor e níveis de detalhe. O tamanho final deve
   vir de benchmark; não carregar todas as texturas do mundo futuro de uma vez.
5. Expandir por região adjacente só após atingir o orçamento de memória/carga e
   completar QA contínuo PC/toque da área atual. O novo mapa de visão geral pode
   mostrar limites e POIs, mas não deve apresentar o horizonte de 30 km como
   região já explorável.

O desafio imediato é tornar a área existente interessante e coerente. A escala
física já suporta uma expansão considerável; mapa maior sem destinos, caminhos,
desembarque e assets consistentes apenas amplia os vazios observados.
