import * as is from '../is.mjs';
import * as util from '../util/index.mjs';

function styleCache( key, fn, ele ){
  const _p = ele._private;
  const cache = _p.styleCache = _p.styleCache || [];
  let val;

  if( (val = cache[key]) != null ){
    return val;
  } else {
    val = cache[key] = fn( ele );

    return val;
  }
}

function cacheStyleFunction( key, fn ){
  key = util.hashString( key );

  return function cachedStyleFunction( ele ){
    return styleCache( key, fn, ele );
  };
}

function cachePrototypeStyleFunction( key, fn ){
  key = util.hashString( key );

  const selfFn = ele => fn.call( ele );

  return function cachedPrototypeStyleFunction(){
    const ele = this[0];

    if( ele ){
      return styleCache( key, selfFn, ele );
    }
  };
}

const elesfn = ({

  recalculateRenderedStyle: function( useCache ){
    const cy = this.cy();
    const renderer = cy.renderer();
    const styleEnabled = cy.styleEnabled();

    if( renderer && styleEnabled ){
      renderer.recalculateRenderedStyle( this, useCache );
    }

    return this;
  },

  dirtyStyleCache: function(){
    const cy = this.cy();
    const dirty = ele => ele._private.styleCache = null;

    if( cy.hasCompoundNodes() ){
      let eles;

      eles = this.spawnSelf()
        .merge( this.descendants() )
        .merge( this.parents() )
      ;

      eles.merge( eles.connectedEdges() );

      eles.forEach( dirty );
    } else {
      this.forEach( ele => {
        dirty( ele );

        ele.connectedEdges().forEach( dirty );
      } );
    }

    return this;
  },

  // fully updates (recalculates) the style for the elements
  updateStyle: function( notifyRenderer ){
    const cy = this._private.cy;

    if( !cy.styleEnabled() ){ return this; }

    if( cy.batching() ){
      const bEles = cy._private.batchStyleEles;

      bEles.merge( this );

      return this; // chaining and exit early when batching
    }

    const hasCompounds = cy.hasCompoundNodes();
    const updatedEles = this;

    notifyRenderer = notifyRenderer || notifyRenderer === undefined ? true : false;

    if( hasCompounds ){ // then add everything up and down for compound selector checks
      updatedEles = this.spawnSelf().merge( this.descendants() ).merge( this.parents() );
    }

    // const changedEles = style.apply( updatedEles );
    const changedEles = updatedEles;

    if( notifyRenderer ){
      changedEles.emitAndNotify( 'style' ); // let renderer know we changed style
    } else {
      changedEles.emit( 'style' ); // just fire the event
    }

    updatedEles.forEach(ele => ele._private.styleDirty = true);

    return this; // chaining
  },

  // private: clears dirty flag and recalculates style
  cleanStyle: function(){
    const cy = this.cy();

    if( !cy.styleEnabled() ){ return; }

    for (let i = 0; i < this.length; i++ ){
      const ele = this[i];

      if( ele._private.styleDirty ){
        // n.b. this flag should be set before apply() to avoid potential infinite recursion
        ele._private.styleDirty = false;

        cy.style().apply(ele);
      }
    }
  },

  // get the internal parsed style object for the specified property
  parsedStyle: function( property, includeNonDefault = true ){
    const ele = this[0];
    const cy = ele.cy();

    if( !cy.styleEnabled() ){ return; }

    if( ele ){
      // this.cleanStyle();

      // Inline the important part of cleanStyle(), for raw performance
      if( ele._private.styleDirty ){
        // n.b. this flag should be set before apply() to avoid potential infinite recursion
        ele._private.styleDirty = false;
        cy.style().apply(ele);
      }

      const overriddenStyle = ele._private.style[ property ];

      if( overriddenStyle != null ){
        return overriddenStyle;
      } else if( includeNonDefault ){
        return cy.style().getDefaultProperty( property );
      } else {
        return null;
      }
    }
  },

  numericStyle: function( property ){
    const ele = this[0];

    if( !ele.cy().styleEnabled() ){ return; }

    if( ele ){
      const pstyle = ele.pstyle( property );

      return pstyle.pfValue !== undefined ? pstyle.pfValue : pstyle.value;
    }
  },

  numericStyleUnits: function( property ){
    const ele = this[0];

    if( !ele.cy().styleEnabled() ){ return; }

    if( ele ){
      return ele.pstyle( property ).units;
    }
  },

  // get the specified css property as a rendered value (i.e. on-screen value)
  // or get the whole rendered style if no property specified (NB doesn't allow setting)
  renderedStyle: function( property ){
    const cy = this.cy();
    if( !cy.styleEnabled() ){ return this; }

    const ele = this[0];

    if( ele ){
      return cy.style().getRenderedStyle( ele, property );
    }
  },

  // read the calculated css style of the element or override the style (via a bypass)
  style: function( name, value ){
    const cy = this.cy();

    if( !cy.styleEnabled() ){ return this; }

    const updateTransitions = false;
    const style = cy.style();

    if( is.plainObject( name ) ){ // then extend the bypass
      const props = name;
      style.applyBypass( this, props, updateTransitions );

      this.emitAndNotify( 'style' ); // let the renderer know we've updated style

    } else if( is.string( name ) ){

      if( value === undefined ){ // then get the property from the style
        const ele = this[0];

        if( ele ){
          return style.getStylePropertyValue( ele, name );
        } else { // empty collection => can't get any value
          return;
        }

      } else { // then set the bypass with the property value
        style.applyBypass( this, name, value, updateTransitions );

        this.emitAndNotify( 'style' ); // let the renderer know we've updated style
      }

    } else if( name === undefined ){
      const ele = this[0];

      if( ele ){
        return style.getRawStyle( ele );
      } else { // empty collection => can't get any value
        return;
      }
    }

    return this; // chaining
  },

  removeStyle: function( names ){
    const cy = this.cy();

    if( !cy.styleEnabled() ){ return this; }

    const updateTransitions = false;
    const style = cy.style();
    const eles = this;

    if( names === undefined ){
      for (let i = 0; i < eles.length; i++ ){
        const ele = eles[ i ];

        style.removeAllBypasses( ele, updateTransitions );
      }
    } else {
      names = names.split( /\s+/ );

      for (let i = 0; i < eles.length; i++ ){
        const ele = eles[ i ];

        style.removeBypasses( ele, names, updateTransitions );
      }
    }

    this.emitAndNotify( 'style' ); // let the renderer know we've updated style

    return this; // chaining
  },

  show: function(){
    this.css( 'display', 'element' );
    return this; // chaining
  },

  hide: function(){
    this.css( 'display', 'none' );
    return this; // chaining
  },

  effectiveOpacity: function(){
    const cy = this.cy();
    if( !cy.styleEnabled() ){ return 1; }

    const hasCompoundNodes = cy.hasCompoundNodes();
    const ele = this[0];

    if( ele ){
      const _p = ele._private;
      const parentOpacity = ele.pstyle( 'opacity' ).value;

      if( !hasCompoundNodes ){ return parentOpacity; }

      const parents = !_p.data.parent ? null : ele.parents();

      if( parents ){
        for (let i = 0; i < parents.length; i++ ){
          const parent = parents[ i ];
          const opacity = parent.pstyle( 'opacity' ).value;

          parentOpacity = opacity * parentOpacity;
        }
      }

      return parentOpacity;
    }
  },

  transparent: function(){
    const cy = this.cy();
    if( !cy.styleEnabled() ){ return false; }

    const ele = this[0];
    const hasCompoundNodes = ele.cy().hasCompoundNodes();

    if( ele ){
      if( !hasCompoundNodes ){
        return ele.pstyle( 'opacity' ).value === 0;
      } else {
        return ele.effectiveOpacity() === 0;
      }
    }
  },

  backgrounding: function(){
    const cy = this.cy();
    if( !cy.styleEnabled() ){ return false; }

    const ele = this[0];

    return ele._private.backgrounding ? true : false;
  }

});

