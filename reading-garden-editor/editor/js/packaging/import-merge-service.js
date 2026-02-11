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

  async applyMergePlan() {
    throw new Error("NOT_IMPLEMENTED: applyMergePlan");
  }
}
