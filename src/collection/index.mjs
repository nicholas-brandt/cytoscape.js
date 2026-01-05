import * as util from '../util/index.mjs';
import * as is from '../is.mjs';
import Map from '../map.mjs';
import Set from '../set.mjs';

import Element from './element.mjs';
import algorithms from './algorithms/index.mjs';
import animation from './animation.mjs';
import classNames from './class.mjs';
import comparators from './comparators.mjs';
import compounds from './compounds.mjs';
import data from './data.mjs';
import degree from './degree.mjs';
import dimensions from './dimensions/index.mjs';
import events from './events.mjs';
import filter from  './filter.mjs';
import group from './group.mjs';
import iteration from './iteration.mjs';
import layout from './layout.mjs';
import style from './style.mjs';
import switchFunctions from './switch-functions.mjs';
import traversing from './traversing.mjs';

// represents a set of nodes, edges, or both together
const Collection = function( cy, elements, unique = false, removed = false ){
  if( cy === undefined ){
    util.error( 'A collection must have a reference to the core' );
    return;
  }

  const map = new Map();
  const createdElements = false;

  if( !elements ){
    elements = [];
  } else if( elements.length > 0 && is.plainObject( elements[0] ) && !is.element( elements[0] ) ){
    createdElements = true;

    // make elements from json and restore all at once later
    const eles = [];
    const elesIds = new Set();

    for (let i = 0, l = elements.length; i < l; i++ ){
      const json = elements[ i ];

      if( json.data == null ){
        json.data = {};
      }

      const data = json.data;

      // make sure newly created elements have valid ids
      if( data.id == null ){
        data.id = util.uuid();
      } else if( cy.hasElementWithId( data.id ) || elesIds.has( data.id ) ){
        continue; // can't create element if prior id already exists
      }

      const ele = new Element( cy, json, false );
      eles.push( ele );
      elesIds.add( data.id );
    }

    elements = eles;
  }

  this.length = 0;

  for (let i = 0, l = elements.length; i < l; i++ ){
    const element = elements[i][0]; // [0] in case elements is an array of collections, rather than array of elements
    if( element == null ){  continue; }

    const id = element._private.data.id;

    if( !unique || !map.has(id) ){
      if( unique ){
        map.set( id, {
          index: this.length,
          ele: element
        } );
      }

      this[ this.length ] = element;
      this.length++;
    }
  }

  this._private = {
    eles: this,
    cy: cy,
    get map(){
      if( this.lazyMap == null ){
        this.rebuildMap();
      }

      return this.lazyMap;
    },
    set map(m){
      this.lazyMap = m;
    },
    rebuildMap(){
      const m = this.lazyMap = new Map();
      const eles = this.eles;

      for (let i = 0; i < eles.length; i++ ){
        const ele = eles[i];

        m.set(ele.id(), { index: i, ele });
      }
    }
  };

  if( unique ){
    this._private.map = map;
  }

  // restore the elements if we created them from json
  if( createdElements && !removed ){
    this.restore();
  }
};

// Functions
////////////////////////////////////////////////////////////////////////////////////////////////////

// keep the prototypes in sync (an element has the same functions as a collection)
// and use elefn and elesfn as shorthands to the prototypes
const elesfn = Element.prototype = Collection.prototype = Object.create(Array.prototype);

elesfn.instanceString = function(){
  return 'collection';
};

elesfn.spawn = function( eles, unique ){
  return new Collection( this.cy(), eles, unique );
};

elesfn.spawnSelf = function(){
  return this.spawn( this );
};

elesfn.cy = function(){
  return this._private.cy;
};

elesfn.renderer = function(){
  return this._private.cy.renderer();
};

elesfn.element = function(){
  return this[0];
};

elesfn.collection = function(){
  if( is.collection( this ) ){
    return this;
  } else { // an element
    return new Collection( this._private.cy, [ this ] );
  }
};

elesfn.unique = function(){
  return new Collection( this._private.cy, this, true );
};

elesfn.hasElementWithId = function( id ){
  id = '' + id; // id must be string

  return this._private.map.has( id );
};

