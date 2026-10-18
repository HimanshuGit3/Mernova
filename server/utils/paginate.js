/** The one list response shape (API.md "Pagination"). */
export function pageOf(items, total, { page, limit }) {
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}
