import * as util from "../util/index.mjs";
import * as is from "../is.mjs";
import Promise from "../promise.mjs";

const styfn = {};

// keys for style blocks, e.g. ttfftt
const TRUE = "t";
const FALSE = "f";

// (potentially expensive calculation)
// apply the style to the element based on
// - its bypass
// - what selectors match it
styfn.apply = function (eles) {
  const self = this;
  const _p = self._private;
  const cy = _p.cy;
  const updatedEles = cy.collection();

  for (let ie = 0; ie < eles.length; ie++) {
    const ele = eles[ie];
    const cxtMeta = self.getContextMeta(ele);

    if (cxtMeta.empty) {
      continue;
    }

    const cxtStyle = self.getContextStyle(cxtMeta);
    const app = self.applyContextStyle(cxtMeta, cxtStyle, ele);

    if (ele._private.appliedInitStyle) {
      self.updateTransitions(ele, app.diffProps);
    } else {
      ele._private.appliedInitStyle = true;
    }

    const hintsDiff = self.updateStyleHints(ele);

    if (hintsDiff) {
      updatedEles.push(ele);
    }
  } // for elements

  return updatedEles;
};

styfn.getPropertiesDiff = function (oldCxtKey, newCxtKey) {
  const self = this;
  const cache = (self._private.propDiffs = self._private.propDiffs || {});
  const dualCxtKey = oldCxtKey + "-" + newCxtKey;
  const cachedVal = cache[dualCxtKey];

  if (cachedVal) {
    return cachedVal;
  }

  const diffProps = [];
  const addedProp = {};

  for (let i = 0; i < self.length; i++) {
    const cxt = self[i];
    const oldHasCxt = oldCxtKey[i] === TRUE;
    const newHasCxt = newCxtKey[i] === TRUE;
    const cxtHasDiffed = oldHasCxt !== newHasCxt;
    const cxtHasMappedProps = cxt.mappedProperties.length > 0;

    if (cxtHasDiffed || (newHasCxt && cxtHasMappedProps)) {
      let props;

      if (cxtHasDiffed && cxtHasMappedProps) {
        props = cxt.properties; // suffices b/c mappedProperties is a subset of properties
      } else if (cxtHasDiffed) {
        props = cxt.properties; // need to check them all
      } else if (cxtHasMappedProps) {
        props = cxt.mappedProperties; // only need to check mapped
      }

      for (let j = 0; j < props.length; j++) {
        const prop = props[j];
        const name = prop.name;

        // if a later context overrides this property, then the fact that this context has switched/diffed doesn't matter
        // (semi expensive check since it makes this function O(n^2) on context length, but worth it since overall result
        // is cached)
        let laterCxtOverrides = false;
        for (let k = i + 1; k < self.length; k++) {
          const laterCxt = self[k];
          const hasLaterCxt = newCxtKey[k] === TRUE;

          if (!hasLaterCxt) {
            continue;
          } // can't override unless the context is active

          laterCxtOverrides = laterCxt.properties[prop.name] != null;

          if (laterCxtOverrides) {
            break;
          } // exit early as long as one later context overrides
        }

        if (!addedProp[name] && !laterCxtOverrides) {
          addedProp[name] = true;
          diffProps.push(name);
        }
      } // for props
    } // if
  } // for contexts

  cache[dualCxtKey] = diffProps;
  return diffProps;
};

styfn.getContextMeta = function (ele) {
  const self = this;
  let cxtKey = "";
  let diffProps;
  const prevKey = ele._private.styleCxtKey || "";

  // get the cxt key
  for (let i = 0; i < self.length; i++) {
    const context = self[i];
    const contextSelectorMatches =
      context.selector && context.selector.matches(ele); // NB: context.selector may be null for 'core'

    if (contextSelectorMatches) {
      cxtKey += TRUE;
    } else {
      cxtKey += FALSE;
    }
  } // for context

  diffProps = self.getPropertiesDiff(prevKey, cxtKey);

  ele._private.styleCxtKey = cxtKey;

  return {
    key: cxtKey,
    diffPropNames: diffProps,
    empty: diffProps.length === 0,
  };
};