elesfn.getElementById = function( id ){
  id = '' + id; // id must be string

  const cy = this._private.cy;
  const entry = this._private.map.get( id );

  return entry ? entry.ele : new Collection( cy ); // get ele or empty collection
};

elesfn.$id = elesfn.getElementById;

elesfn.poolIndex = function(){
  const cy = this._private.cy;
  const eles = cy._private.elements;
  const id = this[0]._private.data.id;

  return eles._private.map.get( id ).index;
};

elesfn.indexOf = function( ele ){
  const id = ele[0]._private.data.id;

  return this._private.map.get( id ).index;
};

elesfn.indexOfId = function( id ){
  id = '' + id; // id must be string

  return this._private.map.get( id ).index;
};

elesfn.json = function( obj ){
  const ele = this.element();
  const cy = this.cy();

  if( ele == null && obj ){ return this; } // can't set to no eles

  if( ele == null ){ return undefined; } // can't get from no eles

  const p = ele._private;

  if( is.plainObject( obj ) ){ // set

    cy.startBatch();

    if( obj.data ){
      ele.data( obj.data );

      const data = p.data;

      if( ele.isEdge() ){ // source and target are immutable via data()
        const move = false;
        const spec = {};
        const src = obj.data.source;
        const tgt = obj.data.target;

        if( src != null && src != data.source ){
          spec.source = '' + src; // id must be string
          move = true;
        }

        if( tgt != null && tgt != data.target ){
          spec.target = '' + tgt; // id must be string
          move = true;
        }

        if( move ){
          ele = ele.move(spec);
        }
      } else { // parent is immutable via data()
        const newParentValSpecd = 'parent' in obj.data;
        const parent = obj.data.parent;

        if( newParentValSpecd && (parent != null || data.parent != null) && parent != data.parent ){
          if( parent === undefined ){ // can't set undefined imperatively, so use null
            parent = null;
          }

          if( parent != null ){
            parent = '' + parent; // id must be string
          }

          ele = ele.move({ parent });
        }
      }
    }

    if( obj.position ){
      ele.position( obj.position );
    }

    // ignore group -- immutable

    const checkSwitch = function( k, trueFnName, falseFnName ){
      const obj_k = obj[ k ];

      if( obj_k != null && obj_k !== p[ k ] ){
        if( obj_k ){
          ele[ trueFnName ]();
        } else {
          ele[ falseFnName ]();
        }
      }
    };

    checkSwitch( 'removed', 'remove', 'restore' );

    checkSwitch( 'selected', 'select', 'unselect' );

    checkSwitch( 'selectable', 'selectify', 'unselectify' );

    checkSwitch( 'locked', 'lock', 'unlock' );

    checkSwitch( 'grabbable', 'grabify', 'ungrabify' );

    checkSwitch( 'pannable', 'panify', 'unpanify' );

    if( obj.classes != null ){
      ele.classes( obj.classes );
    }

    cy.endBatch();

    return this;

  } else if( obj === undefined ){ // get

    const json = {
      data: util.copy( p.data ),
      position: util.copy( p.position ),
      group: p.group,
      removed: p.removed,
      selected: p.selected,
      selectable: p.selectable,
      locked: p.locked,
      grabbable: p.grabbable,
      pannable: p.pannable,
      classes: null
    };

    json.classes = '';

    const i = 0;
    p.classes.forEach( cls => json.classes += ( i++ === 0 ? cls : ' ' + cls ) );

    return json;
  }
};

elesfn.jsons = function(){
  const jsons = [];

  for (let i = 0; i < this.length; i++ ){
    const ele = this[ i ];
    const json = ele.json();

    jsons.push( json );
  }

  return jsons;
};

elesfn.clone = function(){
  const cy = this.cy();
  const elesArr = [];

  for (let i = 0; i < this.length; i++ ){
    const ele = this[ i ];
    const json = ele.json();
    const clone = new Element( cy, json, false ); // NB no restore

    elesArr.push( clone );
  }

  return new Collection( cy, elesArr );
};
elesfn.copy = elesfn.clone;

