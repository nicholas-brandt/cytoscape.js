import * as util from "../util/index.mjs";
import Animation from "../animation.mjs";
import * as math from "../math.mjs";
import * as is from "../is.mjs";

const define = {
  animated: function () {
    return function animatedImpl() {
      const self = this;
      const selfIsArrayLike = self.length !== undefined;
      const all = selfIsArrayLike ? self : [self]; // put in array if not array-like
      const cy = this._private.cy || this;

      if (!cy.styleEnabled()) {
        return false;
      }

      const ele = all[0];

      if (ele) {
        return ele._private.animation.current.length > 0;
      }
    };
  }, // animated

  clearQueue: function () {
    return function clearQueueImpl() {
      const self = this;
      const selfIsArrayLike = self.length !== undefined;
      const all = selfIsArrayLike ? self : [self]; // put in array if not array-like
      const cy = this._private.cy || this;

      if (!cy.styleEnabled()) {
        return this;
      }

      for (let i = 0; i < all.length; i++) {
        const ele = all[i];
        ele._private.animation.queue = [];
      }

      return this;
    };
  }, // clearQueue

  delay: function () {
    return function delayImpl(time, complete) {
      const cy = this._private.cy || this;

      if (!cy.styleEnabled()) {
        return this;
      }

      return this.animate({
        delay: time,
        duration: time,
        complete: complete,
      });
    };
  }, // delay

  delayAnimation: function () {
    return function delayAnimationImpl(time, complete) {
      const cy = this._private.cy || this;

      if (!cy.styleEnabled()) {
        return this;
      }

      return this.animation({
        delay: time,
        duration: time,
        complete: complete,
      });
    };
  }, // delay

  animation: function () {
    return function animationImpl(properties, params) {
      const self = this;
      const selfIsArrayLike = self.length !== undefined;
      const all = selfIsArrayLike ? self : [self]; // put in array if not array-like
      const cy = this._private.cy || this;
      const isCore = !selfIsArrayLike;
      const isEles = !isCore;

      if (!cy.styleEnabled()) {
        return this;
      }

      const style = cy.style();

      properties = util.assign({}, properties, params);

      const propertiesEmpty = Object.keys(properties).length === 0;

      if (propertiesEmpty) {
        return new Animation(all[0], properties); // nothing to animate
      }

      if (properties.duration === undefined) {
        properties.duration = 400;
      }

      switch (properties.duration) {
        case "slow":
          properties.duration = 600;
          break;
        case "fast":
          properties.duration = 200;
          break;
      }

      if (isEles) {
        properties.style = style.getPropsList(
          properties.style || properties.css,
        );

        properties.css = undefined;
      }

      if (isEles && properties.renderedPosition != null) {
        const rpos = properties.renderedPosition;
        const pan = cy.pan();
        const zoom = cy.zoom();

        properties.position = math.renderedToModelPosition(rpos, zoom, pan);
      }

      // override pan w/ panBy if set
      if (isCore && properties.panBy != null) {
        const panBy = properties.panBy;
        const cyPan = cy.pan();

        properties.pan = {
          x: cyPan.x + panBy.x,
          y: cyPan.y + panBy.y,
        };
      }

      // override pan w/ center if set
      const center = properties.center || properties.centre;
      if (isCore && center != null) {
        const centerPan = cy.getCenterPan(center.eles, properties.zoom);

        if (centerPan != null) {
          properties.pan = centerPan;
        }
      }

      // override pan & zoom w/ fit if set
      if (isCore && properties.fit != null) {
        const fit = properties.fit;
        const fitVp = cy.getFitViewport(
          fit.eles || fit.boundingBox,
          fit.padding,
        );

        if (fitVp != null) {
          properties.pan = fitVp.pan;
          properties.zoom = fitVp.zoom;
        }
      }

      // override zoom (& potentially pan) w/ zoom obj if set
      if (isCore && is.plainObject(properties.zoom)) {
        const vp = cy.getZoomedViewport(properties.zoom);

        if (vp != null) {
          if (vp.zoomed) {
            properties.zoom = vp.zoom;
          }

          if (vp.panned) {
            properties.pan = vp.pan;
          }
        } else {
          properties.zoom = null; // an inavalid zoom (e.g. no delta) gets automatically destroyed
        }
      }

      return new Animation(all[0], properties);
    };
  }, // animate

  animate: function () {
    return function animateImpl(properties, params) {
      const self = this;
      const selfIsArrayLike = self.length !== undefined;
      const all = selfIsArrayLike ? self : [self]; // put in array if not array-like
      const cy = this._private.cy || this;

      if (!cy.styleEnabled()) {
        return this;
      }

      if (params) {
        properties = util.extend({}, properties, params);
      }

      // manually hook and run the animation
      for (let i = 0; i < all.length; i++) {
        const ele = all[i];
        const queue =
          ele.animated() &&
          (properties.queue === undefined || properties.queue);

        const ani = ele.animation(
          properties,
          queue ? { queue: true } : undefined,
        );

        ani.play();
      }

      return this; // chaining
    };
  }, // animate

  stop: function () {
    return function stopImpl(clearQueue, jumpToEnd) {
      const self = this;
      const selfIsArrayLike = self.length !== undefined;
      const all = selfIsArrayLike ? self : [self]; // put in array if not array-like
      const cy = this._private.cy || this;

      if (!cy.styleEnabled()) {
        return this;
      }

      for (let i = 0; i < all.length; i++) {
        const ele = all[i];
        const _p = ele._private;
        const anis = _p.animation.current;

        for (let j = 0; j < anis.length; j++) {
          const ani = anis[j];
          const ani_p = ani._private;

          if (jumpToEnd) {
            // next iteration of the animation loop, the animation
            // will go straight to the end and be removed
            ani_p.duration = 0;
          }
        }

        // clear the queue of future animations
        if (clearQueue) {
          _p.animation.queue = [];
        }

        if (!jumpToEnd) {
          _p.animation.current = [];
        }
      }

      // we have to notify (the animation loop doesn't do it for us on `stop`)
      cy.notify("draw");

      return this;
    };
  }, // stop
}; // define

export default define;
