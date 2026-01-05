import * as is from "../is.mjs";
import * as util from "../util/index.mjs";

const styfn = {};

// bypasses are applied to an existing style on an element, and just tacked on temporarily
// returns true iff application was successful for at least 1 specified property
styfn.applyBypass = function (eles, name, value, updateTransitions) {
  const self = this;
  const props = [];
  const isBypass = true;

  // put all the properties (can specify one or many) in an array after parsing them
  if (name === "*" || name === "**") {
    // apply to all property names

    if (value !== undefined) {
      for (let i = 0; i < self.properties.length; i++) {
        const prop = self.properties[i];
        const name = prop.name;

        const parsedProp = this.parse(name, value, true);

        if (parsedProp) {
          props.push(parsedProp);
        }
      }
    }
  } else if (is.string(name)) {
    // then parse the single property
    const parsedProp = this.parse(name, value, true);

    if (parsedProp) {
      props.push(parsedProp);
    }
  } else if (is.plainObject(name)) {
    // then parse each property
    const specifiedProps = name;
    updateTransitions = value;

    const names = Object.keys(specifiedProps);

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const value = specifiedProps[name];

      if (value === undefined) {
        // try camel case name too
        value = specifiedProps[util.dash2camel(name)];
      }

      if (value !== undefined) {
        const parsedProp = this.parse(name, value, true);

        if (parsedProp) {
          props.push(parsedProp);
        }
      }
    }
  } else {
    // can't do anything without well defined properties
    return false;
  }

  // we've failed if there are no valid properties
  if (props.length === 0) {
    return false;
  }

  // now, apply the bypass properties on the elements
  const ret = false; // return true if at least one succesful bypass applied
  for (let i = 0; i < eles.length; i++) {
    // for each ele
    const ele = eles[i];
    const diffProps = {};
    let diffProp;

    for (let j = 0; j < props.length; j++) {
      // for each prop
      const prop = props[j];

      if (updateTransitions) {
        const prevProp = ele.pstyle(prop.name);
        diffProp = diffProps[prop.name] = { prev: prevProp };
      }

      ret = this.applyParsedProperty(ele, util.copy(prop)) || ret;

      if (updateTransitions) {
        diffProp.next = ele.pstyle(prop.name);
      }
    } // for props

    if (ret) {
      this.updateStyleHints(ele);
    }

    if (updateTransitions) {
      this.updateTransitions(ele, diffProps, isBypass);
    }
  } // for eles

  return ret;
};

// only useful in specific cases like animation
styfn.overrideBypass = function (eles, name, value) {
  name = util.camel2dash(name);

  for (let i = 0; i < eles.length; i++) {
    const ele = eles[i];
    const prop = ele._private.style[name];
    const type = this.properties[name].type;
    const isColor = type.color;
    const isMulti = type.mutiple;
    const oldValue = !prop
      ? null
      : prop.pfValue != null
        ? prop.pfValue
        : prop.value;

    if (!prop || !prop.bypass) {
      // need a bypass if one doesn't exist
      this.applyBypass(ele, name, value);
    } else {
      prop.value = value;

      if (prop.pfValue != null) {
        prop.pfValue = value;
      }

      if (isColor) {
        prop.strValue = "rgb(" + value.join(",") + ")";
      } else if (isMulti) {
        prop.strValue = value.join(" ");
      } else {
        prop.strValue = "" + value;
      }

      this.updateStyleHints(ele);
    }

    this.checkTriggers(ele, name, oldValue, value);
  }
};

styfn.removeAllBypasses = function (eles, updateTransitions) {
  return this.removeBypasses(eles, this.propertyNames, updateTransitions);
};

styfn.removeBypasses = function (eles, props, updateTransitions) {
  const isBypass = true;

  for (let j = 0; j < eles.length; j++) {
    const ele = eles[j];
    const diffProps = {};

    for (let i = 0; i < props.length; i++) {
      const name = props[i];
      const prop = this.properties[name];
      const prevProp = ele.pstyle(prop.name);

      if (!prevProp || !prevProp.bypass) {
        // if a bypass doesn't exist for the prop, nothing needs to be removed
        continue;
      }

      const value = ""; // empty => remove bypass
      const parsedProp = this.parse(name, value, true);
      const diffProp = (diffProps[prop.name] = { prev: prevProp });

      this.applyParsedProperty(ele, parsedProp);

      diffProp.next = ele.pstyle(prop.name);
    } // for props

    this.updateStyleHints(ele);

    if (updateTransitions) {
      this.updateTransitions(ele, diffProps, isBypass);
    }
  } // for eles
};

export default styfn;