// gets a computed ele style object based on matched contexts
styfn.getContextStyle = function (cxtMeta) {
  const cxtKey = cxtMeta.key;
  const self = this;
  const cxtStyles = (this._private.contextStyles =
    this._private.contextStyles || {});

  // if already computed style, returned cached copy
  if (cxtStyles[cxtKey]) {
    return cxtStyles[cxtKey];
  }

  const style = {
    _private: {
      key: cxtKey,
    },
  };

  for (let i = 0; i < self.length; i++) {
    const cxt = self[i];
    const hasCxt = cxtKey[i] === TRUE;

    if (!hasCxt) {
      continue;
    }

    for (let j = 0; j < cxt.properties.length; j++) {
      const prop = cxt.properties[j];

      style[prop.name] = prop;
    }
  }

  cxtStyles[cxtKey] = style;
  return style;
};

styfn.applyContextStyle = function (cxtMeta, cxtStyle, ele) {
  const self = this;
  const diffProps = cxtMeta.diffPropNames;
  const retDiffProps = {};
  const types = self.types;

  for (let i = 0; i < diffProps.length; i++) {
    const diffPropName = diffProps[i];
    let cxtProp = cxtStyle[diffPropName];
    const eleProp = ele.pstyle(diffPropName);

    if (!cxtProp) {
      // no context prop means delete
      if (!eleProp) {
        continue; // no existing prop means nothing needs to be removed
        // nb affects initial application on mapped values like control-point-distances
      } else if (eleProp.bypass) {
        cxtProp = { name: diffPropName, deleteBypassed: true };
      } else {
        cxtProp = { name: diffPropName, delete: true };
      }
    }

    // save cycles when the context prop doesn't need to be applied
    if (eleProp === cxtProp) {
      continue;
    }

    // save cycles when a mapped context prop doesn't need to be applied
    if (
      cxtProp.mapped === types.fn && // context prop is function mapper
      eleProp != null && // some props can be null even by default (e.g. a prop that overrides another one)
      eleProp.mapping != null && // ele prop is a concrete value from from a mapper
      eleProp.mapping.value === cxtProp.value // the current prop on the ele is a flat prop value for the function mapper
    ) {
      // NB don't write to cxtProp, as it's shared among eles (stored in stylesheet)
      const mapping = eleProp.mapping; // can write to mapping, as it's a per-ele copy
      const fnValue = (mapping.fnValue = cxtProp.value(ele)); // temporarily cache the value in case of a miss

      if (fnValue === mapping.prevFnValue) {
        continue;
      }
    }

    const retDiffProp = (retDiffProps[diffPropName] = {
      prev: eleProp,
    });

    self.applyParsedProperty(ele, cxtProp);

    retDiffProp.next = ele.pstyle(diffPropName);

    if (retDiffProp.next && retDiffProp.next.bypass) {
      retDiffProp.next = retDiffProp.next.bypassed;
    }
  }

  return {
    diffProps: retDiffProps,
  };
};

