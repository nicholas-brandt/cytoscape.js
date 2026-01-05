import { matches as queryMatches } from "./query-type-match.mjs";
import Type from "./type.mjs";

// filter an existing collection
const filter = function (collection) {
  const self = this;

  // for 1 id #foo queries, just get the element
  if (
    self.length === 1 &&
    self[0].checks.length === 1 &&
    self[0].checks[0].type === Type.ID
  ) {
    return collection.getElementById(self[0].checks[0].value).collection();
  }

  const selectorFunction = function (element) {
    for (let j = 0; j < self.length; j++) {
      const query = self[j];

      if (queryMatches(query, element)) {
        return true;
      }
    }

    return false;
  };

  if (self.text() == null) {
    selectorFunction = function () {
      return true;
    };
  }

  return collection.filter(selectorFunction);
}; // filter

// does selector match a single element?
const matches = function (ele) {
  const self = this;

  for (let j = 0; j < self.length; j++) {
    const query = self[j];

    if (queryMatches(query, ele)) {
      return true;
    }
  }

  return false;
}; // matches

export default { matches, filter };
