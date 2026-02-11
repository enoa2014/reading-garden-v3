import { sanitizeBookId } from "./path-resolver.js";

export function buildNewBookArtifacts(input) {
  const rawId = String(input?.id || "").trim();
  const title = String(input?.title || "").trim();
  const author = String(input?.author || "").trim();
  const description = String(input?.description || "").trim();

  const includeCharacters = input?.includeCharacters !== false;
  const includeThemes = input?.includeThemes !== false;

  const bookId = sanitizeBookId(rawId || title);
  const coverPath = `assets/images/${bookId}/covers/cover.svg`;

  const booksItem = {
    id: bookId,
    title,
    author: author || "未知作者",
    cover: coverPath,
    description: description || `${title}（由 Reading Garden Editor 创建）`,
    theme: "book-default",
    page: `book.html?book=${bookId}`,
    tags: ["new-book"],
  };

  const modules = [
    {
      id: "reading",
      title: "阅读",
      icon: "📖",
      entry: "../../js/modules/reading-module.js",
      data: "chapters.json",
      active: true,
    },
  ];

  if (includeCharacters) {
    modules.push({
      id: "characters",
      title: "人物",
      icon: "👥",
      entry: "../../js/modules/characters-module.js",
      data: "characters.json",
    });
  }

  if (includeThemes) {
    modules.push({
      id: "themes",
      title: "主题",
      icon: "🎯",
      entry: "../../js/modules/themes-module.js",
      data: "themes.json",
    });
  }

  const registry = {
    book: {
      id: bookId,
      title,
      subtitle: "",
      author: author || "未知作者",
      icon: "book",
      themeClass: "",
      defaultTheme: "light",
    },
    modules,
  };

  const chapters = {
    chapters: [
      {
        id: 1,
        title: "第一章",
        content: ["请在编辑器中编辑章节内容。"],
      },
    ],
  };

  const characters = {
    nodes: [
      {
        data: {
          id: "protagonist",
          name: "主角",
          role: "protagonist",
          description: "请补充人物信息",
          avatar: `../assets/images/${bookId}/characters/protagonist.svg`,
          traits: [],
          quote: "",
        },
      },
    ],
    edges: [],
  };

  const themes = {
    themes: [
      {
        id: "theme-1",
        title: "核心主题",
        description: "请补充主题解读",
      },
    ],
  };

  const coverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1120" viewBox="0 0 800 1120">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8efe0"/>
      <stop offset="100%" stop-color="#e6d8bd"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1120" fill="url(#bg)"/>
  <rect x="60" y="60" width="680" height="1000" rx="24" fill="none" stroke="#8a7a5f" stroke-width="3"/>
  <text x="400" y="420" text-anchor="middle" fill="#2e2a23" font-size="56" font-family="Georgia,serif">${escapeXml(
    title || "Untitled Book"
  )}</text>
  <text x="400" y="500" text-anchor="middle" fill="#5f5444" font-size="28" font-family="Georgia,serif">${escapeXml(
    author || "Reading Garden"
  )}</text>
  <text x="400" y="980" text-anchor="middle" fill="#7e705d" font-size="22" font-family="Georgia,serif">Created by Reading Garden Editor</text>
</svg>\n`;

  const protagonistSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="40" fill="#ece2cf"/>
  <circle cx="256" cy="190" r="96" fill="#8f7a56"/>
  <rect x="132" y="300" width="248" height="150" rx="72" fill="#8f7a56"/>
</svg>\n`;

  return {
    bookId,
    booksItem,
    registry,
    chapters,
    characters,
    themes,
    coverSvg,
    protagonistSvg,
    includeCharacters,
    includeThemes,
  };
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
