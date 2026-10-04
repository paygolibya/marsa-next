import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import ModernTemplate from "./ModernTemplate";
import { makeTestStore, baseTemplateProps } from "./test-fixtures";

function render(customizationOverrides: Parameters<typeof makeTestStore>[0]) {
  const store = makeTestStore(customizationOverrides);
  return renderToStaticMarkup(<ModernTemplate {...baseTemplateProps} store={store} />);
}

test("headerStyle=centered stacks the logo group in a column; standard keeps it a row", () => {
  const centered = render({ headerStyle: "centered" });
  const standard = render({ headerStyle: "standard" });
  assert.match(centered, /flex items-center gap-3 min-w-0 flex-col/);
  assert.doesNotMatch(standard, /flex items-center gap-3 min-w-0 flex-col/);
});

test("cartPosition controls the cart button's side independently of headerStyle", () => {
  for (const headerStyle of ["standard", "centered"]) {
    const left = render({ headerStyle, cartPosition: "left" });
    const right = render({ headerStyle, cartPosition: "right" });
    assert.match(left, /absolute top-1\/2 -translate-y-1\/2 left-6/, `cartPosition=left, headerStyle=${headerStyle}`);
    assert.match(right, /absolute top-1\/2 -translate-y-1\/2 right-6/, `cartPosition=right, headerStyle=${headerStyle}`);
  }
});

test("the header row always carries a minimum height, regardless of what else is shown", () => {
  const collapsedContent = render({ showLogo: true, showStoreName: false, headerStyle: "standard" });
  const fullContent = render({ showLogo: true, showStoreName: true, headerStyle: "centered" });
  assert.match(collapsedContent, /min-h-14/);
  assert.match(fullContent, /min-h-14/);
});

// Regression test for a real merchant's store name overlapping the
// absolutely-positioned cart button on a narrow phone (the cart button
// isn't a normal flex sibling, so a long name had nothing stopping it
// from growing straight under it) — the row now reserves space for
// whichever side the cart sits on, and the name itself truncates.
test("a long store name truncates instead of overlapping the cart button", () => {
  const left = render({ cartPosition: "left" }); // cart at left-6
  const right = render({ cartPosition: "right" }); // cart at right-6
  // The logo/name group is right-anchored in this RTL layout and grows
  // leftward (confirmed with real bounding-box measurements against the
  // live broken page) — so a cart on the left needs the LEFT padding
  // reserved, and vice versa. Getting this backwards leaves the bug in
  // place (the reservation lands on the side nothing overlaps).
  assert.match(left, /pl-40/, "cart on the left reserves left padding, since the name grows leftward into it");
  assert.match(right, /pr-40/);
  assert.match(left, /truncate/, "the store name itself must be able to ellipsis");
});

test("in centered mode the logo falls back to a plain sized image, not the overflow-past-the-bar trick", () => {
  // StorefrontLogo wraps the image in a height:0 div (the overflow trick) —
  // in centered/flex-column mode that trick breaks stacking, so Modern must
  // use a plain sized <Image> there instead (see the code comment on this
  // branch). A regression here would silently make a big logo overlap the
  // store name below it.
  const centered = render({ headerStyle: "centered", logoSize: "xl" });
  assert.doesNotMatch(centered, /height:0/);
});

test("showLogo=false omits the logo image entirely", () => {
  const html = render({ showLogo: false });
  assert.doesNotMatch(html, /<img/);
});
