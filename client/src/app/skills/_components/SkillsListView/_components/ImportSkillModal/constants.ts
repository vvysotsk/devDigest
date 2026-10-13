/** File types the import accepts (D3). */
export const ACCEPTED_EXTENSIONS = [".md", ".zip"] as const;

/** `accept` attribute of the file input. */
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(",");

/** Modal width (px). */
export const MODAL_WIDTH = 820;
