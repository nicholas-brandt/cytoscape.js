import * as math from '../../../../math.mjs';
import * as util from '../../../../util/index.mjs';

const BRp = {};

// Project mouse
BRp.projectIntoViewport = function( clientX, clientY ){
  const cy = this.cy;
  const offsets = this.findContainerClientCoords();
  const offsetLeft = offsets[0];
  const offsetTop = offsets[1];
  const scale = offsets[4];
  const pan = cy.pan();
  const zoom = cy.zoom();

  const x = ( (clientX - offsetLeft)/scale - pan.x ) / zoom;
  const y = ( (clientY - offsetTop)/scale - pan.y ) / zoom;

  return [ x, y ];
};

BRp.findContainerClientCoords = function(){
  if( this.containerBB ){
    return this.containerBB;
  }

  const container = this.container;
  const rect = container.getBoundingClientRect();
  const style = this.cy.window().getComputedStyle( container );
  const styleValue = function( name ){ return parseFloat( style.getPropertyValue( name ) ); };

  const padding = {
    left: styleValue('padding-left'),
    right: styleValue('padding-right'),
    top: styleValue('padding-top'),
    bottom: styleValue('padding-bottom')
  };

  const border = {
    left: styleValue('border-left-width'),
    right: styleValue('border-right-width'),
    top: styleValue('border-top-width'),
    bottom: styleValue('border-bottom-width')
  };

  const clientWidth = container.clientWidth;
  const clientHeight = container.clientHeight;

  const paddingHor =  padding.left + padding.right;
  const paddingVer = padding.top + padding.bottom;

  const borderHor = border.left + border.right;

  const scale = rect.width / ( clientWidth + borderHor );

  const unscaledW = clientWidth - paddingHor;
  const unscaledH = clientHeight - paddingVer;

  const left = rect.left + padding.left + border.left;
  const top = rect.top + padding.top + border.top;

  return ( this.containerBB = [
    left,
    top,
    unscaledW,
    unscaledH,
    scale
  ] );
};

BRp.invalidateContainerClientCoordsCache = function(){
  this.containerBB = null;
};

BRp.findNearestElement = function( x, y, interactiveElementsOnly, isTouch ){
  return this.findNearestElements( x, y, interactiveElementsOnly, isTouch )[0];
};

