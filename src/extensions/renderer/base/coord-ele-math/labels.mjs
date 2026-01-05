import * as math from '../../../../math.mjs';
import * as is from '../../../../is.mjs';
import * as util from '../../../../util/index.mjs';

const BRp = {};

BRp.recalculateNodeLabelProjection = function( node ){
  const content = node.pstyle( 'label' ).strValue;

  if( is.emptyString(content) ){ return; }

  let textX, textY;
  const _p = node._private;
  const nodeWidth = node.width();
  const nodeHeight = node.height();
  const padding = node.padding();
  const nodePos = node.position();
  const textHalign = node.pstyle( 'text-halign' ).strValue;
  const textValign = node.pstyle( 'text-valign' ).strValue;
  const rs = _p.rscratch;
  const rstyle = _p.rstyle;

  switch( textHalign ){
    case 'left':
      textX = nodePos.x - nodeWidth / 2 - padding;
      break;

    case 'right':
      textX = nodePos.x + nodeWidth / 2 + padding;
      break;

    default: // e.g. center
      textX = nodePos.x;
  }

  switch( textValign ){
    case 'top':
      textY = nodePos.y - nodeHeight / 2 - padding;
      break;

    case 'bottom':
      textY = nodePos.y + nodeHeight / 2 + padding;
      break;

    default: // e.g. middle
      textY = nodePos.y;
  }

  rs.labelX = textX;
  rs.labelY = textY;
  rstyle.labelX = textX;
  rstyle.labelY = textY;

  this.calculateLabelAngles( node );
  this.applyLabelDimensions( node );
};

const lineAngleFromDelta = function( dx, dy ){
  const angle = Math.atan( dy / dx );

  if( dx === 0 && angle < 0 ){
    angle = angle * -1;
  }

  return angle;
};

const lineAngle = function( p0, p1 ){
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;

  return lineAngleFromDelta( dx, dy );
};

const bezierAngle = function( p0, p1, p2, t ){
  const t0 = math.bound( 0, t - 0.001, 1 );
  const t1 = math.bound( 0, t + 0.001, 1 );

  const lp0 = math.qbezierPtAt( p0, p1, p2, t0 );
  const lp1 = math.qbezierPtAt( p0, p1, p2, t1 );

  return lineAngle( lp0, lp1 );
};

