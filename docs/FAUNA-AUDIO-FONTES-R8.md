# Fauna e margem — fontes de áudio R8

Pesquisa de Codex em 13/11/2026, para a revisão iniciada sobre `c664f9f`.
**Cinco gravações reais baixadas e decodificadas; integração verificada no Chrome,
com mixagem perceptual ainda sem aprovação por escuta.** Não são sons sintetizados nem uma reconstrução sonora
documental da Galileia do século I. As identificações abaixo são declarações dos
gravadores, não uma perícia taxonômica.

## Arquivos locais e origem

Pasta: `assets-src/fauna-audio-r8/`, ignorada pelo Git. Os cinco MP3 são os
**previews HQ públicos do player do Freesound**, obtidos sem conta, autenticação,
API ou compra. Não chamar esses arquivos de masters WAV. As páginas de cada
gravador declaram **CC0 1.0**; licença, URLs exatas do CDN, data UTC, tamanho,
SHA-256 e evidência HTML ficam em `sources.json` e `evidence/`.

| Uso proposto | Fonte primária / autor | Arquivo em `previews/` | Duração decodificada | Bytes |
|---|---|---|---:|---:|
| Chamado de burro, pontual | [A donkey is braying… — felix.blume](https://freesound.org/people/felix.blume/sounds/157763/) | `donkey-157763-hq.mp3` | 22,384 s | 505.248 |
| Cacarejo curto de galinha | [Chicken — D4XX](https://freesound.org/people/D4XX/sounds/607245/) | `chicken-607245-hq.mp3` | 1,920 s | 47.982 |
| Balidos de ovinos | [Sheep bleating — zachrau](https://freesound.org/people/zachrau/sounds/362283/) | `sheep-362283-hq.mp3` | 15,527 s | 364.848 |
| Pássaros discretos na vegetação | [Sparrows.wav — JKata](https://freesound.org/people/JKata/sounds/626174/) | `sparrows-626174-hq.mp3` | 21,000 s | 390.624 |
| Água batendo na margem do lago | [Water lapping on lake Pukaki… — laughatlantic](https://freesound.org/people/laughatlantic/sounds/528067/) | `lake-water-528067-hq.mp3` | 22,605 s | 565.048 |

Total dos cinco arquivos: **1.873.750 bytes**. São arquivos MP3 locais; o jogo não
deve depender do CDN externo para reproduzi-los. O significado de “HQ” aqui é o
nome do derivado do Freesound, não um selo nosso de acabamento aprovado.

Todos apontam para [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
Mesmo sem obrigatoriedade de atribuição declarada no CC0, preservar autoria e
link por transparência. Essa licença dos sons é separada da licença do código,
dos dados bíblicos e das malhas.

## Identificação e adequação

- **Burro:** o gravador identifica o próprio animal, Balthazar, em Minervois,
  França, gravado em 2012 com Schoeps CCM41/CCM8 e Sound Devices 744T. O
  [registro correspondente no Wikimedia Commons](https://commons.wikimedia.org/wiki/File:157763_felix-blume_a-donkey-is-braying-in-his-enclosure-in-south-of-france.wav)
  confirma autoria e CC0 e disponibiliza também o WAV original. Esse WAV não
  foi baixado neste lote. O registro moderno não prova raça antiga ou presença
  daquele indivíduo na Galileia. Usar raramente, em fonte espacial pontual.
- **Galinha:** o autor identifica uma galinha; não informa raça, local ou idade.
  O clipe curto serve como candidato para chamada individual, sem loop contínuo.
- **Ovelhas:** a fonte descreve ovinos numa fazenda em Letschin, Alemanha,
  gravados com FlashMic. Não usar a gravação para representar cabra. Recortar
  balidos isolados somente depois de ouvir e confirmar limites naturais.
- **Pardais:** identificação popular do autor; espécie exata e região não
  documentadas. Não rotular o arquivo como registro de uma espécie histórica de
  Cafarnaum. É candidato de ambiência, sujeito a escuta de ruídos modernos.
- **Água:** o registro é do lago Pukaki, Nova Zelândia. É referência de pequena
  ondulação de água doce, não uma gravação do Mar da Galileia. Não representa
  arrebentação oceânica. Loop/crossfade sem emenda audível ainda precisa de edição.

**Cabra — pesquisada, fora dos cinco downloads:**
[Goat bleating — papimre](https://freesound.org/people/papimre/sounds/842964/),
CC0, 45,295 s anunciados, cabrito segundo o próprio gravador, captado com
telefone e convertido para WAV mono. É uma reserva para audição; não atribuir a
uma cabra adulta nem afirmar qualidade profissional sem ouvir. O candidato
[GOAT - 1 — SamuelGremaud](https://freesound.org/people/SamuelGremaud/sounds/411815/)
também é CC0, 88,037 s, com Zoom H4NSP e proteção de vento, mas igualmente de
animal jovem. Nenhum dos dois foi baixado, decodificado ou integrado neste lote.

Foram excluídos candidatos descritos como imitação humana de galinha; sons com
falas, motores, avião, buzina ou metais modernos descritos pelo próprio autor;
e fontes fora de CC0/CC BY. Licença permissiva não torna uma gravação adequada
à cena, nem confirma ausência de ruído de fundo.

## Verificação técnica CPU

`check-audio.mjs` preserva cada MP3 e confere SHA-256 antes de analisar. Usa
ffprobe existente e FFmpeg existente, sem download de ferramentas. Decodifica
o arquivo inteiro em PCM float mono a 24 kHz; mede sinal, pico e RMS em janelas
de 250 ms. Resultados completos em `qa/summary.json` e arquivos por som.

| Arquivo | RMS mono dBFS | Pico mono dBFS | Decodificação | Limite observado |
|---|---:|---:|---|---|
| Burro | -20,129 | +0,510 | sem erro | 5 amostras >= 0,999 |
| Galinha | -17,774 | -2,474 | sem erro | sem amostras >= 0,999 |
| Ovelha | -16,597 | +1,870 | sem erro | 606 amostras >= 0,999 |
| Pardais | -42,122 | -21,332 | sem erro | sinal baixo; avaliar ruído antes de amplificar |
| Água | -30,848 | -1,062 | sem erro | transientes altos em relação ao RMS |

Todos têm amostras finitas, duração compatível com a fonte e sinal não vazio.
O pico acima de 0 dBFS aparece no PCM float decodificado de MP3 e exige ganho
abaixo da unidade antes de somar canais; não prova, sozinho, que o master
original estava clipado. Os números não são uma medição de loudness LUFS nem
prova de ausência de artefatos perceptuais. Não se aplicou normalização ou
limiter e não houve audição humana nesta pesquisa.

Próxima integração: ouvir cada arquivo inteiro; conferir ruído/fala moderna;
selecionar chamadas; converter fontes pontuais a mono com folga de pico;
balancear com voz e água. Disparar chamadas por distância e intervalos variáveis,
sem repetir todos os animais juntos. Pausa e botão de som devem parar a cena
sonora; no celular iniciar áudio somente após gesto do jogador. Não carregar
o lote inteiro antes de liberar a abertura. A conferência de mix, autoplay,
bytes reais de rede, pausa e Safari físico fica com a integração.

## Reprodução e diário

Pesquisa e obtenção sem navegador/GPU. `sources.json` contém a data UTC real de
cada download; `qa/summary.json`, a data da verificação. A etapa de pesquisa
criou somente a pasta ignorada de pesquisa e este documento; a integração
posteriormente autorizada está descrita abaixo. Sem modelo novo, deploy,
compra ou conta nesta subtarefa; sem custo novo informado.

```powershell
# Confere arquivos já obtidos; grava relatório novo e não sobrescreve QA anterior.
# Para repetir, adaptar a saída para outra revisão antes de executar.
node assets-src/fauna-audio-r8/check-audio.mjs
```

Os scripts usam escrita exclusiva para preservar evidências existentes. O
script de obtenção igualmente não sobrescreve arquivos já baixados. Horas de
trabalho e tokens desta tarefa não foram medidos por um coletor próprio; não
inventar valores com base na duração dos sons ou nos horários de download.

## Derivados leves e integração posterior

Por delegação posterior do responsável pela revisão, os cinco candidatos têm
derivados em `public/audio/fauna/`, com manifesto público `SOURCES.json`.
Formato mono, 24 kHz, MP3 64 kbps; sem normalização automática e sem aumentar
o ganho de nenhum arquivo. Há fades de 30/100 ms nas bordas e atenuação fixa
de -6 dB (burro), -3 dB (galinha), -8 dB (ovinos), 0 dB (aves) e -4 dB (água).
Os originais de pesquisa permanecem intactos e com hashes conferidos.

- Cinco derivados: **670.464 bytes**; aves + água: **350.016 bytes**.
- Nova decodificação completa dos cinco: zero erro; pico máximo do conjunto
  **-5,378 dBFS**, medido no PCM decodificado. Não equivale a auditoria de true
  peak nem aprovação perceptual.
- `src/fauna-audio-manifest.ts` é o catálogo opcional. `src/main.ts` conecta
  o módulo ao **mesmo AudioContext** dos sons de interface após o botão inicial.
  Só aves e água têm emissores nesta etapa; a lista de animais audíveis é vazia.
- Emissores de aves derivam de posições reais dos três grupos de árvores
  produzidas por `props()`; água deriva da linha da margem do mapa perto das
  rotas. São decisões artísticas de posicionamento.
- O ruído sintetizado global de água foi retirado. Falha de áudio não bloqueia
  o início do jogo. O som opcional usa fila serial, cache limitado e chamadas
  com fade; pausas, menus e aba oculta interrompem as vozes.
- Botão de som usa a classe existente do HUD, `aria-pressed` e preferência
  local com tratamento de armazenamento indisponível. Gestos posteriores
  tentam retomar o contexto suspenso sem criar outro.
- `npm run typecheck` e os **10 testes CPU** do módulo passaram depois da
  integração. Quatro testes adicionais do grafo Sfx passaram em
  `test/audio.test.ts`: nenhuma alocação antes de iniciar,
  reuso do contexto, mute/pausa e falhas opcionais de áudio. O primeiro ensaio
  desse script teve um caminho de importação incorreto, corrigido antes da
  execução bem-sucedida; não foi falha do jogo.

## QA de navegador posterior — 13/11/2026

A etapa seguinte usou Playwright e navegadores reais neste PC Windows, um por
vez. Evidências em `shots/fauna-r8/SUMMARY.json`, relatórios JSON, capturas e
`final-build.log`. O build dessa medição passou **138 testes**; bundle
`index-DJkxPCvw.js`, SHA-256
`e272d9e45a844ea9049ce5519d5ce63c04047c763771b6f2bb9b3298344fa8c6`.
Esse hash identifica o código medido, não alterações feitas depois.

| Caso | Resultado registrado | Limite |
|---|---|---|
| Chrome desktop 1280 × 800 | 31 verificações; abertura pronta em 4.618 ms; cerca de 100 FPS | WebGPU neste PC; janela de 5 s |
| Chrome móvel 390 × 844 | 31 verificações; abertura pronta em 8.460 ms; cerca de 95,84 FPS | WebGL2, viewport/toque/UA de iPhone neste PC |
| Chrome móvel com áudio HTTP 404 | 15 verificações; uma tentativa, sem loop; jogo continua | Falha de rede introduzida pelo teste |
| WebKit Windows móvel | Abertura 14/14, zero assets falhos, botão Jogar realmente acionado | AudioContext e webkitAudioContext ausentes nesse runtime |

Os casos Chrome verificaram gesto inicial, fontes sonoras agendadas, buffers
decodificados, habitats de árvores/água, mute, preferência local, pausa nos
créditos/mapa/feedback e retomada após evento de visibilidade. O botão cabe no
viewport móvel. Apenas aves e água foram baixadas: **350.016 bytes** de MP3;
cache PCM observado: **8.372.088 bytes**. Sem download dos animais ainda sem
malhas aprovadas. Não houve exceção de página, crash ou HTTP inesperado nos
casos Chrome; a falha 404 intencional foi mantida no relatório, assim como o
aviso de depreciação do renderer.

O WebKit abriu o jogo e entrou no gameplay sem exceção ou HTTP falho, mas o
harness estrito de áudio parou esperando uma API ausente. Uma página mínima
separada confirmou a ausência de AudioContext, webkitAudioContext e
OfflineAudioContext. Logo, **áudio WebKit não foi aprovado**. Isso não comprova
falha nem sucesso no Safari de um iPhone físico. A tentativa inicial na porta
4190 foi recusada pelo WebKit por ser uma porta restrita; a repetição usou 4191,
sem contornar essa proteção.

O evento de aba oculta foi simulado via DOM e valida os handlers do aplicativo;
não reproduz suspensão pelo iOS, pressão de memória ou encerramento do processo.
FPS de cinco segundos não é um benchmark sustentado ou térmico. Não houve
audição perceptual, aprovação da mix nem aparelho físico nesta etapa.

### Ajuste posterior e nova verificação CPU

O QA identificou que a interface podia mostrar “Som ligado” em runtime sem
Web Audio. O responsável adicionou a detecção `Sfx.available` e o estado
“Som indisponível”. Depois desse ajuste, **17/17 testes CPU** de Sfx e fauna
passaram, junto de `npm run typecheck`; log
`shots/fauna-r8/audio-cpu-latest.log`. A indicação visual nova ainda precisa
de repetição no navegador. O harness será atualizado para registrar a ausência
da API como limitação explícita, sem chamar esse caso de áudio aprovado.

**Pendentes:** ouvir os arquivos e a mix, revalidar a integração de animais
aprovados, repetir o navegador após as alterações posteriores e testar
recuperação/estabilidade no Safari físico. Evidências anteriores foram
preservadas, inclusive tentativas com falha.
