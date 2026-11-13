# Transferência Codex → Claude Code local — 12/11/2026

## Continuação autorizada por Alex — integração visual

**R1 publicada:** `main` em `6e35ff1534d4d17aa082d1d03113d997b51da801`,
deploy `dpl_AHxLfGbMGUfi9VSjb3URSK47Uxmb` confirmado `READY`. Testes de integração,
percurso de cenário e três missões passaram no domínio público. O trabalho seguinte
melhora céu e água, sem mudar o gameplay. Alex autorizou publicar cada incremento
verificado. Antes de editar em outra sessão, conferir o `origin/main` mais recente.

Alex pediu ao Codex seguir para a integração, mantendo qualidade gráfica máxima que o navegador sustente.
Trabalho em `codex/tripo-runtime-r1`: rig nativo do herói, treze malhas de cenário, texturas 2K, instancing,
LOD por distância e catálogo de assets com hash. Detalhes e testes em `docs/TRIPO-RUNTIME-R1.md`.
Não há sessão Claude Code autenticada editando esses arquivos em paralelo. As seções abaixo preservam o estado anterior.

## Repositório criado por Alex

Endereço real: https://github.com/alexpiraginet-bot/-grand-testament-adventure
(há um hífen no início do nome). O `origin` local e o formulário Construa conosco
usam esse endereço. Referências sem o hífen no `HANDOFF.md` original são históricas.
Alex também autorizou importar e publicar o jogo na Vercel. **Publicado e testado**
em https://grand-testament-adventure-lexprojects.vercel.app/ . A `main` foi enviada
ao GitHub preservando o histórico. Evidências, método de teste e limitações em
`docs/PUBLICACAO.md`. O `HANDOFF.md` original descreve o estado anterior à publicação.

## Estado recuperado

O bundle final do Claude web tem `main` em
`84443a71eb7376565c1139efdf56176b8a41560a`. A cópia antiga `1ad6154` não é a base.
Os 24 testes/build informados no HANDOFF original são evidência da sessão de
origem; a validação local deve ser repetida e registrada.

Validação local feita pelo Codex em 12/11/2026: `npm run build` passou, incluindo
typecheck, 24/24 testes e Vite. As malhas ainda não foram integradas ao carregador;
o teste atual informa explicitamente que `public/models/heroi.glb` está ausente.
`npm ci --ignore-scripts` precisou de `NODE_USE_SYSTEM_CA=1` para usar a CA confiada
do Windows; a verificação TLS não foi desativada. O audit registra 4 vulnerabilidades
moderadas na cadeia de ferramentas `@gltf-transform/cli`/caporal/glob/minimatch,
sem altas/críticas. Não aplicar `npm audit fix --force` sem avaliar a mudança major.

## Malhas entregues no disco

`assets-src/tripo-r1/` contém cópias conferidas por SHA-256:

- `source/`: 21 GLBs fonte (20 modelos distintos; herói estático e animado).
- `candidate/heroi-walk.glb`: candidato normalizado, totalizando 22 GLBs.
- `handoff/MANIFEST.json`: inventário, SHA-256, tamanhos, origem e pendências.
- `handoff/LEIA-ME-CLAUDE.md`: contrato de integração detalhado.
- `transfer-sha256.json`: verificação das cópias locais.
- `qa/hero-browser/`: captura e medidas reais do viewer Three.js.
- `qa/dlss5-experiment/`: captura e relatório do experimento que falhou.

Modelos: herói, Simão, André, Tiago, João, Zebedeu, empregado, barco, casas A/B/C,
oliveiras A/B, árvore espinhosa, arbusto seco, junco, pedras de basalto, muro,
rede amontoada e rede lançada. Todos exportados do site Tripo, sem API.

**Validação estrutural:** os 22 GLBs passaram no Khronos glTF Validator com zero
erros. Há avisos de tangentes não armazenadas e, nos arquivos rigados, nó de
SkinnedMesh não raiz. Isso não é aprovação visual de todo o lote nem de desempenho
no jogo. Escalas/pivôs/texturas de cenário ainda precisam de revisão e otimização.

### Herói animado

- SHA-256 candidato: `9e4bf02069342b2668703dd92398db69f006b8aef446702235fc3f7d69b46898`.
- 4.000.952 bytes; 17.481 triângulos; 13.003 vértices; 65 ossos; 1 material.
- Clip `walk`, duração 2,33333325 s, caminhada sem deslocamento de raiz.
- 1,76 m em repouso, Y para cima, frente +Z, pés no chão em repouso.
- Normalização feita num ancestral comum da malha e do esqueleto. Preserve ambos.
- `idle`, `run`, `beckon` **não foram entregues**. Os seis outros humanos estão
  estáticos em pose A e ainda precisam de rig.
- O viewer foi conferido em 1280×800 e 390×844, frente/costas e quatro tempos do
  clip, sem erros de carregamento e com limites finitos. Cerca de 100 FPS nesse
  viewer simples na RTX 5060 Ti **não mede o desempenho do jogo**.

### Créditos

Teto autorizado do primeiro lote: 1.200 créditos existentes, sem compra.
Gasto atribuível: 920; mais 105 de diferença não atribuída; total conservador
1.025. Saldo observado: 2.190. Restam 175 do teto, mas Alex pediu transferência
imediata; nenhuma nova geração deve começar só para gastar esse restante.

## Novas instruções de Alex

1. Levar a sessão para Claude Code **local**, modelo mais capaz disponível e esforço máximo.
2. Criar/publicar o repositório público, preservar histórico e aceitar contribuições.
3. Entregar todas as malhas ao ambiente local; seus binários mantêm licença separada.
4. Incluir **Construa conosco**, detalhado em `docs/CONSTRUA-CONOSCO.md`.
5. Mostrar teste real do DLSS 5. Tentativa executada, mas falhou no servidor de
   recursos da demo; não existe comparação ON/OFF válida até aqui.

### Construa conosco implementado pelo Codex

Branch `codex/construa-conosco`: formulário no jogo, integração por link de issue
preenchida (publicação confirmada no GitHub), pausa de controles/tempo de missão,
rascunho preservado durante a página e testes de navegador. Build com **28/28 testes**.
Não há endpoint nem token no frontend. O repositório está publicado; o envio real
de uma issue ainda precisa ser confirmado por uma conta GitHub. Os prints ficam em
`shots/feedback/`. A sessão Claude Code local ainda depende do login na conta paga
correta; não confundir estes arquivos preparados com uma sessão já iniciada.

Amostra local do jogo com formas provisórias: Chrome/WebGPU em aproximadamente
100 FPS nos dois viewports durante a verificação, cerca de 579 kB transferidos
(documento e recursos, cache novo). É uma amostra curta no PC, não benchmark de
celular nem do jogo com todas as malhas. Resultado completo: `shots/feedback/report.json`.

## Divisão de trabalho

O Codex recuperou o bundle e entregou os assets. Claude Code assume implementação
do jogo e integração; não há outra sessão autorizada a editar esses mesmos fontes
simultaneamente. O projeto de assets original foi preservado em pasta separada.

Antes de declarar publicação: verificar conta, URL remota, visibilidade pública,
SHA remoto e arquivos versionados. Antes de declarar feature concluída: executar
testes reais e demonstrar o comportamento. Nenhum token deve ser copiado do
ambiente de outra aplicação para contornar login.
