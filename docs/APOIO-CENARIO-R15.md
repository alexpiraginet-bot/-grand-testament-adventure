# Apoio de pedras e redes no terreno — R15

14/11/2026, Codex, subtask de cenário. Worktree isolada
`D:/BentoLabs/90-Trabalho-temporario/gta-interacoes-r15-20261114`, base732a451.
Intervalo observado nesta contribuição: 18:42:49–18:51:25, America/Sao_Paulo;
isso é uma janela de atividade, não horas humanas nem cargaGPU medida.
Laboratório neural permaneceu fora deste trabalho. Sem GPU, LLM, download,
dependência nova, push ou publicação.

## Diagnóstico concreto

Havia três problemas distintos:

1. O próprio GLB `pedras-basalto` contém cinco pedras desconectadas, com bases em
   0,000;0,045;0,420;0,561;0,717m. Mesmo colocando a caixa total no chão plano,
   algumas pedras inteiras permaneciam no ar. A análise agrupou triângulos após
   soldar somente posições coincidentes a10micrômetros; sem isso as costurasUV
   parecem dezenas de peças independentes. A rede amontoada é uma única ilha,
   base0 e altura0,30m; ela não recebeu essa transformação.
2. O espalhamento de pedras usava a interpolação bilinear do DEM, enquanto o
   terreno visível usa triângulos nas grades192/256. No quadrado de80m ao redor
   da praia, amostrado a cada4m, a diferença positiva máxima foi0,048125m no
   grid192 e0,001944m no256. Os máximos caem em partes submersas; não são prova
   da altura de uma pedra visível específica. O teste sintético reproduz o
   desacordo de interpolação sem depender de uma captura subjetiva.
3. A troca deLOD reutilizava a matriz da malha detalhada na malha distante,
   embora a base do modelo simplificado esteja em outra altura. Redes/pedras
   de fachada também usavam offsets e alturas fixos em vez dos bounds reais.

Asset examinado, somente leitura:
`D:/BentoLabs/90-Trabalho-temporario/gta-demo-direcao-r13-20261113/public/models/tripo-r1/pedras-basalto-bfb426c7e2b2.glb`.
SHA-256 `bfb426c7e2b23a8df950bc0e1acb125d68e951020974068ac16cbd41db25b666`,
igual ao catálogo antes e depois.2.372vértices,10.206índices/3.402triângulos.

## Correção

- `src/rock-grounding.ts`: desloca rigidamente cada pedra para sua própria
  base0, apenas na geometria privada já copiada por `sceneryMesh()`. Preserva
  os índices, normais, UVs, XZ e a forma de cada pedra. As fontesGLB não mudam.
  Chamado exclusivamente para pedras do mundo, margem e fachadas; não para
  árvores, redes, personagens ou barco.
- `src/prop-grounding.ts`: transforma a AABB real, incluindo pivô deslocado,
  escala e rotação. Apoia no mínimo do terreno **renderizado**, com inserção
  limitada a1,5cm ou3% da altura. Recusa local fora doDEM ou relevo maior que
  12cm/22% da altura, em vez de enterrar grande parte da peça. Nos locais
  aceitos pelo menos75% da altura da envolvente ficam acima do ponto mais alto
  do terreno. Não muda o DEM nem deforma a malha.
- `src/village-house-placement.ts`: acrescenta opção `rendered` à função de
  extremos. O padrão anterior `both` é preservado para casas/fundações.
- `src/world.ts`: cadaLOD de pedra usa seus próprios bounds e matriz de apoio;
  omissões são compartilhadas entre os doisLODs. Contador de pedras passa a
  informar as colocações aceitas. Árvores/arbustos conservam colocação anterior.
- `src/shore-detail-r13.ts`: usa as pedras corrigidas e o apoio real da grade.
- `src/village-detail-r13.ts`: redes terrestres/pedras usam bounds efetivos para
  apoio e colisor; nenhuma caixa invisível é adicionada quando a peça é omitida.

Não foram alterados `main.ts`, HUD, fauna, NPCs, freeroam ou `boat()` nesta
contribuição. Barcos mantêm a posição anterior. A rede lançada recebeu depois
o ajuste específico de linha d'água descrito abaixo, sem apoio terrestre.

## Evidência e testes

EnsaioCPU com o GLB verdadeiro, carregado pelo NodeIO já instalado e convertido
na geometria privadaThree: cinco ilhas, maior deslocamento0,7166115m, bounds
originais[-1.5,0,-1]…[1.5,1.2,1], corrigidos[-1.5,0,-1]…[1.5,0.715917,1].
Delta máximoXZ=0; hash do GLB de origem inalterado. Isso comprova a correção
geométrica isolada; não substitui a aprovação visual no navegador.

Comandos executados, sem descoberta recursiva:

