import { defaults } from "../../util/index.mjs";
import { inPlaceSumNormalize } from "../../math.mjs";

const pageRankDefaults = defaults({
  dampingFactor: 0.8,
  precision: 0.000001,
  iterations: 200,
  weight: (edge) => 1,
});

const elesfn = {
  pageRank: function (options) {
    let { dampingFactor, precision, iterations, weight } =
      pageRankDefaults(options);
    const cy = this._private.cy;
    let { nodes, edges } = this.byGroup();
    const numNodes = nodes.length;
    const numNodesSqd = numNodes * numNodes;
    const numEdges = edges.length;

    // Construct transposed adjacency matrix
    // First lets have a zeroed matrix of the right size
    // We'll also keep track of the sum of each column
    const matrix = new Array(numNodesSqd);
    const columnSum = new Array(numNodes);
    const additionalProb = (1 - dampingFactor) / numNodes;

    // Create null matrix
    for (let i = 0; i < numNodes; i++) {
      for (let j = 0; j < numNodes; j++) {
        const n = i * numNodes + j;

        matrix[n] = 0;
      }

      columnSum[i] = 0;
    }

    // Now, process edges
    for (let i = 0; i < numEdges; i++) {
      const edge = edges[i];
      const srcId = edge.data("source");
      const tgtId = edge.data("target");

      // Don't include loops in the matrix
      if (srcId === tgtId) {
        continue;
      }

      const s = nodes.indexOfId(srcId);
      const t = nodes.indexOfId(tgtId);
      const w = weight(edge);
      const n = t * numNodes + s;

      // Update matrix
      matrix[n] += w;

      // Update column sum
      columnSum[s] += w;
    }

    // Add additional probability based on damping factor
    // Also, take into account columns that have sum = 0
    const p = 1.0 / numNodes + additionalProb; // Shorthand

    // Traverse matrix, column by column
    for (let j = 0; j < numNodes; j++) {
      if (columnSum[j] === 0) {
        // No 'links' out from node jth, assume equal probability for each possible node
        for (let i = 0; i < numNodes; i++) {
          const n = i * numNodes + j;
          matrix[n] = p;
        }
      } else {
        // Node jth has outgoing link, compute normalized probabilities
        for (let i = 0; i < numNodes; i++) {
          const n = i * numNodes + j;

          matrix[n] = matrix[n] / columnSum[j] + additionalProb;
        }
      }
    }

    // Compute dominant eigenvector using power method
    const eigenvector = new Array(numNodes);
    const temp = new Array(numNodes);
    let previous;

    // Start with a vector of all 1's
    // Also, initialize a null vector which will be used as shorthand
    for (let i = 0; i < numNodes; i++) {
      eigenvector[i] = 1;
    }

    for (let iter = 0; iter < iterations; iter++) {
      // Temp array with all 0's
      for (let i = 0; i < numNodes; i++) {
        temp[i] = 0;
      }

      // Multiply matrix with previous result
      for (let i = 0; i < numNodes; i++) {
        for (let j = 0; j < numNodes; j++) {
          const n = i * numNodes + j;

          temp[i] += matrix[n] * eigenvector[j];
        }
      }

      inPlaceSumNormalize(temp);
      previous = eigenvector;
      eigenvector = temp;
      temp = previous;

      const diff = 0;
      // Compute difference (squared module) of both vectors
      for (let i = 0; i < numNodes; i++) {
        const delta = previous[i] - eigenvector[i];

        diff += delta * delta;
      }

      // If difference is less than the desired threshold, stop iterating
      if (diff < precision) {
        break;
      }
    }

    // Construct result
    const res = {
      rank: function (node) {
        node = cy.collection(node)[0];

        return eigenvector[nodes.indexOf(node)];
      },
    };

    return res;
  }, // pageRank
}; // elesfn

export default elesfn;
