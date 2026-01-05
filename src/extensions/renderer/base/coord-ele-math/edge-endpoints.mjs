import * as math from '../../../../math.mjs';
import * as is from '../../../../is.mjs';
import {endsWith} from "../../../../util/index.mjs";

const BRp = {};

BRp.manualEndptToPx = function( node, prop ){
  const r = this;
  const npos = node.position();
  const w = node.outerWidth();
  const h = node.outerHeight();
  const rs = node._private.rscratch;

  if( prop.value.length === 2 ){
    const p = [
      prop.pfValue[0],
      prop.pfValue[1]
    ];

    if( prop.units[0] === '%' ){
      p[0] = p[0] * w;
    }

    if( prop.units[1] === '%' ){
      p[1] = p[1] * h;
    }

    p[0] += npos.x;
    p[1] += npos.y;

    return p;
  } else {
    let angle = prop.pfValue[0];

    angle = -Math.PI / 2 + angle; // start at 12 o'clock

    const l = 2 * Math.max( w, h );

    const p = [
      npos.x + Math.cos( angle ) * l,
      npos.y + Math.sin( angle ) * l
    ];

    return r.nodeShapes[ this.getNodeShape( node ) ].intersectLine(
      npos.x, npos.y,
      w, h,
      p[0], p[1],
      0, node.pstyle('corner-radius').value === 'auto' ? 'auto' : node.pstyle('corner-radius').pfValue, rs
    );
  }
};

