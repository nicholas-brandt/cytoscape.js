function NullRenderer(options) {
  this.options = options;
  this.notifications = 0; // for testing
}

const noop = function () {};

const throwImgErr = function () {
  throw new Error("A headless instance can not render images");
};

NullRenderer.prototype = {
  recalculateRenderedStyle: noop,
  notify: function () {
    this.notifications++;
  },
  init: noop,
  isHeadless: function () {
    return true;
  },
  png: throwImgErr,
  jpg: throwImgErr,
};

export default NullRenderer;