function checkCompound( ele, parentOk ){
  const _p = ele._private;
  const parents = _p.data.parent ? ele.parents() : null;

  if( parents ){ for (let i = 0; i < parents.length; i++ ){
    const parent = parents[ i ];

    if( !parentOk( parent ) ){ return false; }
  } }

  return true;
}

function defineDerivedStateFunction( specs ){
  const ok = specs.ok;
  const edgeOkViaNode = specs.edgeOkViaNode || specs.ok;
  const parentOk = specs.parentOk || specs.ok;

  return function(){
    const cy = this.cy();
    if( !cy.styleEnabled() ){ return true; }

    const ele = this[0];
    const hasCompoundNodes = cy.hasCompoundNodes();

    if( ele ){
      const _p = ele._private;

      if( !ok( ele ) ){ return false; }

      if( ele.isNode() ){
        return !hasCompoundNodes || checkCompound( ele, parentOk );
      } else {
        const src = _p.source;
        const tgt = _p.target;

        return ( edgeOkViaNode(src) && (!hasCompoundNodes || checkCompound(src, edgeOkViaNode)) ) &&
          ( src === tgt || ( edgeOkViaNode(tgt) && (!hasCompoundNodes || checkCompound(tgt, edgeOkViaNode)) ) );
      }
    }
  };
}

