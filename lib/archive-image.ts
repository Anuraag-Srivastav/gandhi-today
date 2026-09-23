/** Server-side rights configuration. No image is enabled by default. */
export const ARCHIVE_IMAGE = {
  enabled: process.env.ARCHIVE_IMAGE_ENABLED === "true",
  credit: (process.env.ARCHIVE_IMAGE_CREDIT ?? "").trim(),
  licence: (process.env.ARCHIVE_IMAGE_LICENCE ?? "").trim(),
};

if (ARCHIVE_IMAGE.enabled && !ARCHIVE_IMAGE.credit) {
  throw new Error("ARCHIVE_IMAGE.credit is required when ARCHIVE_IMAGE.enabled is true. Set ARCHIVE_IMAGE_CREDIT before building.");
}

export const archiveImageVisible = ARCHIVE_IMAGE.enabled && !!ARCHIVE_IMAGE.credit;
