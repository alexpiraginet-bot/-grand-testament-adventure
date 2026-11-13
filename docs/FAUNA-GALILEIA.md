# Fauna da Galileia — R4

Pedido inicial de Alex em 13/11/2026: dar vida à vila e ao lago com galinhas,
burros e outros animais plausíveis. **Decisão posterior de Alex:**
“Se for ruim as malhas sem gráficos perfeitos nem inclua! Vamos criar os nossos”.

Responsável: Codex. **As malhas simplificadas pesquisadas foram rejeitadas para
integração e devem permanecer fora do build.** Esta é documentação de pesquisa,
não um inventário de fauna ativa. A infraestrutura de simulação fica reservada
para futuras malhas próprias, realistas e aprovadas visualmente. Nenhum resultado
da pesquisa autoriza reativar o lote rejeitado.

## O que é histórico e o que é composição

As espécies orientam uma recriação artística. Quantidade, posição, percursos,
pelagens e comportamento dos indivíduos não são dados arqueológicos de Cafarnaum.
Não há quantidade aprovada de animais ativos nesta revisão. Os números do
rascunho de simulação não representam uma entrega, uma decisão de povoamento
vigente ou uma estimativa de população antiga. Uma futura quantidade de cena
dependerá da qualidade das malhas próprias e de medições reais no navegador.

Fontes consultadas:

