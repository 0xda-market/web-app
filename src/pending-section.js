export function setSectionPending(section, pending) {
  if (!section?.setAttribute || !section?.dataset) {
    throw new TypeError("pending section must be an element");
  }

  const active = Boolean(pending);
  section.inert = active;
  section.dataset.loading = active ? "true" : "false";
  section.setAttribute("aria-busy", active ? "true" : "false");
  return active;
}
