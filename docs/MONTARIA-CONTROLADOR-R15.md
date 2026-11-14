# Montaria R15 — lógica isolada e gates visuais

14/11/2026. Ownership: `src/mount-controller.ts`, teste próprio e esta nota.
Nenhum arquivo do laboratório R14, main/fauna/HUD/herói foi alterado por esta contribuição.
O módulo não habilita a montaria no jogo por si só. Não cria animação, assento ou malha.

## Contrato de integração

```ts
const reservations = new MountReservations();
const mount = new MountController({walkSpeed: 2.5, reservations});
// Velocidade máxima: 2.5 * 1.6 = 4 m/s, sem parâmetro de corrida/boost.
mount.tryMount(target, {x: player.pos.x, y: groundY, z: player.pos.z}, world);
mount.update(dt, {x: directionX, z: directionZ}, world, {paused});
const exit = mount.previewDismount(world); // HUD; não altera estado ou reserva.
const result = mount.tryDismount(world);  // Revalida; não usa preview anterior.
```

`target` é um burro físico, próximo, carregado e aprovado: `id`, `kind`, `x/y/z`,
`heading`, `radius`, `halfHeight`, `mountedHeight`, `approved`, `visualReady`.
`mountedHeight` deve cobrir o conjunto inteiro burro/cavaleiro na pose aprovada;
não é sinônimo de `halfHeight*2`. O raio também deve cobrir o conjunto. Os testes
usam medidas de fixture, não medição de encaixe ou assento de produção.
`visualReady` só deve virar true após revisão visual das poses/transições.

`state` devolve uma cópia com `animalId`, posição de apoio `x/y/z`, `heading`,
`radius`, `halfHeight`, `height`, `speed`. A posição é a base do animal, não a
altura do quadril do cavaleiro. `speed` registra deslocamento aceito. A direção
de entrada já vem convertida pela câmera para XZ; heading0 aponta −Z, como fauna.
O controlador gira até 3 rad/s e não anda de lado para compensar uma curva.
`dt` é limitado a 0,05 s: retorno de aba não produz salto de recuperação.

`MountWorld` exige `heightAt`, `inside` e `bodyClear(query)`. A query contém
`from`, `to`, `radius`, `height`, `animalId` e fase `mount/ride/dismount`.
O callback deve validar a varredura do volume completo, obstáculos estáticos,
ocupação de NPCs/outros animais e altura livre. Só o animal reservado é excluído.
O contrato é obrigatório: devolver true sem verificar o mundo não valida colisão.

Para adaptar o mundo atual, `npcCrossesBox(from,to,box,radius)` e os buckets de
`NpcGround.segmentBlocked` já fornecem varredura conservadora dos footprints.
Esses boxes 2D podem ser tratados como colunas sólidas, conservadoramente. Para
passar sob telhado/porta com altura livre real, adicionar os volumes verticais
corretos no callback. O `blocked` do jogador atual, com folga fixa de 0,3m, não
serve sozinho para o burro. `npcStandable` tem raio humano fixo e tampouco deve
substituir o raio do conjunto montado.

Internamente são verificados centro e oito pontos do corpo: dentro do terreno,
altura seca mínima0,25m, apoio finito, gradiente local máximo0,42 com tolerância
numérica0,015m. O trajeto é amostrado a cada0,12m e passa também pela varredura
obrigatória do callback. Isso é um proxy amostrado do terreno, não prova de
colisão por triângulos, IK de cascos ou validação de relevo entre toda amostra.

## Reserva, escrita única e saída

- Consumir E/toque uma vez no integrador. Quando montado, tentar desmontar antes
  de encaminhar o comando a outros alvos. Falha mantém o ID e a posição.
- `isReserved(id)` identifica o animal excluído do `stepFauna`. Preservar esse
  mesmo objeto/clone no streaming, dentro do teto corrente; não gerar duplicata
  nem modificar o array da população com splice.