BRp.findNearestElements = function( x, y, interactiveElementsOnly, isTouch ){
  const self = this;
  const r = this;
  const eles = r.getCachedZSortedEles();
  const near = []; // 1 node max, 1 edge max
  const zoom = r.cy.zoom();
  const hasCompounds = r.cy.hasCompoundNodes();
  const edgeThreshold = (isTouch ? 24 : 8) / zoom;
  const nodeThreshold = (isTouch ? 8 : 2) / zoom;
  const labelThreshold = (isTouch ? 8 : 2) / zoom;
  const minSqDist = Infinity;
  let nearEdge;
  let nearNode;

  if( interactiveElementsOnly ){
    eles = eles.interactive;
  }

  function addEle( ele, sqDist ){
    if( ele.isNode() ){
      if( nearNode ){
        return; // can't replace node
      } else {
        nearNode = ele;
        near.push( ele );
      }
    }

    if( ele.isEdge() && ( sqDist == null || sqDist < minSqDist ) ){
      if( nearEdge ){ // then replace existing edge
        // can replace only if same z-index
        if(
          nearEdge.pstyle('z-compound-depth').value === ele.pstyle('z-compound-depth').value
          && nearEdge.pstyle('z-compound-depth').value === ele.pstyle('z-compound-depth').value
        ){
          for (let i = 0; i < near.length; i++ ){
            if( near[i].isEdge() ){
              near[i] = ele;
              nearEdge = ele;
              minSqDist = sqDist != null ? sqDist : minSqDist;
              break;
            }
          }
        }
      } else {
        near.push( ele );
        nearEdge = ele;
        minSqDist = sqDist != null ? sqDist : minSqDist;
      }
    }
  }

  function checkNode( node ){
    const width = node.outerWidth() + 2 * nodeThreshold;
    const height = node.outerHeight() + 2 * nodeThreshold;
    const hw = width / 2;
    const hh = height / 2;
    const pos = node.position();
    const cornerRadius = node.pstyle('corner-radius').value === 'auto' ? 'auto' : node.pstyle('corner-radius').pfValue;
    const rs = node._private.rscratch;

    if(
      pos.x - hw <= x && x <= pos.x + hw // bb check x
        &&
      pos.y - hh <= y && y <= pos.y + hh // bb check y
    ){
      const shape = r.nodeShapes[ self.getNodeShape( node ) ];

      if(
        shape.checkPoint( x, y, 0, width, height, pos.x, pos.y, cornerRadius, rs )
      ){
        addEle( node, 0 );
        return true;
      }

    }
  }

  function checkEdge( edge ){
    const _p = edge._private;

    const rs = _p.rscratch;
    const styleWidth = edge.pstyle( 'width' ).pfValue;
    const scale = edge.pstyle( 'arrow-scale' ).value;
    const width = styleWidth / 2 + edgeThreshold; // more like a distance radius from centre
    const widthSq = width * width;
    const width2 = width * 2;
    let src = _p.source;
    let tgt = _p.target;
    let sqDist;

    if( rs.edgeType === 'segments' || rs.edgeType === 'straight' || rs.edgeType === 'haystack' ){
      const pts = rs.allpts;

      for (let i = 0; i + 3 < pts.length; i += 2 ){
        if(
          (math.inLineVicinity( x, y, pts[ i ], pts[ i + 1], pts[ i + 2], pts[ i + 3], width2 ))
            &&
          widthSq > ( sqDist = math.sqdistToFiniteLine( x, y, pts[ i ], pts[ i + 1], pts[ i + 2], pts[ i + 3] ) )
        ){
          addEle( edge, sqDist );
          return true;
        }
      }

    } else if( rs.edgeType === 'bezier' || rs.edgeType === 'multibezier' || rs.edgeType === 'self' || rs.edgeType === 'compound' ){
      const pts = rs.allpts;
      for (let i = 0; i + 5 < rs.allpts.length; i += 4 ){
        if(
          (math.inBezierVicinity( x, y, pts[ i ], pts[ i + 1], pts[ i + 2], pts[ i + 3], pts[ i + 4], pts[ i + 5], width2 ))
            &&
          (widthSq > (sqDist = math.sqdistToQuadraticBezier( x, y, pts[ i ], pts[ i + 1], pts[ i + 2], pts[ i + 3], pts[ i + 4], pts[ i + 5] )) )
        ){
          addEle( edge, sqDist );
          return true;
        }
      }
    }

    // if we're close to the edge but didn't hit it, maybe we hit its arrows

    src = src || _p.source;
    tgt = tgt || _p.target;

    const arSize = self.getArrowWidth( styleWidth, scale );

    const arrows = [
      { name: 'source', x: rs.arrowStartX, y: rs.arrowStartY, angle: rs.srcArrowAngle },
      { name: 'target', x: rs.arrowEndX, y: rs.arrowEndY, angle: rs.tgtArrowAngle },
      { name: 'mid-source', x: rs.midX, y: rs.midY, angle: rs.midsrcArrowAngle },
      { name: 'mid-target', x: rs.midX, y: rs.midY, angle: rs.midtgtArrowAngle }
    ];

    for (let i = 0; i < arrows.length; i++ ){
      const ar = arrows[ i ];
      const shape = r.arrowShapes[ edge.pstyle( ar.name + '-arrow-shape' ).value ];
      const edgeWidth = edge.pstyle('width').pfValue;
      if(
        shape.roughCollide( x, y, arSize, ar.angle, { x: ar.x, y: ar.y }, edgeWidth, edgeThreshold )
         &&
        shape.collide( x, y, arSize, ar.angle, { x: ar.x, y: ar.y }, edgeWidth, edgeThreshold )
      ){
        addEle( edge );
        return true;
      }
    }

    // for compound graphs, hitting edge may actually want a connected node instead (b/c edge may have greater z-index precedence)
    if( hasCompounds && near.length > 0 ){
      checkNode( src );
      checkNode( tgt );
    }
  }

  function preprop( obj, name, pre ){
    return util.getPrefixedProperty( obj, name, pre );
  }

  function checkLabel( ele, prefix ){
    const _p = ele._private;
    const th = labelThreshold;

    let prefixDash;
    if( prefix ){
      prefixDash = prefix + '-';
    } else {
      prefixDash = '';
    }

    ele.boundingBox();
    const bb = _p.labelBounds[prefix || 'main'];

    const text = ele.pstyle( prefixDash + 'label' ).value;
    const eventsEnabled = ele.pstyle( 'text-events' ).strValue === 'yes';

    if( !eventsEnabled || !text ){ return; }

    const lx = preprop( _p.rscratch, 'labelX', prefix );
    const ly = preprop( _p.rscratch, 'labelY', prefix );

    const theta = preprop( _p.rscratch, 'labelAngle', prefix );

    const ox = ele.pstyle(prefixDash + 'text-margin-x').pfValue;
    const oy = ele.pstyle(prefixDash + 'text-margin-y').pfValue;

    const lx1 = bb.x1 - th - ox; // (-ox, -oy) as bb already includes margin
    const lx2 = bb.x2 + th - ox; // and rotation is about (lx, ly)
    const ly1 = bb.y1 - th - oy;
    const ly2 = bb.y2 + th - oy;

    if( theta ){
      const cos = Math.cos( theta );
      const sin = Math.sin( theta );

      const rotate = function( x, y ){
        x = x - lx;
        y = y - ly;

        return {
          x: x * cos - y * sin + lx,
          y: x * sin + y * cos + ly
        };
      };

      const px1y1 = rotate( lx1, ly1 );
      const px1y2 = rotate( lx1, ly2 );
      const px2y1 = rotate( lx2, ly1 );
      const px2y2 = rotate( lx2, ly2 );

      const points = [ // with the margin added after the rotation is applied
        px1y1.x + ox, px1y1.y + oy,
        px2y1.x + ox, px2y1.y + oy,
        px2y2.x + ox, px2y2.y + oy,
        px1y2.x + ox, px1y2.y + oy
      ];

      if( math.pointInsidePolygonPoints( x, y, points ) ){
        addEle( ele );
        return true;
      }
    } else { // do a cheaper bb check
      if( math.inBoundingBox( bb, x, y ) ){
        addEle( ele );
        return true;
      }
    }

  }

  for (let i = eles.length - 1; i >= 0; i-- ){ // reverse order for precedence
    const ele = eles[ i ];

    if( ele.isNode() ){
      checkNode( ele ) || checkLabel( ele );

    } else { // then edge
      checkEdge( ele ) || checkLabel( ele ) || checkLabel( ele, 'source' ) || checkLabel( ele, 'target' );
    }
  }

  return near;
};

