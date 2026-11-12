# Grand Testament Adventure em alto nível

Referência visual final (Alex, 12/11/2026): `assets-src/referencias/conceito-visual-01.png` (fora do git; SHA-256
`ea81dd752e8342e9737f62bcc65d21128ac625811fb26ad9e50021dbe859bee6`). É um conceito de imagem gerada, marcado
"CONCEITO VISUAL": serve de alvo, não é captura do jogo.

## Duas versões, os mesmos dados

| | Link direto (web) | PC alto nível (nativo) |
|---|---|---|
| Para quem | qualquer celular ou computador, sem instalar | o PC do projeto com a RTX 5060 (e quem tiver RTX 50) |
| Motor | three.js (WebGPU, ou WebGL 2) | **Unreal Engine 5** (proposta) |
| DLSS | **não existe no navegador** | DLSS (Super Resolution e Frame Generation; o 5 conforme a NVIDIA liberar para o motor) |
| Visual | o mais perto da referência que o aparelho aguenta | a referência |
| Mundo, missões, textos, save | os mesmos arquivos | os mesmos arquivos, via `tools/export_engine.py` |

O DLSS é da NVIDIA para jogos nativos (DirectX 12 ou Vulkan com o SDK dela). Uma página web não tem acesso a ele: nem
WebGPU nem WebGL expõem esse recurso. Por isso o "rodar com DLSS 5 na 5060" pede uma versão nativa. O link direto
continua sendo o jogo que todo mundo abre.

Fatos conferidos (12/11/2026):
- O DLSS 5 foi anunciado no GTC 2026 como renderização neural que acrescenta iluminação e materiais fotorrealistas
  (página da NVIDIA). Lançou em 3/9/2026 com o NBA 2K27 e exige GeForce RTX série 50, de mesa ou notebook (Club386).
- A RTX 5060 tem 8 GB de VRAM (fichas técnicas).
- Não conferido: se já existe plugin de DLSS 5 para o Unreal Engine e o que o jogo precisa entregar ao modelo. Antes
  de prometer o DLSS 5 nesta versão, conferir no site de desenvolvedores da NVIDIA (DLSS / Streamline) e no plugin
  para Unreal.

## O que o PC alto nível herda daqui

`python3 -I tools/export_engine.py` gera `export/engine/`:
- `heightmap_1009.png`: relevo real em 16 bits, pronto para importar como Landscape. Escala, posição e eixos estão em
  `landscape.json` (X = leste, Y = sul, Z = cima; a superfície do lago é Z = 0; 3,05 m por ponto; escala Z 100).
- `watermask_1009.png`: onde o chão fica abaixo da superfície do lago.
- `episodes.json`: missões, falas literais da BLIVRE, nomes, a prova do contador e todos os pontos em centímetros
  do Unreal.
- `save-contract.json`: o formato do save e as duas funções da nuvem. **O mesmo código de recuperação continua o jogo
  no celular e no PC.**

As malhas do Tripo (`ASSETS.md`) entram no Unreal como glTF. Por serem do Alex, ficam fora do repositório público
também nessa versão.

O projeto Unreal não pode ser feito neste ambiente (Linux na nuvem, sem placa de vídeo). Ele nasce na máquina com a
RTX 5060, numa pasta própria, e lê `export/engine/`.

## A referência, peça por peça

| Na imagem | No jogo hoje | O que falta | Quem |
|---|---|---|---|
| Jesus de costas: túnica, manto terracota no ombro esquerdo, sandálias, cabelo ondulado | malha de teste do Tripo com esqueleto provisório | malha de produção, rigada, com andar natural | Codex (malha), Claude (integração) |
| Água limpa com fundo de pedras e cáusticas, espuma fina na margem | plano com reflexo simples | água rasa com transparência, cáusticas e linha de espuma; no PC, reflexo e refração de verdade | Codex (visual), Claude (código) |
| Praia estreita de areia e cascalho entre a água e as casas | **praia larga**: o relevo do SRTM, de 2000, mostra o lago baixo (−213 m) e uma faixa plana de ~300 m | decidir com fonte (ver abaixo) | Alex |
| Casas de pedra clara com portas de madeira, pérgulas de varas, muros de pedra seca em terraços | caixas cinzas | casas de basalto, pérgula, muro em módulos | Codex (malhas 11–13, 17 do `TRIPO.md` + pérgula) |
| Jarros de barro, cestos, cordas, redes penduradas | não há | objetos 21–22 do `TRIPO.md`, rede pendurada | Codex |
| Barco a remo amarrado num poste, píer de madeira com redes secando, barco com dois homens ao fundo | barco de caixa | barco 6, píer e poste (novos) | Codex |
| Pescadores consertando rede na margem | formas simples | pescadores 2–5 rigados | Codex |
| Oliveiras, ciprestes, juncos, arbustos | bolinhas e cones | 14–15, 18–20 e cipreste (novo) | Codex |
| Colinas com vegetação, cidade ao longe, céu com nuvens | horizonte do relevo real, céu em degradê | nuvens, distância com névoa de altura, vilarejos ao longe | Claude (céu), Codex (vilarejo) |
| Sol forte com sombras recortadas e luz rebatida | sol, uma sombra, céu ambiente | no PC, iluminação global (Lumen) e sombras virtuais; na web, sombras em cascata e oclusão de ambiente | por versão |
| HUD: linha de missão, distância, discípulos, radar, joystick e botão de mão | igual, menos o joystick fixo e o ícone de mão | joystick sempre visível no celular e botão de ação com ícone de mão (desenho próprio, sem emoji) | Claude |

Itens novos para a ficha do Tripo: pérgula de varas, píer de madeira com postes, poste de amarra, rede pendurada,
cipreste.

## A praia: não mexer no relevo para parecer a imagem

A referência põe as casas quase na água. Os dados de elevação mostram outra coisa em Cafarnaum: uma faixa plana
larga, porque o lago estava baixo quando o SRTM foi medido (2000). Saídas honestas:
1. **Nível do lago com fonte:** subir a água para o nível de uma referência publicada para o século I. Isso só entra
   com a fonte citada no jogo e nos créditos.
2. **Manter o dado e construir em cima dele:** o povoado avança sobre a faixa plana (casas, terraços, píer), como
   recriação marcada.
3. **Mudar o ponto da cena** para um trecho em que a margem já é estreita nos dados, se houver um perto de
   Cafarnaum.

O que não entra: inventar um número para o nível do lago ou rebaixar o terreno à mão sem dizer.

## Ordem de trabalho proposta

1. Malhas de produção (Codex): herói rigado, depois pescadores e barco, depois casas e objetos.
2. Na web: água rasa, céu com nuvens, HUD do celular igual ao da referência e a integração das malhas rigadas
   (`AnimationMixer`).
3. Decisão da praia (Alex).
4. Projeto Unreal na máquina da RTX 5060, importando `export/engine/` e as malhas, com DLSS e medição de FPS.
