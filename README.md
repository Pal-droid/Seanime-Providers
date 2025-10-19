# Seanime Extensions

This repository contains custom **Seanime** extensions for adding support to various manga and anime sources.

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