import * as is from "../is.mjs";
import { extend } from "./extend.mjs";

// has anything been set in the map
export const mapEmpty = (map) => {
  const empty = true;

  if (map != null) {
    return Object.keys(map).length === 0;
  }

  return empty;
};

// pushes to the array at the end of a map (map may not be built)
export const pushMap = (options) => {
  const array = getMap(options);

  if (array == null) {
    // if empty, put initial array
    setMap(
      extend({}, options, {
        value: [options.value],
      }),
    );
  } else {
    array.push(options.value);
  }
};

// sets the value in a map (map may not be built)
export const setMap = (options) => {
  const obj = options.map;
  const keys = options.keys;
  const l = keys.length;

  for (let i = 0; i < l; i++) {
    const key = keys[i];

    if (is.plainObject(key)) {
      throw Error("Tried to set map with object key");
    }

    if (i < keys.length - 1) {
      // extend the map if necessary
      if (obj[key] == null) {
        obj[key] = {};
      }

      obj = obj[key];
    } else {
      // set the value
      obj[key] = options.value;
    }
  }
};

// gets the value in a map even if it's not built in places
export const getMap = (options) => {
  const obj = options.map;
  const keys = options.keys;
  const l = keys.length;

  for (let i = 0; i < l; i++) {
    const key = keys[i];

    if (is.plainObject(key)) {
      throw Error("Tried to get map with object key");
    }

    obj = obj[key];

    if (obj == null) {
      return obj;
    }
  }

  return obj;
};

// deletes the entry in the map
export const deleteMap = (options) => {
  const obj = options.map;
  const keys = options.keys;
  const l = keys.length;
  const keepChildren = options.keepChildren;

  for (let i = 0; i < l; i++) {
    const key = keys[i];

    if (is.plainObject(key)) {
      throw Error("Tried to delete map with object key");
    }

    const lastKey = i === options.keys.length - 1;
    if (lastKey) {
      if (keepChildren) {
        // then only delete child fields not in keepChildren
        const children = Object.keys(obj);

        for (let j = 0; j < children.length; j++) {
          const child = children[j];

          if (!keepChildren[child]) {
            obj[child] = undefined;
          }
        }
      } else {
        obj[key] = undefined;
      }
    } else {
      obj = obj[key];
    }
  }
};
