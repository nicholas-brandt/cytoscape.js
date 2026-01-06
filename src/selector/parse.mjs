import { warn } from "../util/index.mjs";
import * as is from "../is.mjs";
import exprs from "./expressions.mjs";
import newQuery from "./new-query.mjs";
import Type from "./type.mjs";

/**
 * Of all the expressions, find the first match in the remaining text.
 * @param {string} remaining The remaining text to parse
 * @returns The matched expression and the newly remaining text `{ expr, match, name, remaining }`
 */
const consumeExpr = (remaining) => {
  let expr;
  let match;
  let name;

  for (let j = 0; j < exprs.length; j++) {
    const e = exprs[j];
    const n = e.name;

    const m = remaining.match(e.regexObj);

    if (m != null) {
      match = m;
      expr = e;
      name = n;

      const consumed = m[0];
      remaining = remaining.substring(consumed.length);

      break; // we've consumed one expr, so we can return now
    }
  }

  return {
    expr: expr,
    match: match,
    name: name,
    remaining: remaining,
  };
};

/**
 * Consume all the leading whitespace
 * @param {string} remaining The text to consume
 * @returns The text with the leading whitespace removed
 */
const consumeWhitespace = (remaining) => {
  const match = remaining.match(/^\s+/);

  if (match) {
    const consumed = match[0];
    remaining = remaining.substring(consumed.length);
  }

  return remaining;
};

/**
 * Parse the string and store the parsed representation in the Selector.
 * @param {string} selector The selector string
 * @returns `true` if the selector was successfully parsed, `false` otherwise
 */
const parse = function (selector) {
  const self = this;

  let remaining = (self.inputText = selector);

  let currentQuery = (self[0] = newQuery());
  self.length = 1;

  remaining = consumeWhitespace(remaining); // get rid of leading whitespace

  for (;;) {
    const exprInfo = consumeExpr(remaining);

    if (exprInfo.expr == null) {
      warn("The selector `" + selector + "`is invalid");
      return false;
    } else {
      const args = exprInfo.match.slice(1);

      // let the token populate the selector object in currentQuery
      const ret = exprInfo.expr.populate(self, currentQuery, args);

      if (ret === false) {
        return false; // exit if population failed
      } else if (ret != null) {
        currentQuery = ret; // change the current query to be filled if the expr specifies
      }
    }

    remaining = exprInfo.remaining;

    // we're done when there's nothing left to parse
    if (remaining.match(/^\s*$/)) {
      break;
    }
  }

  const lastQ = self[self.length - 1];

  if (self.currentSubject != null) {
    lastQ.subject = self.currentSubject;
  }

  lastQ.edgeCount = self.edgeCount;
  lastQ.compoundCount = self.compoundCount;

  for (let i = 0; i < self.length; i++) {
    const q = self[i];

    // in future, this could potentially be allowed if there were operator precedence and detection of invalid combinations
    if (q.compoundCount > 0 && q.edgeCount > 0) {
      warn(
        "The selector `" +
          selector +
          "` is invalid because it uses both a compound selector and an edge selector",
      );
      return false;
    }

    if (q.edgeCount > 1) {
      warn(
        "The selector `" +
          selector +
          "` is invalid because it uses multiple edge selectors",
      );
      return false;
    } else if (q.edgeCount === 1) {
      warn(
        "The selector `" +
          selector +
          "` is deprecated.  Edge selectors do not take effect on changes to source and target nodes after an edge is added, for performance reasons.  Use a class or data selector on edges instead, updating the class or data of an edge when your app detects a change in source or target nodes.",
      );
    }
  }

  return true; // success
};

/**
 * Get the selector represented as a string.  This value uses default formatting,
 * so things like spacing may differ from the input text passed to the constructor.
 * @returns {string} The selector string
 */
export const toString = function () {
  if (this.toStringCache != null) {
    return this.toStringCache;
  }

  const clean = function (obj) {
    if (obj == null) {
      return "";
    } else {
      return obj;
    }
  };

  const cleanVal = function (val) {
    if (is.string(val)) {
      return '"' + val + '"';
    } else {
      return clean(val);
    }
  };

  const space = (val) => {
    return " " + val + " ";
  };

  const checkToString = (check, subject) => {
    let { type, value } = check;

    switch (type) {
      case Type.GROUP: {
        const group = clean(value);

        return group.substring(0, group.length - 1);
      }

      case Type.DATA_COMPARE: {
        let { field, operator } = check;

        return "[" + field + space(clean(operator)) + cleanVal(value) + "]";
      }

      case Type.DATA_BOOL: {
        let { operator, field } = check;

        return "[" + clean(operator) + field + "]";
      }

      case Type.DATA_EXIST: {
        const { field } = check;

        return "[" + field + "]";
      }

      case Type.META_COMPARE: {
        let { operator, field } = check;

        return "[[" + field + space(clean(operator)) + cleanVal(value) + "]]";
      }

      case Type.STATE: {
        return value;
      }

      case Type.ID: {
        return "#" + value;
      }

      case Type.CLASS: {
        return "." + value;
      }

      case Type.PARENT:
      case Type.CHILD: {
        return (
          queryToString(check.parent, subject) +
          space(">") +
          queryToString(check.child, subject)
        );
      }

      case Type.ANCESTOR:
      case Type.DESCENDANT: {
        return (
          queryToString(check.ancestor, subject) +
          " " +
          queryToString(check.descendant, subject)
        );
      }

      case Type.COMPOUND_SPLIT: {
        const lhs = queryToString(check.left, subject);
        const sub = queryToString(check.subject, subject);
        const rhs = queryToString(check.right, subject);

        return lhs + (lhs.length > 0 ? " " : "") + sub + rhs;
      }

      case Type.TRUE: {
        return "";
      }
    }
  };

  const queryToString = (query, subject) => {
    return query.checks.reduce((str, chk, i) => {
      return (
        str +
        (subject === query && i === 0 ? "$" : "") +
        checkToString(chk, subject)
      );
    }, "");
  };

  let str= "";

  for (let i = 0; i < this.length; i++) {
    const query = this[i];

    str += queryToString(query, query.subject);

    if (this.length > 1 && i < this.length - 1) {
      str += ", ";
    }
  }

  this.toStringCache = str;

  return str;
};

export default { parse, toString };
