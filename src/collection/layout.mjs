import * as util from '../util/index.mjs';
import Promise from '../promise.mjs';
import * as math from '../math.mjs';

const getLayoutDimensionOptions = util.defaults({
  nodeDimensionsIncludeLabels: false
});

const elesfn = ({
  // Calculates and returns node dimensions { x, y } based on options given
  layoutDimensions: function( options ){
    options = getLayoutDimensionOptions( options );

    let dims;

    if( !this.takesUpSpace() ){
      dims = { w: 0, h: 0 };
    } else if( options.nodeDimensionsIncludeLabels ){
      const bbDim = this.boundingBox();

      dims = {
        w: bbDim.w,
        h: bbDim.h
      };
    } else {
      dims = {
        w: this.outerWidth(),
        h: this.outerHeight()
      };
    }

    // sanitise the dimensions for external layouts (avoid division by zero)
    if( dims.w === 0 || dims.h === 0 ){
      dims.w = dims.h = 1;
    }

    return dims;
  },

  // using standard layout options, apply position function (w/ or w/o animation)
  layoutPositions: function( layout, options, fn ){
    const nodes = this.nodes().filter(n => !n.isParent());
    const cy = this.cy();
    const layoutEles = options.eles; // nodes & edges
    const getMemoizeKey = node => node.id();
    const fnMem = util.memoize( fn, getMemoizeKey ); // memoized version of position function

    layout.emit( { type: 'layoutstart', layout: layout } );

    layout.animations = [];

    const calculateSpacing = function( spacing, nodesBb, pos ){
      const center = {
        x: nodesBb.x1 + nodesBb.w / 2,
        y: nodesBb.y1 + nodesBb.h / 2
      };

      const spacingVector = { // scale from center of bounding box (not necessarily 0,0)
        x: (pos.x - center.x) * spacing,
        y: (pos.y - center.y) * spacing
      };

      return {
        x: center.x + spacingVector.x,
        y: center.y + spacingVector.y
      };
    };

    const useSpacingFactor = options.spacingFactor && options.spacingFactor !== 1;

    const spacingBb = function(){
      if( !useSpacingFactor ){ return null; }

      const bb = math.makeBoundingBox();

      for (let i = 0; i < nodes.length; i++ ){
        const node = nodes[i];
        const pos = fnMem( node, i );

        math.expandBoundingBoxByPoint( bb, pos.x, pos.y );
      }

      return bb;
    };

    const bb = spacingBb();

    const getFinalPos = util.memoize( function( node, i ){
      const newPos = fnMem( node, i );

      if( useSpacingFactor ){
        const spacing = Math.abs( options.spacingFactor );

        newPos = calculateSpacing( spacing, bb, newPos );
      }

      if( options.transform != null ){
        newPos = options.transform( node, newPos );
      }

      return newPos;
    }, getMemoizeKey );

    if( options.animate ){
      for (let i = 0; i < nodes.length; i++ ){
        const node = nodes[ i ];
        const newPos = getFinalPos( node, i );
        const animateNode = options.animateFilter == null || options.animateFilter( node, i );

        if( animateNode ){
          const ani = node.animation( {
            position: newPos,
            duration: options.animationDuration,
            easing: options.animationEasing
          } );

          layout.animations.push( ani );
        } else {
          node.position( newPos );
        }

      }

      if( options.fit ){
        const fitAni = cy.animation({
          fit: {
            boundingBox: layoutEles.boundingBoxAt( getFinalPos ),
            padding: options.padding
          },
          duration: options.animationDuration,
          easing: options.animationEasing
        });

        layout.animations.push( fitAni );
      } else if( options.zoom !== undefined && options.pan !== undefined ){
        const zoomPanAni = cy.animation({
          zoom: options.zoom,
          pan: options.pan,
          duration: options.animationDuration,
          easing: options.animationEasing
        });

        layout.animations.push( zoomPanAni );
      }

      layout.animations.forEach(ani => ani.play());

      layout.one( 'layoutready', options.ready );
      layout.emit( { type: 'layoutready', layout: layout } );

      Promise.all( layout.animations.map(function( ani ){
        return ani.promise();
      }) ).then(function(){
        layout.one( 'layoutstop', options.stop );
        layout.emit( { type: 'layoutstop', layout: layout } );
      });
    } else {

      nodes.positions( getFinalPos );

      if( options.fit ){
        cy.fit( options.eles, options.padding );
      }

      if( options.zoom != null ){
        cy.zoom( options.zoom );
      }

      if( options.pan ){
        cy.pan( options.pan );
      }

      layout.one( 'layoutready', options.ready );
      layout.emit( { type: 'layoutready', layout: layout } );

      layout.one( 'layoutstop', options.stop );
      layout.emit( { type: 'layoutstop', layout: layout } );
    }

    return this; // chaining
  },

  layout: function( options ){
    const cy = this.cy();

    return cy.makeLayout( util.extend( {}, options, {
      eles: this
    } ) );
  }

});

// aliases:
elesfn.createLayout = elesfn.makeLayout = elesfn.layout;

export default elesfn;
