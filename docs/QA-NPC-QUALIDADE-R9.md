# QA R9 — NPCs provisórios retirados e encontros preservados

Data: 13/11/2026. Revisão local em `gta-visual-quality-r9-20261113`, baseada na R8 publicada. Publicação fica com o integrador.

## Resultado

Quatro casos aprovados, **72 verificações**: Chrome desktop 24, Chrome mobile 22, WebKit mobile 12 e hero404/retry 14. Build/teste completo informado pelo integrador: 172/172. A QA executou o bundle `index-7Z8RWWVI.js`, SHA-256 `57262772fec1784854f16e42b6316a7201d6d5c6bf5af5143c51645fb0d83514`, sem modificar o runtime.

A cena inspecionada possui um único humano: o herói GLB com SkinnedMesh nativa e geometria BufferGeometry. Nenhum NPC, humano de geometria primitiva, collider de NPC ou seguidor no radar aparece nas amostras. O diagnóstico deriva das raízes visíveis anexadas à cena e é acompanhado de inspeção dos prints e da guarda CPU do grafo de imports para `people.ts`/`rig.ts`; não é um classificador de qualquer geometria arbitrária.

As três missões concluíram nos dois Chrome. Desktop usou **KeyE real**; mobile usou **tap real em #act**. Os encontros foram posicionados com teleporte de debug, sem fingir uma rota completa percorrida. A passagem contínua de caminhada foi desktop: 3,2435 m por W em 12 amostras, chegando a 0,05 m do centro de uma antiga posição de NPC. As consultas de colisão nos pontos narrativos de Simão/André não adicionaram barreiras invisíveis.

O contador narrativo terminou com Simão, André, Tiago e João; as listas de seguidores visuais, NPCs e marcas de radar ficaram vazias. O aviso **“Cena em desenvolvimento · personagens em preparação.”** aparece perto dos encontros e durante as falas. As legendas continuaram literais, com atribuição BÍBLIA LIVRE, e a orientação editorial cedeu espaço durante a fala.

A abertura continuou exigindo 14 GLBs centrais. Após Go, galinha e burro aprovados foram carregados com instâncias reais e bytes dos perfis esperados; esta rodada não substitui a QA de andadura/áudio R8.

## Recuperação do herói

Foi respondido 404 uma única vez para `models/tripo-r1/heroi-2fe504810710.glb`. A tela mostrou mensagem específica do personagem, Go permaneceu desabilitado e o HUD fechado; não houve debug de jogo publicado nem substituto procedural. Após 2 s com os outros recursos terminando, o erro continuou terminal. Um clique real em **Tentar novamente** carregou o GLB verdadeiro, recuperou 14/14 e permitiu Go + fauna. O botão de modo compatível permaneceu disponível; o clique nele não foi repetido nesta rodada.

O caso contém deliberadamente **um HTTP 404 e dois console.error** (rede e erro tratado), mais cancelamento do request. Nos três casos normais: zero erros de console/página/HTTP e zero crashes. Warnings do Three renderAsync descontinuado foram preservados; WebKit também registrou avisos de preload de fonte.

## Medições

Janela de FPS de 5 s, perto do início, neste PC Windows. Mobile significa viewport 390×844 + UA/touch; desktop 1280×800. Bytes são ResourceTiming encodedBodySize do **caso inteiro**, incluindo recursos opcionais, não tamanho da primeira tela. TextureBytes é estimativa do renderer, não medição de VRAM nem RAM do processo.

| Caso | Verificações | Backend | Até pronto | FPS médio (mín–máx) | Bytes do caso | Texturas estimadas |
|---|---:|---|---:|---:|---:|---:|
| Chrome desktop | 24 | WebGPU | 4,52 s | 100,00 (99,99–100,03) | 21,67 MB | 1.247,50 MB |
| Chrome mobile | 22 | WebGL2 | 7,68 s | 99,96 (99,01–100,80) | 20,57 MB | 203,40 MB |
| WebKit mobile | 12 | WebGL2 | 15,99 s | 60,58 (51,84–63,81) | 20,05 MB | 203,40 MB |

As posições/janelas R8 não são rigorosamente idênticas; estes números não provam ganho percentual. O teste 404 inclui dois carregamentos e, por isso, não serve para comparar tempo de abertura. Nenhum resultado prova desempenho, memória ou suspensão do Safari em iPhone físico.

## Inspeção visual e limites

Foram vistos os prints de encontros desktop/mobile, WebKit e erro do herói. Não há bonecos CAD ou personagens provisórios no barco nas imagens inspecionadas. As casas ainda repetem a mesma forma/material, com bases retangulares expostas e solo muito uniforme; esses pontos já aparecem em R8 e seguem como prioridade visual futura. Não são corrigidos pela remoção dos NPCs.

O teleporte rápido do desktop e do smoke WebKit pode capturar a breve animação de conclusão da missão anterior junto ao novo encontro. A variante mobile espera o HUD atual antes da captura. A lógica de missão e as falas consultadas em estado correspondem ao encontro correto.

O áudio no WebKit Windows segue indisponível e a interface informa isso. Nenhuma escuta perceptual nem novo teste de contatos dos pés foi alegado. Browsers foram fechados ao fim de cada caso; uma única janela/GPU foi usada por vez. Não houve geração Tripo, compra, gasto externo, envio de formulário ou deploy.

## Evidências e reprodução

Relatórios e prints locais: `shots/npc-quality-r9/`. O manifesto `SUMMARY.json` lista SHA-256 e tamanho de cada arquivo de evidência, o commit-base e o hash do harness. A pasta de shots é ignorada no Git e deve acompanhar o acervo privado do projeto.

- `chrome-mobile-simao-andre-prompt.png`: encontro sem NPC e aviso visível.
- `chrome-mobile-tiago-joao-line.png`: missão 3 e legenda literal sem personagens provisórios.
- `chrome-desktop-walk-through-former-npc.png`: segmento testado por teclado.
- `hero-404-retry-hero-error.png`: falha recuperável sem liberar jogo.

```powershell
$env:PLAYWRIGHT_PATH='C:/Users/R2/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node tools/check_npc_visual.mjs http://127.0.0.1:4193/ shots/npc-quality-r9 --case=chrome-desktop
node tools/check_npc_visual.mjs http://127.0.0.1:4193/ shots/npc-quality-r9 --case=chrome-mobile
node tools/check_npc_visual.mjs http://127.0.0.1:4193/ shots/npc-quality-r9 --case=webkit-mobile
node tools/check_npc_visual.mjs http://127.0.0.1:4193/ shots/npc-quality-r9 --case=hero-404-retry
```

Use uma nova pasta de saída ao repetir para preservar esta rodada. O preview 4193 pertence ao integrador.
