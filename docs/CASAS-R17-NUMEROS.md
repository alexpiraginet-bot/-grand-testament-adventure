# Kit de casas R17 — números

Gerado por `node tools/build_house_report.mjs` a partir de `src/house-kit.ts` nos lotes reais da vila. Não editar à mão:
`test/house-kit.test.ts` falha se este arquivo diferir do que o código dá. Contexto, limites e decisões em `docs/CASAS-R17.md`.

## Os lotes

- 158 lotes (os mesmos nos perfis de chão 256 e 192). Largura 3,77 a 8,56 m, profundidade 3,31 a 6,25 m, altura 2,26 a 3,39 m.
- Malhas esculpidas em uso hoje: `casa-basalto-a` em 58 lotes (3.824 triângulos cada), `casa-basalto-b` em 36 lotes (4.910 triângulos cada), `casa-basalto-c` em 64 lotes (3.262 triângulos cada).

## As casas que o kit dá a esses lotes

| Tipo | O que é | Casas |
|---|---|---:|
| `sala` | um cômodo | 70 |
| `duas-salas` | dois cômodos, o segundo mais baixo e recuado | 19 |
| `patio` | cômodo e pátio murado com forno | 14 |
| `escada` | cômodo com terraço e escada de pedra | 23 |
| `alpendre` | cômodo recuado atrás de um alpendre | 24 |
| `sobrado` | cômodo com um quarto menor no terraço | 8 |

| Acabamento da parede | Casas |
|---|---:|
| pedra à vista (`pedra`) | 64 |
| reboco de barro até um rodapé de pedra (`reboco`) | 51 |
| reboco só na parte de cima (`meio`) | 43 |

- Cobertura: 74 com laje de terra batida até a borda, 84 com terraço dentro de um parapeito.
- Aparências distintas (tipo + acabamento + cobertura): 28. Desenhos distintos (com medidas, lado e aberturas): 110 em 158 lotes.
- Vizinhas com a mesma aparência a menos de 15 m: 10 pares se cada lote sorteia sozinho; 0 com `villageDesigns`, que fez 10 lotes sortearem de novo.
- Entrada: 14 casas entram pelo portão do pátio, 24 têm a porta sob o alpendre, as outras 120 têm a porta na fachada.
- Altura: 74 casas passam da altura do lote (a mais alta, 1,85 m acima; a casa mais alta mede 5,19 m). O colisor que segura a câmera precisa do topo da malha (`HouseMesh.height`), não do lote.

## Custo

| | Hoje (3 malhas esculpidas repetidas) | Kit |
|---|---:|---:|
| Triângulos das casas da vila | 607.320 | 210.667 |
| Triângulos por casa | 3.824 / 4.910 / 3.262 | 746 a 2.058 (média 1.333) |
| Casas diferentes | 3 | 110 |

- O kit usa 34,7% dos triângulos de hoje. Juntas (`mergeHouses`), as 158 casas são 3 malhas, uma por material: 236.615 vértices, 12,3 MiB de geometria na memória (posição, normal, UV, cor e índices), feita ao abrir o jogo e não baixada.
- A troca: hoje as três malhas são instanciadas, então a geometria de cada uma existe uma só vez; no kit cada casa tem a sua. Menos triângulos desenhados, mais memória de geometria.
- Não medido aqui: quadros por segundo e memória de GPU no jogo real. As casas ainda não estão na vila.

## Materiais gerados por código

| Material | Perfil | Lado | Bytes (cor + normal + rugosidade) |
|---|---|---:|---:|
| `basalt-wall` | mobile | 512 px | 179.454 |
| `basalt-wall` | desktop | 1.024 px | 575.196 |
| `mud-plaster` | mobile | 512 px | 158.622 |
| `mud-plaster` | desktop | 1.024 px | 555.434 |

- Total: 1.468.706 bytes em 12 arquivos; um jogador baixaria só o seu perfil: mobile 338.076 bytes, desktop 1.130.630 bytes. A madeira é a de `facade-materials-r13`, já no jogo.
- Tamanho no mundo: pedra 2,4 m por repetição, reboco 2,0 m, madeira 0,5 m.