const eleTakesUpSpace = cacheStyleFunction( 'eleTakesUpSpace', function( ele ){
  return (
    ele.pstyle( 'display' ).value === 'element'
    && ele.width() !== 0
    && ( ele.isNode() ? ele.height() !== 0 : true )
  );
} );

elesfn.takesUpSpace = cachePrototypeStyleFunction( 'takesUpSpace', defineDerivedStateFunction({
  ok: eleTakesUpSpace
}) );

const eleInteractive = cacheStyleFunction( 'eleInteractive', function( ele ){
  return (
    ele.pstyle('events').value === 'yes'
    && ele.pstyle('visibility').value === 'visible'
    && eleTakesUpSpace( ele )
  );
} );

const parentInteractive = cacheStyleFunction( 'parentInteractive', function( parent ){
  return (
    parent.pstyle('visibility').value === 'visible'
    && eleTakesUpSpace( parent )
  );
} );

elesfn.interactive = cachePrototypeStyleFunction( 'interactive', defineDerivedStateFunction({
  ok: eleInteractive,
  parentOk: parentInteractive,
  edgeOkViaNode: eleTakesUpSpace
}) );

elesfn.noninteractive = function(){
  const ele = this[0];

  if( ele ){
    return !ele.interactive();
  }
};

const eleVisible = cacheStyleFunction( 'eleVisible', function( ele ){
  return (
    ele.pstyle( 'visibility' ).value === 'visible'
    && ele.pstyle( 'opacity' ).pfValue !== 0
    && eleTakesUpSpace( ele )
  );
} );

const edgeVisibleViaNode = eleTakesUpSpace;

elesfn.visible = cachePrototypeStyleFunction( 'visible', defineDerivedStateFunction({
  ok: eleVisible,
  edgeOkViaNode: edgeVisibleViaNode
}) );

elesfn.hidden = function(){
  const ele = this[0];

  if( ele ){
    return !ele.visible();
  }
};

elesfn.isBundledBezier = cachePrototypeStyleFunction('isBundledBezier', function(){
  if( !this.cy().styleEnabled() ){ return false; }

  return !this.removed() && this.pstyle('curve-style').value === 'bezier' && this.takesUpSpace();
});

elesfn.bypass = elesfn.css = elesfn.style;
elesfn.renderedCss = elesfn.renderedStyle;
elesfn.removeBypass = elesfn.removeCss = elesfn.removeStyle;
elesfn.pstyle = elesfn.parsedStyle;

export default elesfn;
