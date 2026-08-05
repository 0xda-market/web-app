import test from "node:test";
import assert from "node:assert/strict";
import { mountWorkspaceNavigation } from "../src/index.js";
import { marketDocument } from "./helpers.js";

function section(document, id, label) {
  const root = document.createElement("section");
  root.id = id;
  return { id, label, root };
}

test("workspace tabs expose an icon, visible label and accessible localized name", () => {
  const document = marketDocument();
  const navigation = mountWorkspaceNavigation({
    document,
    session: { role: "admin" },
    locale: "uk_UA",
    sections: [
      section(document, "market"),
      section(document, "listings"),
      section(document, "admin")
    ]
  });

  assert.equal(navigation.root.children.length, 3);
  const admin = navigation.root.children[2];
  assert.equal(admin.attributes["data-workspace"], "admin");
  assert.equal(admin.attributes["aria-label"], "Адміністрування");
  assert.equal(admin.children[0].className, "workspace-tab-icon");
  assert.equal(admin.children[0].attributes["aria-hidden"], "true");
  assert.equal(admin.children[0].attributes["data-workspace-icon"], "admin");
  assert.equal(admin.children[1].className, "workspace-tab-label");
  assert.equal(admin.children[1].textContent, "Адміністрування");
});

test("workspace tab keeps a custom label as its accessible name", () => {
  const document = marketDocument();
  const navigation = mountWorkspaceNavigation({
    document,
    session: { role: "client" },
    sections: [section(document, "market", "Store")]
  });

  const market = navigation.root.children[0];
  assert.equal(market.attributes["aria-label"], "Store");
  assert.equal(market.children[1].textContent, "Store");
});
