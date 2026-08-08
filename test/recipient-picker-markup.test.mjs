import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("recipient controls are inserted inside the checkout card before the primary action", () => {
  assert.match(source, /elements\.action\.before\(label\)/);
  assert.match(source, /elements\.action\.before\(field\)/);
  assert.doesNotMatch(source, /elements\.dialog\.append\((?:label|field)\)/);
});

test("recipient UI keeps the public self or username checkout contract", () => {
  assert.match(source, /other\.value = "username"/);
  assert.match(source, /return \{ mode: "self" \}/);
  assert.match(source, /return \{ mode: "username", username: elements\.recipient\.usernameInput\.value \}/);
  assert.match(source, /typeof host\.pickRecipient !== "function"/);
});
