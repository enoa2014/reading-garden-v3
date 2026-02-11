import { sanitizeBookId } from "./path-resolver.js";

function normalizeImageMode(rawMode = "disabled") {
  const mode = String(rawMode || "disabled").trim();
  return ["disabled", "api", "prompt-file", "emoji", "none"].includes(mode)
    ? mode
    : "disabled";
}

function buildCoverSvg({ title, author, imageMode }) {
  const safeTitle = escapeXml(title || "Untitled Book");
  const safeAuthor = escapeXml(author || "Reading Garden");

  if (imageMode === "emoji") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1120" viewBox="0 0 800 1120">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff3d6"/>
      <stop offset="100%" stop-color="#ffe0a3"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1120" fill="url(#bg)"/>
  <text x="400" y="260" text-anchor="middle" fill="#47361f" font-size="124">📚✨</text>
  <text x="400" y="430" text-anchor="middle" fill="#2e2a23" font-size="56" font-family="Georgia,serif">${safeTitle}</text>
  <text x="400" y="510" text-anchor="middle" fill="#5f5444" font-size="28" font-family="Georgia,serif">${safeAuthor}</text>
  <text x="400" y="980" text-anchor="middle" fill="#7e705d" font-size="22" font-family="Georgia,serif">Emoji Cover Mode</text>
</svg>\n`;
  }

  if (imageMode === "none") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1120" viewBox="0 0 800 1120">
  <rect width="800" height="1120" fill="#f2f2f2"/>
  <rect x="70" y="70" width="660" height="980" rx="20" fill="none" stroke="#888" stroke-width="3" stroke-dasharray="10 8"/>
  <text x="400" y="430" text-anchor="middle" fill="#2e2a23" font-size="56" font-family="Georgia,serif">${safeTitle}</text>
  <text x="400" y="510" text-anchor="middle" fill="#5f5444" font-size="28" font-family="Georgia,serif">${safeAuthor}</text>
  <text x="400" y="620" text-anchor="middle" fill="#6a6a6a" font-size="34" font-family="Georgia,serif">No Image Mode</text>
  <text x="400" y="980" text-anchor="middle" fill="#7e705d" font-size="22" font-family="Georgia,serif">Image disabled by configuration</text>
</svg>\n`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1120" viewBox="0 0 800 1120">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8efe0"/>
      <stop offset="100%" stop-color="#e6d8bd"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1120" fill="url(#bg)"/>
  <rect x="60" y="60" width="680" height="1000" rx="24" fill="none" stroke="#8a7a5f" stroke-width="3"/>
  <text x="400" y="420" text-anchor="middle" fill="#2e2a23" font-size="56" font-family="Georgia,serif">${safeTitle}</text>
  <text x="400" y="500" text-anchor="middle" fill="#5f5444" font-size="28" font-family="Georgia,serif">${safeAuthor}</text>
  <text x="400" y="980" text-anchor="middle" fill="#7e705d" font-size="22" font-family="Georgia,serif">Created by Reading Garden Editor</text>
</svg>\n`;
}

function buildImagePromptTemplate({ bookId, title, author, imageMode }) {
  if (!["prompt-file", "api"].includes(imageMode)) return "";
  const safeTitle = String(title || "").trim() || "未命名图书";
  const safeAuthor = String(author || "").trim() || "未知作者";
  return `# Image Prompt Template

bookId: ${bookId}
title: ${safeTitle}
author: ${safeAuthor}
imageMode: ${imageMode}

## cover
- scene: 图书封面
- prompt: 儿童阅读风格插画，主题为《${safeTitle}》，作者 ${safeAuthor}，暖色调，适合小学阅读课堂，高清，无水印
- negative: 低清晰度、文字错乱、logo、水印、畸形

## protagonist
- scene: 主角头像
- prompt: 友善、简洁、卡通半身像，适用于阅读学习应用角色卡
- negative: 模糊、过度写实、背景杂乱
`;
}

export function buildNewBookArtifacts(input) {
  const rawId = String(input?.id || "").trim();
  const title = String(input?.title || "").trim();
  const author = String(input?.author || "").trim();
  const description = String(input?.description || "").trim();
  const imageMode = normalizeImageMode(input?.imageMode || "disabled");

  const includeCharacters = input?.includeCharacters !== false;
  const includeThemes = input?.includeThemes !== false;
  const includeTimeline = input?.includeTimeline === true;
  const includeInteractive = input?.includeInteractive === true;

  const bookId = sanitizeBookId(rawId || title);
  const coverFileName = imageMode === "emoji"
    ? "cover-emoji.svg"
    : imageMode === "none"
      ? "cover-none.svg"
      : "cover.svg";
  const coverPath = `assets/images/${bookId}/covers/${coverFileName}`;

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

  if (includeTimeline) {
    modules.push({
      id: "timeline",
      title: "时间线",
      icon: "📅",
      entry: "../../js/modules/timeline-module.js",
      data: "timeline.json",
    });
  }

  if (includeInteractive) {
    modules.push({
      id: "interactive",
      title: "情境",
      icon: "🎯",
      entry: "../../js/modules/interactive-module.js",
      data: "scenarios.json",
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

  const timeline = {
    events: [
      {
        id: "event-1",
        title: "关键事件",
        time: "",
        description: "请补充时间线内容",
      },
    ],
  };

  const scenarios = {
    scenarios: [
      {
        id: "scenario-1",
        title: "互动问题",
        prompt: "请补充互动问题",
        options: [],
      },
    ],
  };

  const coverSvg = buildCoverSvg({
    title: title || "Untitled Book",
    author: author || "Reading Garden",
    imageMode,
  });

  const protagonistSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="40" fill="#ece2cf"/>
  <circle cx="256" cy="190" r="96" fill="#8f7a56"/>
  <rect x="132" y="300" width="248" height="150" rx="72" fill="#8f7a56"/>
</svg>\n`;
  const promptTemplateText = buildImagePromptTemplate({
    bookId,
    title,
    author,
    imageMode,
  });

  return {
    bookId,
    booksItem,
    registry,
    chapters,
    characters,
    themes,
    timeline,
    scenarios,
    coverSvg,
    coverFileName,
    protagonistSvg,
    promptTemplateText,
    includeCharacters,
    includeThemes,
    includeTimeline,
    includeInteractive,
    imageMode,
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
