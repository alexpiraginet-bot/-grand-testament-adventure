# Autoria reproduzível da fauna R8

Ferramentas de CPU para reproduzir as animações revisadas, preservando as fontes. Não geram modelos no Tripo, não acessam API e não publicam arquivos. Usam Node 24 e as dependências já travadas no projeto: Three.js, glTF Transform e Sharp. Execute na raiz do repositório após `npm ci`.

As fontes GLB são assets próprios de Alex, licenciados separadamente; obtenha acesso autorizado a elas. **Nenhuma malha ou imagem está nesta pasta nem fica sob a licença do código.** Os scripts são específicos dos rigs R8 observados, não um retargeter genérico.

```sh
node tools/fauna/author-chicken-walk.mjs --input assets-src/fauna-r8/sources/gta-fauna-galinha-r8-rig-walk.glb --output assets-src/fauna-repro/chicken --source-sha256 0eda48666418c7473e308a8667bac8a721dfc6abd7f2756a7c4b9a7d5fe7e1e6
node tools/fauna/author-donkey-walk.mjs --input assets-src/fauna-r8/sources/gta-fauna-burro-r8-detail-rig-walk.glb --output assets-src/fauna-repro/donkey --source-sha256 9d6723abfde81f027cc3d7dfc4ac1f9c4bcc06f07d12a99a285981bfbe508a41
```

`--input`, `--output` e `--source-sha256` são obrigatórios; caminhos relativos ou absolutos funcionam. O hash é conferido antes de criar arquivos. A saída precisa ser nova ou vazia: não há sobrescrita, limpeza automática ou alteração da fonte. Para repetir, escolha outra pasta. `assets-src/` é ignorada pelo Git.

Cada saída contém `qa/` com parâmetros/contato e `candidates/` com GLBs 2k, 1024 e 512, além de manifesto/hashes. Os relatórios têm horário/caminho locais, portanto não são idênticos byte a byte; os seis GLBs reproduziram exatamente os binários revisados no ambiente registrado em [REPRODUCIBILITY.json](REPRODUCIBILITY.json). Em outra plataforma/versão de encoder, revalidar hashes e visual antes de substituir assets.

| Asset | Variante | SHA-256 revisado |
| --- | --- | --- |
| Galinha | 1024 | `68acfac44214863cad4252a4bda4a94fed142eec9bef043ce8bf338f7ffd978d` |
| Galinha | 512 | `33c5201a20851cb50fe8a6577bb5c94691969aa1c8cf1055df2da04e04098eb0` |
| Burro | 1024 | `de6552cc3150efd81b75059bc95347d7a58c4bd54f54d683ff8a6121e42e034b` |
| Burro | 512 | `25bd1f401968c7dcbfef983854004b7b009a434e574fc90d434e0c0229b3ac02` |

Galinha: adiciona dois ossos de pé e redistribui suavemente seus pesos, mantendo a pose neutra; 0,45 m, frente −Z, caminhada 0,24 m/s. Burro: corrige a classificação das quatro cadeias sem alterar pesos/vértices; 1,30 m artístico, frente −Z, caminhada 0,38 m/s e idle com quatro apoios. A autoria interrompe se o contato falhar ou se houver alcance impossível; isso não substitui QA visual.

Limites: clips revisados em piso plano; ainda verificar terreno, curvas e aparelhos físicos. O blend walk/idle do burro pode penetrar até 6,23 mm transitoriamente. Não há IK de terreno. Os avisos glTF de tangentes em runtime e nó skinned sob ancestral estão documentados. Detalhes e evidências: [galinha](../../docs/QA-GALINHA-R8-BIRDWALK.md) e [burro](../../docs/QA-BURRO-R8-WALK.md).
