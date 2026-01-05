import * as is from "../../is.mjs";
import { defaults } from "../../util/index.mjs";

const floydWarshallDefaults = defaults({
  weight: (edge) => 1,
  directed: false,
});

const elesfn = {
  // Implemented from pseudocode from wikipedia
  floydWarshall: function (options) {
    const cy = this.cy();

    let { weight, directed } = floydWarshallDefaults(options);
    const weightFn = weight;

    let { nodes, edges } = this.byGroup();

    const N = nodes.length;
    const Nsq = N * N;

    const indexOf = (node) => nodes.indexOf(node);
    const atIndex = (i) => nodes[i];

    // Initialize distance matrix
    const dist = new Array(Nsq);
    for (let n = 0; n < Nsq; n++) {
      const j = n % N;
      const i = (n - j) / N;

      if (i === j) {
        dist[n] = 0;
      } else {
        dist[n] = Infinity;
      }
    }

    // Initialize matrix used for path reconstruction
    // Initialize distance matrix
    const next = new Array(Nsq);
    const edgeNext = new Array(Nsq);

    // Process edges
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const src = edge.source()[0];
      const tgt = edge.target()[0];

      if (src === tgt) {
        continue;
      } // exclude loops

      const s = indexOf(src);
      const t = indexOf(tgt);
      const st = s * N + t; // source to target index
      const weight = weightFn(edge);

      // Check if already process another edge between same 2 nodes
      if (dist[st] > weight) {
        dist[st] = weight;
        next[st] = t;
        edgeNext[st] = edge;
      }

      // If undirected graph, process 'reversed' edge
      if (!directed) {
        const ts = t * N + s; // target to source index

        if (!directed && dist[ts] > weight) {
          dist[ts] = weight;
          next[ts] = s;
          edgeNext[ts] = edge;
        }
      }
    }

    // Main loop
    for (let k = 0; k < N; k++) {
      for (let i = 0; i < N; i++) {
        const ik = i * N + k;

        for (let j = 0; j < N; j++) {
          const ij = i * N + j;
          const kj = k * N + j;

          if (dist[ik] + dist[kj] < dist[ij]) {
            dist[ij] = dist[ik] + dist[kj];
            next[ij] = next[ik];
          }
        }
      }
    }

    const getArgEle = (ele) => (is.string(ele) ? cy.filter(ele) : ele)[0];
    const indexOfArgEle = (ele) => indexOf(getArgEle(ele));

    const res = {
      distance: function (from, to) {
        const i = indexOfArgEle(from);
        const j = indexOfArgEle(to);

        return dist[i * N + j];
      },

      path: function (from, to) {
        const i = indexOfArgEle(from);
        const j = indexOfArgEle(to);

        const fromNode = atIndex(i);

        if (i === j) {
          return fromNode.collection();
        }

        if (next[i * N + j] == null) {
          return cy.collection();
        }

        const path = cy.collection();
        const prev = i;
        let edge;

        path.merge(fromNode);

        while (i !== j) {
          prev = i;
          i = next[i * N + j];
          edge = edgeNext[prev * N + i];

          path.merge(edge);
          path.merge(atIndex(i));
        }

        return path;
      },
    };

    return res;
  }, // floydWarshall
}; // elesfn

export default elesfn;