```powershell
node --test test/prop-grounding.test.ts test/rock-grounding.test.ts test/village-houses.test.ts test/village-facade-r13.test.ts
node node_modules/typescript/bin/tsc --noEmit
git diff --check
```

25/25testes passaram; typecheck e diff-check sem erros. Os testes novos cobrem
pivôs deslocados, rotação/escala, terreno triangular versus bilinear, grades
reais, recusa de declive, diferenças deLOD, costurasUV, topologia inválida,
translação rígida, idempotência e preservação da fonte. Testes anteriores
preservam rotas livres, fundações, fachadas e DEM imutável.

SondagemCPU de layout real com envolventes dos modelos (não render):

| Grade | Portas | Pórticos | Redes decorativas aceitas | Grupos de pedras de fachada |
|---|---:|---:|---:|---:|
| 192 | 13 | 10 | 1 | 3 |
| 256 | 13 | 10 | 0 | 3 |

## Limites e próxima verificação

O critério conservador omite as redes decorativas em cantos com declive; no
desktop dessa sondagem nenhuma rede de fachada passou. Isso é explícito, não
uma alegação de todas as redes corrigidas visualmente. Uma rede necessária a
uma interação precisa de posição/plataforma própria ou apoio inclinado
validado. A rede do barco continua como antes. A rede lançada na água permanece
no mesmo XZ e recebeu somente a translação vertical descrita abaixo. Nenhuma
delas foi avaliada visualmente nesta contribuição.

AABB é envolvente: não comprova contato de todo vértice irregular, materiais,
sombras ou estética final. O número de props pode cair em lugares íngremes.
As cinco pedras continuam compartilhando uma malha/instância: agora repousam
na mesma base local; o solo local só admite pouco relevo. AnáliseCPU não mede
FPS, estabilidadeSafari ou tempo de carregamento.

A sessão integradora deve conferir início/vila/margem e transiçãoLOD no build,
incluindo o lago, com capturas antes/depois e registrar a revisão publicada
separadamente. Sem alegação de aprovação visual ou deploy nesta subtarefa.

Roteamento de ferramentas aplicado: arquivos/símbolos já identificados,
busca dirigida comrg; sem indexar conversas, segredos ou iniciar modelos.

## Complemento — rede lançada apoiada na água

Diagnóstico e prova CPU concluídos até 18:56:45 de 14/11/2026, a pedido da
integração. `TRIPO.md:131` pede uma rede aberta deitada na água, sem rig ou
animação. O arquivo runtime não é uma rede vertical nem um lance animado:
1 ilha conectada, 1.886 vértices, 1.349 triângulos, dimensões aproximadas
1,844 × 0,267 × 3,5 m. Nenhum giro de90 graus ou achatamento é necessário.

A baseY=0 corresponde a um fio/peso baixo isolado. A superfície principal
está em torno deY=0,20m; mediana medida0,2012402m. `main.ts` adiciona mais0,07m
ao mesh inteiro, deixando a parte principal a aproximadamente27cm da água.
Esse deslocamento explica o apoio incorreto sem supor que o pivô0 seja a
superfície média do tecido.

`src/cast-net-placement.ts`, chamado somente por `castNet()` em `world.ts`,
aplica uma translação rígida à geometria privada. Compensa o contrato existente
de rootY=0,07m e coloca a mediana dos vértices na linha média da águaY=0.
Não modifica forma, XZ, índices, UV ou normais. O fallback plano recebe a mesma
compensação; geometria vertical/espessa é recusada em vez de ser achatada.
`main.ts`, água, barco e redes amontoadas não foram modificados neste complemento.

Prova com GLB real `public/models/tripo-r1/rede-lancada-233b768b70c4.glb`:

| Medida | Resultado |
|---|---:|
| TranslaçãoY da geometria | −0,2712402 m |
| IntervaloY mundial dos vértices | −0,2012402 a +0,0654142 m |
| Faixa entre percentis10 e90, 80% dos vértices | −0,0202312 a +0,0167542 m |
| Mudança máxima emXZ | 0 |

Fios/pesos baixos ficam submersos; algumas dobras superiores conservam altura.
É uma pose estática de repouso sobre o nível médio, não simulação de
flutuação/ondas nem confirmação de interseção pixel a pixel com o shader.
O lago tem ondas de até4,5cm; visibilidade, transparência e reflexos precisam
da revisão visual da integração.

SHA-256 original, igual antes/depois e ao catálogo:
`233b768b70c4ec77d25da7bf971ea22b9a5303208b8b58c99717b4e3e04bde22`.
Quatro testes em `node --test test/cast-net-placement.test.ts` passaram:
superfície com peso baixo, root/waterline explícitos, rejeição de asset vertical,
preservação de origem/atributos e idempotência. Typecheck e diff-check também
passaram depois dessa alteração. Total da contribuição: 29 testes focados
executados em duas rodadas; sem execuçãoGPU nesta subtarefa.