- **Galinhas e ovinos/caprinos na região e período:** [Yardenna Alexandre,
  relatório da escavação de Yafi‘a, Israel Antiquities Authority, 2012](https://hadashot.iaa.org.il/report_detail_eng.aspx?id=2084&mag_id=119).
  O estrato II, na Baixa Galileia, é datado entre o século I a.C. e o I d.C.
  Os contextos L113/L110 contêm ossos de ovinos/caprinos, bovinos e galinhas junto
  a materiais romanos iniciais. Isso sustenta presença regional; não demonstra
  quais animais havia em cada rua de Cafarnaum.
- **Contexto anterior da criação de galinhas:** [Perry-Gal et al., PNAS,
  2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4538678/).
  O estudo zooarqueológico de Maresha documenta exploração econômica de galinhas
  no Levante helenístico. Maresha não é Cafarnaum, e os dados não devem ser usados
  como contagem da vila do jogo.
- **Peixes nativos do lago:** [Zohar et al., PLOS ONE,
  2018](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0198747),
  seção sobre a ictiofauna nativa e tabela 1, incluindo *Sarotherodon galilaeus*.
  A escavação estudada é Ohalo II, do Paleolítico; a descrição ecológica informa
  a plausibilidade regional, não a distribuição exata das espécies no século I.
- **Burros no contexto textual:** Lucas 13:15 e Marcos 11:1–7 são referências
  bíblicas pertinentes. Conferir qualquer citação literal na BLIVRE do projeto.
  Nesta pesquisa não foi estabelecida evidência zooarqueológica específica de
  burros no ponto de Cafarnaum representado no jogo. Texto bíblico e arqueologia
  permanecem categorias distintas de evidência.

Não inserir automaticamente espécies presentes em pacotes comerciais ou livres.
Koi, peixe-palhaço, piranha, betta e peixes de recife não passam a ser fauna local
por estarem disponíveis em GLB. O nome popular “peixe de São Pedro” também não
comprova a identificação de um peixe citado num episódio bíblico.

## Pesquisa externa preservada — rejeitada para o build

As três malhas terrestres investigadas têm publicação específica pelo perfil
Quaternius com licença **CC0 1.0**, distinta da licença MIT do código do jogo.
São referências de pesquisa preservadas, não assets aprovados para inclusão:

| Malha | Publicação original consultada | Formatos/animação anunciados |
|---|---|---|
| `chicken.glb` | [Chicken](https://poly.pizza/m/ineV9pU5VL) | FBX/glTF, animada |
| `sheep.glb` | [Sheep](https://poly.pizza/m/rgJXF570ZK) | FBX/glTF, animada |
| `donkey.glb` | [Animated Animal Pack](https://poly.pizza/bundle/Animated-Animal-Pack-ILAPXeUYiS) | Burro listado no pack; FBX/OBJ/glTF/Blend, animações |

O mirror de obtenção está fixado no commit
`f42095c120c29a892c0c221bdc8357ac982ccfca` de
[Vitexus/ishtaria-client](https://github.com/Vitexus/ishtaria-client/tree/f42095c120c29a892c0c221bdc8357ac982ccfca/assets/quaternius).
Os arquivos investigados pertencem a `farm-animals/Models/` (galinha e ovelha) e
`animated-animal-pack/Models/` (burro). Os respectivos `License.txt` identificam
Quaternius, CC0 e as páginas de origem. O mirror é um meio de distribuição;
a confirmação da licença também foi feita nas páginas específicas do autor.

Há uma diferença relevante no catálogo: a [licença geral atual do
Quaternius](https://quaternius.com/license.html), QAL v1.0 de 28/08/2026, restringe
a redistribuição avulsa. As publicações específicas acima continuam indicando
CC0 e são anteriores. Preservar sua evidência, os avisos de origem e os hashes
dos bytes obtidos; não estender a classificação CC0 a novos packs por analogia.

O ensaio técnico considerou conversão de paletas para cores de vértice e retenção
de clipes de repouso, caminhada e alimentação. Isso não corrigiu a inadequação
estética apontada por Alex; não é o plano de entrega vigente. Preservar fontes,
derivados de investigação e metadados fora do build, sem apresentá-los como
malhas profissionais prontas.

Para qualquer futura malha própria aprovada:

- Preservar a fonte e seu hash; registrar hash, bytes, triângulos e clipes do
  derivado no catálogo/relatório de preparação.
- Preservar detalhes anatômicos e texturas realistas; uma simplificação técnica
  não pode descaracterizar a aparência aprovada. Usar materiais não metálicos
  adequados a pelagem, penas e escamas, com conferência sob a luz real do jogo.
- Manter somente os clipes necessários de repouso, caminhada e alimentação
  (`idle`, `walk`, `eat`), quando existirem no arquivo daquela espécie. Não
  registrar um clipe como disponível sem inspecionar o GLB correspondente.
- Manter o esqueleto vinculado à malha durante transformação, clonagem e animação.
  Licença confirmada não comprova orientação, escala, deformação ou desempenho.

A página dos packs anuncia animações; contagens reais de triângulos, materiais,
texturas e clipes precisam ser obtidas dos arquivos. Este documento não atribui
métricas de outra malha aos derivados utilizados.

## Direção das referências próprias

O rascunho de peixe simplificado também não é uma entrega aprovada. Uma futura
malha própria pode usar *Sarotherodon galilaeus* como referência anatômica, com
corpo oval comprimido lateralmente, dorsal extensa, cauda em leque e cores
naturais discretas. A representação não deve ganhar identificação científica
garantida sem validação; tampouco é reconstrução de um indivíduo antigo.

Foi gerada uma referência visual própria de **burro doméstico adulto**,
aparência natural do Levante, pelo curto cinza-acastanhado, orelhas
longas e proporções realistas. Corpo inteiro em vista de três quartos, quatro
pernas distinguíveis, pose tranquila e fundo cinza neutro, sem acessórios ou
elementos de cenário. É material para image-to-3D no Tripo, não uma malha, prova
de rig ou evidência de qualidade no navegador. Não há raça histórica específica
comprovada para esse conceito.

Três referências originais foram geradas com o recurso integrado `image_gen`,
sem API do Tripo, e inspecionadas visualmente. Estão no acervo local de assets,
em `02-Referencias/Fauna-R4/` do projeto `GRAND-TESTAMENT-ASSETS-R1-20261112`:

- `burro-adulto-realista-R1.png`: corpo inteiro, quatro pernas separadas,
  sem arreios, chão ou cenário.
- `galinha-adulta-realista-R1.png`: adulta, penas castanhas, asas recolhidas,
  dois pés distinguíveis, sem acessórios ou cenário.
- `peixe-ciclideo-realista-R1.png`: perfil prateado-oliva, nadadeiras e cauda
  visíveis; inspiração morfológica, sem identificação taxonômica garantida.

Cada imagem tem seu prompt integral em um arquivo irmão `-prompt.txt`. São
conceitos para image-to-3D, externos ao build. Nenhuma dessas imagens é uma
malha gerada, rigada, animada ou validada em Three.js.

O movimento pode usar oscilação gradual de corpo e cauda e deslocamento do grupo.
Manter o volume inteiro abaixo da superfície e acima do fundo, conferindo também
as nadadeiras, não somente o centro do objeto. Proximidade, transparência da água
e contraste devem permitir vê-los sem transformá-los em objetos luminosos.

## Pendências e critérios de verificação

- Nenhuma das malhas externas investigadas integra o lote aprovado. Cabe à
  integração verificar que arquivos, imports e carregamento rejeitados ficaram
  fora do build; alterar apenas esta documentação não comprova essa remoção.
- Faltam malhas próprias de galinha, burro, ovelha, cabra e peixe com acabamento
  visual aprovado, escala conferida e rig/animações adequados quando necessários.
- Fotorrealismo e acabamento profissional compatível com a imagem-alvo ainda
  não estão demonstrados. Uma imagem gerada não comprova qualidade da futura
  malha, textura, rig ou resultado no jogo.
- Simulação: verificar determinismo, solo/água, limites, obstáculos, pausa e
  ausência de posições inválidas. Conferir sobreposição entre animais e relação
  entre direção do deslocamento e direção da animação.
- Navegador: verificar carregamento dos arquivos reais, escala, pés no chão,
  clipes, peixe abaixo da água, enquadramento e integração com luz/sombra.
- Benchmark de fauna própria: pendente de um lote aprovado e de execução e
  registro pelo responsável pela integração.
  Medir FPS/tempo de quadro e bytes transferidos em 1280×800 e 390×844; viewport
  móvel no PC não equivale a telefone físico. Comparar com a mesma rota/câmera
  da revisão anterior. Não usar resultados R3 como prova da nova fauna.

Nenhuma estimativa de desempenho ou captura conceitual substitui esses testes.