BRp.findEndpoints = function( edge ){
  const r = this;
  let intersect;

  const source = edge.source()[0];
  const target = edge.target()[0];

  const srcPos = source.position();
  const tgtPos = target.position();

  const tgtArShape = edge.pstyle( 'target-arrow-shape' ).value;
  const srcArShape = edge.pstyle( 'source-arrow-shape' ).value;

  const tgtDist = edge.pstyle( 'target-distance-from-node' ).pfValue;
  const srcDist = edge.pstyle( 'source-distance-from-node' ).pfValue;

  const srcRs = source._private.rscratch;
  const tgtRs = target._private.rscratch;

  const curveStyle = edge.pstyle('curve-style').value;

  const rs = edge._private.rscratch;

  const et = rs.edgeType;
  const taxi = endsWith(curveStyle, 'taxi'); // Covers taxi and round-taxi
  const self = et === 'self' || et === 'compound';
  const bezier = et === 'bezier' || et === 'multibezier' || self;
  const multi = et !== 'bezier';
  const lines = et === 'straight' || et === 'segments';
  const segments = et === 'segments';
  const hasEndpts = bezier || multi || lines;
  const overrideEndpts = self || taxi;
  const srcManEndpt = edge.pstyle('source-endpoint');
  const srcManEndptVal = overrideEndpts ? 'outside-to-node' : srcManEndpt.value;
  const srcCornerRadius = source.pstyle('corner-radius').value === 'auto' ? 'auto' : source.pstyle('corner-radius').pfValue;
  const tgtManEndpt = edge.pstyle('target-endpoint');
  const tgtManEndptVal = overrideEndpts ? 'outside-to-node' : tgtManEndpt.value;
  const tgtCornerRadius = target.pstyle('corner-radius').value === 'auto' ? 'auto' : target.pstyle('corner-radius').pfValue;


  rs.srcManEndpt = srcManEndpt;
  rs.tgtManEndpt = tgtManEndpt;

  let p1; // last known point of edge on target side
  let p2; // last known point of edge on source side

  let p1_i; // point to intersect with target shape
  let p2_i; // point to intersect with source shape

  const tgtManEndptPt = (tgtManEndpt?.pfValue?.length === 2 ? tgtManEndpt.pfValue : null) ?? [0, 0];
  const srcManEndptPt = (srcManEndpt?.pfValue?.length === 2 ? srcManEndpt.pfValue : null) ?? [0, 0];

  if( bezier ){
    const cpStart = [ rs.ctrlpts[0], rs.ctrlpts[1] ];
    const cpEnd = multi ? [ rs.ctrlpts[ rs.ctrlpts.length - 2], rs.ctrlpts[ rs.ctrlpts.length - 1] ] : cpStart;

    p1 = cpEnd;
    p2 = cpStart;
  } else if( lines ){
    const srcArrowFromPt = !segments ? [
      tgtPos.x + tgtManEndptPt[0],
      tgtPos.y + tgtManEndptPt[1]
    ] : rs.segpts.slice( 0, 2 );
    const tgtArrowFromPt = !segments ? [
      srcPos.x + srcManEndptPt[0],
      srcPos.y + srcManEndptPt[1]
    ] : rs.segpts.slice( rs.segpts.length - 2 );

    p1 = tgtArrowFromPt;
    p2 = srcArrowFromPt;
  }

  if( tgtManEndptVal === 'inside-to-node' ){
    intersect = [ tgtPos.x, tgtPos.y ];
  } else if( tgtManEndpt.units ){
    intersect = this.manualEndptToPx( target, tgtManEndpt );
  } else if( tgtManEndptVal === 'outside-to-line' ){
    intersect = rs.tgtIntn; // use cached value from ctrlpt calc
  } else {
    if( tgtManEndptVal === 'outside-to-node' || tgtManEndptVal === 'outside-to-node-or-label' ){
      p1_i = p1;
    } else if( tgtManEndptVal === 'outside-to-line' || tgtManEndptVal === 'outside-to-line-or-label' ){
      p1_i = [ srcPos.x, srcPos.y ];
    }

    intersect = r.nodeShapes[ this.getNodeShape( target ) ].intersectLine(
      tgtPos.x,
      tgtPos.y,
      target.outerWidth(),
      target.outerHeight(),
      p1_i[0],
      p1_i[1],
      0, tgtCornerRadius, tgtRs
    );

    if( tgtManEndptVal === 'outside-to-node-or-label' || tgtManEndptVal === 'outside-to-line-or-label' ){
      const trs = target._private.rscratch;
      const lw = trs.labelWidth;
      const lh = trs.labelHeight;
      const lx = trs.labelX;
      const ly = trs.labelY;
      const lw2 = lw/2;
      const lh2 = lh/2;

      const va = target.pstyle('text-valign').value;
      if( va === 'top' ){
        ly -= lh2;
      } else if( va === 'bottom' ){
        ly += lh2;
      }

      const ha = target.pstyle('text-halign').value;
      if( ha === 'left' ){
        lx -= lw2;
      } else if( ha === 'right' ){
        lx += lw2;
      }

      const labelIntersect = math.polygonIntersectLine(p1_i[0], p1_i[1], [
        lx - lw2, ly - lh2,
        lx + lw2, ly - lh2,
        lx + lw2, ly + lh2,
        lx - lw2, ly + lh2
      ], tgtPos.x, tgtPos.y);

      if( labelIntersect.length > 0 ){
        const refPt = srcPos;
        const intSqdist = math.sqdist( refPt, math.array2point(intersect) );
        const labIntSqdist = math.sqdist( refPt, math.array2point(labelIntersect) );
        const minSqDist = intSqdist;

        if( labIntSqdist < intSqdist ){
          intersect = labelIntersect;
          minSqDist = labIntSqdist;
        }

        if( labelIntersect.length > 2 ){
          const labInt2SqDist = math.sqdist( refPt, { x: labelIntersect[2], y: labelIntersect[3] } );

          if( labInt2SqDist < minSqDist ){
            intersect = [ labelIntersect[2], labelIntersect[3] ];
          }
        }
      }
    }
  }

  const arrowEnd = math.shortenIntersection(
    intersect,
    p1,
    r.arrowShapes[ tgtArShape ].spacing( edge ) + tgtDist
  );
  const edgeEnd = math.shortenIntersection(
    intersect,
    p1,
    r.arrowShapes[ tgtArShape ].gap( edge ) + tgtDist
  );

  rs.endX = edgeEnd[0];
  rs.endY = edgeEnd[1];

  rs.arrowEndX = arrowEnd[0];
  rs.arrowEndY = arrowEnd[1];

  if( srcManEndptVal === 'inside-to-node' ){
    intersect = [ srcPos.x, srcPos.y ];
  } else if( srcManEndpt.units ){
    intersect = this.manualEndptToPx( source, srcManEndpt );
  } else if( srcManEndptVal === 'outside-to-line' ){
    intersect = rs.srcIntn; // use cached value from ctrlpt calc
  } else {
    if( srcManEndptVal === 'outside-to-node' || srcManEndptVal === 'outside-to-node-or-label' ){
      p2_i = p2;
    } else if( srcManEndptVal === 'outside-to-line' || srcManEndptVal === 'outside-to-line-or-label' ){
      p2_i = [ tgtPos.x, tgtPos.y ];
    }

    intersect = r.nodeShapes[ this.getNodeShape( source ) ].intersectLine(
      srcPos.x,
      srcPos.y,
      source.outerWidth(),
      source.outerHeight(),
      p2_i[0],
      p2_i[1],
      0, srcCornerRadius, srcRs
    );

    if( srcManEndptVal === 'outside-to-node-or-label' || srcManEndptVal === 'outside-to-line-or-label' ){
      const srs = source._private.rscratch;
      const lw = srs.labelWidth;
      const lh = srs.labelHeight;
      const lx = srs.labelX;
      const ly = srs.labelY;
      const lw2 = lw/2;
      const lh2 = lh/2;

      const va = source.pstyle('text-valign').value;
      if( va === 'top' ){
        ly -= lh2;
      } else if( va === 'bottom' ){
        ly += lh2;
      }

      const ha = source.pstyle('text-halign').value;
      if( ha === 'left' ){
        lx -= lw2;
      } else if( ha === 'right' ){
        lx += lw2;
      }

      const labelIntersect = math.polygonIntersectLine(p2_i[0], p2_i[1], [
        lx - lw2, ly - lh2,
        lx + lw2, ly - lh2,
        lx + lw2, ly + lh2,
        lx - lw2, ly + lh2
      ], srcPos.x, srcPos.y);

      if( labelIntersect.length > 0 ){
        const refPt = tgtPos;
        const intSqdist = math.sqdist( refPt, math.array2point(intersect) );
        const labIntSqdist = math.sqdist( refPt, math.array2point(labelIntersect) );
        const minSqDist = intSqdist;

        if( labIntSqdist < intSqdist ){
          intersect = [ labelIntersect[0], labelIntersect[1] ];
          minSqDist = labIntSqdist;
        }

        if( labelIntersect.length > 2 ){
          const labInt2SqDist = math.sqdist( refPt, { x: labelIntersect[2], y: labelIntersect[3] } );

          if( labInt2SqDist < minSqDist ){
            intersect = [ labelIntersect[2], labelIntersect[3] ];
          }
        }
      }
    }
  }

  const arrowStart = math.shortenIntersection(
    intersect,
    p2,
    r.arrowShapes[ srcArShape ].spacing( edge ) + srcDist
  );
  const edgeStart = math.shortenIntersection(
    intersect,
    p2,
    r.arrowShapes[ srcArShape ].gap( edge ) + srcDist
  );

  rs.startX = edgeStart[0];
  rs.startY = edgeStart[1];

  rs.arrowStartX = arrowStart[0];
  rs.arrowStartY = arrowStart[1];

  if( hasEndpts ){
    if( !is.number( rs.startX ) || !is.number( rs.startY ) || !is.number( rs.endX ) || !is.number( rs.endY ) ){
      rs.badLine = true;
    } else {
      rs.badLine = false;
    }
  }
};

BRp.getSourceEndpoint = function( edge ){
  const rs = edge[0]._private.rscratch;

  this.recalculateRenderedStyle( edge );

  switch( rs.edgeType ){
    case 'haystack':
      return {
        x: rs.haystackPts[0],
        y: rs.haystackPts[1]
      };
    default:
      return {
        x: rs.arrowStartX,
        y: rs.arrowStartY
      };
  }
};

BRp.getTargetEndpoint = function( edge ){
  const rs = edge[0]._private.rscratch;

  this.recalculateRenderedStyle( edge );

  switch( rs.edgeType ){
    case 'haystack':
      return {
        x: rs.haystackPts[2],
        y: rs.haystackPts[3]
      };
    default:
      return {
        x: rs.arrowEndX,
        y: rs.arrowEndY
      };
  }
};

export default BRp;
