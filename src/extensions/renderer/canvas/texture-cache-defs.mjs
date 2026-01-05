import * as util from '../../../util/index.mjs';

const fullFpsTime = 1000/60; // assume 60 frames per second

export default {
  setupDequeueing: function( opts ){
    return function setupDequeueingImpl(){
      const self = this;
      const r = this.renderer;

      if( self.dequeueingSetup ){
        return;
      } else {
        self.dequeueingSetup = true;
      }

      const queueRedraw = util.debounce( function(){
        r.redrawHint( 'eles', true );
        r.redrawHint( 'drag', true );

        r.redraw();
      }, opts.deqRedrawThreshold );

      const dequeue = function( willDraw, frameStartTime ){
        const startTime = util.performanceNow();
        const avgRenderTime = r.averageRedrawTime;
        const renderTime = r.lastRedrawTime;
        const deqd = [];
        const extent = r.cy.extent();
        const pixelRatio = r.getPixelRatio();

        // if we aren't in a tick that causes a draw, then the rendered style
        // queue won't automatically be flushed before dequeueing starts
        if( !willDraw ){
          r.flushRenderedStyleQueue();
        }

        while( true ){ // eslint-disable-line no-constant-condition
          const now = util.performanceNow();
          const duration = now - startTime;
          const frameDuration = now - frameStartTime;

          if( renderTime < fullFpsTime ){
            // if we're rendering faster than the ideal fps, then do dequeueing
            // during all of the remaining frame time

            const timeAvailable = fullFpsTime - ( willDraw ? avgRenderTime : 0 );

            if( frameDuration >= opts.deqFastCost * timeAvailable ){
              break;
            }
          } else {
            if( willDraw ){
              if(
                   duration >= opts.deqCost * renderTime
                || duration >= opts.deqAvgCost * avgRenderTime
              ){
                break;
              }
            } else if( frameDuration >= opts.deqNoDrawCost * fullFpsTime ){
              break;
            }
          }

          const thisDeqd = opts.deq( self, pixelRatio, extent );

          if( thisDeqd.length > 0 ){
            for (let i = 0; i < thisDeqd.length; i++ ){
              deqd.push( thisDeqd[i] );
            }
          } else {
            break;
          }
        }

        // callbacks on dequeue
        if( deqd.length > 0 ){
          opts.onDeqd( self, deqd );

          if( !willDraw && opts.shouldRedraw( self, deqd, pixelRatio, extent ) ){
            queueRedraw();
          }
        }
      };

      const priority = opts.priority || util.noop;

      r.beforeRender( dequeue, priority( self ) );
    };
  }
};