styfn.updateStyleHints = function (ele) {
  const _p = ele._private;
  const self = this;
  let propNames = self.propertyGroupNames;
  const propGrKeys = self.propertyGroupKeys;
  const propHash = (ele, propNames, seedKey) =>
    self.getPropertiesHash(ele, propNames, seedKey);
  const oldStyleKey = _p.styleKey;

  if (ele.removed()) {
    return false;
  }

  const isNode = _p.group === "nodes";

  // get the style key hashes per prop group
  // but lazily -- only use non-default prop values to reduce the number of hashes
  //

  const overriddenStyles = ele._private.style;

  propNames = Object.keys(overriddenStyles);

  for (let i = 0; i < propGrKeys.length; i++) {
    const grKey = propGrKeys[i];

    _p.styleKeys[grKey] = [util.DEFAULT_HASH_SEED, util.DEFAULT_HASH_SEED_ALT];
  }

  const updateGrKey1 = (val, grKey) =>
    (_p.styleKeys[grKey][0] = util.hashInt(val, _p.styleKeys[grKey][0]));
  const updateGrKey2 = (val, grKey) =>
    (_p.styleKeys[grKey][1] = util.hashIntAlt(val, _p.styleKeys[grKey][1]));

  const updateGrKey = (val, grKey) => {
    updateGrKey1(val, grKey);
    updateGrKey2(val, grKey);
  };

  const updateGrKeyWStr = (strVal, grKey) => {
    for (let j = 0; j < strVal.length; j++) {
      const ch = strVal.charCodeAt(j);

      updateGrKey1(ch, grKey);
      updateGrKey2(ch, grKey);
    }
  };

  // - hashing works on 32 bit ints b/c we use bitwise ops
  // - small numbers get cut off (e.g. 0.123 is seen as 0 by the hashing function)
  // - raise up small numbers so more significant digits are seen by hashing
  // - make small numbers larger than a normal value to avoid collisions
  // - works in practice and it's relatively cheap
  const N = 2000000000;
  const cleanNum = (val) =>
    -128 < val && val < 128 && Math.floor(val) !== val
      ? N - ((val * 1024) | 0)
      : val;

  for (let i = 0; i < propNames.length; i++) {
    const name = propNames[i];
    const parsedProp = overriddenStyles[name];

    if (parsedProp == null) {
      continue;
    }

    const propInfo = this.properties[name];
    const type = propInfo.type;
    const grKey = propInfo.groupKey;
    let normalizedNumberVal;

    if (propInfo.hashOverride != null) {
      normalizedNumberVal = propInfo.hashOverride(ele, parsedProp);
    } else if (parsedProp.pfValue != null) {
      normalizedNumberVal = parsedProp.pfValue;
    }

    // might not be a number if it allows enums
    const numberVal = propInfo.enums == null ? parsedProp.value : null;
    const haveNormNum = normalizedNumberVal != null;
    const haveUnitedNum = numberVal != null;
    const haveNum = haveNormNum || haveUnitedNum;
    const units = parsedProp.units;

    // numbers are cheaper to hash than strings
    // 1 hash op vs n hash ops (for length n string)
    if (type.number && haveNum && !type.multiple) {
      const v = haveNormNum ? normalizedNumberVal : numberVal;

      updateGrKey(cleanNum(v), grKey);

      if (!haveNormNum && units != null) {
        updateGrKeyWStr(units, grKey);
      }
    } else {
      updateGrKeyWStr(parsedProp.strValue, grKey);
    }
  }

  // overall style key
  //

  const hash = [util.DEFAULT_HASH_SEED, util.DEFAULT_HASH_SEED_ALT];

  for (let i = 0; i < propGrKeys.length; i++) {
    const grKey = propGrKeys[i];
    const grHash = _p.styleKeys[grKey];

    hash[0] = util.hashInt(grHash[0], hash[0]);
    hash[1] = util.hashIntAlt(grHash[1], hash[1]);
  }

  _p.styleKey = util.combineHashes(hash[0], hash[1]);

  // label dims
  //

  const sk = _p.styleKeys;

  _p.labelDimsKey = util.combineHashesArray(sk.labelDimensions);

  const labelKeys = propHash(ele, ["label"], sk.labelDimensions);

  _p.labelKey = util.combineHashesArray(labelKeys);
  _p.labelStyleKey = util.combineHashesArray(
    util.hashArrays(sk.commonLabel, labelKeys),
  );

  if (!isNode) {
    const sourceLabelKeys = propHash(ele, ["source-label"], sk.labelDimensions);
    _p.sourceLabelKey = util.combineHashesArray(sourceLabelKeys);
    _p.sourceLabelStyleKey = util.combineHashesArray(
      util.hashArrays(sk.commonLabel, sourceLabelKeys),
    );

    const targetLabelKeys = propHash(ele, ["target-label"], sk.labelDimensions);
    _p.targetLabelKey = util.combineHashesArray(targetLabelKeys);
    _p.targetLabelStyleKey = util.combineHashesArray(
      util.hashArrays(sk.commonLabel, targetLabelKeys),
    );
  }

  // node
  //

  if (isNode) {
    let {
      nodeBody,
      nodeBorder,
      nodeOutline,
      backgroundImage,
      compound,
      pie,
      stripe,
    } = _p.styleKeys;

    const nodeKeys = [
      nodeBody,
      nodeBorder,
      nodeOutline,
      backgroundImage,
      compound,
      pie,
      stripe,
    ]
      .filter((k) => k != null)
      .reduce(util.hashArrays, [
        util.DEFAULT_HASH_SEED,
        util.DEFAULT_HASH_SEED_ALT,
      ]);
    _p.nodeKey = util.combineHashesArray(nodeKeys);

    _p.hasPie =
      pie != null &&
      pie[0] !== util.DEFAULT_HASH_SEED &&
      pie[1] !== util.DEFAULT_HASH_SEED_ALT;

    _p.hasStripe =
      stripe != null &&
      stripe[0] !== util.DEFAULT_HASH_SEED &&
      stripe[1] !== util.DEFAULT_HASH_SEED_ALT;
  }

  return oldStyleKey !== _p.styleKey;
};

