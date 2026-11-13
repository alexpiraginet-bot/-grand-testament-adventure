# Fachadas — amostra R13

13/11/2026. Responsável: Codex (`r7_gameplay_audit`). Etapa de autoria do
Marco A em `codex/demo-direcao-r13`; não é aprovação visual nem publicação.

## Problema observado e intervenção

As projeções CPU dos três GLBs e as capturas reais do baseline concordaram:
as casas A e C têm entrada em +Z; a B tem entrada em +X. O alinhamento anterior
punha uma parede cega da B de frente para a rua. Também havia portas muito
pequenas, tecido liso sobre varetas e uma base de cascalho sem relação clara
com a entrada. Esta etapa atua nas fachadas dos primeiros 100 m da rota.

`village-facade-layout.ts` seleciona somente a primeira fileira da rua,
usando a projeção ao longo da rota e a distância da fachada, sem mudar o DEM.
As duas B selecionadas recebem uma cópia da geometria girada −90° em Y.
A escala uniforme e a borda da rua continuam iguais. O fundo pode se estender
para trás para evitar miniaturizar ainda mais a casa: essa extensão é recusada
se interceptar outro lote, uma correção anterior, o corredor da rota ou água.
Os lotes não corrigidos preservam exatamente posição, dimensões e fundação.
As três malhas originais e suas texturas não são regravadas.

`village-detail-r13.ts` acrescenta folhas de porta fechadas, batentes, soleiras
e pórticos curtos com ripas. A madeira tem arestas chanfradas e pequena variação
de seção, textura em escala métrica e sombra geométrica; todas as peças são
fundidas em **um mesh/material**. As folhas fechadas combinam com os interiores
que o jogo já bloqueia; esta etapa não oferece abertura ou entrada nas casas.
As novas folhas têm altura mínima de 1,80 m, limitada pela parede, para melhorar
a percepção de escala sem ampliar as malhas inteiras.

Os batentes foram sondados diretamente nos triângulos dos GLBs. As coordenadas
nativas de apoio são Z=1,70 m (A), 3,69 m (B após a rotação) e 1,59 m (C).
Usar o extremo da caixa do modelo colocaria a porta A cerca de 70 cm à frente
da parede, pois essa caixa também inclui beirais. As ripas recuam até a parede,
e os postes começam 4 cm abaixo dos triângulos efetivamente renderizados.

Redes amontoadas e pequenos grupos de pedras reutilizam os GLBs reais existentes,
sem novos vasos lathe, caixotes ou humanos. O enfeite genérico anterior é omitido
nos lotes trabalhados. O decorador legado continua no restante da vila; como sua
lista é filtrada, a distribuição incidental desses enfeites fora da amostra pode
mudar, embora as malhas/footprints das casas não corrigidas permaneçam iguais.

## Material e origem

