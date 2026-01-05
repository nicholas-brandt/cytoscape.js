import { error } from "../../util/index.mjs";

const sqrt2 = Math.sqrt(2);

// Function which colapses 2 (meta) nodes into one
// Updates the remaining edge lists
// Receives as a paramater the edge which causes the collapse
const collapse = function (edgeIndex, nodeMap, remainingEdges) {
  if (remainingEdges.length === 0) {
    error(`Karger-Stein must be run on a connected (sub)graph`);
  }

  const edgeInfo = remainingEdges[edgeIndex];
  const sourceIn = edgeInfo[1];
  const targetIn = edgeInfo[2];
  const partition1 = nodeMap[sourceIn];
  const partition2 = nodeMap[targetIn];
  const newEdges = remainingEdges; // re-use array

  // Delete all edges between partition1 and partition2
  for (let i = newEdges.length - 1; i >= 0; i--) {
    const edge = newEdges[i];
    const src = edge[1];
    const tgt = edge[2];

    if (
      (nodeMap[src] === partition1 && nodeMap[tgt] === partition2) ||
      (nodeMap[src] === partition2 && nodeMap[tgt] === partition1)
    ) {
      newEdges.splice(i, 1);
    }
  }

  // All edges pointing to partition2 should now point to partition1
  for (let i = 0; i < newEdges.length; i++) {
    const edge = newEdges[i];

    if (edge[1] === partition2) {
      // Check source
      newEdges[i] = edge.slice(); // copy
      newEdges[i][1] = partition1;
    } else if (edge[2] === partition2) {
      // Check target
      newEdges[i] = edge.slice(); // copy
      newEdges[i][2] = partition1;
    }
  }

  // Move all nodes from partition2 to partition1
  for (let i = 0; i < nodeMap.length; i++) {
    if (nodeMap[i] === partition2) {
      nodeMap[i] = partition1;
    }
  }

  return newEdges;
};

// Contracts a graph until we reach a certain number of meta nodes
const contractUntil = function (metaNodeMap, remainingEdges, size, sizeLimit) {
  while (size > sizeLimit) {
    // Choose an edge randomly
    const edgeIndex = Math.floor(Math.random() * remainingEdges.length);

    // Collapse graph based on edge
    remainingEdges = collapse(edgeIndex, metaNodeMap, remainingEdges);

    size--;
  }

  return remainingEdges;
};

const elesfn = {
  // Computes the minimum cut of an undirected graph
  // Returns the correct answer with high probability
  kargerStein: function () {
    let { nodes, edges } = this.byGroup();
    edges.unmergeBy((edge) => edge.isLoop());

    const numNodes = nodes.length;
    const numEdges = edges.length;
    const numIter = Math.ceil(Math.pow(Math.log(numNodes) / Math.LN2, 2));
    const stopSize = Math.floor(numNodes / sqrt2);

    if (numNodes < 2) {
      error("At least 2 nodes are required for Karger-Stein algorithm");
      return undefined;
    }

    // Now store edge destination as indexes
    // Format for each edge (edge index, source node index, target node index)
    const edgeIndexes = [];
    for (let i = 0; i < numEdges; i++) {
      const e = edges[i];
      edgeIndexes.push([
        i,
        nodes.indexOf(e.source()),
        nodes.indexOf(e.target()),
      ]);
    }

    // We will store the best cut found here
    const minCutSize = Infinity;
    const minCutEdgeIndexes = [];
    const minCutNodeMap = new Array(numNodes);

    // Initial meta node partition
    const metaNodeMap = new Array(numNodes);
    const metaNodeMap2 = new Array(numNodes);

    const copyNodesMap = (from, to) => {
      for (let i = 0; i < numNodes; i++) {
        to[i] = from[i];
      }
    };

    // Main loop
    for (let iter = 0; iter <= numIter; iter++) {
      // Reset meta node partition
      for (let i = 0; i < numNodes; i++) {
        metaNodeMap[i] = i;
      }

      // Contract until stop point (stopSize nodes)
      const edgesState = contractUntil(
        metaNodeMap,
        edgeIndexes.slice(),
        numNodes,
        stopSize,
      );
      const edgesState2 = edgesState.slice(); // copy

      // Create a copy of the colapsed nodes state
      copyNodesMap(metaNodeMap, metaNodeMap2);

      // Run 2 iterations starting in the stop state
      const res1 = contractUntil(metaNodeMap, edgesState, stopSize, 2);
      const res2 = contractUntil(metaNodeMap2, edgesState2, stopSize, 2);

      // Is any of the 2 results the best cut so far?
      if (res1.length <= res2.length && res1.length < minCutSize) {
        minCutSize = res1.length;
        minCutEdgeIndexes = res1;
        copyNodesMap(metaNodeMap, minCutNodeMap);
      } else if (res2.length <= res1.length && res2.length < minCutSize) {
        minCutSize = res2.length;
        minCutEdgeIndexes = res2;
        copyNodesMap(metaNodeMap2, minCutNodeMap);
      }
    } // end of main loop

    // Construct result
    const cut = this.spawn(minCutEdgeIndexes.map((e) => edges[e[0]]));
    const partition1 = this.spawn();
    const partition2 = this.spawn();

    // traverse metaNodeMap for best cut
    const witnessNodePartition = minCutNodeMap[0];
    for (let i = 0; i < minCutNodeMap.length; i++) {
      const partitionId = minCutNodeMap[i];
      const node = nodes[i];

      if (partitionId === witnessNodePartition) {
        partition1.merge(node);
      } else {
        partition2.merge(node);
      }
    }

    // construct components corresponding to each disjoint subset of nodes
    const constructComponent = (subset) => {
      const component = this.spawn();

      subset.forEach((node) => {
        component.merge(node);

        node.connectedEdges().forEach((edge) => {
          // ensure edge is within calling collection and edge is not in cut
          if (this.contains(edge) && !cut.contains(edge)) {
            component.merge(edge);
          }
        });
      });

      return component;
    };

    const components = [
      constructComponent(partition1),
      constructComponent(partition2),
    ];

    const ret = {
      cut,
      components,

      // n.b. partitions are included to be compatible with the old api spec
      // (could be removed in a future major version)
      partition1,
      partition2,
    };

    return ret;
  },
}; // elesfn

export default elesfn;
