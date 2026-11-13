# Nature recordings — R8

These five recordings are **CC0 1.0**, separately from the game's code, Bible
texts, terrain and models. Modern field recordings support an artistic scene;
they do not document the historical soundscape of Galilee.

- `donkey.mp3`: [felix.blume — A donkey is braying in his enclosure, in south of France](https://freesound.org/people/felix.blume/sounds/157763/).
- `chicken.mp3`: [D4XX — Chicken](https://freesound.org/people/D4XX/sounds/607245/).
- `sheep.mp3`: [zachrau — Sheep bleating](https://freesound.org/people/zachrau/sounds/362283/).
- `birds.mp3`: [JKata — Sparrows.wav](https://freesound.org/people/JKata/sounds/626174/).
- `lake.mp3`: [laughatlantic — Water lapping on lake Pukaki](https://freesound.org/people/laughatlantic/sounds/528067/).

License: <https://creativecommons.org/publicdomain/zero/1.0/>.

Derived from the public HQ MP3 player previews, not the original WAV masters.
Conversion: mono, 24 kHz, 64 kbps MP3; fixed attenuation where needed and short
edge fades. No amplification or automatic normalization. Exact source URLs,
retrieval times, original/derivative SHA-256, processing and technical evidence
are recorded per asset in [SOURCES.json](./SOURCES.json).

The initial integration uses birds near actual tree placements and water near
the mapped shoreline. Animal calls remain dormant until corresponding approved
models are present and passed to the audio renderer. Sources load lazily after
the player starts. These are fading, spaced one-shots, not seamless loops.

Complete decoding, finite samples, byte budget and headroom were checked on CPU.
Listening, perceptual quality and the in-game mix still require validation;
technical measurements alone do not establish those qualities.
