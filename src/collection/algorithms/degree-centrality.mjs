import * as is from "../../is.mjs";
import * as util from "../../util/index.mjs";

const defaults = util.defaults({
  root: null,
  weight: (edge) => 1,
  directed: false,
  alpha: 0,
});

const elesfn = {
  degreeCentralityNormalized: function (options) {
    options = defaults(options);

    const cy = this.cy();
    const nodes = this.nodes();
    const numNodes = nodes.length;

    if (!options.directed) {
      const degrees = {};
      let maxDegree = 0;

      for (let i = 0; i < numNodes; i++) {
        const node = nodes[i];

        // add current node to the current options object and call degreeCentrality
        options.root = node;

        const currDegree = this.degreeCentrality(options);

        if (maxDegree < currDegree.degree) {
          maxDegree = currDegree.degree;
        }

        degrees[node.id()] = currDegree.degree;
      }

      return {
        degree: function (node) {
          if (maxDegree === 0) {
            return 0;
          }

          if (is.string(node)) {
            // from is a selector string
            node = cy.filter(node);
          }

          return degrees[node.id()] / maxDegree;
        },
      };
    } else {
      const indegrees = {};
      const outdegrees = {};
      let maxIndegree = 0;
      let maxOutdegree = 0;

      for (let i = 0; i < numNodes; i++) {
        const node = nodes[i];
        const id = node.id();

        // add current node to the current options object and call degreeCentrality
        options.root = node;

        const currDegree = this.degreeCentrality(options);

        if (maxIndegree < currDegree.indegree)
          maxIndegree = currDegree.indegree;

        if (maxOutdegree < currDegree.outdegree)
          maxOutdegree = currDegree.outdegree;

        indegrees[id] = currDegree.indegree;
        outdegrees[id] = currDegree.outdegree;
      }

      return {
        indegree: function (node) {
          if (maxIndegree == 0) {
            return 0;
          }

          if (is.string(node)) {
            // from is a selector string
            node = cy.filter(node);
          }

          return indegrees[node.id()] / maxIndegree;
        },
        outdegree: function (node) {
          if (maxOutdegree === 0) {
            return 0;
          }

          if (is.string(node)) {
            // from is a selector string
            node = cy.filter(node);
          }

          return outdegrees[node.id()] / maxOutdegree;
        },
      };
    }
  }, // degreeCentralityNormalized

  // Implemented from the algorithm in Opsahl's paper
  // "Node centrality in weighted networks: Generalizing degree and shortest paths"
  // check the heading 2 "Degree"
  degreeCentrality: function (options) {
    options = defaults(options);

    const cy = this.cy();
    const callingEles = this;
    let { root, weight, directed, alpha } = options;

    root = cy.collection(root)[0];

    if (!directed) {
      const connEdges = root.connectedEdges().intersection(callingEles);
      const k = connEdges.length;
      let s = 0;

      // Now, sum edge weights
      for (let i = 0; i < connEdges.length; i++) {
        s += weight(connEdges[i]);
      }

      return {
        degree: Math.pow(k, 1 - alpha) * Math.pow(s, alpha),
      };
    } else {
      const edges = root.connectedEdges();
      const incoming = edges.filter(
        (edge) => edge.target().same(root) && callingEles.has(edge),
      );
      const outgoing = edges.filter(
        (edge) => edge.source().same(root) && callingEles.has(edge),
      );
      const k_in = incoming.length;
      const k_out = outgoing.length;
      let s_in = 0;
      let s_out = 0;

      // Now, sum incoming edge weights
      for (let i = 0; i < incoming.length; i++) {
        s_in += weight(incoming[i]);
      }

      // Now, sum outgoing edge weights
      for (let i = 0; i < outgoing.length; i++) {
        s_out += weight(outgoing[i]);
      }

      return {
        indegree: Math.pow(k_in, 1 - alpha) * Math.pow(s_in, alpha),
        outdegree: Math.pow(k_out, 1 - alpha) * Math.pow(s_out, alpha),
      };
    }
  }, // degreeCentrality
}; // elesfn

// nice, short mathematical alias
elesfn.dc = elesfn.degreeCentrality;
elesfn.dcn = elesfn.degreeCentralityNormalised =
  elesfn.degreeCentralityNormalized;

export default elesfn;
