function uniqueBookId(baseId, existingBooks) {
  const seen = new Set((existingBooks || []).map((b) => String(b?.id || "")).filter(Boolean));
  if (!seen.has(baseId)) return baseId;

  let idx = 1;
  while (seen.has(`${baseId}-imported-${idx}`)) idx += 1;
  return `${baseId}-imported-${idx}`;
}

export class ImportMergeService {
  planMerge({ incomingBookId, existingBooks }) {
    const hasConflict = (existingBooks || []).some((item) => item?.id === incomingBookId);
    return {
      incomingBookId,
      hasConflict,
      conflicts: hasConflict
        ? [
            {
              type: "bookId",
              target: incomingBookId,
              options: ["overwrite", "rename", "skip", "manual"],
            },
          ]
        : [],
      selectedStrategy: hasConflict ? "rename" : "overwrite",
    };
  }

  applyMergePlan({ plan, existingBooks, strategy }) {
    const selected = strategy || plan?.selectedStrategy || "overwrite";
    const incomingBookId = String(plan?.incomingBookId || "");

    if (!plan?.hasConflict) {
      return {
        shouldImport: true,
        strategy: "none",
        targetBookId: incomingBookId,
      };
    }

    if (selected === "skip") {
      return {
        shouldImport: false,
        strategy: "skip",
        targetBookId: incomingBookId,
      };
    }

    if (selected === "manual") {
      throw new Error("MANUAL_MERGE_REQUIRED");
    }

    if (selected === "overwrite") {
      return {
        shouldImport: true,
        strategy: "overwrite",
        targetBookId: incomingBookId,
      };
    }

    return {
      shouldImport: true,
      strategy: "rename",
      targetBookId: uniqueBookId(incomingBookId, existingBooks),
    };
  }
}
