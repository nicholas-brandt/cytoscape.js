// Implemented by Zoe Xi @zoexi for GSOC 2016
// https://github.com/cytoscape/cytoscape.js-markov-cluster

// Implemented from Stijn van Dongen's (author of MCL algorithm) documentation: http://micans.org/mcl/
// and lecture notes: https://www.cs.ucsb.edu/~xyan/classes/CS595D-2009winter/MCL_Presentation2.pdf

import * as util from "../../util/index.mjs";

/* eslint-disable no-unused-vars */
const defaults = util.defaults({
  expandFactor: 2, // affects time of computation and cluster granularity to some extent: M * M
  inflateFactor: 2, // affects cluster granularity (the greater the value, the more clusters): M(i,j) / E(j)
  multFactor: 1, // optional self loops for each node. Use a neutral value to improve cluster computations.
  maxIterations: 20, // maximum number of iterations of the MCL algorithm in a single run
  attributes: [
    // attributes/features used to group nodes, ie. similarity values between nodes
    function (edge) {
      return 1;
    },
  ],
});
/* eslint-enable */

const setOptions = (options) => defaults(options);

/* eslint-disable no-unused-vars, no-console */
if (process.env.NODE_ENV !== "production") {
  const printMatrix = function (M) {
    // used for debugging purposes only
    const n = Math.sqrt(M.length);
    for (let i = 0; i < n; i++) {
      const row = "";
      for (let j = 0; j < n; j++) {
        row += Number(M[i * n + j]).toFixed(3) + " ";
      }
      console.log(row);
    }
    console.log("");
  };
}
/* eslint-enable */

const getSimilarity = function (edge, attributes) {
  let total = 0;
  for (let i = 0; i < attributes.length; i++) {
    total += attributes[i](edge);
  }
  return total;
};

const addLoops = function (M, n, val) {
  for (let i = 0; i < n; i++) {
    M[i * n + i] = val;
  }
};

const normalize = function (M, n) {
  let sum;
  for (let col = 0; col < n; col++) {
    sum = 0;
    for (let row = 0; row < n; row++) {
      sum += M[row * n + col];
    }
    for (let row = 0; row < n; row++) {
      M[row * n + col] = M[row * n + col] / sum;
    }
  }
};

// TODO: blocked matrix multiplication?
const mmult = function (A, B, n) {
  const C = new Array(n * n);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      C[i * n + j] = 0;
    }

    for (let k = 0; k < n; k++) {
      for (let j = 0; j < n; j++) {
        C[i * n + j] += A[i * n + k] * B[k * n + j];
      }
    }
  }
  return C;
};

const expand = function (M, n, expandFactor /** power **/) {
  const _M = M.slice(0);

  for (let p = 1; p < expandFactor; p++) {
    M = mmult(M, _M, n);
  }
  return M;
};

const inflate = function (M, n, inflateFactor /** r **/) {
  const _M = new Array(n * n);

  // M(i,j) ^ inflatePower
  for (let i = 0; i < n * n; i++) {
    _M[i] = Math.pow(M[i], inflateFactor);
  }

  normalize(_M, n);

  return _M;
};

const hasConverged = function (M, _M, n2, roundFactor) {
  // Check that both matrices have the same elements (i,j)
  for (let i = 0; i < n2; i++) {
    const v1 =
      Math.round(M[i] * Math.pow(10, roundFactor)) / Math.pow(10, roundFactor); // truncate to 'roundFactor' decimal places
    const v2 =
      Math.round(_M[i] * Math.pow(10, roundFactor)) / Math.pow(10, roundFactor);

    if (v1 !== v2) {
      return false;
    }
  }
  return true;
};

const assign = function (M, n, nodes, cy) {
  const clusters = [];

  for (let i = 0; i < n; i++) {
    const cluster = [];
    for (let j = 0; j < n; j++) {
      // Row-wise attractors and elements that they attract belong in same cluster
      if (Math.round(M[i * n + j] * 1000) / 1000 > 0) {
        cluster.push(nodes[j]);
      }
    }
    if (cluster.length !== 0) {
      clusters.push(cy.collection(cluster));
    }
  }
  return clusters;
};

const isDuplicate = function (c1, c2) {
  for (let i = 0; i < c1.length; i++) {
    if (!c2[i] || c1[i].id() !== c2[i].id()) {
      return false;
    }
  }
  return true;
};

const removeDuplicates = function (clusters) {
  for (let i = 0; i < clusters.length; i++) {
    for (let j = 0; j < clusters.length; j++) {
      if (i != j && isDuplicate(clusters[i], clusters[j])) {
        clusters.splice(j, 1);
      }
    }
  }
  return clusters;
};

const markovClustering = function (options) {
  const nodes = this.nodes();
  const edges = this.edges();
  const cy = this.cy();

  // Set parameters of algorithm:
  const opts = setOptions(options);

  // Map each node to its position in node array
  const id2position = {};
  for (let i = 0; i < nodes.length; i++) {
    id2position[nodes[i].id()] = i;
  }

  // Generate stochastic matrix M from input graph G (should be symmetric/undirected)
  const n = nodes.length,
    n2 = n * n;
  let M = new Array(n2);
  let _M;
  for (let i = 0; i < n2; i++) {
    M[i] = 0;
  }

  for (let e = 0; e < edges.length; e++) {
    const edge = edges[e];
    let i = id2position[edge.source().id()];
    let j = id2position[edge.target().id()];

    const sim = getSimilarity(edge, opts.attributes);

    M[i * n + j] += sim; // G should be symmetric and undirected
    M[j * n + i] += sim;
  }

  // Begin Markov cluster algorithm

  // Step 1: Add self loops to each node, ie. add multFactor to matrix diagonal
  addLoops(M, n, opts.multFactor);

  // Step 2: M = normalize( M );
  normalize(M, n);

  let isStillMoving = true;
  let iterations = 0;
  while (isStillMoving && iterations < opts.maxIterations) {
    isStillMoving = false;

    // Step 3:
    _M = expand(M, n, opts.expandFactor);

    // Step 4:
    M = inflate(_M, n, opts.inflateFactor);

    // Step 5: check to see if ~steady state has been reached
    if (!hasConverged(M, _M, n2, 4)) {
      isStillMoving = true;
    }

    iterations++;
  }

  // Build clusters from matrix
  let clusters = assign(M, n, nodes, cy);

  // Remove duplicate clusters due to symmetry of graph and M matrix
  clusters = removeDuplicates(clusters);

  return clusters;
};

export default {
  markovClustering,
  mcl: markovClustering,
};
