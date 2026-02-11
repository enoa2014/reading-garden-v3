import { stripQuery } from "./path-resolver.js";

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
    return { valid: false, errors: ["`data/books.json` 必须包含 books 数组"] };
  }

  const seen = new Set();
  books.forEach((book, index) => {
    const prefix = `books[${index}]`;
    const id = String(book?.id || "").trim();
    if (!id) errors.push(`${prefix}.id 不能为空`);
    if (id && seen.has(id)) errors.push(`${prefix}.id 重复：${id}`);
    if (id) seen.add(id);

    if (!String(book?.title || "").trim()) errors.push(`${prefix}.title 不能为空`);
    if (!String(book?.page || "").trim()) errors.push(`${prefix}.page 不能为空`);

    const cover = String(book?.cover || "").trim();
    if (cover && !stripQuery(cover).includes("assets/")) {
      errors.push(`${prefix}.cover 建议使用 assets/ 开头路径`);
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
