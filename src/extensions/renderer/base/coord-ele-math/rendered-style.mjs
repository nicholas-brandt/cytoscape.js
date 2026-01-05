const BRp = {};

BRp.registerCalculationListeners = function () {
  const cy = this.cy;
  const elesToUpdate = cy.collection();
  const r = this;

  const enqueue = function (eles, dirtyStyleCaches = true) {
    elesToUpdate.merge(eles);

    if (dirtyStyleCaches) {
      for (let i = 0; i < eles.length; i++) {
        const ele = eles[i];
        const _p = ele._private;
        const rstyle = _p.rstyle;

        rstyle.clean = false;
        rstyle.cleanConnected = false;
      }
    }
  };

  r.binder(cy)
    .on("bounds.* dirty.*", function onDirtyBounds(e) {
      const ele = e.target;

      enqueue(ele);
    })

    .on("style.* background.*", function onDirtyStyle(e) {
      const ele = e.target;

      enqueue(ele, false);
    });

  const updateEleCalcs = function (willDraw) {
    if (willDraw) {
      const fns = r.onUpdateEleCalcsFns;

      // because we need to have up-to-date style (e.g. stylesheet mappers)
      // before calculating rendered style (and pstyle might not be called yet)
      elesToUpdate.cleanStyle();

      for (let i = 0; i < elesToUpdate.length; i++) {
        const ele = elesToUpdate[i];
        const rstyle = ele._private.rstyle;

        if (ele.isNode() && !rstyle.cleanConnected) {
          enqueue(ele.connectedEdges());

          rstyle.cleanConnected = true;
        }
      }

      if (fns) {
        for (let i = 0; i < fns.length; i++) {
          const fn = fns[i];

          fn(willDraw, elesToUpdate);
        }
      }

      r.recalculateRenderedStyle(elesToUpdate);

      elesToUpdate = cy.collection();
    }
  };

  r.flushRenderedStyleQueue = function () {
    updateEleCalcs(true);
  };

  r.beforeRender(updateEleCalcs, r.beforeRenderPriorities.eleCalcs);
};

BRp.onUpdateEleCalcs = function (fn) {
  const fns = (this.onUpdateEleCalcsFns = this.onUpdateEleCalcsFns || []);

  fns.push(fn);
};

BRp.recalculateRenderedStyle = function (eles, useCache) {
  const isCleanConnected = (ele) => ele._private.rstyle.cleanConnected;

  if (eles.length === 0) {
    return;
  }

  const edges = [];
  const nodes = [];

  // the renderer can't be used for calcs when destroyed, e.g. ele.boundingBox()
  if (this.destroyed) {
    return;
  }

  // use cache by default for perf
  if (useCache === undefined) {
    useCache = true;
  }

  for (let i = 0; i < eles.length; i++) {
    const ele = eles[i];
    const _p = ele._private;
    const rstyle = _p.rstyle;

    // an edge may be implicitly dirty b/c of one of its connected nodes
    // (and a request for recalc may come in between frames)
    if (
      ele.isEdge() &&
      (!isCleanConnected(ele.source()) || !isCleanConnected(ele.target()))
    ) {
      rstyle.clean = false;
    }

    if (ele.isEdge() && ele.isBundledBezier()) {
      if (
        ele
          .parallelEdges()
          .some((ele) => !ele._private.rstyle.clean && ele.isBundledBezier())
      ) {
        rstyle.clean = false;
      }
    }

    // only update if dirty and in graph
    if ((useCache && rstyle.clean) || ele.removed()) {
      continue;
    }

    // only update if not display: none
    if (ele.pstyle("display").value === "none") {
      continue;
    }

    if (_p.group === "nodes") {
      nodes.push(ele);
    } else {
      // edges
      edges.push(ele);
    }

    rstyle.clean = true;
  }

  // update node data from projections
  for (let i = 0; i < nodes.length; i++) {
    const ele = nodes[i];
    const _p = ele._private;
    const rstyle = _p.rstyle;
    const pos = ele.position();

    this.recalculateNodeLabelProjection(ele);

    rstyle.nodeX = pos.x;
    rstyle.nodeY = pos.y;
    rstyle.nodeW = ele.pstyle("width").pfValue;
    rstyle.nodeH = ele.pstyle("height").pfValue;
  }

  this.recalculateEdgeProjections(edges);

  // update edge data from projections
  for (let i = 0; i < edges.length; i++) {
    const ele = edges[i];
    const _p = ele._private;
    const rstyle = _p.rstyle;
    const rs = _p.rscratch;

    // update rstyle positions
    rstyle.srcX = rs.arrowStartX;
    rstyle.srcY = rs.arrowStartY;
    rstyle.tgtX = rs.arrowEndX;
    rstyle.tgtY = rs.arrowEndY;
    rstyle.midX = rs.midX;
    rstyle.midY = rs.midY;
    rstyle.labelAngle = rs.labelAngle;
    rstyle.sourceLabelAngle = rs.sourceLabelAngle;
    rstyle.targetLabelAngle = rs.targetLabelAngle;
  }
};

export default BRp;
