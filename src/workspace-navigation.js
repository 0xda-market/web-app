const ROLE_SECTIONS = Object.freeze({
  client: Object.freeze(["market"]),
  broker: Object.freeze(["market", "listings"]),
  admin: Object.freeze(["market", "listings", "admin"])
});

function element(document, tag, attributes = {}, text = null) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "className") node.className = value;
    else if (key === "type") node.type = value;
    else node.setAttribute(key, value);
  }
  if (text !== null) node.textContent = text;
  return node;
}

export function workspaceSectionsForRole(role) {
  return [...(ROLE_SECTIONS[String(role || "client")] || ROLE_SECTIONS.client)];
}

export function mountWorkspaceNavigation({
  document,
  session,
  sections,
  initialSection = "market",
  selectionFeedback = () => {}
}) {
  if (!document?.createElement) throw new TypeError("document is required");
  if (!Array.isArray(sections)) throw new TypeError("workspace sections are required");

  const allowed = new Set(workspaceSectionsForRole(session?.role));
  const entries = sections.filter((entry) => allowed.has(entry?.id) && entry?.root);
  if (entries.length === 0) throw new TypeError("at least one permitted workspace section is required");

  const root = element(document, "nav", {
    id: "workspace-navigation",
    className: "workspace-navigation",
    role: "tablist",
    "aria-label": "Workspace"
  });
  const buttons = new Map();
  let activeSection = null;

  function select(sectionId, { feedback = true } = {}) {
    const next = entries.find((entry) => entry.id === sectionId);
    if (!next) throw new RangeError(`workspace section is unavailable: ${sectionId}`);

    activeSection = next.id;
    for (const entry of entries) entry.root.hidden = entry.id !== activeSection;
    for (const [id, button] of buttons) button.setAttribute("aria-selected", String(id === activeSection));
    if (feedback) selectionFeedback();
    return activeSection;
  }

  for (const entry of entries) {
    const button = element(document, "button", {
      type: "button",
      className: "workspace-tab",
      role: "tab",
      "data-workspace": entry.id,
      "aria-selected": "false"
    }, entry.label || entry.id);
    button.addEventListener("click", () => select(entry.id));
    buttons.set(entry.id, button);
    root.append(button);
  }

  (document.body || document.querySelector("main")).append(root);
  const requestedInitial = entries.some((entry) => entry.id === initialSection) ? initialSection : entries[0].id;
  select(requestedInitial, { feedback: false });

  return {
    root,
    select,
    activeSection: () => activeSection,
    sections: () => entries.map((entry) => entry.id)
  };
}
