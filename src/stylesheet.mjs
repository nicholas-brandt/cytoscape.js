import * as is from "./is.mjs";
import Style from "./style/index.mjs";
import { dash2camel } from "./util/index.mjs";

// a dummy stylesheet object that doesn't need a reference to the core
// (useful for init)
const Stylesheet = function () {
  if (!(this instanceof Stylesheet)) {
    return new Stylesheet();
  }

  this.length = 0;
};

const sheetfn = Stylesheet.prototype;

sheetfn.instanceString = function () {
  return "stylesheet";
};

// just store the selector to be parsed later
sheetfn.selector = function (selector) {
  const i = this.length++;

  this[i] = {
    selector: selector,
    properties: [],
  };

  return this; // chaining
};

// just store the property to be parsed later
sheetfn.css = function (name, value) {
  const i = this.length - 1;

  if (is.string(name)) {
    this[i].properties.push({
      name: name,
      value: value,
    });
  } else if (is.plainObject(name)) {
    const map = name;
    const propNames = Object.keys(map);

    for (let j = 0; j < propNames.length; j++) {
      const key = propNames[j];
      const mapVal = map[key];

      if (mapVal == null) {
        continue;
      }

      const prop = Style.properties[key] || Style.properties[dash2camel(key)];

      if (prop == null) {
        continue;
      }

      const name = prop.name;
      const value = mapVal;

      this[i].properties.push({
        name: name,
        value: value,
      });
    }
  }

  return this; // chaining
};

sheetfn.style = sheetfn.css;

// generate a real style object from the dummy stylesheet
sheetfn.generateStyle = function (cy) {
  const style = new Style(cy);

  return this.appendToStyle(style);
};

// append a dummy stylesheet object on a real style object
sheetfn.appendToStyle = function (style) {
  for (let i = 0; i < this.length; i++) {
    const context = this[i];
    const selector = context.selector;
    const props = context.properties;

    style.selector(selector); // apply selector

    for (let j = 0; j < props.length; j++) {
      const prop = props[j];

      style.css(prop.name, prop.value); // apply property
    }
  }

  return style;
};

export default Stylesheet;
