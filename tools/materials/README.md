# Materiais CC0 do solo — R13

Fontes e licença fixadas em `sources-r13.json`. Script Node + Sharp 0.35.5 já presente no lockfile; não usa GPU ou IA. Seis PNGs Poly Haven de 1K geram dois perfis (512/1024), quatro texturas por perfil. Normal OpenGL RGB + roughness A em WebP lossless; albedo WebP qualidade 92.

```powershell
node tools/materials/prepare_ground_r13.mjs --source-dir D:/minha-pasta/fontes --download --output-dir shots/reproducao-solo --catalog-path shots/reproducao-solo/catalog.json
```

`--download` é opcional, apenas para fontes ausentes. SHA/tamanho obrigatórios e arquivos divergentes nunca são sobrescritos. `--output-dir` omitido aponta a `public/textures/ground/r13`; `--catalog-path` é opcional, explicitamente separado para não alterar runtime durante reexport de QA.

R13 original reproduzido com 8/8 WebPs + manifesto idênticos. Dependências nativas/versões diferentes precisam conferir SHA de saída, não presumir equivalência. Licença de assets: [CC0 Poly Haven](https://polyhaven.com/license). Autores, limites, orçamento e integração: `docs/SOLO-R13.md`.
