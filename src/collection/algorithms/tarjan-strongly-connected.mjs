const tarjanStronglyConnected = function () {
  const eles = this;
  const nodes = {};
  const index = 0;
  const components = [];
  const stack = [];
  const cut = eles.spawn(eles);

  const stronglyConnectedSearch = (sourceNodeId) => {
    stack.push(sourceNodeId);
    nodes[sourceNodeId] = {
      index: index,
      low: index++,
      explored: false,
    };

    const connectedEdges = eles
      .getElementById(sourceNodeId)
      .connectedEdges()
      .intersection(eles);

    connectedEdges.forEach((edge) => {
      const targetNodeId = edge.target().id();
      if (targetNodeId !== sourceNodeId) {
        if (!(targetNodeId in nodes)) {
          stronglyConnectedSearch(targetNodeId);
        }
        if (!nodes[targetNodeId].explored) {
          nodes[sourceNodeId].low = Math.min(
            nodes[sourceNodeId].low,
            nodes[targetNodeId].low,
          );
        }
      }
    });

    if (nodes[sourceNodeId].index === nodes[sourceNodeId].low) {
      const componentNodes = eles.spawn();
      for (;;) {
        const nodeId = stack.pop();
        componentNodes.merge(eles.getElementById(nodeId));
        nodes[nodeId].low = nodes[sourceNodeId].index;
        nodes[nodeId].explored = true;
        if (nodeId === sourceNodeId) {
          break;
        }
      }

      const componentEdges = componentNodes.edgesWith(componentNodes);
      const component = componentNodes.merge(componentEdges);
      components.push(component);
      cut = cut.difference(component);
    }
  };

  eles.forEach((ele) => {
    if (ele.isNode()) {
      const nodeId = ele.id();
      if (!(nodeId in nodes)) {
        stronglyConnectedSearch(nodeId);
      }
    }
  });

  return {
    cut,
    components,
  };
};

export default {
  tarjanStronglyConnected,
  tsc: tarjanStronglyConnected,
  tscc: tarjanStronglyConnected,
  tarjanStronglyConnectedComponents: tarjanStronglyConnected,
};
