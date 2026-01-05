import * as util from '../../util/index.mjs';
import * as math from '../../math.mjs';
import * as is from '../../is.mjs';

const defaults = {
  fit: true, // whether to fit the viewport to the graph
  padding: 30, // the padding on fit
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  avoidOverlap: true, // prevents node overlap, may overflow boundingBox and radius if not enough space
  nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
  spacingFactor: undefined, // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
  radius: undefined, // the radius of the circle
  startAngle: 3 / 2 * Math.PI, // where nodes start in radians
  sweep: undefined, // how many radians should be between the first and last node (defaults to full circle)
  clockwise: true, // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
  sort: undefined, // a sorting function to order the nodes; e.g. function(a, b){ return a.data('weight') - b.data('weight') }
  animate: false, // whether to transition the node positions
  animationDuration: 500, // duration of animation in ms if enabled
  animationEasing: undefined, // easing of animation if enabled
  animateFilter: function ( node, i ){ return true; }, // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
  ready: undefined, // callback on layoutready
  stop: undefined, // callback on layoutstop
  transform: function (node, position ){ return position; } // transform a given node position. Useful for changing flow direction in discrete layouts 

};

function CircleLayout( options ){
  this.options = util.extend( {}, defaults, options );
}

CircleLayout.prototype.run = function(){
  const params = this.options;
  const options = params;

  const cy = params.cy;
  const eles = options.eles;

  const clockwise = options.counterclockwise !== undefined ? !options.counterclockwise : options.clockwise;

  const nodes = eles.nodes().not( ':parent' );

  if( options.sort ){
    nodes = nodes.sort( options.sort );
  }

  const bb = math.makeBoundingBox( options.boundingBox ? options.boundingBox : {
    x1: 0, y1: 0, w: cy.width(), h: cy.height()
  } );

  const center = {
    x: bb.x1 + bb.w / 2,
    y: bb.y1 + bb.h / 2
  };

  const sweep = options.sweep === undefined ? 2 * Math.PI - 2 * Math.PI / nodes.length : options.sweep;
  const dTheta = sweep / ( Math.max( 1, nodes.length - 1 ) );
  let r;

  const minDistance = 0;
  for (let i = 0; i < nodes.length; i++ ){
    const n = nodes[ i ];
    const nbb = n.layoutDimensions( options );
    const w = nbb.w;
    const h = nbb.h;

    minDistance = Math.max( minDistance, w, h );
  }

  if( is.number( options.radius ) ){
    r = options.radius;
  } else if( nodes.length <= 1 ){
    r = 0;
  } else {
    r = Math.min( bb.h, bb.w ) / 2 - minDistance;
  }

  // calculate the radius
  if( nodes.length > 1 && options.avoidOverlap ){ // but only if more than one node (can't overlap)
    minDistance *= 1.75; // just to have some nice spacing

    const dcos = Math.cos( dTheta ) - Math.cos( 0 );
    const dsin = Math.sin( dTheta ) - Math.sin( 0 );
    const rMin = Math.sqrt( minDistance * minDistance / ( dcos * dcos + dsin * dsin ) ); // s.t. no nodes overlapping
    r = Math.max( rMin, r );
  }

  const getPos = function( ele, i ){
    const theta = options.startAngle + i * dTheta * ( clockwise ? 1 : -1 );

    const rx = r * Math.cos( theta );
    const ry = r * Math.sin( theta );
    const pos = {
      x: center.x + rx,
      y: center.y + ry
    };

    return pos;
  };

  eles.nodes().layoutPositions( this, options, getPos );

  return this; // chaining
};

export default CircleLayout;
