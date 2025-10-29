/// <reference path="./plugin.d.ts" />
/// <reference path="./system.d.ts" />
/// <reference path="./app.d.ts" />
/// <reference path="./core.d.ts" />

function init() {
  $ui.register(async (ctx) => {
    const currentMediaId = ctx.state<number | null>(null);
    const isNovel = ctx.state<boolean>(false);
    const novelData = ctx.state<{ slug: string, id: number } | null>(null);
    const chapters = ctx.state<{ href: string, title: string }[]>([]);
    const selectedChapterHref = ctx.fieldRef<string>("");
    const chapterContent = ctx.state<string>("");

    // Navigation listener
    ctx.screen.onNavigate((e) => {
      if (e.pathname === "/entry" && e.searchParams.id) {
        const id = parseInt(e.searchParams.id);
        currentMediaId.set(id);
      } else {
        currentMediaId.set(null);
        isNovel.set(false);
        chapters.set([]);
        chapterContent.set("");
        novelData.set(null);
      }
    });

    // Load current screen
    ctx.screen.loadCurrent();

    // Effect to load media and check if novel, then fetch data
    ctx.effect(async () => {
      const id = currentMediaId.get();
      if (!id) return;

      try {
        // Assuming getManga works for novels as well
        const media = $anilist.getManga(id);
        if (media.format === $app.AL_MediaFormat.NOVEL) {
          isNovel.set(true);

          // Search on NovelBuddy
          const searchQuery = encodeURIComponent(media.title.english || media.title.romaji || media.title.native);
          const searchUrl = `https://novelbuddy.com/search?q=${searchQuery}`;
          const searchRes = await ctx.fetch(searchUrl);
          const searchText = await searchRes.text();
          const $search = LoadDoc(searchText);

          const items = $search(".book-item");
          let foundSlug: string | undefined;
          let foundId: number | undefined;

          for (let i = 0; i < items.length; i++) {
            const item = $search(items[i]);
            const itemTitle = item.find(".title h3 a").text().trim().replace(/\s+/g, ' ').toLowerCase();
            const mediaTitleLower = (media.title.english || media.title.romaji || "").toLowerCase();

            if (itemTitle.includes(mediaTitleLower)) {
              const href = item.find(".thumb a").attr("href");
              if (href) {
                foundSlug = href.replace("/novel/", "");
              }

              if (foundSlug) {
                // Fetch novel page to get bookId
                const novelUrl = `https://novelbuddy.com/novel/${foundSlug}`;
                const novelRes = await ctx.fetch(novelUrl);
                const novelText = await novelRes.text();
                const idMatch = novelText.match(/var bookId = (\d+);/);
                if (idMatch) {
                  foundId = parseInt(idMatch[1]);
                }
              }
              if (foundId) break;
            }
          }

          if (!foundSlug || !foundId) {
            ctx.toast.warning("Could not find the novel on NovelBuddy.");
            return;
          }

          novelData.set({ slug: foundSlug, id: foundId });

          // Fetch chapters
          const chaptersUrl = `https://novelbuddy.com/api/manga/${foundId}/chapters?source=detail`;
          const chaptersRes = await ctx.fetch(chaptersUrl);
          const chaptersText = await chaptersRes.text();
          const $chapters = LoadDoc(chaptersText);

          const chapItems = $chapters("#chapter-list li");
          const chapList: { href: string, title: string }[] = [];

          for (let j = 0; j < chapItems.length; j++) {
            const li = $chapters(chapItems[j]);
            const a = li.find("a");
            const href = a.attr("href");
            const title = li.find(".chapter-title").text().trim();
            if (href && title) {
              chapList.push({ href, title });
            }
          }

          chapters.set(chapList.reverse()); // Reverse if needed to have oldest first
          if (chapList.length > 0) {
            selectedChapterHref.setValue(chapList[0].href);
          }
        } else {
          isNovel.set(false);
        }
      } catch (e) {
        console.error(e);
        ctx.toast.error("Error loading novel information.");
      }
    }, [currentMediaId]);

    // Effect to fetch chapter content when selection changes
    ctx.effect(async () => {
      const href = selectedChapterHref.current;
      if (!href || !isNovel.get()) return;

      try {
        const chapUrl = `https://novelbuddy.com${href}`;
        const chapRes = await ctx.fetch(chapUrl);
        const chapText = await chapRes.text();
        const $chap = LoadDoc(chapText);

        const contentDiv = $chap(".content-inner");
        const paragraphs = contentDiv.find("p").map((i, el) => $chap(el).text().trim()).get();
        const fullContent = paragraphs.join("\n\n");

        chapterContent.set(fullContent);
      } catch (e) {
        console.error(e);
        ctx.toast.error("Error loading chapter content.");
      }
    }, [selectedChapterHref]);

    // Create tray
    const tray = ctx.newTray({
      tooltipText: "NovelBuddy Reader",
      iconUrl: "https://novelbuddy.com/static/images/favicon.ico", // Or a suitable icon
      withContent: true,
    });

    // Render tray content
    ctx.effect(() => {
      if (!isNovel.get()) {
        tray.close();
        return;
      }

      tray.render(() => {
        const chaps = chapters.get();
        if (chaps.length === 0) {
          return tray.text("Loading chapters...");
        }

        return tray.stack({
          items: [
            tray.select("Select Chapter", {
              placeholder: "Choose a chapter...",
              options: chaps.map((chap) => ({ label: chap.title, value: chap.href })),
              fieldRef: selectedChapterHref,
            }),
            tray.text(chapterContent.get() || "Select a chapter to read."),
          ],
        });
      });

      // Optionally open the tray
      tray.open();
    }, [isNovel, chapters, chapterContent]);
  });
}