BRp.recalculateEdgeLabelProjections = function( edge ){
  let p;
  const _p = edge._private;
  const rs = _p.rscratch;
  const r = this;
  const content = {
    mid: edge.pstyle('label').strValue,
    source: edge.pstyle('source-label').strValue,
    target: edge.pstyle('target-label').strValue
  };

  if( content.mid || content.source || content.target ){
    // then we have to calculate...
  } else {
    return; // no labels => no calcs
  }

  // add center point to style so bounding box calculations can use it
  //
  p = {
    x: rs.midX,
    y: rs.midY
  };

  const setRs = function( propName, prefix, value ){
    util.setPrefixedProperty( _p.rscratch, propName, prefix, value );
    util.setPrefixedProperty( _p.rstyle, propName, prefix, value );
  };

  setRs( 'labelX', null, p.x );
  setRs( 'labelY', null, p.y );

  const midAngle = lineAngleFromDelta(rs.midDispX, rs.midDispY);
  setRs( 'labelAutoAngle', null, midAngle );

  const createControlPointInfo = function(){
    if( createControlPointInfo.cache ){ return createControlPointInfo.cache; } // use cache so only 1x per edge

    const ctrlpts = [];

    // store each ctrlpt info init
    for (let i = 0; i + 5 < rs.allpts.length; i += 4 ){
      const p0 = { x: rs.allpts[i], y: rs.allpts[i+1] };
      const p1 = { x: rs.allpts[i+2], y: rs.allpts[i+3] }; // ctrlpt
      const p2 = { x: rs.allpts[i+4], y: rs.allpts[i+5] };

      ctrlpts.push({
        p0: p0,
        p1: p1,
        p2: p2,
        startDist: 0,
        length: 0,
        segments: []
      });
    }

    const bpts = _p.rstyle.bezierPts;
    const nProjs = r.bezierProjPcts.length;

    function addSegment( cp, p0, p1, t0, t1 ){
      const length = math.dist( p0, p1 );
      const prevSegment = cp.segments[ cp.segments.length - 1 ];
      const segment = {
        p0: p0,
        p1: p1,
        t0: t0,
        t1: t1,
        startDist: prevSegment ? prevSegment.startDist + prevSegment.length : 0,
        length: length
      };

      cp.segments.push( segment );

      cp.length += length;
    }

    // update each ctrlpt with segment info
    for (let i = 0; i < ctrlpts.length; i++ ){
      const cp = ctrlpts[i];
      const prevCp = ctrlpts[i - 1];

      if( prevCp ){
        cp.startDist = prevCp.startDist + prevCp.length;
      }

      addSegment(
        cp,
        cp.p0,   bpts[ i * nProjs ],
        0,       r.bezierProjPcts[ 0 ]
      ); // first

      for (let j = 0; j < nProjs - 1; j++ ){
        addSegment(
          cp,
          bpts[ i * nProjs + j ],   bpts[ i * nProjs + j + 1 ],
          r.bezierProjPcts[ j ],    r.bezierProjPcts[ j + 1 ]
        );
      }

      addSegment(
        cp,
        bpts[ i * nProjs + nProjs - 1 ],   cp.p2,
        r.bezierProjPcts[ nProjs - 1 ],    1
      ); // last
    }

    return ( createControlPointInfo.cache = ctrlpts );
  };

  const calculateEndProjection = function( prefix ){
    let angle;
    const isSrc = prefix === 'source';

    if( !content[ prefix ] ){ return; }

    const offset = edge.pstyle(prefix+'-text-offset').pfValue;

    switch( rs.edgeType ){
      case 'self':
      case 'compound':
      case 'bezier':
      case 'multibezier': {
        const cps = createControlPointInfo();
        let selected;
        const startDist = 0;
        const totalDist = 0;

        // find the segment we're on
        for (let i = 0; i < cps.length; i++ ){
          const cp = cps[ isSrc ? i : cps.length - 1 - i ];

          for (let j = 0; j < cp.segments.length; j++ ){
            const seg = cp.segments[ isSrc ? j : cp.segments.length - 1 - j ];
            const lastSeg = i === cps.length - 1 && j === cp.segments.length - 1;

            startDist = totalDist;
            totalDist += seg.length;

            if( totalDist >= offset || lastSeg ){
              selected = { cp: cp, segment: seg };
              break;
            }
          }

          if( selected ){ break; }
        }

        const cp = selected.cp;
        const seg = selected.segment;
        const tSegment = ( offset - startDist ) / ( seg.length );
        const segDt = seg.t1 - seg.t0;
        let t = isSrc ? seg.t0 + segDt * tSegment : seg.t1 - segDt * tSegment;

        t = math.bound( 0, t, 1 );
        p = math.qbezierPtAt( cp.p0, cp.p1, cp.p2, t );
        angle = bezierAngle( cp.p0, cp.p1, cp.p2, t, p );

        break;
      }
      case 'straight':
      case 'segments':
      case 'haystack': {
        const d = 0;
        let di, d0;
        let p0, p1;
        const l = rs.allpts.length;

        for (let i = 0; i + 3 < l; i += 2 ){
          if( isSrc ){
            p0 = { x: rs.allpts[i],     y: rs.allpts[i+1] };
            p1 = { x: rs.allpts[i+2],   y: rs.allpts[i+3] };
          } else {
            p0 = { x: rs.allpts[l-2-i], y: rs.allpts[l-1-i] };
            p1 = { x: rs.allpts[l-4-i], y: rs.allpts[l-3-i] };
          }

          di = math.dist( p0, p1 );
          d0 = d;
          d += di;

          if( d >= offset ){ break; }
        }

        const pD = offset - d0;
        let t = pD / di;

        t  = math.bound( 0, t, 1 );
        p = math.lineAt( p0, p1, t );
        angle = lineAngle( p0, p1 );

        break;
      }
    }

    setRs( 'labelX', prefix, p.x );
    setRs( 'labelY', prefix, p.y );
    setRs( 'labelAutoAngle', prefix, angle );
  };

  calculateEndProjection( 'source' );
  calculateEndProjection( 'target' );

  this.applyLabelDimensions( edge );
};

BRp.applyLabelDimensions = function( ele ){
  this.applyPrefixedLabelDimensions( ele );

  if( ele.isEdge() ){
    this.applyPrefixedLabelDimensions( ele, 'source' );
    this.applyPrefixedLabelDimensions( ele, 'target' );
  }
};