elesfn.restore = function( notifyRenderer = true, addToPool = true ){
  const self = this;
  const cy = self.cy();
  const cy_p = cy._private;

  // create arrays of nodes and edges, since we need to
  // restore the nodes first
  const nodes = [];
  const edges = [];
  let elements;
  for (let i = 0, l = self.length; i < l; i++ ){
    const ele = self[ i ];

    if( addToPool && !ele.removed() ){
      // don't need to handle this ele
      continue;
    }

    // keep nodes first in the array and edges after
    if( ele.isNode() ){ // put to front of array if node
      nodes.push( ele );
    } else { // put to end of array if edge
      edges.push( ele );
    }
  }

  elements = nodes.concat( edges );

  let i;
  const removeFromElements = function(){
    elements.splice( i, 1 );
    i--;
  };

  // now, restore each element
  for( i = 0; i < elements.length; i++ ){
    const ele = elements[ i ];

    const _private = ele._private;
    const data = _private.data;

    // the traversal cache should start fresh when ele is added
    ele.clearTraversalCache();

    // set id and validate
    if( !addToPool && !_private.removed ){
      // already in graph, so nothing required

    } else if( data.id === undefined ){
      data.id = util.uuid();

    } else if( is.number( data.id ) ){
      data.id = '' + data.id; // now it's a string

    } else if( is.emptyString( data.id ) || !is.string( data.id ) ){
      util.error( 'Can not create element with invalid string ID `' + data.id + '`' );

      // can't create element if it has empty string as id or non-string id
      removeFromElements();
      continue;
    } else if( cy.hasElementWithId( data.id ) ){
      util.error( 'Can not create second element with ID `' + data.id + '`' );

      // can't create element if one already has that id
      removeFromElements();
      continue;
    }

    const id = data.id; // id is finalised, now let's keep a ref

    if( ele.isNode() ){ // extra checks for nodes
      const pos = _private.position;

      // make sure the nodes have a defined position

      if( pos.x == null ){
        pos.x = 0;
      }

      if( pos.y == null ){
        pos.y = 0;
      }
    }

    if( ele.isEdge() ){ // extra checks for edges

      const edge = ele;
      const fields = [ 'source', 'target' ];
      const fieldsLength = fields.length;
      const badSourceOrTarget = false;
      for (let j = 0; j < fieldsLength; j++ ){

        const field = fields[ j ];
        const val = data[ field ];

        if( is.number( val ) ){
          val = data[ field ] = '' + data[ field ]; // now string
        }

        if( val == null || val === '' ){
          // can't create if source or target is not defined properly
          util.error( 'Can not create edge `' + id + '` with unspecified ' + field );
          badSourceOrTarget = true;
        } else if( !cy.hasElementWithId( val ) ){
          // can't create edge if one of its nodes doesn't exist
          util.error( 'Can not create edge `' + id + '` with nonexistent ' + field + ' `' + val + '`' );
          badSourceOrTarget = true;
        }
      }

      if( badSourceOrTarget ){ removeFromElements(); continue; } // can't create this

      const src = cy.getElementById( data.source );
      const tgt = cy.getElementById( data.target );

      // only one edge in node if loop
      if (src.same(tgt)) {
          src._private.edges.push( edge );
      } else {
          src._private.edges.push( edge );
          tgt._private.edges.push( edge );
      }

      edge._private.source = src;
      edge._private.target = tgt;
    } // if is edge

    // create mock ids / indexes maps for element so it can be used like collections
    _private.map = new Map();
    _private.map.set( id, { ele: ele, index: 0 } );

    _private.removed = false;

    if( addToPool ){
      cy.addToPool( ele );
    }
  } // for each element

  // do compound node sanity checks
  for (let i = 0; i < nodes.length; i++ ){ // each node
    const node = nodes[ i ];
    const data = node._private.data;

    if( is.number( data.parent ) ){ // then automake string
      data.parent = '' + data.parent;
    }

    const parentId = data.parent;

    const specifiedParent = parentId != null;

    if( specifiedParent || node._private.parent ){

      const parent = node._private.parent ? cy.collection().merge(node._private.parent) : cy.getElementById( parentId );

      if( parent.empty() ){
        // non-existant parent; just remove it
        data.parent = undefined;
      } else if( parent[0].removed() ) {
        util.warn('Node added with missing parent, reference to parent removed');
        data.parent = undefined;
        node._private.parent = null;
      } else {
        const selfAsParent = false;
        const ancestor = parent;
        while( !ancestor.empty() ){
          if( node.same( ancestor ) ){
            // mark self as parent and remove from data
            selfAsParent = true;
            data.parent = undefined; // remove parent reference

            // exit or we loop forever
            break;
          }

          ancestor = ancestor.parent();
        }

        if( !selfAsParent ){
          // connect with children
          parent[0]._private.children.push( node );
          node._private.parent = parent[0];

          // let the core know we have a compound graph
          cy_p.hasCompoundNodes = true;
        }
      } // else
    } // if specified parent
  } // for each node

  if( elements.length > 0 ){
    const restored = elements.length === self.length ? self : new Collection( cy, elements );

    for (let i = 0; i < restored.length; i++ ){
      const ele = restored[i];

      if( ele.isNode() ){ continue; }

      // adding an edge invalidates the traversal caches for the parallel edges
      ele.parallelEdges().clearTraversalCache();

      // adding an edge invalidates the traversal cache for the connected nodes
      ele.source().clearTraversalCache();
      ele.target().clearTraversalCache();
    }

    let toUpdateStyle;

    if( cy_p.hasCompoundNodes ){
      toUpdateStyle = cy.collection().merge( restored ).merge( restored.connectedNodes() ).merge( restored.parent() );
    } else {
      toUpdateStyle = restored;
    }

    toUpdateStyle.dirtyCompoundBoundsCache().dirtyBoundingBoxCache().updateStyle( notifyRenderer );

    if( notifyRenderer ){
      restored.emitAndNotify( 'add' );
    } else if( addToPool ){
      restored.emit( 'add' );
    }
  }

  return self; // chainability
};

