# Fauna própria R8 — produção, som e distribuição

Revisão iniciada em 13/11/2026 sobre `c664f9f`. Pedido de Alex: preparar os
animais para povoar todo o mapa, com sons. Preservar a abertura marfim/bordô/ouro
e o carregamento limitado para iOS da R7. Malhas simplificadas anteriormente
rejeitadas continuam fora do jogo.

## Inventário e critérios de entrada

| Espécie | Uso artístico | Alvo de geometria próximo | Movimento necessário |
|---|---|---:|---|
| Galinha adulta | Pátios e bordas da vila | 8 mil triângulos | Dois pés, caminhada e pausa |
| Burro adulto | Trabalho e acessos às casas | 18 mil triângulos | Quatro patas, caminhada e pausa |
| Ovelha adulta | Pequenos grupos no interior | 12 mil triângulos | Quatro patas e pastoreio |
| Cabra adulta | Terreno firme no interior | 12 mil triângulos | Quatro patas e pastoreio |
| Ciclídeo de água doce | Cardumes no lago | 6 mil triângulos | Cauda/nadadeiras, sem vocalização |

São alvos de produção e composição artística, não contagens históricas ou
promessa de desempenho. As fontes históricas estão em `FAUNA-GALILEIA.md`.
As referências próprias de galinha, burro e peixe estão no acervo local
`GRAND-TESTAMENT-ASSETS-R1-20261112/02-Referencias/Fauna-R4`.

Exigir escala em metros, frente consistente, textura PBR sem luz artificial
pintada, pés apoiados, rig útil e deformação conferida em várias fases. Uma
malha só entra como aprovada depois de inspeção do GLB real; uma imagem bonita,
skin presente ou um clip chamado `Walk` não bastam. Preservar fonte e derivado
com hashes distintos. Não redistribuir os modelos como parte da licença MIT.

## Tripo: operações verificadas

Todas as operações foram feitas no **site**, com a conta existente, sem API
nem compra de créditos. O saldo inicial desta revisão era 2.190, coerente com
o ledger anterior: 1.025 dos 1.200 créditos autorizados já consumidos.

- Burro candidato: tarefa `78a7c14b-9990-4c16-a7aa-7d7131ff8bc0`, 45 créditos.
  A configuração persistida de 1.500 polígonos produziu 1.418 triângulos. Foi
  preservado, inspecionado em seis vistas e **reprovado para uso próximo**.
- Burro revisado: tarefa `1acf3b00-f086-4d84-afca-cf24091d6321`, 45 créditos,
  alvo de 18.000 polígonos confirmado na interface. Fonte recebida com 17.688
  triângulos e 11.073 vértices; conferida em seis vistas. Rig `Other` adicional:
  20 créditos. O Walk original confundiu uma pata dianteira com coluna e foi
  rejeitado; a cópia local aprovada recebe caminhada e repouso corrigidos.
- Galinha: tarefa `eb78abc7-cd1e-4c5d-890e-826c16ba0f09`, H3.1, 45 créditos,
  alvo 8.000; arquivo recebido com 7.886 triângulos e mapas 2048².
- Rig da galinha: opção `Other`, 20 créditos. Exportou 20 ossos, uma skin e um
  clip `preset:quadruped:walk`. Inspeção em 121 fases revelou que as pernas
  permaneciam imóveis. **Animação original não aprovada**; correção local em
  cópia deve receber nova validação antes de entrar no runtime.

Consumo confirmado desta revisão até essas operações: 175 créditos; saldo
observado 2.015; teto anterior de 1.200 créditos atingido. Foi solicitada ampliação de até
300 créditos, **sem considerar aprovada até resposta explícita**. Não submeter
operações dependentes dessa ampliação enquanto a pergunta estiver pendente.

Fontes e capturas ficam em `assets-src/fauna-r8/` e `shots/tripo-*.json`, fora
do Git. O ledger local registra cada débito e o status real.

## Distribuição do mundo

`fauna-population.ts` usa setores determinísticos de 128 m. Os padrões móveis
limitam a seleção a 48 animais, nove setores carregados, 24 em cache e duas
gerações de setor por atualização. Carrega somente a vizinhança do jogador.
IDs permanecem estáveis por semente/setor/espécie. Ao expulsar um setor do
cache, uma nova visita regenera suas posições iniciais; não há persistência
global de cada animal.

