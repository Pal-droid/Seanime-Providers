# Seanime Extensions

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
3. Select **Add from URL**.  
4. Paste the **raw GitHub URL** of the desired `manifest.json` file, for example:

```
https://raw.githubusercontent.com/pal-droid/seanime-providers/main/src/manga/scanita/manifest.json
```

5. Seanime will automatically fetch and register the provider.

---

## Where do i find the manifest URL's?

[Click here for anime extensions](https://github.com/Pal-droid/Seanime-Providers/tree/main/src/anime)

[Click here for manga extensions](https://github.com/Pal-droid/Seanime-Providers/tree/main/src/manga)

[Click here for plugins](https://github.com/Pal-droid/Seanime-Providers/tree/main/src/plugins)

[Click here for custom sources](https://github.com/Pal-droid/Seanime-Providers/tree/main/src/Custom%20source)

Or

[Click here to see full list of extensions and extension marketplace](https://github.com/Pal-droid/Seanime-Providers/tree/main/marketplace)

---

### Want to suggest more providers?

[Open an issue](https://github.com/Pal-droid/Seanime-Providers/issues/new)

Or 

**[Hit me up on discord!](https://discord.gg/gWaY3t5m)**


---

### Credits

* [Seanime](https://github.com/5rahim/seanime) made by [5rahim](https://github.com/5rahim)

* [Seanime docs](https://seanime.app/docs)

* [Seanime official site](https://seanime.app/)

* [Seanime extension docs](https://seanime.gitbook.io/seanime-extensions)