elesfn.removed = function(){
  const ele = this[0];
  return ele && ele._private.removed;
};

elesfn.inside = function(){
  const ele = this[0];
  return ele && !ele._private.removed;
};

elesfn.remove = function( notifyRenderer = true, removeFromPool = true ){
  const self = this;
  const elesToRemove = [];
  const elesToRemoveIds = {};
  const cy = self._private.cy;

  // add connected edges
  function addConnectedEdges( node ){
    const edges = node._private.edges;
    for (let i = 0; i < edges.length; i++ ){
      add( edges[ i ] );
    }
  }

  // add descendant nodes
  function addChildren( node ){
    const children = node._private.children;

    for (let i = 0; i < children.length; i++ ){
      add( children[ i ] );
    }
  }

  function add( ele ){
    const alreadyAdded =  elesToRemoveIds[ ele.id() ];
    if( (removeFromPool && ele.removed()) || alreadyAdded ){
      return;
    } else {
      elesToRemoveIds[ ele.id() ] = true;
    }

    if( ele.isNode() ){
      elesToRemove.push( ele ); // nodes are removed last

      addConnectedEdges( ele );
      addChildren( ele );
    } else {
      elesToRemove.unshift( ele ); // edges are removed first
    }
  }

  // make the list of elements to remove
  // (may be removing more than specified due to connected edges etc)

  for (let i = 0, l = self.length; i < l; i++ ){
    const ele = self[ i ];

    add( ele );
  }

  function removeEdgeRef( node, edge ){
    const connectedEdges = node._private.edges;

    util.removeFromArray( connectedEdges, edge );

    // removing an edges invalidates the traversal cache for its nodes
    node.clearTraversalCache();
  }

  function removeParallelRef( pllEdge ){
    // removing an edge invalidates the traversal caches for the parallel edges
    pllEdge.clearTraversalCache();
  }

  const alteredParents = [];
  alteredParents.ids = {};

  function removeChildRef( parent, ele ){
    ele = ele[0];
    parent = parent[0];

    const children = parent._private.children;
    const pid = parent.id();

    util.removeFromArray( children, ele ); // remove parent => child ref

    ele._private.parent = null; // remove child => parent ref

    if( !alteredParents.ids[ pid ] ){
      alteredParents.ids[ pid ] = true;
      alteredParents.push( parent );
    }
  }

  self.dirtyCompoundBoundsCache();

  if( removeFromPool ){
    cy.removeFromPool( elesToRemove ); // remove from core pool
  }

  for (let i = 0; i < elesToRemove.length; i++ ){
    const ele = elesToRemove[ i ];

    if( ele.isEdge() ){ // remove references to this edge in its connected nodes
      const src = ele.source()[0];
      const tgt = ele.target()[0];

      removeEdgeRef( src, ele );
      removeEdgeRef( tgt, ele );

      const pllEdges = ele.parallelEdges();

      for (let j = 0; j < pllEdges.length; j++ ){
        const pllEdge = pllEdges[j];

        removeParallelRef(pllEdge);

        if( pllEdge.isBundledBezier() ){
          pllEdge.dirtyBoundingBoxCache();
        }
      }

    } else { // remove reference to parent
      const parent = ele.parent();

      if( parent.length !== 0 ){
        removeChildRef( parent, ele );
      }
    }

    if( removeFromPool ){
      // mark as removed
      ele._private.removed = true;
    }
  }

  // check to see if we have a compound graph or not
  const elesStillInside = cy._private.elements;
  cy._private.hasCompoundNodes = false;
  for (let i = 0; i < elesStillInside.length; i++ ){
    const ele = elesStillInside[ i ];

    if( ele.isParent() ){
      cy._private.hasCompoundNodes = true;
      break;
    }
  }

  const removedElements = new Collection( this.cy(), elesToRemove );

  if( removedElements.size() > 0 ){
    // must manually notify since trigger won't do this automatically once removed

    if( notifyRenderer ){
      removedElements.emitAndNotify('remove');
    } else if( removeFromPool ){
      removedElements.emit('remove');
    }
  }

  // the parents who were modified by the removal need their style updated
  for (let i = 0; i < alteredParents.length; i++ ){
    const ele = alteredParents[ i ];

    if( !removeFromPool || !ele.removed() ){
      ele.updateStyle();
    }
  }

  return removedElements;
};

