/** Lower-case, spaces to dashes; Tamil and other scripts are kept. */
export function slugify(name: string): string {
  return name
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\s/\\?#%&+]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
