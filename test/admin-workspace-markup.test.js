import test from "node:test";
import assert from "node:assert/strict";
import { mountAdminWorkspace } from "../src/index.js";
import { bootstrapDocument, marketDocument } from "./helpers.js";

test("admin overview is a compact semantic rail before writable sections", () => {
  const document = marketDocument();
  const workspace = mountAdminWorkspace({
    document,
    catalog: { products: bootstrapDocument({ role: "admin" }).data },
    session: { role: "admin" },
    locale: "uk_UA",
    transport: {}
  });

  const [header, rail] = workspace.root.children;
  assert.equal(header.className, "admin-workspace-header");
  assert.equal(rail.attributes.role, "list");
  assert.match(rail.className, /admin-capability-rail/);
  assert.equal(rail.children.length, 6);
  assert.equal(rail.children[0].attributes.role, "listitem");
  assert.equal(rail.children[0].attributes["data-admin-capability"], "products");
  assert.equal(rail.children[0].children[0].className, "admin-capability-name");
  assert.equal(rail.children[0].children[1].className, "admin-capability-metric");
  assert.equal(rail.children[0].children[2].className, "admin-capability-note");
});