// 'Give me everything from this box'
BRp.getAllInBox = function( x1, y1, x2, y2 ){
  const eles = this.getCachedZSortedEles().interactive;
  const zoom = this.cy.zoom();
  const labelThreshold = 2 / zoom;
  const box = [];

  const x1c = Math.min( x1, x2 );
  const x2c = Math.max( x1, x2 );
  const y1c = Math.min( y1, y2 );
  const y2c = Math.max( y1, y2 );

  x1 = x1c;
  x2 = x2c;
  y1 = y1c;
  y2 = y2c;

  const boxBb = math.makeBoundingBox( {
    x1: x1, y1: y1,
    x2: x2, y2: y2
  } );
  const selectionBox = [
    { x: boxBb.x1, y: boxBb.y1 },
    { x: boxBb.x2, y: boxBb.y1 },
    { x: boxBb.x2, y: boxBb.y2 },
    { x: boxBb.x1, y: boxBb.y2 },
  ];
  const boxEdges = [
    [selectionBox[0], selectionBox[1]],
    [selectionBox[1], selectionBox[2]],
    [selectionBox[2], selectionBox[3]],
    [selectionBox[3], selectionBox[0]]
  ];


  function preprop(obj, name, pre) {
    return util.getPrefixedProperty(obj, name, pre);
  }

  function getRotatedLabelBox(ele, prefix) {
    const _p = ele._private;
    const th = labelThreshold;

    const prefixDash = prefix ? prefix + '-' : '';
    ele.boundingBox();
    const bb = _p.labelBounds[prefix || 'main'];

    // If the bounding box is not available, return null.
    // This indicates that the label box cannot be calculated, which is consistent
    // with the expected behavior of this function. Returning null allows the caller
    // to handle the absence of a bounding box explicitly.
    if (!bb) {
      return null;
    }

    const lx = preprop(_p.rscratch, 'labelX', prefix);
    const ly = preprop(_p.rscratch, 'labelY', prefix);
    const theta = preprop(_p.rscratch, 'labelAngle', prefix);

    const ox = ele.pstyle(prefixDash + 'text-margin-x').pfValue;
    const oy = ele.pstyle(prefixDash + 'text-margin-y').pfValue;

    const lx1 = bb.x1 - th - ox;
    const lx2 = bb.x2 + th - ox;
    const ly1 = bb.y1 - th - oy;
    const ly2 = bb.y2 + th - oy;

    if (theta) {
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      const rotate = function (x, y) {
        x = x - lx;
        y = y - ly;
        return {
          x: x * cos - y * sin + lx,
          y: x * sin + y * cos + ly,
        };
      };

      return [rotate(lx1, ly1), rotate(lx2, ly1), rotate(lx2, ly2), rotate(lx1, ly2)];
    } else {
      return [
        { x: lx1, y: ly1 },
        { x: lx2, y: ly1 },
        { x: lx2, y: ly2 },
        { x: lx1, y: ly2 },
      ];
    }
  }

  function doLinesIntersect(p1, p2, q1, q2) {
    function ccw(a, b, c) {
      return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    }
    return ccw(p1, q1, q2) !== ccw(p2, q1, q2) && ccw(p1, p2, q1) !== ccw(p1, p2, q2);
  }

  for (let e = 0; e < eles.length; e++ ){
    const ele = eles[e];

    if( ele.isNode() ){
      const node = ele;
      const textEvents = node.pstyle('text-events').strValue === 'yes';
      const nodeBoxSelectMode = node.pstyle('box-selection').strValue;
      const labelBoxSelectEnabled = node.pstyle('box-select-labels').strValue === 'yes';

      if ( nodeBoxSelectMode === 'none' ) {
        continue; 
      }
      const includeLabels = (nodeBoxSelectMode === 'overlap' || labelBoxSelectEnabled) && textEvents;
      const nodeBb = node.boundingBox({
        includeNodes: true,
        includeEdges: false,
        includeLabels,
      });
      
      if ( nodeBoxSelectMode === 'contain' ) {
        const selected = false;

        if (labelBoxSelectEnabled && textEvents) {
          const rotatedLabelBox = getRotatedLabelBox(node);
          if (rotatedLabelBox && math.satPolygonIntersection(rotatedLabelBox, selectionBox)) {
            box.push(node);
            selected = true;
          }
        }

        if (!selected && math.boundingBoxInBoundingBox(boxBb, nodeBb)) {
          box.push(node);
        }
      } else if ( nodeBoxSelectMode === 'overlap' ) {
        if (math.boundingBoxesIntersect(boxBb, nodeBb)) {
          const nodeBodyBb = node.boundingBox({ 
            includeNodes: true, 
            includeEdges: true, 
            includeLabels: false, 
            includeMainLabels: false, 
            includeSourceLabels: false, 
            includeTargetLabels: false 
          });

          const nodeBodyCorners = [
            { x: nodeBodyBb.x1, y: nodeBodyBb.y1 },
            { x: nodeBodyBb.x2, y: nodeBodyBb.y1 },
            { x: nodeBodyBb.x2, y: nodeBodyBb.y2 },
            { x: nodeBodyBb.x1, y: nodeBodyBb.y2 },
          ];

          // if node body intersects, no need to check label
          if (math.satPolygonIntersection(nodeBodyCorners, selectionBox)) {
            box.push(node);
          } else {
            // only check label if node body didn't intersect
            const rotatedLabelBox = getRotatedLabelBox(node);
            if (rotatedLabelBox && math.satPolygonIntersection(rotatedLabelBox, selectionBox)) {
              box.push(node);
            }
          }
        }
      }
    } else {
      const edge = ele;
      const _p = edge._private;
      const rs = _p.rscratch;
      const edgeBoxSelectMode = edge.pstyle('box-selection').strValue;

      if ( edgeBoxSelectMode === 'none' ) {
        continue; 
      }

      if ( edgeBoxSelectMode === 'contain' ) {
        if( rs.startX != null && rs.startY != null && !math.inBoundingBox( boxBb, rs.startX, rs.startY ) ){ continue; }
        if( rs.endX != null && rs.endY != null && !math.inBoundingBox( boxBb, rs.endX, rs.endY ) ){ continue; }
  
        if( rs.edgeType === 'bezier' || rs.edgeType === 'multibezier' || rs.edgeType === 'self' || rs.edgeType === 'compound' || rs.edgeType === 'segments' || rs.edgeType === 'haystack' ){
  
          const pts = _p.rstyle.bezierPts || _p.rstyle.linePts || _p.rstyle.haystackPts;
          const allInside = true;
  
          for (let i = 0; i < pts.length; i++ ){
            if( !math.pointInBoundingBox( boxBb, pts[ i ] ) ){
              allInside = false;
              break;
            }
          }
  
          if( allInside ){
            box.push( edge );
          }
  
        } else if( rs.edgeType === 'straight' ){
          box.push( edge );
        }
      } else if ( edgeBoxSelectMode === 'overlap' ) {
        const selected = false;

        // Check: either endpoint inside box
        if (
          rs.startX != null && rs.startY != null &&
          rs.endX != null && rs.endY != null &&
          (math.inBoundingBox(boxBb, rs.startX, rs.startY) || math.inBoundingBox(boxBb, rs.endX, rs.endY))
        ) {
          box.push(edge);
          selected = true;
        } 
        
        // Haystack fallback (only check if not already selected)
        else if (!selected && rs.edgeType === 'haystack') {
          const haystackPts = _p.rstyle.haystackPts;
          for (let i = 0; i < haystackPts.length; i++) {
            if (math.pointInBoundingBox(boxBb, haystackPts[i])) {
              box.push(edge);
              selected = true;
              break;
            }
          }
        }

        // Segment intersection check (only if not already selected)
        if (!selected) {
          const pts = _p.rstyle.bezierPts || _p.rstyle.linePts || _p.rstyle.haystackPts;

          // straight edges
          if ((!pts || pts.length < 2) && rs.edgeType === 'straight') {
            if (rs.startX != null && rs.startY != null && rs.endX != null && rs.endY != null) {
              pts = [
                { x: rs.startX, y: rs.startY },
                { x: rs.endX, y: rs.endY }
              ];
            }
          }
          if (!pts || pts.length < 2) continue;

          for (let i = 0; i < pts.length - 1; i++) {
            const segStart = pts[i];
            const segEnd = pts[i + 1];

            for (let b = 0; b < boxEdges.length; b++) {
              let [boxStart, boxEnd] = boxEdges[b];

              if (doLinesIntersect(segStart, segEnd, boxStart, boxEnd)) {
                box.push(edge);
                selected = true;
                break;
              }
            }

            if (selected) break;
          }
        }
      }
    }
  }

  return box;
};

export default BRp;