styfn.clearStyleHints = function (ele) {
  const _p = ele._private;

  _p.styleCxtKey = "";
  _p.styleKeys = {};
  _p.styleKey = null;
  _p.labelKey = null;
  _p.labelStyleKey = null;
  _p.sourceLabelKey = null;
  _p.sourceLabelStyleKey = null;
  _p.targetLabelKey = null;
  _p.targetLabelStyleKey = null;
  _p.nodeKey = null;
  _p.hasPie = null;
  _p.hasStripe = null;
};

// apply a property to the style (for internal use)
// returns whether application was successful
//
// now, this function flattens the property, and here's how:
//
// for parsedProp:{ bypass: true, deleteBypass: true }
// no property is generated, instead the bypass property in the
// element's style is replaced by what's pointed to by the `bypassed`
// field in the bypass property (i.e. restoring the property the
// bypass was overriding)
//
// for parsedProp:{ mapped: truthy }
// the generated flattenedProp:{ mapping: prop }
//
// for parsedProp:{ bypass: true }
// the generated flattenedProp:{ bypassed: parsedProp }
styfn.applyParsedProperty = function (ele, parsedProp) {
  const self = this;
  let prop = parsedProp;
  const style = ele._private.style;
  let flatProp;
  const types = self.types;
  const type = self.properties[prop.name].type;
  const propIsBypass = prop.bypass;
  const origProp = style[prop.name];
  const origPropIsBypass = origProp && origProp.bypass;
  const _p = ele._private;
  const flatPropMapping = "mapping";

  const getVal = (p) => {
    if (p == null) {
      return null;
    } else if (p.pfValue != null) {
      return p.pfValue;
    } else {
      return p.value;
    }
  };

  const checkTriggers = () => {
    const fromVal = getVal(origProp);
    const toVal = getVal(prop);

    self.checkTriggers(ele, prop.name, fromVal, toVal);
  };

  // edge sanity checks to prevent the client from making serious mistakes
  if (
    parsedProp.name === "curve-style" &&
    ele.isEdge() && // loops must be bundled beziers
    ((parsedProp.value !== "bezier" && ele.isLoop()) || // edges connected to compound nodes can not be haystacks
      (parsedProp.value === "haystack" &&
        (ele.source().isParent() || ele.target().isParent())))
  ) {
    prop = parsedProp = this.parse(parsedProp.name, "bezier", propIsBypass);
  }

  if (prop.delete) {
    // delete the property and use the default value on falsey value
    style[prop.name] = undefined;

    checkTriggers();

    return true;
  }

  if (prop.deleteBypassed) {
    // delete the property that the
    if (!origProp) {
      checkTriggers();

      return true; // can't delete if no prop
    } else if (origProp.bypass) {
      // delete bypassed
      origProp.bypassed = undefined;

      checkTriggers();

      return true;
    } else {
      return false; // we're unsuccessful deleting the bypassed
    }
  }

  // check if we need to delete the current bypass
  if (prop.deleteBypass) {
    // then this property is just here to indicate we need to delete
    if (!origProp) {
      checkTriggers();

      return true; // property is already not defined
    } else if (origProp.bypass) {
      // then replace the bypass property with the original
      // because the bypassed property was already applied (and therefore parsed), we can just replace it (no reapplying necessary)
      style[prop.name] = origProp.bypassed;

      checkTriggers();

      return true;
    } else {
      return false; // we're unsuccessful deleting the bypass
    }
  }

  const printMappingErr = function () {
    util.warn(
      "Do not assign mappings to elements without corresponding data (i.e. ele `" +
        ele.id() +
        "` has no mapping for property `" +
        prop.name +
        "` with data field `" +
        prop.field +
        "`); try a `[" +
        prop.field +
        "]` selector to limit scope to elements with `" +
        prop.field +
        "` defined",
    );
  };

  // put the property in the style objects
  switch (
    prop.mapped // flatten the property if mapped
  ) {
    case types.mapData: {
      // flatten the field (e.g. data.foo.bar)
      const fields = prop.field.split(".");
      let fieldVal = _p.data;

      for (let i = 0; i < fields.length && fieldVal; i++) {
        const field = fields[i];
        fieldVal = fieldVal[field];
      }

      if (fieldVal == null) {
        printMappingErr();
        return false;
      }

      let percent;
      if (!is.number(fieldVal)) {
        // then don't apply and fall back on the existing style
        util.warn(
          "Do not use continuous mappers without specifying numeric data (i.e. `" +
            prop.field +
            ": " +
            fieldVal +
            "` for `" +
            ele.id() +
            "` is non-numeric)",
        );
        return false;
      } else {
        const fieldWidth = prop.fieldMax - prop.fieldMin;

        if (fieldWidth === 0) {
          // safety check -- not strictly necessary as no props of zero range should be passed here
          percent = 0;
        } else {
          percent = (fieldVal - prop.fieldMin) / fieldWidth;
        }
      }

      // make sure to bound percent value
      if (percent < 0) {
        percent = 0;
      } else if (percent > 1) {
        percent = 1;
      }

      if (type.color) {
        const r1 = prop.valueMin[0];
        const r2 = prop.valueMax[0];
        const g1 = prop.valueMin[1];
        const g2 = prop.valueMax[1];
        const b1 = prop.valueMin[2];
        const b2 = prop.valueMax[2];
        const a1 = prop.valueMin[3] == null ? 1 : prop.valueMin[3];
        const a2 = prop.valueMax[3] == null ? 1 : prop.valueMax[3];

        const clr = [
          Math.round(r1 + (r2 - r1) * percent),
          Math.round(g1 + (g2 - g1) * percent),
          Math.round(b1 + (b2 - b1) * percent),
          Math.round(a1 + (a2 - a1) * percent),
        ];

        flatProp = {
          // colours are simple, so just create the flat property instead of expensive string parsing
          bypass: prop.bypass, // we're a bypass if the mapping property is a bypass
          name: prop.name,
          value: clr,
          strValue: "rgb(" + clr[0] + ", " + clr[1] + ", " + clr[2] + ")",
        };
      } else if (type.number) {
        const calcValue =
          prop.valueMin + (prop.valueMax - prop.valueMin) * percent;
        flatProp = this.parse(
          prop.name,
          calcValue,
          prop.bypass,
          flatPropMapping,
        );
      } else {
        return false; // can only map to colours and numbers
      }

      if (!flatProp) {
        // if we can't flatten the property, then don't apply the property and fall back on the existing style
        printMappingErr();
        return false;
      }

      flatProp.mapping = prop; // keep a reference to the mapping
      prop = flatProp; // the flattened (mapped) property is the one we want

      break;
    }

    // direct mapping
    case types.data: {
      // flatten the field (e.g. data.foo.bar)
      const fields = prop.field.split(".");
      let fieldVal = _p.data;

      for (let i = 0; i < fields.length && fieldVal; i++) {
        const field = fields[i];
        fieldVal = fieldVal[field];
      }

      if (fieldVal != null) {
        flatProp = this.parse(
          prop.name,
          fieldVal,
          prop.bypass,
          flatPropMapping,
        );
      }

      if (!flatProp) {
        // if we can't flatten the property, then don't apply and fall back on the existing style
        printMappingErr();
        return false;
      }

      flatProp.mapping = prop; // keep a reference to the mapping
      prop = flatProp; // the flattened (mapped) property is the one we want

      break;
    }

    case types.fn: {
      const fn = prop.value;
      const fnRetVal = prop.fnValue != null ? prop.fnValue : fn(ele); // check for cached value before calling function

      prop.prevFnValue = fnRetVal;

      if (fnRetVal == null) {
        util.warn(
          "Custom function mappers may not return null (i.e. `" +
            prop.name +
            "` for ele `" +
            ele.id() +
            "` is null)",
        );
        return false;
      }

      flatProp = this.parse(prop.name, fnRetVal, prop.bypass, flatPropMapping);

      if (!flatProp) {
        util.warn(
          "Custom function mappers may not return invalid values for the property type (i.e. `" +
            prop.name +
            "` for ele `" +
            ele.id() +
            "` is invalid)",
        );
        return false;
      }

      flatProp.mapping = util.copy(prop); // keep a reference to the mapping
      prop = flatProp; // the flattened (mapped) property is the one we want

      break;
    }

    case undefined:
      break; // just set the property

    default:
      return false; // not a valid mapping
  }

  // if the property is a bypass property, then link the resultant property to the original one
  if (propIsBypass) {
    if (origPropIsBypass) {
      // then this bypass overrides the existing one
      prop.bypassed = origProp.bypassed; // steal bypassed prop from old bypass
    } else {
      // then link the orig prop to the new bypass
      prop.bypassed = origProp;
    }

    style[prop.name] = prop; // and set
  } else {
    // prop is not bypass
    if (origPropIsBypass) {
      // then keep the orig prop (since it's a bypass) and link to the new prop
      origProp.bypassed = prop;
    } else {
      // then just replace the old prop with the new one
      style[prop.name] = prop;
    }
  }

  checkTriggers();

  return true;
};

