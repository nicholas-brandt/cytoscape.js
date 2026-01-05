import * as is from "../is.mjs";
import zIndexSort from "./zsort.mjs";
import * as util from "../util/index.mjs";

const elesfn = {
  forEach: function (fn, thisArg) {
    if (is.fn(fn)) {
      const N = this.length;

      for (let i = 0; i < N; i++) {
        const ele = this[i];
        const ret = thisArg
          ? fn.apply(thisArg, [ele, i, this])
          : fn(ele, i, this);

        if (ret === false) {
          break;
        } // exit each early on return false
      }
    }

    return this;
  },

  toArray: function () {
    const array = [];

    for (let i = 0; i < this.length; i++) {
      array.push(this[i]);
    }

    return array;
  },

  slice: function (start, end) {
    const array = [];
    const thisSize = this.length;

    if (end == null) {
      end = thisSize;
    }

    if (start == null) {
      start = 0;
    }

    if (start < 0) {
      start = thisSize + start;
    }

    if (end < 0) {
      end = thisSize + end;
    }

    for (let i = start; i >= 0 && i < end && i < thisSize; i++) {
      array.push(this[i]);
    }

    return this.spawn(array);
  },

  size: function () {
    return this.length;
  },

  eq: function (i) {
    return this[i] || this.spawn();
  },

  first: function () {
    return this[0] || this.spawn();
  },

  last: function () {
    return this[this.length - 1] || this.spawn();
  },

  empty: function () {
    return this.length === 0;
  },

  nonempty: function () {
    return !this.empty();
  },

  sort: function (sortFn) {
    if (!is.fn(sortFn)) {
      return this;
    }

    const sorted = this.toArray().sort(sortFn);

    return this.spawn(sorted);
  },

  sortByZIndex: function () {
    return this.sort(zIndexSort);
  },

  zDepth: function () {
    const ele = this[0];
    if (!ele) {
      return undefined;
    }

    // const cy = ele.cy();
    const _p = ele._private;
    const group = _p.group;

    if (group === "nodes") {
      const depth = _p.data.parent ? ele.parents().size() : 0;

      if (!ele.isParent()) {
        return util.MAX_INT - 1; // childless nodes always on top
      }

      return depth;
    } else {
      const src = _p.source;
      const tgt = _p.target;
      const srcDepth = src.zDepth();
      const tgtDepth = tgt.zDepth();

      return Math.max(srcDepth, tgtDepth, 0); // depth of deepest parent
    }
  },
};

elesfn.each = elesfn.forEach;

const defineSymbolIterator = () => {
  const typeofUndef = typeof undefined;
  const isIteratorSupported =
    typeof Symbol != typeofUndef && typeof Symbol.iterator != typeofUndef;

  if (isIteratorSupported) {
    elesfn[Symbol.iterator] = function () {
      const entry = { value: undefined, done: false };
      const i = 0;
      const length = this.length;

      return {
        next: () => {
          if (i < length) {
            entry.value = this[i++];
          } else {
            entry.value = undefined;
            entry.done = true;
          }

          return entry;
        },
        [Symbol.iterator]: function () {
          return this;
        },
      };
    };
  }
};
defineSymbolIterator();

export default elesfn;
