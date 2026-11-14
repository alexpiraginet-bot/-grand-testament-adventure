# Claude — Cafarnaum viva, população e próxima missão

14/11/2026 · pedido direto de Alex · coordenação com Codex R15.
Use o modelo e esforço já selecionados na sessão. Este documento não ativa modelo.

## Objetivo desta rodada

Alex quer uma melhora perceptível hoje: sair de um cenário vazio para uma área de
Cafarnaum com caminhos convincentes, habitantes com malhas reais e algo para fazer
depois de chamar os discípulos. Priorizar uma sequência jogável completa e bem
apresentada. O mapa inteiro continua como visão; não prometer todo o Evangelho ou
qualidade final hoje. Entregar código, captura real e lista objetiva do que falta.

## Base e coordenação — leia antes de editar

Repositório: https://github.com/alexpiraginet-bot/-grand-testament-adventure

- `origin/main` observado: `732a451` (R13).
- Sua branch `claude/quirky-hamilton-bt0y7w`, observada em `b653232`, já contém R13.
- Seu commit `1fbfbda` tem `interactions.ts`, `encounters.ts`, `world-state.ts` e
  testes. Esses módulos ainda não estão ligados ao runtime. Não os reimplemente.
- O epílogo atual só mostra a entrada em Cafarnaum de Mc 1:21 e libera exploração.
  A etapa de ensino ainda não foi implementada.
- Só Simão tem NPC integrado com rig/idle/walk. Os demais humanos estáticos em
  A-pose estão fora da cena por decisão de Alex. Galinha e burro próprios existem.
- Codex trabalha na branch `codex/cafarnaum-interacoes-r15`, worktree local
  `D:/BentoLabs/90-Trabalho-temporario/gta-interacoes-r15-20261114`.
- Laboratório neural R14 e recorrência permanecem PAUSADOS a pedido de Alex.
  Não reativar. Não confundir esta rodada de jogo com o laboratório.

Leia `CLAUDE.md`, `docs/CONTINUIDADE-R13.md`, `docs/INTERACOES-E-ENCONTROS.md`,
`docs/NPC-INTEGRACAO-R12.md`, `docs/NPC-ASSETS-R12.md`, `docs/NARRATIVA.md` e os
contratos de custos/diário. Confira as refs atuais antes de trabalhar.

## Divisão de arquivos

**Codex nesta rodada:** `main.ts`, controles/HUD contextual, integração de
`interactions.ts`, controlador de montaria e pose do herói, apoio de pedras/redes
(`world.ts`, `shore-detail-r13.ts`, `village-detail-r13.ts`, helper de terreno).
Codex também revisará/corrigirá os dois problemas de persistência abaixo.

**Claude:** módulos novos e testes de população/rotinas, catálogo/loader NPC
generalizado, jornada de ensino em módulo separado, especificações de assets e
planejamento espacial. Não editar os arquivos reservados acima em paralelo.
Quando precisar de integração, entregue a assinatura da API e um patch textual
separado ou commit isolado, para Codex integrar. Não mudar branch em checkout de
outra sessão. Não substituir arquivos de malha existentes.

## Ordem de ataque — comece implementando

### 1. Fechar a jornada depois do barco

Criar uma continuação clara: convite/objetivo de voltar à cidade → percurso pela
rua → ponto de encontro ligado à sinagoga → ação de iniciar o ensinamento →
conclusão e próximo destino anunciado. A localização exata de cenário é escolha
artística identificada; não alegar que reconstruímos o prédio histórico com exatidão.

Use o corpus BLIVRE já versionado: Marcos 1:21–22 como referência inicial;
confira os versículos disponíveis antes de citar. Mc 1:21 informa que ensinava,
mas não fornece um discurso: não invente palavras e as atribua ao versículo.
Citação literal deve manter `Bíblia Livre · referência`; fala autoral deve
mostrar `Narrativa do jogo`. Leitura da Bíblia orienta, NÃO bloqueia quem chegou
ao local. Preservar saves existentes e possibilidade de explorar/voltar depois.

Entregue `teaching-journey.ts` (ou nome consistente), dados curados, transições
puras e testes: primeira visita, interrupção, retorno, finalização única, reload,
save velho/futuro/corrompido e missão acessível sem abrir Bíblia. Integração no
HUD/main fica com Codex. Evitar mais uma tela de fim sem objetivo seguinte.

### 2. Pessoas de verdade — produção antes de quantidade

Inventariar candidatos já pagos: André, Tiago, João, Zebedeu e empregado. Conferir
hashes/rig/escala/textura/animações. Prioridade: discípulos que faltam → trabalhador
adulto para encontro cotidiano → adultos de rua com roupas/identidades distintas.
Reaproveitar a cadeia de autoria local de Simão; ajustar pesos/clipes para cada
malha, sem assumir que copiar skeleton basta. Não gerar réplicas de Simão como
identidades bíblicas distintas. Não introduzir bonecos geométricos nem A-pose.