styfn.cleanElements = function (eles, keepBypasses) {
  for (let i = 0; i < eles.length; i++) {
    const ele = eles[i];

    this.clearStyleHints(ele);

    ele.dirtyCompoundBoundsCache();
    ele.dirtyBoundingBoxCache();

    if (!keepBypasses) {
      ele._private.style = {};
    } else {
      const style = ele._private.style;
      const propNames = Object.keys(style);

      for (let j = 0; j < propNames.length; j++) {
        const propName = propNames[j];
        const eleProp = style[propName];

        if (eleProp != null) {
          if (eleProp.bypass) {
            eleProp.bypassed = null;
          } else {
            style[propName] = null;
          }
        }
      }
    }
  }
};

// updates the visual style for all elements (useful for manual style modification after init)
styfn.update = function () {
  const cy = this._private.cy;
  const eles = cy.mutableElements();

  eles.updateStyle();
};

// diffProps : { name => { prev, next } }
styfn.updateTransitions = function (ele, diffProps) {
  const self = this;
  const _p = ele._private;
  const props = ele.pstyle("transition-property").value;
  const duration = ele.pstyle("transition-duration").pfValue;
  const delay = ele.pstyle("transition-delay").pfValue;

  if (props.length > 0 && duration > 0) {
    const style = {};

    // build up the style to animate towards
    let anyPrev = false;
    for (let i = 0; i < props.length; i++) {
      const prop = props[i];
      const styProp = ele.pstyle(prop);
      const diffProp = diffProps[prop];

      if (!diffProp) {
        continue;
      }

      const prevProp = diffProp.prev;
      const fromProp = prevProp;
      const toProp = diffProp.next != null ? diffProp.next : styProp;
      let diff = false;
      let initVal;
      const initDt = 0.000001; // delta time % value for initVal (allows animating out of init zero opacity)

      if (!fromProp) {
        continue;
      }

      // consider px values
      if (is.number(fromProp.pfValue) && is.number(toProp.pfValue)) {
        diff = toProp.pfValue - fromProp.pfValue; // nonzero is truthy
        initVal = fromProp.pfValue + initDt * diff;

        // consider numerical values
      } else if (is.number(fromProp.value) && is.number(toProp.value)) {
        diff = toProp.value - fromProp.value; // nonzero is truthy
        initVal = fromProp.value + initDt * diff;

        // consider colour values
      } else if (is.array(fromProp.value) && is.array(toProp.value)) {
        diff =
          fromProp.value[0] !== toProp.value[0] ||
          fromProp.value[1] !== toProp.value[1] ||
          fromProp.value[2] !== toProp.value[2];

        initVal = fromProp.strValue;
      }

      // the previous value is good for an animation only if it's different
      if (diff) {
        style[prop] = toProp.strValue; // to val
        this.applyBypass(ele, prop, initVal); // from val
        anyPrev = true;
      }
    } // end if props allow ani

    // can't transition if there's nothing previous to transition from
    if (!anyPrev) {
      return;
    }

    _p.transitioning = true;

    new Promise(function (resolve) {
      if (delay > 0) {
        ele.delayAnimation(delay).play().promise().then(resolve);
      } else {
        resolve();
      }
    })
      .then(function () {
        return ele
          .animation({
            style: style,
            duration: duration,
            easing: ele.pstyle("transition-timing-function").value,
            queue: false,
          })
          .play()
          .promise();
      })
      .then(function () {
        // if( !isBypass ){
        self.removeBypasses(ele, props);
        ele.emitAndNotify("style");
        // }

        _p.transitioning = false;
      });
  } else if (_p.transitioning) {
    this.removeBypasses(ele, props);
    ele.emitAndNotify("style");

    _p.transitioning = false;
  }
};

