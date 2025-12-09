# Seanime Extensions

![Last Commit](https://img.shields.io/github/last-commit/Pal-droid/Seanime-Providers?logo=git&logoColor=white&labelColor=2d3748&color=805ad5&style=for-the-badge)

This repository contains custom **[Seanime](https://github.com/5rahim/seanime)** extensions for adding support to various manga and anime sources.

> *Plugins are also available.*

## Repository Structure

```
src/
├── anime/
│   └── (empty for now)
└── manga/
    ├── mangafreak/
    │   ├── provider.js
    │   ├── README.md
    │   ├── manga-provider.d.ts
    │   └── manifest.json
    └── scanita/
        ├── provider.js
        ├── ....
         ...
```

Each folder represents a standalone Seanime extension provider.

---

## Installation

1. Open Seanime.  
2. Go to the **Extensions** tab.  
3. Select **Add extensions**.  
4. Paste the **raw GitHub URL** of the desired `manifest.json` file, for example:

```
https://raw.githubusercontent.com/pal-droid/seanime-providers/main/src/manga/scanita/manifest.json
```

5. Seanime will automatically fetch and register the provider.

---

## Where do i find the manifest URL's?


[Click here](https://pal-droid.github.io/Seanime-Providers/) to visit the extensions Marketplace

Or

[Click here to see full list of extensions and extension marketplace README](https://github.com/Pal-droid/Seanime-Providers/tree/main/marketplace/README.md)

---

### Want to suggest more providers?

[Open an issue](https://github.com/Pal-droid/Seanime-Providers/issues/new?template=provider_request.yml)

Or 

**[Hit me up on discord!](https://discord.gg/gWaY3t5m)**


---

### Credits ❤️

* [Seanime](https://github.com/5rahim/seanime) made by [5rahim](https://github.com/5rahim)

* [Seanime docs](https://seanime.app/docs)

* [Seanime official site](https://seanime.app/)

* [Seanime extensions docs](https://seanime.gitbook.io/seanime-extensions)

* [kRYstall9](https://github.com/kRYstall9) *(For the source code of [MangaWorldAdult](https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/main/src/manga/MangaWorldAdult/manifest.json), [HentaiWorld](https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/main/src/anime/hentaiworld/manifest.json), and [HentaiSaturn](https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/main/src/anime/hentaisaturn/manifest.json))*
* [SyntaxSama](https://github.com/syntaxsama) *(For the source code of the visual marketplace)*