Domésticos se concentram perto de construções/pátios conhecidos. Rebanhos
ficam em terra firme com inclinação admissível, fora de obstáculos e trilhas;
peixes exigem profundidade para todo o corpo. A simulação respeita a orientação
do deslocamento e pode congelar animais distantes sem remover sua ocupação.

Uma inspeção CPU percorreu os 576 setores do terreno atual. Isso verifica a
cobertura do gerador, **não significa milhares de modelos renderizados**.
Só espécies com malhas aprovadas devem ser passadas ao gerador em produção.

## Áudio

Cinco gravações CC0 com autores, links, hashes e adaptações documentados em
`FAUNA-AUDIO-FONTES-R8.md` e `public/audio/fauna/SOURCES.json`. Derivados mono
24 kHz/64 kbps somam 670.464 bytes; aves e margem somam 350.016 bytes.

Um único AudioContext é iniciado pelo gesto de jogar. Downloads/decodes são
sequenciais e opcionais; falhas não bloqueiam o jogo. Até três vozes, cache
PCM de 12 MiB, histórico de até 512 emissores com expiração, distância 3D,
intervalos variados e fades. Silenciar, abrir menus ou ocultar a página
interrompe as vozes. A retomada do contexto usa gesto do jogador.

Enquanto não houver animais visuais aprovados, apenas os habitats de aves e
água podem soar. Peixe não tem vocalização. Fontes atuais são gravações modernas
usadas numa recriação, não registros sonoros da Galileia antiga. A escuta e a
mixagem perceptual continuam distintas da decodificação técnica.

## Evidência de navegador disponível

`shots/fauna-r8/SUMMARY.json` registra Chrome desktop 1280×800, Chrome móvel
390×844, falha HTTP 404 de áudio e WebKit móvel. Os casos Chrome passaram por
abertura real, áudio, mute, menus e retomada. O WebKit Windows abriu o jogo com
14/14 assets, mas não disponibiliza AudioContext/webkitAudioContext; não é
prova de áudio no Safari físico. Capturas e logs de tentativas com falha também
foram preservados. Qualquer alteração posterior exige conferir o seu impacto.

FPS medido nesse PC e viewport móvel não representa desempenho no iPhone.
Nenhum resultado de DLSS ou quantidade histórica de animais é inferido.

## Primeira integração controlada

A galinha R2 recebeu dois ossos de pé e animação local, preservando as versões
originais. A revisão completa está em `QA-GALINHA-R8-BIRDWALK.md`. O manifesto
separado escolhe 1024 px no desktop e 512 px no celular, com hash verificado.
Carga opcional só após o gesto de jogar; a abertura continua com 14 assets.
Máximo de 24 animais no celular e 48 no desktop, com animação próxima a 45 m.
Texturas, origem e escala vêm do GLB inspecionado; não se usa animal provisório
se um download falhar. `public/fauna/SOURCES.json` registra fonte e derivados.

O burro corrigido tem caminhada a 0,38 m/s e repouso com quatro apoios, frente
−Z e escala artística total de 1,30 m. `QA-BURRO-R8-WALK.md` registra fontes,
hashes, 22 vistas e limites do blend. Os quatro GLBs de ambas as espécies
somam 4.841.404 bytes; o navegador baixa apenas o par do seu perfil:
1.783.012 bytes no celular ou 3.058.392 bytes no desktop. Não há IK de terreno.

O build integrado final passou 167 testes CPU e typecheck. A revisão de navegador
de cada versão está nas capturas/logs `shots/fauna-r8-*`; não generalizar
evidência de uma versão anterior para um bundle alterado.

O ensaio de áudio nativo encontrou um erro de integração que os emissores
simplificados dos testes anteriores não expunham: o raio físico do animal
sobrescrevia o alcance sonoro. Corrigido copiando apenas identidade e posição;
regressão cobre agentes completos, ouvido a 1,55 m e os alcances de 22/55 m.
Bundle após a correção: `index-BvfTbjcg.js`. A falha anterior foi preservada
em `shots/fauna-r8-final-audio/` para não registrar um falso sucesso.

Ovelha, cabra e peixe permanecem pendentes de geração própria e aprovação.
O som de ovelha está preparado, mas não será emitido por um animal invisível.
