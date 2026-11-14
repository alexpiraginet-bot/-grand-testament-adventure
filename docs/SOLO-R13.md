# Solo R13 — terra compactada e areia com materiais próprios

Data: 13/11/2026. Responsável: Codex, agente `r7_visual_audit`. Implementação local; aprovação visual no navegador é uma etapa da integração, não consequência dos testes CPU abaixo.

## Mudança

`src/ground-surface.ts` preserva os caminhos, alturas e cascalho Rocky Gravel da R10. Acrescenta duas superfícies fotográficas independentes: terra compactada no caminho e areia fina na margem. Cor, normal e rugosidade mudam de material; não se trata de recolorir o mesmo cascalho.

- [Dirt](https://polyhaven.com/a/dirt), Charlotte Baglioni: terra compactada com grãos/pedrinhas. Página e API oficiais conferidas; escala publicada de 2 m.
- [Damp Beach Sand](https://polyhaven.com/a/damp_beach_sand), Dimitrios Savva: areia de grão fino. [Metadados oficiais](https://api.polyhaven.com/info/damp_beach_sand) e [arquivos oficiais](https://api.polyhaven.com/files/damp_beach_sand) conferidos. A página HTML não respondeu ao navegador de pesquisa; a API e os seis downloads PNG responderam e foram validados. O tile empregado mede 2 m.
- A [licença de assets da Poly Haven](https://polyhaven.com/license) é CC0. As fontes são referências materiais contemporâneas; não são escaneamentos de Cafarnaum nem prova arqueológica.

Foram inspecionados os albedos completos e as prévias das alternativas em CPU. Sand 02/03 apresentavam marcas de pisadas mais salientes; foi escolhida Damp Beach Sand para uma margem menos marcada. Não houve geração por IA, alteração de matiz/exposição das imagens, compra, conta ou API paga.

A transição usa as mesmas máscaras contínuas de distância ao caminho e altura sobre o lago. Terra/areia recebem seu albedo fotográfico sem a segunda coloração saturada dos vértices; cascalho e fallback mantêm a cor de bioma. Os vetores normais são combinados em espaço tangente e normalizados pelo `NormalMapNode` do three 0.186.1. Nada desloca a geometria, muda o DEM ou acrescenta draw calls.

## Arquivos e orçamento

| Perfil | Novos mapas por dispositivo | Download adicional | Memória RGBA8 com mipmaps, estimada |
|---|---:|---:|---:|
| Celular | 4 × 512² | 1.002.972 bytes | 5,33 MiB |
| PC | 4 × 1024² | 4.786.294 bytes | 21,33 MiB |

São oito arquivos distribuídos, **5.789.266 bytes** ao todo; cada aparelho baixa somente quatro. O manifesto público tem mais 7.045 bytes. Estimativa de memória = quatro texturas × resolução² × 4 bytes × 4/3; não é leitura da VRAM, não inclui os três mapas legados, buffers de decodificação ou o restante do jogo.

Cada material tem albedo WebP qualidade 92 e um WebP **lossless** com normal OpenGL em RGB e roughness no canal A. A não significa opacidade: carregamento sem premultiplicação e sem conversão sRGB nos dados. Normais são renormalizadas depois da redução; zero roughness teria piso 1/255 para preservar RGB no codec, mas **nenhum pixel destas fontes precisou desse piso**. O shader mantém roughness em faixas artísticas de solo seco/úmido; não simula poças.

O material completo usa sete texturas únicas e oito amostras: os três mapas de cascalho existentes, quatro novos e a segunda leitura macro do albedo antigo. Não há nova passagem, malha ou atualização CPU por quadro. Os três mapas 2K legados continuam como estavam; esta revisão não representa sua otimização. A repetição dos tiles ainda existe e deve ser julgada caminhando e em vistas amplas.

Proveniência e todos os SHA-256:

- `tools/materials/sources-r13.json`: seis fontes PNG, URLs oficiais, MD5 do provedor, SHA-256, autores e licença.
- `public/textures/ground/r13/manifest.json`: fontes + oito derivados, bytes, SHA-256, canais e perfis.
- `src/data/ground-materials-r13.json`: catálogo idêntico incorporado ao código; testado contra o manifesto público.
- Fonte bruta local preservada: `D:/BentoLabs/90-Trabalho-temporario/gta-r13-material-sources`. Prévias da pesquisa não integram o jogo nem a redistribuição pública.

## Contrato de integração

```ts
import {loadGroundMaterialsR13, GROUND_MATERIAL_CREDITS_R13} from './ground-materials.ts';
const additional = await loadGroundMaterialsR13({mobile, signal, base:import.meta.env.BASE_URL});
const maps = {...baseMaps, ...additional};
// createGroundSurface(maps, routes); fundações continuam recebendo os três mapas base.
```

Retorno flat: `dirtAlbedo`, `dirtNormalRoughness`, `sandAlbedo`, `sandNormalRoughness`. A posse pertence ao carregador/chamador; o material não libera texturas compartilhadas. `Texture.dispose()` também fecha sua imagem. `Object.values(maps)` continua útil à limpeza já existente.

Carga sequencial, limite total interno de 20 s, sinal externo, bytes/SHA/dimensões conferidos antes de upload. Falha em qualquer arquivo libera os já carregados e rejeita; bitmap que termine depois do cancelamento é fechado. Cabe à integração decidir fallback ou erro terminal. O shader aceita ausência de um par inteiro e retoma o material anterior; um albedo isolado nunca é apresentado como PBR novo. `GROUND_MATERIAL_CREDITS_R13` exporta nomes/autores/URLs para créditos da UI.

`material.userData.groundSurface` registra revisão, materiais ativos, tile, contagem e bytes adicionais reais conhecidos no carregador. `vertexColorMode` explicita que, na R13, a cor dos vértices é aplicada só ao cascalho/fallback. A contagem de amostras é do grafo, não medição de tempo de GPU.

## Reprodução e verificação

Com dependências do lockfile (Sharp 0.35.5), sem instalar nada novo:

```powershell
node tools/materials/prepare_ground_r13.mjs --source-dir D:/BentoLabs/90-Trabalho-temporario/gta-r13-material-sources --output-dir shots/r13-material-reproduction --catalog-path shots/r13-material-reproduction/catalog.json
node --test test/ground-surface.test.ts test/ground-materials.test.ts
node node_modules/typescript/bin/tsc --noEmit --pretty false
```

Para máquina sem fonte, acrescentar `--download` com uma pasta bruta vazia. O script usa somente URLs oficiais fixadas, exige hash/tamanho e recusa sobrescrever arquivo divergente. O diretório de saída é parametrizado. O catálogo de runtime só é escrito se `--catalog-path` for fornecido; uma reprodução em pasta de QA não modifica a fonte final.

Executado nesta revisão: **12/12 testes focados passaram** e typecheck completo sem erros. Testes decodificam os oito arquivos reais, conferem SHA/bytes/canais/normalização/orçamento, validam seleção de perfil, ordem serial, timeout, limpeza em erro, bitmap tardio, propriedade compartilhada, continuidade e independência dos mapas de cor/normal/roughness.

Reexportei numa pasta nova: **8/8 WebPs e manifesto idênticos byte a byte** aos arquivos de runtime. Registro local: `shots/r13-material-reproduction/comparison.json`. SHA-256 do manifesto: `f7fa93bf636b087311118c02cd9790bbc9ab0cec7efb1b24fc52069a96bce1fd`.

Nesta tarefa não houve renderer, GPU, teste físico de iPhone, deploy ou promessa de ganho de FPS. WebGL2/WebGPU, alpha dos mapas empacotados em Safari, aparência sob iluminação real e custo por quadro exigem os testes de integração coordenados pelo agente principal. Os testes CPU não equivalem a essa aprovação.

## Ajuste após a primeira captura integrada

Na revisão visual CPU de `shots/r13-integrated-wip-r1/desktop-fixed/start.png`, o cascalho legado das laterais ainda parecia uma cobertura dourada muito contrastante com a trilha. O albedo Dirt foi estendido à base seca até 24 m da borda da rota, com transição irregular até 42 m. No núcleo não aparece o albedo dourado antigo. As laterais recebem 90% do brilho da terra e 88% do normal de terra + 12% do normal de cascalho, com rugosidade menos compactada; a trilha preserva seu relevo e as máscaras originais. Areia e umidade não mudaram. Só o terreno distante mantém a coloração de bioma e cascalho legados.

Não acrescenta textura, amostra, geometria ou download. **13/13 testes focados** e typecheck passaram após esse ajuste, incluindo continuidade da faixa ampliada, ausência de terra nova fora de rotas e prioridade da areia. A nova aparência ainda precisa da captura integrada posterior; o screenshot anterior documenta o problema, não o resultado do ajuste.