BRp.applyPrefixedLabelDimensions = function( ele, prefix ){
  const _p = ele._private;

  const text = this.getLabelText( ele, prefix );

  const cacheKey = util.hashString( text, ele._private.labelDimsKey );

  // save recalc if the label is the same as before
  if( util.getPrefixedProperty( _p.rscratch, 'prefixedLabelDimsKey', prefix ) === cacheKey ){
    return; // then the label dimensions + text are the same
  }

  // save the key
  util.setPrefixedProperty( _p.rscratch, 'prefixedLabelDimsKey', prefix, cacheKey );

  const labelDims = this.calculateLabelDimensions( ele, text );
  const lineHeight = ele.pstyle('line-height').pfValue;
  const textWrap = ele.pstyle('text-wrap').strValue;
  const lines = util.getPrefixedProperty( _p.rscratch, 'labelWrapCachedLines', prefix ) || [];
  const numLines = textWrap !== 'wrap' ? 1 : Math.max(lines.length, 1);
  const normPerLineHeight = labelDims.height / numLines;
  const labelLineHeight = normPerLineHeight * lineHeight;

  const width = labelDims.width;
  const height = labelDims.height + (numLines - 1) * (lineHeight - 1) * normPerLineHeight;

  util.setPrefixedProperty( _p.rstyle,   'labelWidth', prefix, width );
  util.setPrefixedProperty( _p.rscratch, 'labelWidth', prefix, width );

  util.setPrefixedProperty( _p.rstyle,   'labelHeight', prefix, height );
  util.setPrefixedProperty( _p.rscratch, 'labelHeight', prefix, height );

  util.setPrefixedProperty( _p.rscratch, 'labelLineHeight', prefix, labelLineHeight );
};

BRp.getLabelText = function( ele, prefix ){
  const _p = ele._private;
  const pfd = prefix ? prefix + '-' : '';
  const text = ele.pstyle( pfd + 'label' ).strValue;
  const textTransform = ele.pstyle( 'text-transform' ).value;
  const rscratch = function( propName, value ){
    if( value ){
      util.setPrefixedProperty( _p.rscratch, propName, prefix, value );
      return value;
    } else {
      return util.getPrefixedProperty( _p.rscratch, propName, prefix );
    }
  };

  // for empty text, skip all processing
  if( !text ){ return ''; }

  if( textTransform == 'none' ){
    // passthrough
  } else if( textTransform == 'uppercase' ){
    text = text.toUpperCase();
  } else if( textTransform == 'lowercase' ){
    text = text.toLowerCase();
  }

  const wrapStyle = ele.pstyle( 'text-wrap' ).value;

  if( wrapStyle === 'wrap' ){
    const labelKey = rscratch( 'labelKey' );

    // save recalc if the label is the same as before
    if( labelKey != null && rscratch( 'labelWrapKey' ) === labelKey ){
      return rscratch( 'labelWrapCachedText' );
    }

    const zwsp = '\u200b';
    const lines = text.split('\n');
    const maxW = ele.pstyle('text-max-width').pfValue;
    const overflow = ele.pstyle('text-overflow-wrap').value;
    const overflowAny = overflow === 'anywhere';
    const wrappedLines = [];
    const separatorRegex = /[\s\u200b]+|$/g; // Include end of string to add last word

    for (let l = 0; l < lines.length; l++ ){
      const line = lines[ l ];

      const lineDims = this.calculateLabelDimensions( ele, line );
      const lineW = lineDims.width;

      if( overflowAny ){
        const processedLine = line.split('').join(zwsp);

        line = processedLine;
      }

      if( lineW > maxW ){ // line is too long
        const separatorMatches = line.matchAll(separatorRegex);
        const subline = '';

        const previousIndex = 0;
        // Add fake match
        for( let separatorMatch of separatorMatches ){
          const wordSeparator = separatorMatch[ 0 ];
          const word = line.substring( previousIndex, separatorMatch.index );
          previousIndex = separatorMatch.index + wordSeparator.length;

          const testLine = subline.length === 0 ? word : subline + word + wordSeparator;
          const testDims = this.calculateLabelDimensions( ele, testLine );
          const testW = testDims.width;

          if( testW <= maxW ){ // word fits on current line
            subline += word + wordSeparator;
          } else { // word starts new line
            if( subline ){
              wrappedLines.push( subline );
            }
            subline = word + wordSeparator;
          }
        }

        // if there's remaining text, put it in a wrapped line
        if( !subline.match( /^[\s\u200b]+$/ ) ){
          wrappedLines.push( subline );
        }
      } else { // line is already short enough
        wrappedLines.push( line );
      }
    } // for

    rscratch( 'labelWrapCachedLines', wrappedLines );
    text = rscratch( 'labelWrapCachedText', wrappedLines.join( '\n' ) );
    rscratch( 'labelWrapKey', labelKey );

  } else if( wrapStyle === 'ellipsis' ){
    const maxW = ele.pstyle( 'text-max-width' ).pfValue;
    const ellipsized = '';
    const ellipsis = '\u2026';
    const incLastCh = false;

    if (this.calculateLabelDimensions(ele, text).width < maxW) { // the label already fits
      return text;
    }

    for (let i = 0; i < text.length; i++ ){
      const widthWithNextCh = this.calculateLabelDimensions( ele, ellipsized + text[i] + ellipsis ).width;

      if( widthWithNextCh > maxW ){ break; }

      ellipsized += text[i];

      if( i === text.length - 1 ){ incLastCh = true; }
    }

    if( !incLastCh ){
      ellipsized += ellipsis;
    }

    return ellipsized;
  } // if ellipsize

  return text;
};

