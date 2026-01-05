import Heap from "../../heap.mjs";
import * as util from "../../util/index.mjs";

const defaults = util.defaults({
  weight: null,
  directed: false,
});

const elesfn = {
  // Implemented from the algorithm in the paper "On Variants of Shortest-Path Betweenness Centrality and their Generic Computation" by Ulrik Brandes
  betweennessCentrality: function (options) {
    let { directed, weight } = defaults(options);
    const weighted = weight != null;
    const cy = this.cy();

    // starting
    const V = this.nodes();
    const A = {};
    const _C = {};
    const max = 0;
    const C = {
      set: function (key, val) {
        _C[key] = val;

        if (val > max) {
          max = val;
        }
      },

      get: function (key) {
        return _C[key];
      },
    };

    // A contains the neighborhoods of every node
    for (let i = 0; i < V.length; i++) {
      const v = V[i];
      const vid = v.id();

      if (directed) {
        A[vid] = v.outgoers().nodes(); // get outgoers of every node
      } else {
        A[vid] = v.openNeighborhood().nodes(); // get neighbors of every node
      }

      C.set(vid, 0);
    }

    for (let s = 0; s < V.length; s++) {
      const sid = V[s].id();
      const S = []; // stack
      const P = {};
      const g = {};
      const d = {};
      const Q = new Heap(function (a, b) {
        return d[a] - d[b];
      }); // queue

      // init dictionaries
      for (let i = 0; i < V.length; i++) {
        const vid = V[i].id();

        P[vid] = [];
        g[vid] = 0;
        d[vid] = Infinity;
      }

      g[sid] = 1; // sigma
      d[sid] = 0; // distance to s

      Q.push(sid);

      while (!Q.empty()) {
        const v = Q.pop();

        S.push(v);

        if (weighted) {
          for (let j = 0; j < A[v].length; j++) {
            let w = A[v][j];
            const vEle = cy.getElementById(v);

            let edge;
            if (vEle.edgesTo(w).length > 0) {
              edge = vEle.edgesTo(w)[0];
            } else {
              edge = w.edgesTo(vEle)[0];
            }

            const edgeWeight = weight(edge);

            w = w.id();

            if (d[w] > d[v] + edgeWeight) {
              d[w] = d[v] + edgeWeight;

              if (Q.nodes.indexOf(w) < 0) {
                //if w is not in Q
                Q.push(w);
              } else {
                // update position if w is in Q
                Q.updateItem(w);
              }

              g[w] = 0;
              P[w] = [];
            }

            if (d[w] == d[v] + edgeWeight) {
              g[w] = g[w] + g[v];
              P[w].push(v);
            }
          }
        } else {
          for (let j = 0; j < A[v].length; j++) {
            const w = A[v][j].id();

            if (d[w] == Infinity) {
              Q.push(w);

              d[w] = d[v] + 1;
            }

            if (d[w] == d[v] + 1) {
              g[w] = g[w] + g[v];
              P[w].push(v);
            }
          }
        }
      }

      const e = {};
      for (let i = 0; i < V.length; i++) {
        e[V[i].id()] = 0;
      }

      while (S.length > 0) {
        const w = S.pop();

        for (let j = 0; j < P[w].length; j++) {
          const v = P[w][j];

          e[v] = e[v] + (g[v] / g[w]) * (1 + e[w]);
        }

        if (w != V[s].id()) {
          C.set(w, C.get(w) + e[w]);
        }
      }
    }

    const ret = {
      betweenness: function (node) {
        const id = cy.collection(node).id();

        return C.get(id);
      },

      betweennessNormalized: function (node) {
        if (max == 0) {
          return 0;
        }

        const id = cy.collection(node).id();

        return C.get(id) / max;
      },
    };

    // alias
    ret.betweennessNormalised = ret.betweennessNormalized;

    return ret;
  }, // betweennessCentrality
}; // elesfn

// nice, short mathematical alias
elesfn.bc = elesfn.betweennessCentrality;

export default elesfn;
