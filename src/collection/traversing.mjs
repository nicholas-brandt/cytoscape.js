import * as util from "../util/index.mjs";
import * as is from "../is.mjs";
import cache from "./cache-traversal-call.mjs";

const elesfn = {};

// DAG functions
////////////////

const defineDagExtremity = function (params) {
  return function dagExtremityImpl(selector) {
    const eles = this;
    const ret = [];

    for (let i = 0; i < eles.length; i++) {
      const ele = eles[i];
      if (!ele.isNode()) {
        continue;
      }

      let disqualified = false;
      const edges = ele.connectedEdges();

      for (let j = 0; j < edges.length; j++) {
        const edge = edges[j];
        const src = edge.source();
        const tgt = edge.target();

        if (
          (params.noIncomingEdges && tgt === ele && src !== ele) ||
          (params.noOutgoingEdges && src === ele && tgt !== ele)
        ) {
          disqualified = true;
          break;
        }
      }

      if (!disqualified) {
        ret.push(ele);
      }
    }

    return this.spawn(ret, true).filter(selector);
  };
};

const defineDagOneHop = function (params) {
  return function (selector) {
    const eles = this;
    const oEles = [];

    for (let i = 0; i < eles.length; i++) {
      const ele = eles[i];

      if (!ele.isNode()) {
        continue;
      }

      const edges = ele.connectedEdges();
      for (let j = 0; j < edges.length; j++) {
        const edge = edges[j];
        const src = edge.source();
        const tgt = edge.target();

        if (params.outgoing && src === ele) {
          oEles.push(edge);
          oEles.push(tgt);
        } else if (params.incoming && tgt === ele) {
          oEles.push(edge);
          oEles.push(src);
        }
      }
    }

    return this.spawn(oEles, true).filter(selector);
  };
};

const defineDagAllHops = function (params) {
  return function (selector) {
    let eles = this;
    const sEles = [];
    const sElesIds = {};

    for (;;) {
      const next = params.outgoing ? eles.outgoers() : eles.incomers();

      if (next.length === 0) {
        break;
      } // done if none left

      let newNext = false;
      for (let i = 0; i < next.length; i++) {
        const n = next[i];
        const nid = n.id();

        if (!sElesIds[nid]) {
          sElesIds[nid] = true;
          sEles.push(n);
          newNext = true;
        }
      }

      if (!newNext) {
        break;
      } // done if touched all outgoers already

      eles = next;
    }

    return this.spawn(sEles, true).filter(selector);
  };
};

elesfn.clearTraversalCache = function () {
  for (let i = 0; i < this.length; i++) {
    this[i]._private.traversalCache = null;
  }
};

util.extend(elesfn, {
  // get the root nodes in the DAG
  roots: defineDagExtremity({ noIncomingEdges: true }),

  // get the leaf nodes in the DAG
  leaves: defineDagExtremity({ noOutgoingEdges: true }),

  // normally called children in graph theory
  // these nodes =edges=> outgoing nodes
  outgoers: cache(defineDagOneHop({ outgoing: true }), "outgoers"),

  // aka DAG descendants
  successors: defineDagAllHops({ outgoing: true }),

  // normally called parents in graph theory
  // these nodes <=edges= incoming nodes
  incomers: cache(defineDagOneHop({ incoming: true }), "incomers"),

  // aka DAG ancestors
  predecessors: defineDagAllHops({ incoming: true }),
});

// Neighbourhood functions
//////////////////////////

util.extend(elesfn, {
  neighborhood: cache(function (selector) {
    const elements = [];
    const nodes = this.nodes();

    for (let i = 0; i < nodes.length; i++) {
      // for all nodes
      const node = nodes[i];
      const connectedEdges = node.connectedEdges();

      // for each connected edge, add the edge and the other node
      for (let j = 0; j < connectedEdges.length; j++) {
        const edge = connectedEdges[j];
        const src = edge.source();
        const tgt = edge.target();
        const otherNode = node === src ? tgt : src;

        // need check in case of loop
        if (otherNode.length > 0) {
          elements.push(otherNode[0]); // add node 1 hop away
        }

        // add connected edge
        elements.push(edge[0]);
      }
    }

    return this.spawn(elements, true).filter(selector);
  }, "neighborhood"),

  closedNeighborhood: function (selector) {
    return this.neighborhood().add(this).filter(selector);
  },

  openNeighborhood: function (selector) {
    return this.neighborhood(selector);
  },
});

// aliases
elesfn.neighbourhood = elesfn.neighborhood;
elesfn.closedNeighbourhood = elesfn.closedNeighborhood;
elesfn.openNeighbourhood = elesfn.openNeighborhood;

// Edge functions
/////////////////

util.extend(elesfn, {
  source: cache(function sourceImpl(selector) {
    const ele = this[0];
    let src;

    if (ele) {
      src = ele._private.source || ele.cy().collection();
    }

    return src && selector ? src.filter(selector) : src;
  }, "source"),

  target: cache(function targetImpl(selector) {
    const ele = this[0];
    let tgt;

    if (ele) {
      tgt = ele._private.target || ele.cy().collection();
    }

    return tgt && selector ? tgt.filter(selector) : tgt;
  }, "target"),

  sources: defineSourceFunction({
    attr: "source",
  }),

  targets: defineSourceFunction({
    attr: "target",
  }),
});

