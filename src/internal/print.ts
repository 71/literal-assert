/**
 * Prints the given string, replacing `_[i]` by `(value #i)`.
 */
export function message(strings: TemplateStringsArray, ...args: string[]) {
  return String.raw(strings, ...args).replace(/_\[(\d+)\]/g, "(value #$1)");
}
