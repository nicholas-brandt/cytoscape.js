import * as util from '../../../util/index.mjs';

const BRp = {};

BRp.timeToRender = function(){
  return this.redrawTotalTime / this.redrawCount;
};

BRp.redraw = function( options ){
  options = options || util.staticEmptyObject();

  const r = this;

  if( r.averageRedrawTime === undefined ){ r.averageRedrawTime = 0; }
  if( r.lastRedrawTime === undefined ){ r.lastRedrawTime = 0; }
  if( r.lastDrawTime === undefined ){ r.lastDrawTime = 0; }

  r.requestedFrame = true;
  r.renderOptions = options;
};

BRp.beforeRender = function( fn, priority ){
  // the renderer can't add tick callbacks when destroyed
  if( this.destroyed ){ return; }

  if( priority == null ){
    util.error('Priority is not optional for beforeRender');
  }

  const cbs = this.beforeRenderCallbacks;

  cbs.push({ fn: fn, priority: priority });

  // higher priority callbacks executed first
  cbs.sort(function( a, b ){ return b.priority - a.priority; });
};

const beforeRenderCallbacks = function( r, willDraw, startTime ){
  const cbs = r.beforeRenderCallbacks;

  for (let i = 0; i < cbs.length; i++ ){
    cbs[i].fn( willDraw, startTime );
  }
};

BRp.startRenderLoop = function(){
  const r = this;
  const cy = r.cy;

  if( r.renderLoopStarted ){
    return;
  } else {
    r.renderLoopStarted = true;
  }

  const renderFn = function( requestTime ){
    if( r.destroyed ){ return; }

    if( cy.batching() ){
      // mid-batch, none of these should run
      // - pre frame hooks (calculations, texture caches, style, etc.)
      // - any drawing
    } else if( r.requestedFrame && !r.skipFrame ){
      beforeRenderCallbacks( r, true, requestTime );

      const startTime = util.performanceNow();

      r.render( r.renderOptions );

      const endTime = r.lastDrawTime = util.performanceNow();

      if( r.averageRedrawTime === undefined ){
        r.averageRedrawTime = endTime - startTime;
      }

      if( r.redrawCount === undefined ){
        r.redrawCount = 0;
      }

      r.redrawCount++;

      if( r.redrawTotalTime === undefined ){
        r.redrawTotalTime = 0;
      }

      const duration = endTime - startTime;

      r.redrawTotalTime += duration;
      r.lastRedrawTime = duration;

      // use a weighted average with a bias from the previous average so we don't spike so easily
      r.averageRedrawTime = r.averageRedrawTime / 2 + duration / 2;

      r.requestedFrame = false;
    } else {
      beforeRenderCallbacks( r, false, requestTime );
    }

    r.skipFrame = false;

    util.requestAnimationFrame( renderFn );
  };

  util.requestAnimationFrame( renderFn );

};

export default BRp;
