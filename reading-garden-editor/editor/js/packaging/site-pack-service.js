export class SitePackService {
  async buildManifest({ booksCount }) {
    return {
      format: "rgsite",
      formatVersion: "1.0.0",
      booksCount: Number(booksCount || 0),
      entry: "index.html",
      buildTime: new Date().toISOString(),
      checks: {
        schema: false,
        assets: false,
        crossRefs: false,
        pathRewrite: false,
      },
    };
  }

  async exportSitePack() {
    throw new Error("NOT_IMPLEMENTED: exportSitePack");
  }
}
