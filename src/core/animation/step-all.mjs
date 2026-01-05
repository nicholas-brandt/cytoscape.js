import step from "./step.mjs";
import startAnimation from "./start.mjs";

function stepAll(now, cy) {
  const eles = cy._private.aniEles;
  const doneEles = [];

  function stepOne(ele, isCore) {
    const _p = ele._private;
    const current = _p.animation.current;
    const queue = _p.animation.queue;
    const ranAnis = false;

    // if nothing currently animating, get something from the queue
    if (current.length === 0) {
      const next = queue.shift();

      if (next) {
        current.push(next);
      }
    }

    const callbacks = function (callbacks) {
      for (let j = callbacks.length - 1; j >= 0; j--) {
        const cb = callbacks[j];

        cb();
      }

      callbacks.splice(0, callbacks.length);
    };

    // step and remove if done
    for (let i = current.length - 1; i >= 0; i--) {
      const ani = current[i];
      const ani_p = ani._private;

      if (ani_p.stopped) {
        current.splice(i, 1);

        ani_p.hooked = false;
        ani_p.playing = false;
        ani_p.started = false;

        callbacks(ani_p.frames);

        continue;
      }

      if (!ani_p.playing && !ani_p.applying) {
        continue;
      }

      // an apply() while playing shouldn't do anything
      if (ani_p.playing && ani_p.applying) {
        ani_p.applying = false;
      }

      if (!ani_p.started) {
        startAnimation(ele, ani, now, isCore);
      }

      step(ele, ani, now, isCore);

      if (ani_p.applying) {
        ani_p.applying = false;
      }

      callbacks(ani_p.frames);

      if (ani_p.step != null) {
        ani_p.step(now);
      }

      if (ani.completed()) {
        current.splice(i, 1);

        ani_p.hooked = false;
        ani_p.playing = false;
        ani_p.started = false;

        callbacks(ani_p.completes);
      }

      ranAnis = true;
    }

    if (!isCore && current.length === 0 && queue.length === 0) {
      doneEles.push(ele);
    }

    return ranAnis;
  } // stepElement

  // handle all eles
  const ranEleAni = false;
  for (let e = 0; e < eles.length; e++) {
    const ele = eles[e];
    const handledThisEle = stepOne(ele);

    ranEleAni = ranEleAni || handledThisEle;
  } // each element

  const ranCoreAni = stepOne(cy, true);

  // notify renderer
  if (ranEleAni || ranCoreAni) {
    if (eles.length > 0) {
      cy.notify("draw", eles);
    } else {
      cy.notify("draw");
    }
  }

  // remove elements from list of currently animating if its queues are empty
  eles.unmerge(doneEles);

  cy.emit("step");
} // stepAll

export default stepAll;
