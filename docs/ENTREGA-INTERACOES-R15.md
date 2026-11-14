# Cafarnaum R15 — ações e continuação da jornada

14/11/2026. Integração Codex na branch `codex/cafarnaum-interacoes-r15`, com
os módulos de Claude `5477b9a` (ensino) e `5ec789e` (implantação na vila).
O laboratório neural R14 e sua automação permanecem pausados a pedido de Alex.

## Mudança jogável

- O botão de ação e a tecla E usam o mesmo destinatário validado por quadro.
  Ao haver duas opções, Q ou **Trocar ação** escolhe entre missão e conversa.
  Alvo desaparecido, parede, água ou desnível não redirecionam a ação.
- Simão, na malha animada já revisada, tem conversa opcional. As duas situações
  (antes/depois do chamado) estão identificadas como **Narrativa do jogo**.
  Conversar não chama discípulos nem marca missão como concluída.
- Créditos, Bíblia, mapa, colaboração e nuvem suspendem controles e relógio.
  Enter/Space mantidos pressionados não pulam várias falas. Foi preservada a
  ativação por tecnologia assistiva, com anúncio de conversa sem repetir por frame.
- A câmera deixa de se recentrar ao andar para trás. Antes, o giro mudava o
  referencial de S/joystick e fazia o jogador orbitar em vez de se afastar.
- Após o episódio e a volta à vila, há um pátio para a ação **Ensinar**, duas
  orações literais de Marcos 1:21–22 e indicação do próximo destino em Marcos
  1:29. As cenas ainda ausentes são declaradas. Ler a Bíblia orienta sem bloquear.
- A Bíblia interna inclui os versículos deste passo. A grafia da fonte é
  preservada, inclusive `temautoridade` em Marcos 1:22; a legenda encenada usa
  apenas a oração anterior à primeira vírgula.
- O progresso do ensino é local, versionado e separado do save de missões.
  Escritas recusam versões futuras e IDs arbitrários não alteram protótipos.

## Implantação e cenário

O algoritmo de Claude foi executado contra os colisores efetivos do runtime.
Encontrou o pátio em (-39,85), rua de 58,6625 m e folga mínima de 1,4464 m de
cada lado. São escolhas de direção de arte, não coordenadas arqueológicas.
Vegetação respeita a faixa da rua e do pátio; as casas não foram redistribuídas.

Pedras usavam um GLB com cinco ilhas desconectadas em alturas diferentes. A
cópia de runtime agora apoia cada ilha, sem modificar a fonte, forma, UV ou
material. Props estáticos usam os triângulos efetivamente desenhados pelo solo.

A rede aberta foi reprovada na implantação atual. O pivô a levantava cerca de
27 cm; seu XZ também caía em terra. A pose foi corrigida, mas a busca limitada
a 12 m não encontra profundidade para toda a peça em ambos os perfis. Por isso
ela não aparece. O material opaco dourado continua pendente de revisão visual.
Não foi inventada transparência nem usada posição seca como fallback.

## Montaria: limite explícito

`mount-controller.ts` implementa seleção, reserva, colisão varrida, saída
segura e velocidade 1,6× caminhada (4 m/s). Os testes de lógica passam.
**Não está ligado ao botão do jogo.** O herói ainda não tem pose/transições de
montaria aprovadas, e acelerar o ciclo existente do burro até 4 m/s faria as
patas deslizar. A próxima entrega deve validar assento, contato das mãos,
subir/descer e andamento antes de oferecer **Montar** ao jogador.

## Evidência e medição

- Build, typecheck e 418 testes aprovados: `shots/r15-build-release.log`.
- Nove verificações de teclado isoladas: `shots/context-input-r15-release/report.json`.
- Travessia de 58,7 m: `shots/r15-street-walk.json`, movimento real por KeyW,
  sem teletransporte nessa rua. O estado inicial de exploração e o alinhamento
  da câmera foram preparados por debug; não é um percurso manual integral.
- Jornada/ações desktop e toque: `tools/check_context_game_r15.mjs`, saída em
  `shots/context-game-r15-release/`: 28 verificações aprovadas e fontes estáveis.
  O relatório declara os teletransportes usados
  para alcançar os encontros; não os confunde com caminhada.
- BLIVRE: ZIP local SHA-256
  `99b62593c3cc6387bbd4aa6aff11103a5c3f5bda87d6257155bdb6576e3e1231`,
  versículos 21,22,29 conferidos contra o arquivo de origem. Resultado local
  `shots/r15-scripture-verification.json`.

Capturas de Chrome no Windows, mesmo em 390×844 com toque, não comprovam
Safari físico, temperatura, autonomia ou FPS de um iPhone.

O resumo versionado em `docs/evidence/r15-qa-summary.json` preserva hashes,
contagens, medições e limites. No pátio parado, a amostra de cinco segundos
registrou cerca de 100 FPS nos dois viewports na mesma RTX; isso não é ganho
medido contra a versão anterior. As imagens ainda evidenciam materiais,
vegetação e costa abaixo da direção visual aprovada. Revisão de código
independente não identificou novos defeitos P0/P1/P2 no diff final.

## IA local: sugestões revisadas, não provas

Gemma: 285 tokens de entrada e 1.000 de saída, sem resposta final utilizável.
Qwen: 177 de entrada e 311 de saída. Total observado: 1.773 tokens locais.
A proposta de exigir backend/WebSockets para NPCs foi rejeitada: este fluxo
é single player local. Não há gasto monetário inferido desses contadores.
Não foram reativadas filas, TTS, geração de imagens nem automações R14.

## Próximas frentes, com critério de aceite

1. **Rua, pátio e margem convincentes:** corrigir malha da costa (células atuais
   de 12/16 m), materiais e vegetação; comparar mesma câmera e perfil antes/depois.
   Evitar sobreposição de solo que esconda erros com z-fighting.
2. **Pessoas de verdade:** preparar e revisar os quatro candidatos de discípulos
   e adultos existentes, rig, idle e caminhada. Catálogo/rotinas não equivalem
   a população visível. Não criar bonecos substitutos ou multidões idênticas.
3. **Montaria completa:** pose e clips aprovados, percurso com obstáculos,
   transição a pé/montado e saída sem atravessar paredes ou cair no lago.
4. **Encontro com consequência:** pessoa identificada, ação clara, gesto
   revisado, resposta e fato salvo. Sem fala inventada atribuída à Bíblia.

Grand-V foi examinado apenas como referência. Na árvore publicada consultada
(`831c9ae`) predominam launcher/relay/configuração; não há licença explícita nem
um kit independente de gameplay que substitua este jogo. Nenhum código ou
binário dele foi executado ou incorporado. Não iniciar outra migração de motor
antes de medir uma alternativa contra esta pequena experiência jogável.

Referências consultadas:
- https://github.com/SebasKitten/Grand-V
- https://github.com/SebasKitten/Grand-V/blob/main/LauncherApp/rust/README.md
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository

Publicação, hash final e números finais de QA são registrados no diário após
a execução. Este documento não declara conclusão do mundo aberto ou qualidade AAA.
