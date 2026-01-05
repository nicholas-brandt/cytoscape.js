import * as util from "../util/index.mjs";
import * as is from "../is.mjs";

const corefn = {
  layout: function (options) {
    const cy = this;

    if (options == null) {
      util.error("Layout options must be specified to make a layout");
      return;
    }

    if (options.name == null) {
      util.error("A `name` must be specified to make a layout");
      return;
    }

    const name = options.name;
    const Layout = cy.extension("layout", name);

    if (Layout == null) {
      util.error(
        "No such layout `" +
          name +
          "` found.  Did you forget to import it and `cytoscape.use()` it?",
      );
      return;
    }

    let eles;
    if (is.string(options.eles)) {
      eles = cy.$(options.eles);
    } else {
      eles = options.eles != null ? options.eles : cy.$();
    }

    const layout = new Layout(
      util.extend({}, options, {
        cy: cy,
        eles: eles,
      }),
    );

    return layout;
  },
};

corefn.createLayout = corefn.makeLayout = corefn.layout;

export default corefn;
