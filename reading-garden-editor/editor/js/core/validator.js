import { stripQuery } from "./path-resolver.js";

function issue(path, reason, suggestion = "") {
  const tip = suggestion ? `；建议：${suggestion}` : "";
  return `${path} ${reason}${tip}`;
}

export function validateProjectStructure(result) {
  const errors = [];
  if (!result || !Array.isArray(result.missing)) {
    errors.push("结构校验返回值无效");
    return { valid: false, errors };
  }

  if (result.missing.length) {
    result.missing.forEach((item) => errors.push(`缺失必要路径：${item}`));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateBooksData(data) {
  const errors = [];
  const books = data?.books;

  if (!Array.isArray(books)) {
    return {
      valid: false,
      errors: [issue("$.books", "必须是数组", "请使用 `{ \"books\": [] }` 结构")],
    };
  }

  const seen = new Set();
  books.forEach((book, index) => {
    const prefix = `$.books[${index}]`;
    const id = String(book?.id || "").trim();
    if (!id) errors.push(issue(`${prefix}.id`, "不能为空", "使用小写字母、数字与连字符，例如 `my-book`"));
    if (id && seen.has(id)) errors.push(issue(`${prefix}.id`, `重复：${id}`, "确保每本书使用唯一 id"));
    if (id) seen.add(id);

    if (!String(book?.title || "").trim()) {
      errors.push(issue(`${prefix}.title`, "不能为空", "填写书籍展示名称"));
    }
    if (!String(book?.page || "").trim()) {
      errors.push(issue(`${prefix}.page`, "不能为空", "设置为 `book.html?book=<id>`"));
    }

    const cover = String(book?.cover || "").trim();
    if (cover && !stripQuery(cover).includes("assets/")) {
      errors.push(issue(`${prefix}.cover`, "建议使用 assets/ 开头路径", "例如 `assets/images/<bookId>/covers/cover.svg`"));
    }

    const page = String(book?.page || "").trim();
    if (page && !/\bbook=/.test(page)) {
      errors.push(issue(`${prefix}.page`, "缺少 `book=` 查询参数", "例如 `book.html?book=my-book`"));
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateRegistryData(registry) {
  const errors = [];
  if (!registry || typeof registry !== "object") {
    return {
      valid: false,
      errors: [issue("$.registry", "必须是对象", "确保 registry.json 为合法 JSON 对象")],
    };
  }

  const book = registry.book;
  if (!book || typeof book !== "object") {
    errors.push(issue("$.book", "不能为空", "至少包含 `id` 与 `title`"));
  } else {
    if (!String(book.id || "").trim()) {
      errors.push(issue("$.book.id", "不能为空", "与 books.json 中的 id 保持一致"));
    }
    if (!String(book.title || "").trim()) {
      errors.push(issue("$.book.title", "不能为空", "填写书籍标题"));
    }
  }

  const modules = registry.modules;
  if (!Array.isArray(modules)) {
    errors.push(issue("$.modules", "必须是数组", "至少配置 reading 模块"));
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  if (!modules.length) {
    errors.push(issue("$.modules", "不能为空", "至少保留一个可运行模块"));
  }

  const seenModuleIds = new Set();
  modules.forEach((mod, index) => {
    const prefix = `$.modules[${index}]`;
    const id = String(mod?.id || "").trim();
    const entry = String(mod?.entry || "").trim();
    const data = String(mod?.data || "").trim();

    if (!id) {
      errors.push(issue(`${prefix}.id`, "不能为空", "例如 `reading` / `characters`"));
    } else if (seenModuleIds.has(id)) {
      errors.push(issue(`${prefix}.id`, `重复：${id}`, "模块 id 必须唯一"));
    } else {
      seenModuleIds.add(id);
    }

    if (!entry) {
      errors.push(issue(`${prefix}.entry`, "不能为空", "指向模块 JS 文件"));
    } else if (!/\.js($|\?)/.test(entry)) {
      errors.push(issue(`${prefix}.entry`, "建议使用 .js 结尾", "例如 `../../js/modules/reading-module.js`"));
    }

    if (!data) {
      errors.push(issue(`${prefix}.data`, "不能为空", "指向模块 JSON 数据文件"));
    } else if (!/\.json($|\?)/.test(data)) {
      errors.push(issue(`${prefix}.data`, "建议使用 .json 结尾", "例如 `chapters.json`"));
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateNewBookInput(input, existingBooks = []) {
  const errors = [];
  const id = String(input?.id || "").trim();
  const title = String(input?.title || "").trim();

  if (!title) errors.push("书名不能为空");
  if (!id) errors.push("书籍 ID 不能为空");
  if (id && !/^[a-z0-9-]+$/.test(id)) {
    errors.push("书籍 ID 仅允许小写字母、数字和连字符");
  }

  const exists = existingBooks.some((book) => String(book?.id || "") === id);
  if (exists) errors.push(`书籍 ID 已存在：${id}`);

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateErrorList(errors) {
  if (!Array.isArray(errors)) return [];
  return errors.map((item) => String(item)).filter(Boolean);
}
