// use this module to cherry pick functions into your prototype
// (useful for functions shared between the core and collections, for example)

// e.g.
// const foo = define.foo({ /* params... */ })

import * as util from "../util/index.mjs";
import animation from "./animation.mjs";
import data from "./data.mjs";
import events from "./events.mjs";

const define = {};

[animation, data, events].forEach(function (m) {
  util.assign(define, m);
});

export default define;
