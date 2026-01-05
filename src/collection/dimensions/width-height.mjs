import * as util from "../../util/index.mjs";

let fn, elesfn;

fn = elesfn = {};

const defineDimFns = function (opts) {
  opts.uppercaseName = util.capitalize(opts.name);
  opts.autoName = "auto" + opts.uppercaseName;
  opts.labelName = "label" + opts.uppercaseName;
  opts.outerName = "outer" + opts.uppercaseName;
  opts.uppercaseOuterName = util.capitalize(opts.outerName);

  fn[opts.name] = function dimImpl() {
    const ele = this[0];
    const _p = ele._private;
    const cy = _p.cy;
    const styleEnabled = cy._private.styleEnabled;

    if (ele) {
      if (styleEnabled) {
        if (ele.isParent()) {
          ele.updateCompoundBounds();

          return _p[opts.autoName] || 0;
        }

        const d = ele.pstyle(opts.name);

        switch (d.strValue) {
          case "label":
            ele.recalculateRenderedStyle();

            return _p.rstyle[opts.labelName] || 0;

          default:
            return d.pfValue;
        }
      } else {
        return 1;
      }
    }
  };

  fn["outer" + opts.uppercaseName] = function outerDimImpl() {
    const ele = this[0];
    const _p = ele._private;
    const cy = _p.cy;
    const styleEnabled = cy._private.styleEnabled;

    if (ele) {
      if (styleEnabled) {
        const dim = ele[opts.name]();

        const borderPos = ele.pstyle("border-position").value;

        let border;
        if (borderPos === "center") {
          border = ele.pstyle("border-width").pfValue; // n.b. 1/2 each side
        } else if (borderPos === "outside") {
          border = 2 * ele.pstyle("border-width").pfValue;
        } else {
          // 'inside'
          border = 0;
        }

        const padding = 2 * ele.padding();

        return dim + border + padding;
      } else {
        return 1;
      }
    }
  };

  fn["rendered" + opts.uppercaseName] = function renderedDimImpl() {
    const ele = this[0];

    if (ele) {
      const d = ele[opts.name]();
      return d * this.cy().zoom();
    }
  };

  fn["rendered" + opts.uppercaseOuterName] = function renderedOuterDimImpl() {
    const ele = this[0];

    if (ele) {
      const od = ele[opts.outerName]();
      return od * this.cy().zoom();
    }
  };
};

defineDimFns({
  name: "width",
});

defineDimFns({
  name: "height",
});

elesfn.padding = function () {
  const ele = this[0];
  const _p = ele._private;
  if (ele.isParent()) {
    ele.updateCompoundBounds();

    if (_p.autoPadding !== undefined) {
      return _p.autoPadding;
    } else {
      return ele.pstyle("padding").pfValue;
    }
  } else {
    return ele.pstyle("padding").pfValue;
  }
};

elesfn.paddedHeight = function () {
  const ele = this[0];

  return ele.height() + 2 * ele.padding();
};

elesfn.paddedWidth = function () {
  const ele = this[0];

  return ele.width() + 2 * ele.padding();
};

export default elesfn;