[Rough Wood, Rob Tuytel / Poly Haven](https://polyhaven.com/a/rough_wood),
[CC0](https://polyhaven.com/license), consultados em 13/11/2026. O material
original foi inspecionado: madeira crua envelhecida, sem tinta moderna. É uma
referência material contemporânea, não evidência da espécie ou carpintaria de
Cafarnaum no século I. A composição dos pórticos é reconstrução artística.

- Originais JPG 1k: diretório externo `GRAND-TESTAMENT-ASSETS-R1-20261112/12-FACHADAS-R13-20261113/sources/rough_wood`.
- MD5 dos originais confrontado com o JSON oficial; SHA-256, URLs e autoria
  em `public/textures/facade-r13/SOURCES.json`.
- Derivados WebP: albedo sRGB, normal OpenGL e roughness lineares; 512 móvel,
  1024 desktop. Escala de UV de 0,5 m, compartilhada; nenhum clone de textura
  por porta/poste. Sem displacement, alpha blend ou novo passe.
- Downloads por perfil: **160.830 bytes** móvel; **716.172 bytes** desktop.
- Catálogo de runtime: `src/data/facade-materials-r13.json`.
- Reprodução: `node tools/prepare_facade_materials.mjs <diretório dos originais>`.
  O script só lê as fontes e gera seis mapas e os dois manifestos.

O loader de abertura, integrado pelo agente principal, entrega
`FoundationSurface.facadeWood = { map, normalMap, roughnessMap }`. As texturas
usam RepeatWrapping, repeat(1,1); os UVs da geometria já contêm a escala física.
Sem esse conjunto, não surgem marcenaria sem textura nem colisores novos.
Os GLBs Tripo continuam sob a licença própria dos assets de Alex, fora da MIT.

## Evidência CPU e orçamento

Na planta real: **158 casas**, 13 fachadas selecionadas, duas B corrigidas,
nenhuma B recusada. A execução com assets completos e madeira gera 13 portas,
10 pórticos, duas redes, nove grupos de pedra. São 355 peças de madeira,
15.620 triângulos de marcenaria e 31 colisores de detalhe. A integração pode
recusar algum prop adicional se ele conflitar com enfeites legados existentes.

São até **três batches** para os novos detalhes (madeira, redes, pedras) e
um batch adicional para a B orientada. Isso é contagem de objetos de render,
não medição de chamadas GPU totais: sombras podem desenhá-los novamente.
Não há novo trabalho por frame no módulo.

`node --test test/village-facade-r13.test.ts test/village-houses.test.ts`:
**14/14 passaram**. A cobertura inclui origem/orientação, proporções, imóveis
fora da correção, borda da fachada, corredor inteiro das rotas, apoio no chão
renderizado 192/256, normais externas, compartilhamento das texturas e ausência
de fallback quando a madeira falta. `npm run typecheck` passou.

Projeções, sondas e relatório CPU local estão em `shots/facade-r13-cpu/`.
Baseline visual preservado em
`D:/BentoLabs/04-Fotos-e-videos/Grand-Testament-Adventure/Diario/R13-AMOSTRA-20261113/baseline/`.
As capturas candidatas, passeio em movimento e métricas integradas ficam com
o agente de QA, nos mesmos enquadramentos; nenhum navegador/GPU foi aberto
pelo autor deste módulo durante o trabalho paralelo.

## Limites e próximo critério

A malha e os atlas das casas ainda são os três assets anteriores. Esta etapa
não promete substituir sua resolução, resolver a repetição do mapa inteiro ou
reconstituir interiores. A decoração precisa passar pela comparação visual
A/B/C e pelo passeio: verificar alinhamento das novas folhas, encontro dos
postes com o solo, sombras das ripas, leitura da escala e câmera sob os beirais.
Teste CPU não aprova esses aspectos. A densidade e as aberturas são autoria de
cenário, não um levantamento arqueológico. Nenhum crédito pago foi consumido.

## Correção após a primeira captura integrada

A captura `shots/r13-integrated-wip-r1/desktop-fixed/facade-c.png` reprovou as
folhas: pareciam grades diante da porta original. A causa principal era o
referencial da seção das tábuas, não a textura. Os pontos de início/fim seguiam
a casa, mas a largura/espessura permaneciam em eixos globais; numa casa girada
90°, a câmera via a espessura de 6,5 cm em vez da largura. A seção agora usa
uma base ortogonal ligada à fachada, inclusive nas travessas e ripas.

Um fundo de madeira contínuo fecha as pequenas juntas/chanfros sem outro
material ou draw call. Nova sondagem CPU no corpo da folha C identificou
interferência residual de cerca de 5 mm em dois de 400 raios; o plano avançou
somente 2 cm nativos, mantendo o contato do batente com a parede. Beirais e
pedras da soleira não são usados como referência para empurrar toda a porta.

O teste de regressão lança 427 raios pela área da folha em quatro rotações.
Antes da correção, **228 raios atravessavam a folha na casa a 90°**; depois,
nenhum raio atravessa em 0°, 90°, −0,63 rad ou 2,41 rad. Isso comprova cobertura
geométrica frontal; a nova imagem do jogo ainda deve confirmar o acabamento.