- Depois do update aceito, apenas o integrador copia a transformação/speed para
  o animal reservado e para a referência de movimento/câmera do jogador. Não
  rodar também a locomoção a pé, corrida ou multiplicadores de velocidade.
- A reserva impede duas instâncias do controlador de assumir o mesmo ID quando
  compartilham `MountReservations`. O código não modifica a população por conta
  própria, não cancela streaming nem persiste ossos ou montaria em saves.
- A saída testa direita/esquerda e quatro diagonais próximas, com destino e
  caminho secos/livres. Há no máximo seis candidatos, sem busca distante, spawn,
  teleporte ou reparo de posição. Montar e avançar exigem ao menos uma saída.
- `tryDismount` retorna `from`, `position` e o último snapshot `animal`; só libera
  a reserva depois de encontrar a saída. O adaptador visual deve executar a
  transição revisada entre assento e apoio. Os resultados lógicos não constituem
  animação de desembarque nem autorizam um salto visual entre poses.
- Pausas/menu/aba oculta não movimentam a montaria. Se outra entidade fechar a
  saída, o HUD deve explicar que é preciso espaço; não reposicionar ninguém.

## Rig e animação: inspeção somente leitura

Arquivo real inspecionado em CPU: `public/models/tripo-r1/heroi-2fe504810710.glb`,
1.397.424bytes, SHA256
`2fe50481071021e76f282425ef063082608cc2ee085cfd29403d4bfe15a0d0b5`.
Contém uma skin com65joints e apenas o clip `walk`. Existem Hips, Left/RightUpLeg,
Leg e Foot. O catálogo e a leitura do JSON interno do GLB conferem esses dados.

`animated-actor.ts` deriva a pose parada da caminhada e aplica o mixer ao rig
completo. `hero-posture.ts` trabalha tronco, cabeça e braço em convite; não
oferece quadril/pernas sentados. Não há pose montada aprovada, clipe de subir,
descer ou contato sincronizado. Ter ossos úteis não comprova deformação correta
da túnica/manto sobre o dorso.

Caminho visual: adaptador próprio que suspenda a caminhada do herói, preserve a
base do mixer e faça blend reversível de quadril/pernas/braços no esqueleto
inteiro; assento definido em coordenadas normalizadas do burro; inspecionar
contato, joelhos, pés, túnica e manto parado/em curva/em movimento. Se houver
pose procedural, identificá-la assim: não chamar de animação Tripo nova. Não
deixar o herói em pé preso ao dorso nem mover só o SkinnedMesh longe do skeleton.

Outro gate: a caminhada aprovada do burro foi calibrada para0,38m/s. O renderer
atual limita a taxa a3×. Aos4m/s da regra aprovada, a taxa necessária seria
`4/(0.38*scale)` (≈10,5× com scale1), muito acima desse limite. Acelerar o clip
ou manter o clamp sem revisão causa passo artificial/deslizamento. É preciso
revisar um ciclo adequado para a velocidade solicitada ou demonstrar outro
tratamento aprovado; este controlador não resolve essa animação.

## Evidências desta contribuição

- `node --test test/mount-controller.test.ts`:14 testes passaram, sem skip.
  Cobrem gates visuais/proximidade, duas reservas, velocidade/diagonal/corrida,
  pausa/lag, curva, água/borda/declive, teto/parede, caminho de saída bloqueado,
  revalidação após preview, imutabilidade e ausência de recuperação por warp.
- Typecheck explícito dos dois arquivos passou. TypeScript7 exige `--ignoreConfig`
  quando arquivos são fornecidos na linha de comando; primeira tentativa sem
  essa opção retornou TS5112 e não verificou o código.
- Sem benchmarkGPU, runtime/browser, Safari físico, animação nova, nova malha,
  geraçãoLLM, download ou publicação. Root precisa integrar, revisar visualmente
  e medir o jogo antes de anunciar montaria disponível.