function defineSourceFunction(params) {
  return function sourceImpl(selector) {
    const sources = [];

    for (let i = 0; i < this.length; i++) {
      const ele = this[i];
      const src = ele._private[params.attr];

      if (src) {
        sources.push(src);
      }
    }

    return this.spawn(sources, true).filter(selector);
  };
}

util.extend(elesfn, {
  edgesWith: cache(defineEdgesWithFunction(), "edgesWith"),

  edgesTo: cache(
    defineEdgesWithFunction({
      thisIsSrc: true,
    }),
    "edgesTo",
  ),
});

function defineEdgesWithFunction(params) {
  return function edgesWithImpl(otherNodes) {
    const elements = [];
    const cy = this._private.cy;
    const p = params || {};

    // get elements if a selector is specified
    if (is.string(otherNodes)) {
      otherNodes = cy.$(otherNodes);
    }

    for (let h = 0; h < otherNodes.length; h++) {
      const edges = otherNodes[h]._private.edges;

      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        const edgeData = edge._private.data;
        const thisToOther =
          this.hasElementWithId(edgeData.source) &&
          otherNodes.hasElementWithId(edgeData.target);
        const otherToThis =
          otherNodes.hasElementWithId(edgeData.source) &&
          this.hasElementWithId(edgeData.target);
        const edgeConnectsThisAndOther = thisToOther || otherToThis;

        if (!edgeConnectsThisAndOther) {
          continue;
        }

        if (p.thisIsSrc || p.thisIsTgt) {
          if (p.thisIsSrc && !thisToOther) {
            continue;
          }

          if (p.thisIsTgt && !otherToThis) {
            continue;
          }
        }

        elements.push(edge);
      }
    }

    return this.spawn(elements, true);
  };
}

util.extend(elesfn, {
  connectedEdges: cache(function (selector) {
    const retEles = [];

    const eles = this;
    for (let i = 0; i < eles.length; i++) {
      const node = eles[i];
      if (!node.isNode()) {
        continue;
      }

      const edges = node._private.edges;

      for (let j = 0; j < edges.length; j++) {
        const edge = edges[j];
        retEles.push(edge);
      }
    }

    return this.spawn(retEles, true).filter(selector);
  }, "connectedEdges"),

  connectedNodes: cache(function (selector) {
    const retEles = [];

    const eles = this;
    for (let i = 0; i < eles.length; i++) {
      const edge = eles[i];
      if (!edge.isEdge()) {
        continue;
      }

      retEles.push(edge.source()[0]);
      retEles.push(edge.target()[0]);
    }

    return this.spawn(retEles, true).filter(selector);
  }, "connectedNodes"),

  parallelEdges: cache(defineParallelEdgesFunction(), "parallelEdges"),

  codirectedEdges: cache(
    defineParallelEdgesFunction({
      codirected: true,
    }),
    "codirectedEdges",
  ),
});

function defineParallelEdgesFunction(params) {
  const defaults = {
    codirected: false,
  };
  params = util.extend({}, defaults, params);

  return function parallelEdgesImpl(selector) {
    // micro-optimised for renderer
    const elements = [];
    const edges = this.edges();
    const p = params;

    // look at all the edges in the collection
    for (let i = 0; i < edges.length; i++) {
      const edge1 = edges[i];
      const edge1_p = edge1._private;
      const src1 = edge1_p.source;
      const srcid1 = src1._private.data.id;
      const tgtid1 = edge1_p.data.target;
      const srcEdges1 = src1._private.edges;

      // look at edges connected to the src node of this edge
      for (let j = 0; j < srcEdges1.length; j++) {
        const edge2 = srcEdges1[j];
        const edge2data = edge2._private.data;
        const tgtid2 = edge2data.target;
        const srcid2 = edge2data.source;

        const codirected = tgtid2 === tgtid1 && srcid2 === srcid1;
        const oppdirected = srcid1 === tgtid2 && tgtid1 === srcid2;

        if (
          (p.codirected && codirected) ||
          (!p.codirected && (codirected || oppdirected))
        ) {
          elements.push(edge2);
        }
      }
    }

    return this.spawn(elements, true).filter(selector);
  };
}

// Misc functions
/////////////////

util.extend(elesfn, {
  components: function (root) {
    const self = this;
    const cy = self.cy();
    const visited = cy.collection();
    let unvisited = root == null ? self.nodes() : root.nodes();
    const components = [];

    if (root != null && unvisited.empty()) {
      // root may contain only edges
      unvisited = root.sources(); // doesn't matter which node to use (undirected), so just use the source sides
    }

    const visitInComponent = (node, component) => {
      visited.merge(node);
      unvisited.unmerge(node);
      component.merge(node);
    };

    if (unvisited.empty()) {
      return self.spawn();
    }

    do {
      // each iteration yields a component
      const cmpt = cy.collection();
      components.push(cmpt);

      const root = unvisited[0];
      visitInComponent(root, cmpt);

      self.bfs({
        directed: false,
        roots: root,
        visit: (v) => visitInComponent(v, cmpt),
      });

      cmpt.forEach((node) => {
        node.connectedEdges().forEach((e) => {
          // connectedEdges() usually cached
          if (self.has(e) && cmpt.has(e.source()) && cmpt.has(e.target())) {
            // has() is cheap
            cmpt.merge(e); // forEach() only considers nodes -- sets N at call time
          }
        });
      });
    } while (unvisited.length > 0);

    return components;
  },

  component: function () {
    const ele = this[0];

    return ele.cy().mutableElements().components(ele)[0];
  },
});

elesfn.componentsOf = elesfn.components;

export default elesfn;