BRp.getLabelJustification = function(ele){
  const justification = ele.pstyle('text-justification').strValue;
  const textHalign = ele.pstyle('text-halign').strValue;

  if( justification === 'auto' ){
    if( ele.isNode() ){
      switch( textHalign ){
        case 'left':
          return 'right';
        case 'right':
          return 'left';
        default:
          return 'center';
      }
    } else {
      return 'center';
    }
  } else {
    return justification;
  }
};

BRp.calculateLabelDimensions = function( ele, text ){
  const r = this;

  const containerWindow = r.cy.window();

  const document = containerWindow.document;

  const padding = 0; // add padding around text dims, as the measurement isn't that accurate
  const fStyle = ele.pstyle('font-style').strValue;
  const size = ele.pstyle('font-size').pfValue;
  const family = ele.pstyle('font-family').strValue;
  const weight = ele.pstyle('font-weight').strValue;

  const canvas = this.labelCalcCanvas;
  const c2d = this.labelCalcCanvasContext;

  if( !canvas ){
    canvas = this.labelCalcCanvas = document.createElement('canvas');
    c2d = this.labelCalcCanvasContext = canvas.getContext('2d');

    const ds = canvas.style;
    ds.position = 'absolute';
    ds.left = '-9999px';
    ds.top = '-9999px';
    ds.zIndex = '-1';
    ds.visibility = 'hidden';
    ds.pointerEvents = 'none';
  }

  c2d.font = `${fStyle} ${weight} ${size}px ${family}`;

  let width = 0;
  let height = 0;
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++ ){
    const line = lines[i];
    const metrics = c2d.measureText(line);
    const w = Math.ceil(metrics.width);
    const h = size;

    width = Math.max(w, width);
    height += h;
  }

  width += padding;
  height += padding;

  return {
    width,
    height
  };
};

BRp.calculateLabelAngle = function( ele, prefix ){
  const _p = ele._private;
  const rs = _p.rscratch;
  const isEdge = ele.isEdge();
  const prefixDash = prefix ? prefix + '-' : '';
  const rot = ele.pstyle( prefixDash + 'text-rotation' );
  const rotStr = rot.strValue;

  if( rotStr === 'none' ){
    return 0;
  } else if( isEdge && rotStr === 'autorotate' ){
    return rs.labelAutoAngle;
  } else if( rotStr === 'autorotate' ){
    return 0;
  } else {
    return rot.pfValue;
  }
};

BRp.calculateLabelAngles = function( ele ){
  const r = this;
  const isEdge = ele.isEdge();
  const _p = ele._private;
  const rs = _p.rscratch;

  rs.labelAngle = r.calculateLabelAngle(ele);

  if( isEdge ){
    rs.sourceLabelAngle = r.calculateLabelAngle(ele, 'source');
    rs.targetLabelAngle = r.calculateLabelAngle(ele, 'target');
  }
};

export default BRp;
