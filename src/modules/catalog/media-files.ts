/** Shared by every upload mutation and the post-commit file collector. */
export const MEDIA_FILES_LOCK = 'media-files'
export const MANAGED_MEDIA_NAME = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?:-\d+)?\.(?:webp|pdf)$/
export const MEDIA_GC_GRACE = 24 * 60 * 60 * 1000
export const MEDIA_GC_INDEX = '.bibliotheon-media-gc.json'
