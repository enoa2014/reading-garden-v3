export class BookPackService {
  constructor({ fs, pathResolver }) {
    this.fs = fs;
    this.pathResolver = pathResolver;
  }

  async buildManifest({ book, schemaVersion = "2026-02" }) {
    return {
      format: "rgbook",
      formatVersion: "1.0.0",
      schemaVersion,
      book: {
        id: String(book?.id || ""),
        title: String(book?.title || ""),
        version: "1.0.0",
      },
      createdAt: new Date().toISOString(),
      capabilities: {
        llmGenerated: false,
        imageMode: "none",
      },
      checksums: {},
    };
  }

  async exportBookPack() {
    throw new Error("NOT_IMPLEMENTED: exportBookPack");
  }

  async inspectBookPack() {
    throw new Error("NOT_IMPLEMENTED: inspectBookPack");
  }

  async importBookPack() {
    throw new Error("NOT_IMPLEMENTED: importBookPack");
  }
}