Para cada asset: GLB em metros, origem nos pés, frente consistente, idle/walk e
um gesto de conversa; perfis mobile/desktop com hashes; licenças separadas do MIT;
inspecionar frente/costas/lado e vários frames no jogo antes de aprovar. Se não
houver acesso ao Blender/Tripo, entregar código de população e tarefas exatas de
arte, com espécies/atores ausentes realmente ausentes, sem fingir entrega.

Tripo: o teto histórico de 1.200 créditos foi consumido. NÃO comprar nem iniciar
novo gasto sem teto disponível confirmado. Usar fontes existentes e ferramentas
locais instaladas. Não usar APIs pagas nem baixar pesos grandes por rotina.

### 3. População em setores e ruas convincentes

Implementar `npc-population.ts` + adaptadores de ator reutilizáveis. Identidades
estáveis, seed reproduzível, separação entre identidade e modelo, ownership de
geometrias/texturas compartilhadas, esqueletos independentes, descarte seguro.
Ativos precisam estar carregados/aprovados antes de virar alvo, áudio ou colisor.

Começar com metas de teste de 8 atores próximos no perfil móvel e 20 no desktop;
esses números são orçamento inicial, NÃO população histórica nem capacidade
medida. Medir e ajustar. Mais gente no mapa por carregamento por setores, não
centenas de esqueletos animados ao mesmo tempo. Fora de vista: reduzir atualização
e suspender mixers; reservar slots dos personagens de missão. Nunca sumir com
alguém durante diálogo nem com animal montado.

Rotinas simples legíveis: caminhar em trilhas, esperar no pátio, conversar em dupla,
cuidar da rede quando houver animação. Não deslizar, atravessar casa, flutuar ou
andar na água. Usar `town.plans`/footprints finais e superfície renderizada.
Separar pessoas da rota para não bloquear passagem; evitar multidão estacionária
no ponto inicial e agrupamento de clones idênticos.

Criar `town-life-layout.ts` com pontos de interesse e rotas a integrar: quarteirão
inicial, passagem estreita, pátio de ensino, margem/cais. Preservar relevo e routes
existentes, linha d'água e os marcos das missões. Não preencher todo espaço com
props repetidos. Marcar casas em lotes com portas para a rua, pátios e variação
de orientação/volumetria; respeitar vias acessíveis ao burro (~raio conservador
0,91 m, mais margem). Melhorar os módulos de casa em commit independente, sem
editar os módulos de apoio de props que Codex está corrigindo.

### 4. Encontros e reação do mundo

Usar a sua base `encounters.ts`. Primeiro encontro possível com adulto aprovado:
conversa curta opcional e reação visível. Não começar por carregar rede/galinha
sem animações de contato/soltar. Definir ações com id, label, posição, alcance,
pré-condições e resultado. O botão só aparece quando a ação pode executar.

O sistema do Codex consumirá E/toque uma vez e enviará ao alvo que o HUD mostra.
Exporte funções de alvo/ação; não ler teclado de novo dentro do NPC. Falas não
podem disputar legenda bíblica ou tocar sem ator visível. Som ambiente com
proveniência, limite de vozes e botão de silêncio; nada de TTS pago em runtime.

### 5. Revisão crítica e fechamento

Dois bugs encontrados na sua base, reservados para Codex corrigir:
`WorldStateStore.write()` precisa recusar versão futura surgida entre load/write;
`parseWorldState()` não pode escrever IDs como `__proto__` num dicionário comum.
Não confiar em contagem de testes histórica: rodar testes do checkout final.

Rodar typecheck, testes focados e build. Playwright em 390×844 e 1280×800:
percurso com controles reais, ação E/toque, mapas/modais pausando, falha de asset,
reload, transição de setor e fim da jornada. Medir bytes transferidos, frames e
erros no jogo, identificar Chrome no PC vs Safari físico não testado. Comparar
antes/depois com mesma posição/câmera/configuração. Não é DLSS nem equivalente.

## Entrega e integração

1. Primeiro commit pequeno: continuação da jornada + testes + API para main.
2. Segundo: catálogo/rotinas/população por setores + testes e diagnóstico de assets.
3. Terceiro: trecho urbano/referências de arte e evidência de caminhada.
4. PR em rascunho com hashes, capturas reais, testes e limitações. Não force-push,
   não mergear alterações concorrentes às cegas. Avisar Codex pelos arquivos de
   handoff/PR quais APIs estão prontas e quais modelos faltam.

Registrar cada etapa no diário, inclusive rejeições, início/fim observados e
tokens reais se disponíveis. Não converter horas abertas em trabalho contínuo.
O critério de hoje é melhora jogável e visível; números de NPC, alcance de mapa
e data de conclusão só podem ser divulgados como medidos ou metas identificadas.