styfn.checkTrigger = function (
  ele,
  name,
  fromValue,
  toValue,
  getTrigger,
  onTrigger,
) {
  const prop = this.properties[name];
  const triggerCheck = getTrigger(prop);

  if (ele.removed()) {
    return;
  }

  if (triggerCheck != null && triggerCheck(fromValue, toValue, ele)) {
    onTrigger(prop);
  }
};

styfn.checkZOrderTrigger = function (ele, name, fromValue, toValue) {
  this.checkTrigger(
    ele,
    name,
    fromValue,
    toValue,
    (prop) => prop.triggersZOrder,
    () => {
      this._private.cy.notify("zorder", ele);
    },
  );
};

styfn.checkBoundsTrigger = function (ele, name, fromValue, toValue) {
  this.checkTrigger(
    ele,
    name,
    fromValue,
    toValue,
    (prop) => prop.triggersBounds,
    (prop) => {
      ele.dirtyCompoundBoundsCache();
      ele.dirtyBoundingBoxCache();
    },
  );
};

styfn.checkConnectedEdgesBoundsTrigger = function (
  ele,
  name,
  fromValue,
  toValue,
) {
  this.checkTrigger(
    ele,
    name,
    fromValue,
    toValue,
    (prop) => prop.triggersBoundsOfConnectedEdges,
    (prop) => {
      ele.connectedEdges().forEach((edge) => {
        edge.dirtyBoundingBoxCache();
      });
    },
  );
};

styfn.checkParallelEdgesBoundsTrigger = function (
  ele,
  name,
  fromValue,
  toValue,
) {
  this.checkTrigger(
    ele,
    name,
    fromValue,
    toValue,
    (prop) => prop.triggersBoundsOfParallelEdges,
    (prop) => {
      ele.parallelEdges().forEach((pllEdge) => {
        pllEdge.dirtyBoundingBoxCache();
      });
    },
  );
};

styfn.checkTriggers = function (ele, name, fromValue, toValue) {
  ele.dirtyStyleCache();

  this.checkZOrderTrigger(ele, name, fromValue, toValue);
  this.checkBoundsTrigger(ele, name, fromValue, toValue);
  this.checkConnectedEdgesBoundsTrigger(ele, name, fromValue, toValue);
  this.checkParallelEdgesBoundsTrigger(ele, name, fromValue, toValue);
};

export default styfn;
