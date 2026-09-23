/** Server-side archive configuration; publication approved by the site owner. */
export const ARCHIVE_IMAGE = {
  enabled: (process.env.ARCHIVE_IMAGE_ENABLED ?? "true") === "true",
  credit: (process.env.ARCHIVE_IMAGE_CREDIT ?? "Image supplied by the site owner").trim(),
  licence: (process.env.ARCHIVE_IMAGE_LICENCE ?? "").trim(),
};

if (ARCHIVE_IMAGE.enabled && !ARCHIVE_IMAGE.credit) {
  throw new Error("ARCHIVE_IMAGE.credit is required when ARCHIVE_IMAGE.enabled is true. Set ARCHIVE_IMAGE_CREDIT before building.");
}

export const archiveImageVisible = ARCHIVE_IMAGE.enabled && !!ARCHIVE_IMAGE.credit;
