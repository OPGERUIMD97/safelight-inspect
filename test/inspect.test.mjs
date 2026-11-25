import assert from "node:assert/strict";
import { keyEventInit, zoomPlan, ZOOM_STOPS, anchoredCentre, tilePlan, clampDeep, TILE_MAX } from "../dist/index.js";

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
assert.deepEqual(ZOOM_STOPS.map((z) => z.id), ["fit", "100", "200", "400", "800"]);

// Deep zoom: clamp, anchor under the mouse, tiles.
assert.equal(clampDeep(1), 2); assert.equal(clampDeep(20), 8); assert.equal(clampDeep(3), 3);
{
  const v = { w: 1000, h: 500 };
  const c = anchoredCentre({ x: 300, y: 200 }, { x: 100, y: 50 }, v, 4, 1);
  // the anchor frame point maps back to the anchor device point
  assert.equal((300 - c.x) * 4 + v.w / 2, 100);
  assert.equal((200 - c.y) * 4 + v.h / 2, 50);
}
{
  const frame = { w: 6000, h: 4000 };
  const t8 = tilePlan({ x: 3000, y: 2000 }, { w: 5120, h: 2880 }, 8, 1, frame);
  assert.equal(t8.length, 1); assert.equal(t8[0].width, 642);
  const t25 = tilePlan({ x: 3000, y: 2000 }, { w: 5120, h: 2880 }, 2.5, 1, frame);
  assert.ok(t25.length >= 4 && t25.every((t) => t.width <= TILE_MAX && t.height <= TILE_MAX));
  const sumW = t25.filter((t) => t.y === t25[0].y).reduce((a, t) => a + t.width - 2, 0);
  assert.ok(Math.abs(sumW - 2048) <= 4);
  assert.deepEqual(tilePlan({ x: -9000, y: 0 }, { w: 100, h: 100 }, 4, 1, frame), []);
}
console.log("inspect tests passed");
