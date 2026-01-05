import zIndexSort from "../../../../collection/zsort.mjs";

const BRp = {};

BRp.updateCachedGrabbedEles = function () {
  const eles = this.cachedZSortedEles;

  if (!eles) {
    // just let this be recalculated on the next z sort tick
    return;
  }

  eles.drag = [];
  eles.nondrag = [];

  const grabTargets = [];

  for (let i = 0; i < eles.length; i++) {
    const ele = eles[i];
    const rs = ele._private.rscratch;

    if (ele.grabbed() && !ele.isParent()) {
      grabTargets.push(ele);
    } else if (rs.inDragLayer) {
      eles.drag.push(ele);
    } else {
      eles.nondrag.push(ele);
    }
  }

  // put the grab target nodes last so it's on top of its neighbourhood
  for (let i = 0; i < grabTargets.length; i++) {
    const ele = grabTargets[i];

    eles.drag.push(ele);
  }
};

BRp.invalidateCachedZSortedEles = function () {
  this.cachedZSortedEles = null;
};

BRp.getCachedZSortedEles = function (forceRecalc) {
  if (forceRecalc || !this.cachedZSortedEles) {
    const eles = this.cy.mutableElements().toArray();

    eles.sort(zIndexSort);

    eles.interactive = eles.filter((ele) => ele.interactive());

    this.cachedZSortedEles = eles;

    this.updateCachedGrabbedEles();
  } else {
    eles = this.cachedZSortedEles;
  }

  return eles;
};

export default BRp;
