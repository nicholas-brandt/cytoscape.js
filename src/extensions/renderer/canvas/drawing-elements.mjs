import * as math from "../../../math.mjs";

const CRp = {};

CRp.drawElement = function (
  context,
  ele,
  shiftToOriginWithBb,
  showLabel,
  showOverlay,
  showOpacity,
) {
  const r = this;

  if (ele.isNode()) {
    r.drawNode(
      context,
      ele,
      shiftToOriginWithBb,
      showLabel,
      showOverlay,
      showOpacity,
    );
  } else {
    r.drawEdge(
      context,
      ele,
      shiftToOriginWithBb,
      showLabel,
      showOverlay,
      showOpacity,
    );
  }
};

CRp.drawElementOverlay = function (context, ele) {
  const r = this;

  if (ele.isNode()) {
    r.drawNodeOverlay(context, ele);
  } else {
    r.drawEdgeOverlay(context, ele);
  }
};

CRp.drawElementUnderlay = function (context, ele) {
  const r = this;

  if (ele.isNode()) {
    r.drawNodeUnderlay(context, ele);
  } else {
    r.drawEdgeUnderlay(context, ele);
  }
};

CRp.drawCachedElementPortion = function (
  context,
  ele,
  eleTxrCache,
  pxRatio,
  lvl,
  reason,
  getRotation,
  getOpacity,
) {
  const r = this;
  const bb = eleTxrCache.getBoundingBox(ele);

  if (bb.w === 0 || bb.h === 0) {
    return;
  } // ignore zero size case

  const eleCache = eleTxrCache.getElement(ele, bb, pxRatio, lvl, reason);

  if (eleCache != null) {
    const opacity = getOpacity(r, ele);

    if (opacity === 0) {
      return;
    }

    const theta = getRotation(r, ele);
    let { x1, y1, w, h } = bb;
    let x, y, sx, sy, smooth;

    if (theta !== 0) {
      const rotPt = eleTxrCache.getRotationPoint(ele);

      sx = rotPt.x;
      sy = rotPt.y;

      context.translate(sx, sy);
      context.rotate(theta);

      smooth = r.getImgSmoothing(context);

      if (!smooth) {
        r.setImgSmoothing(context, true);
      }

      const off = eleTxrCache.getRotationOffset(ele);

      x = off.x;
      y = off.y;
    } else {
      x = x1;
      y = y1;
    }

    let oldGlobalAlpha;

    if (opacity !== 1) {
      oldGlobalAlpha = context.globalAlpha;
      context.globalAlpha = oldGlobalAlpha * opacity;
    }

    context.drawImage(
      eleCache.texture.canvas,
      eleCache.x,
      0,
      eleCache.width,
      eleCache.height,
      x,
      y,
      w,
      h,
    );

    if (opacity !== 1) {
      context.globalAlpha = oldGlobalAlpha;
    }

    if (theta !== 0) {
      context.rotate(-theta);
      context.translate(-sx, -sy);

      if (!smooth) {
        r.setImgSmoothing(context, false);
      }
    }
  } else {
    eleTxrCache.drawElement(context, ele); // direct draw fallback
  }
};

const getZeroRotation = () => 0;
const getLabelRotation = (r, ele) => r.getTextAngle(ele, null);
const getSourceLabelRotation = (r, ele) => r.getTextAngle(ele, "source");
const getTargetLabelRotation = (r, ele) => r.getTextAngle(ele, "target");
const getOpacity = (r, ele) => ele.effectiveOpacity();
const getTextOpacity = (e, ele) =>
  ele.pstyle("text-opacity").pfValue * ele.effectiveOpacity();

CRp.drawCachedElement = function (
  context,
  ele,
  pxRatio,
  extent,
  lvl,
  requestHighQuality,
) {
  const r = this;
  let { eleTxrCache, lblTxrCache, slbTxrCache, tlbTxrCache } = r.data;

  const bb = ele.boundingBox();
  const reason =
    requestHighQuality === true ? eleTxrCache.reasons.highQuality : null;

  if (bb.w === 0 || bb.h === 0 || !ele.visible()) {
    return;
  }

  if (!extent || math.boundingBoxesIntersect(bb, extent)) {
    const isEdge = ele.isEdge();
    const badLine = ele.element()._private.rscratch.badLine;

    r.drawElementUnderlay(context, ele);

    r.drawCachedElementPortion(
      context,
      ele,
      eleTxrCache,
      pxRatio,
      lvl,
      reason,
      getZeroRotation,
      getOpacity,
    );

    if (!isEdge || !badLine) {
      r.drawCachedElementPortion(
        context,
        ele,
        lblTxrCache,
        pxRatio,
        lvl,
        reason,
        getLabelRotation,
        getTextOpacity,
      );
    }

    if (isEdge && !badLine) {
      r.drawCachedElementPortion(
        context,
        ele,
        slbTxrCache,
        pxRatio,
        lvl,
        reason,
        getSourceLabelRotation,
        getTextOpacity,
      );
      r.drawCachedElementPortion(
        context,
        ele,
        tlbTxrCache,
        pxRatio,
        lvl,
        reason,
        getTargetLabelRotation,
        getTextOpacity,
      );
    }

    r.drawElementOverlay(context, ele);
  }
};

CRp.drawElements = function (context, eles) {
  const r = this;

  for (let i = 0; i < eles.length; i++) {
    const ele = eles[i];

    r.drawElement(context, ele);
  }
};

CRp.drawCachedElements = function (context, eles, pxRatio, extent) {
  const r = this;

  for (let i = 0; i < eles.length; i++) {
    const ele = eles[i];

    r.drawCachedElement(context, ele, pxRatio, extent);
  }
};

CRp.drawCachedNodes = function (context, eles, pxRatio, extent) {
  const r = this;

  for (let i = 0; i < eles.length; i++) {
    const ele = eles[i];

    if (!ele.isNode()) {
      continue;
    }

    r.drawCachedElement(context, ele, pxRatio, extent);
  }
};

CRp.drawLayeredElements = function (context, eles, pxRatio, extent) {
  const r = this;

  const layers = r.data.lyrTxrCache.getLayers(eles, pxRatio);

  if (layers) {
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const bb = layer.bb;

      if (bb.w === 0 || bb.h === 0) {
        continue;
      }

      context.drawImage(layer.canvas, bb.x1, bb.y1, bb.w, bb.h);
    }
  } else {
    // fall back on plain caching if no layers
    r.drawCachedElements(context, eles, pxRatio, extent);
  }
};

if (process.env.NODE_ENV !== "production") {
  CRp.drawDebugPoints = function (context, eles) {
    const draw = function (x, y, color) {
      context.fillStyle = color;
      context.fillRect(x - 1, y - 1, 3, 3);
    };

    for (let i = 0; i < eles.length; i++) {
      const ele = eles[i];
      const rs = ele._private.rscratch;

      if (ele.isNode()) {
        const p = ele.position();

        draw(rs.labelX, rs.labelY, "red");
        draw(p.x, p.y, "magenta");
      } else {
        const pts = rs.allpts;

        for (let j = 0; j + 1 < pts.length; j += 2) {
          const x = pts[j];
          const y = pts[j + 1];

          draw(x, y, "cyan");
        }

        draw(rs.midX, rs.midY, "yellow");
      }
    }
  };
}

export default CRp;
