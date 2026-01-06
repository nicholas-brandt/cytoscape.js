import * as is from "../is.mjs";

const elesfn = {};

function defineSwitchFunction(params) {
  return function () {
    const args = arguments;
    const changedEles = [];

    // e.g. cy.nodes().select( data, handler )
    if (args.length === 2) {
      const data = args[0];
      const handler = args[1];
      this.on(params.event, data, handler);
    }

    // e.g. cy.nodes().select( handler )
    else if (args.length === 1 && is.fn(args[0])) {
      const handler = args[0];
      this.on(params.event, handler);
    }

    // e.g. cy.nodes().select()
    // e.g. (private) cy.nodes().select(['tapselect'])
    else if (args.length === 0 || (args.length === 1 && is.array(args[0]))) {
      const addlEvents = args.length === 1 ? args[0] : null;

      for (let i = 0; i < this.length; i++) {
        const ele = this[i];
        let able = !params.ableField || ele._private[params.ableField];
        const changed = ele._private[params.field] != params.value;

        if (params.overrideAble) {
          const overrideAble = params.overrideAble(ele);

          if (overrideAble !== undefined) {
            able = overrideAble;

            if (!overrideAble) {
              return this;
            } // to save cycles assume not able for all on override
          }
        }

        if (able) {
          ele._private[params.field] = params.value;

          if (changed) {
            changedEles.push(ele);
          }
        }
      }

      const changedColl = this.spawn(changedEles);
      changedColl.updateStyle(); // change of state => possible change of style
      changedColl.emit(params.event);

      if (addlEvents) {
        changedColl.emit(addlEvents);
      }
    }

    return this;
  };
}

function defineSwitchSet(params) {
  elesfn[params.field] = function () {
    const ele = this[0];

    if (ele) {
      if (params.overrideField) {
        const val = params.overrideField(ele);

        if (val !== undefined) {
          return val;
        }
      }

      return ele._private[params.field];
    }
  };

  elesfn[params.on] = defineSwitchFunction({
    event: params.on,
    field: params.field,
    ableField: params.ableField,
    overrideAble: params.overrideAble,
    value: true,
  });

  elesfn[params.off] = defineSwitchFunction({
    event: params.off,
    field: params.field,
    ableField: params.ableField,
    overrideAble: params.overrideAble,
    value: false,
  });
}

defineSwitchSet({
  field: "locked",
  overrideField: function (ele) {
    return ele.cy().autolock() ? true : undefined;
  },
  on: "lock",
  off: "unlock",
});

defineSwitchSet({
  field: "grabbable",
  overrideField: function (ele) {
    return ele.cy().autoungrabify() || ele.pannable() ? false : undefined;
  },
  on: "grabify",
  off: "ungrabify",
});

defineSwitchSet({
  field: "selected",
  ableField: "selectable",
  overrideAble: function (ele) {
    return ele.cy().autounselectify() ? false : undefined;
  },
  on: "select",
  off: "unselect",
});

defineSwitchSet({
  field: "selectable",
  overrideField: function (ele) {
    return ele.cy().autounselectify() ? false : undefined;
  },
  on: "selectify",
  off: "unselectify",
});

elesfn.deselect = elesfn.unselect;

elesfn.grabbed = function () {
  const ele = this[0];
  if (ele) {
    return ele._private.grabbed;
  }
};

defineSwitchSet({
  field: "active",
  on: "activate",
  off: "unactivate",
});

defineSwitchSet({
  field: "pannable",
  on: "panify",
  off: "unpanify",
});

elesfn.inactive = function () {
  const ele = this[0];
  if (ele) {
    return !ele._private.active;
  }
};

export default elesfn;