elesfn.move = function( struct ){
  const cy = this._private.cy;
  const eles = this;

  // just clean up refs, caches, etc. in the same way as when removing and then restoring
  // (our calls to remove/restore do not remove from the graph or make events)
  const notifyRenderer = false;
  const modifyPool = false;

  const toString = id => id == null ? id : '' + id; // id must be string

  if( struct.source !== undefined || struct.target !== undefined ){
    const srcId = toString(struct.source);
    const tgtId = toString(struct.target);
    const srcExists = srcId != null && cy.hasElementWithId( srcId );
    const tgtExists = tgtId != null && cy.hasElementWithId( tgtId );

    if( srcExists || tgtExists ){
      cy.batch(() => { // avoid duplicate style updates
        eles.remove( notifyRenderer, modifyPool ); // clean up refs etc.
        eles.emitAndNotify('moveout');

        for (let i = 0; i < eles.length; i++ ){
          const ele = eles[i];
          const data = ele._private.data;

          if( ele.isEdge() ){
            if( srcExists ){ data.source = srcId; }

            if( tgtExists ){ data.target = tgtId; }
          }
        }

        eles.restore( notifyRenderer, modifyPool ); // make new refs, style, etc.
      });

      eles.emitAndNotify('move');
    }

  } else if( struct.parent !== undefined ){ // move node to new parent
    const parentId = toString(struct.parent);
    const parentExists = parentId === null || cy.hasElementWithId( parentId );

    if( parentExists ){
      const pidToAssign = parentId === null ? undefined : parentId;

      cy.batch(() => { // avoid duplicate style updates
        const updated = eles.remove( notifyRenderer, modifyPool ); // clean up refs etc.
        updated.emitAndNotify('moveout');

        for (let i = 0; i < eles.length; i++ ){
          const ele = eles[i];
          const data = ele._private.data;

          if( ele.isNode() ){
            data.parent = pidToAssign;
          }
        }

        updated.restore( notifyRenderer, modifyPool ); // make new refs, style, etc.
      });

      eles.emitAndNotify('move');
    }
  }

  return this;
};

[
  algorithms,
  animation,
  classNames,
  comparators,
  compounds,
  data,
  degree,
  dimensions,
  events,
  filter,
  group,
  iteration,
  layout,
  style,
  switchFunctions,
  traversing
].forEach( function( props ){
  util.extend( elesfn, props );
} );

export default Collection;
