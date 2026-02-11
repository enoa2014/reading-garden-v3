import { sanitizeBookId } from "./path-resolver.js";

export function buildNewBookArtifacts(input) {
  const rawId = String(input?.id || "").trim();
  const title = String(input?.title || "").trim();
  const author = String(input?.author || "").trim();
  const description = String(input?.description || "").trim();

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
    modules: [
      {
        id: "reading",
        title: "阅读",
        icon: "📖",
        entry: "../../js/modules/reading-module.js",
        data: "chapters.json",
        active: true,
      },
    ],
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

  return {
    bookId,
    booksItem,
    registry,
    chapters,
    coverSvg,
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
