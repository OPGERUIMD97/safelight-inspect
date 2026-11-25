import assert from "node:assert/strict";
import { keyEventInit, zoomPlan, ZOOM_STOPS } from "../dist/index.js";

assert.deepEqual(keyEventInit("Tab"), { key: "Tab", code: "Tab", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false });
assert.deepEqual(keyEventInit("Ctrl+1"), { key: "1", code: "Digit1", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false });
assert.equal(keyEventInit("Ctrl+1", true).metaKey, true);
assert.equal(keyEventInit("Ctrl+1", true).ctrlKey, false);
assert.equal(keyEventInit("Ctrl+=").code, "Equal");
assert.equal(keyEventInit("Ctrl+-").code, "Minus");
assert.equal(keyEventInit("Ctrl++").key, "+");
assert.equal(keyEventInit("F").key, "f");
assert.equal(keyEventInit("Shift+F").key, "F");
assert.equal(keyEventInit(""), null);
assert.equal(keyEventInit("Ctrl+Wheel"), null);

assert.deepEqual(zoomPlan("fit"), ["develop.zoomFit"]);
assert.deepEqual(zoomPlan("100"), ["develop.zoom100"]);
assert.equal(zoomPlan("200").filter((a) => a === "develop.zoomIn").length, 4);
assert.ok(1.25 ** 4 >= 2); // four steps reach core's 200% cap
assert.deepEqual(ZOOM_STOPS.map((z) => z.id), ["fit", "100", "200"]);
console.log("inspect tests passed");
