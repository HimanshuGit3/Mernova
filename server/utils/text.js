/** Escape user input so it can be used literally inside a RegExp. */
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
