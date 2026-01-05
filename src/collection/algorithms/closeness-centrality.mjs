import * as is from "../../is.mjs";
import * as util from "../../util/index.mjs";

const defaults = util.defaults({
  harmonic: true,
  weight: () => 1,
  directed: false,
  root: null,
});

const elesfn = {
  closenessCentralityNormalized: function (options) {
    let { harmonic, weight, directed } = defaults(options);

    const cy = this.cy();
    const closenesses = {};
    const maxCloseness = 0;
    const nodes = this.nodes();
    const fw = this.floydWarshall({ weight, directed });

    // Compute closeness for every node and find the maximum closeness
    for (let i = 0; i < nodes.length; i++) {
      const currCloseness = 0;
      const node_i = nodes[i];

      for (let j = 0; j < nodes.length; j++) {
        if (i !== j) {
          const d = fw.distance(node_i, nodes[j]);

          if (harmonic) {
            currCloseness += 1 / d;
          } else {
            currCloseness += d;
          }
        }
      }

      if (!harmonic) {
        currCloseness = 1 / currCloseness;
      }

      if (maxCloseness < currCloseness) {
        maxCloseness = currCloseness;
      }

      closenesses[node_i.id()] = currCloseness;
    }

    return {
      closeness: function (node) {
        if (maxCloseness == 0) {
          return 0;
        }

        if (is.string(node)) {
          // from is a selector string
          node = cy.filter(node)[0].id();
        } else {
          // from is a node
          node = node.id();
        }

        return closenesses[node] / maxCloseness;
      },
    };
  },

  // Implemented from pseudocode from wikipedia
  closenessCentrality: function (options) {
    let { root, weight, directed, harmonic } = defaults(options);

    root = this.filter(root)[0];

    // we need distance from this node to every other node
    const dijkstra = this.dijkstra({ root, weight, directed });
    const totalDistance = 0;
    const nodes = this.nodes();

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];

      if (!n.same(root)) {
        const d = dijkstra.distanceTo(n);

        if (harmonic) {
          totalDistance += 1 / d;
        } else {
          totalDistance += d;
        }
      }
    }

    return harmonic ? totalDistance : 1 / totalDistance;
  }, // closenessCentrality
}; // elesfn

// nice, short mathematical alias
elesfn.cc = elesfn.closenessCentrality;
elesfn.ccn = elesfn.closenessCentralityNormalised =
  elesfn.closenessCentralityNormalized;

export default elesfn;
