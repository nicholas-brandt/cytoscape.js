import Set from "../set.mjs";
import * as is from "../is.mjs";

const elesfn = {
  classes: function (classes) {
    const self = this;

    if (classes === undefined) {
      const ret = [];

      self[0]._private.classes.forEach((cls) => ret.push(cls));

      return ret;
    } else if (!is.array(classes)) {
      // extract classes from string
      classes = (classes || "").match(/\S+/g) || [];
    }

    const changed = [];
    const classesSet = new Set(classes);

    // check and update each ele
    for (let j = 0; j < self.length; j++) {
      const ele = self[j];
      const _p = ele._private;
      const eleClasses = _p.classes;
      const changedEle = false;

      // check if ele has all of the passed classes
      for (let i = 0; i < classes.length; i++) {
        const cls = classes[i];
        const eleHasClass = eleClasses.has(cls);

        if (!eleHasClass) {
          changedEle = true;
          break;
        }
      }

      // check if ele has classes outside of those passed
      if (!changedEle) {
        changedEle = eleClasses.size !== classes.length;
      }

      if (changedEle) {
        _p.classes = classesSet;

        changed.push(ele);
      }
    }

    // trigger update style on those eles that had class changes
    if (changed.length > 0) {
      this.spawn(changed).updateStyle().emit("class");
    }

    return self;
  },

  addClass: function (classes) {
    return this.toggleClass(classes, true);
  },

  hasClass: function (className) {
    const ele = this[0];
    return ele != null && ele._private.classes.has(className);
  },

  toggleClass: function (classes, toggle) {
    if (!is.array(classes)) {
      // extract classes from string
      classes = classes.match(/\S+/g) || [];
    }
    const self = this;
    const toggleUndefd = toggle === undefined;
    const changed = []; // eles who had classes changed

    for (let i = 0, il = self.length; i < il; i++) {
      const ele = self[i];
      const eleClasses = ele._private.classes;
      const changedEle = false;

      for (let j = 0; j < classes.length; j++) {
        const cls = classes[j];
        const hasClass = eleClasses.has(cls);
        const changedNow = false;

        if (toggle || (toggleUndefd && !hasClass)) {
          eleClasses.add(cls);
          changedNow = true;
        } else if (!toggle || (toggleUndefd && hasClass)) {
          eleClasses.delete(cls);
          changedNow = true;
        }

        if (!changedEle && changedNow) {
          changed.push(ele);
          changedEle = true;
        }
      } // for j classes
    } // for i eles

    // trigger update style on those eles that had class changes
    if (changed.length > 0) {
      this.spawn(changed).updateStyle().emit("class");
    }

    return self;
  },

  removeClass: function (classes) {
    return this.toggleClass(classes, false);
  },

  flashClass: function (classes, duration) {
    const self = this;

    if (duration == null) {
      duration = 250;
    } else if (duration === 0) {
      return self; // nothing to do really
    }

    self.addClass(classes);
    setTimeout(function () {
      self.removeClass(classes);
    }, duration);

    return self;
  },
};

elesfn.className = elesfn.classNames = elesfn.classes;

export default elesfn;
