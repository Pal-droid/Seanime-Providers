<h1 align="center">Seanime Providers</h1>

<p align="center">
  <img src="https://img.shields.io/github/last-commit/Pal-droid/Seanime-Providers?logo=git&logoColor=white&labelColor=2d3748&color=805ad5&style=for-the-badge" />
  <img src="https://img.shields.io/github/license/Pal-droid/Seanime-Providers?style=for-the-badge" />
  <img src="https://img.shields.io/website?url=https://pal-droid.github.io/Seanime-Providers/&label=Deployment" />
</p>

<p align="center">
This repository contains custom <strong><a href="https://github.com/5rahim/seanime">Seanime</a></strong> extensions for adding support to various manga and anime sources.
</p>

<blockquote align="center">
  <em>Plugins are also available.</em>
</blockquote>

<h3 align="center">Powered by:</h3>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" />
</p>

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

<img src="https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/main/public/first_step.jpg"></img>

3. Select **Add extensions**.

<img src="https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/main/public/second_step.jpg"></img>


4. Paste the **raw GitHub URL** of the desired `manifest.json` file, for example:

```
https://raw.githubusercontent.com/pal-droid/seanime-providers/main/src/manga/scanita/manifest.json
```

<img src="https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/main/public/last_step.jpg"></img>


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

* [kRYstall9](https://github.com/kRYstall9) *(For the source code of [MangaWorldAdult](https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/main/src/manga/MangaWorldAdult/manifest.json), [HentaiWorld](https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/main/src/anime/hentaiworld/manifest.json), and [HentaiSaturn](https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/main/src/anime/hentaisaturn/manifest.json))*

* [SyntaxSama](https://github.com/syntaxsama) *(For the source code of the visual marketplace)*

* [Dantotsu](https://discord.gg/MSJvfJzS7R) *(The Anilist activity plugin is inspired by Dantotsu's stories.)*
