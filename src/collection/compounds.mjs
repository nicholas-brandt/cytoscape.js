import Set from '../set.mjs';
import cache from './cache-traversal-call.mjs';

const elesfn = ({
  parent: function( selector ){
    const parents = [];

    // optimisation for single ele call
    if( this.length === 1 ){
      const parent = this[0]._private.parent;

      if( parent ){ return parent; }
    }

    for (let i = 0; i < this.length; i++ ){
      const ele = this[ i ];
      const parent = ele._private.parent;

      if( parent ){
        parents.push( parent );
      }
    }

    return this.spawn( parents, true ).filter( selector );
  },

  parents: function( selector ){
    const parents = [];

    const eles = this.parent();
    while( eles.nonempty() ){
      for (let i = 0; i < eles.length; i++ ){
        const ele = eles[ i ];
        parents.push( ele );
      }

      eles = eles.parent();
    }

    return this.spawn( parents, true ).filter( selector );
  },

  commonAncestors: function( selector ){
    let ancestors;

    for (let i = 0; i < this.length; i++ ){
      const ele = this[ i ];
      const parents = ele.parents();

      ancestors = ancestors || parents;

      ancestors = ancestors.intersect( parents ); // current list must be common with current ele parents set
    }

    return ancestors.filter( selector );
  },

  orphans: function( selector ){
    return this.stdFilter( function( ele ){
      return ele.isOrphan();
    } ).filter( selector );
  },

  nonorphans: function( selector ){
    return this.stdFilter( function( ele ){
      return ele.isChild();
    } ).filter( selector );
  },

  children: cache( function( selector ){
    const children = [];

    for (let i = 0; i < this.length; i++ ){
      const ele = this[ i ];
      const eleChildren = ele._private.children;

      for (let j = 0; j < eleChildren.length; j++ ){
        children.push( eleChildren[j] );
      }
    }

    return this.spawn( children, true ).filter( selector );
  }, 'children' ),

  siblings: function( selector ){
    return this.parent().children().not( this ).filter( selector );
  },

  isParent: function(){
    const ele = this[0];

    if( ele ){
      return ele.isNode() && ele._private.children.length !== 0;
    }
  },

  isChildless: function(){
    const ele = this[0];

    if( ele ){
      return ele.isNode() && ele._private.children.length === 0;
    }
  },

  isChild: function(){
    const ele = this[0];

    if( ele ){
      return ele.isNode() && ele._private.parent != null;
    }
  },

  isOrphan: function(){
    const ele = this[0];

    if( ele ){
      return ele.isNode() && ele._private.parent == null;
    }
  },

  descendants: function( selector ){
    const elements = [];

    function add( eles ){
      for (let i = 0; i < eles.length; i++ ){
        const ele = eles[ i ];

        elements.push( ele );

        if( ele.children().nonempty() ){
          add( ele.children() );
        }
      }
    }

    add( this.children() );

    return this.spawn( elements, true ).filter( selector );
  }
});

function forEachCompound( eles, fn, includeSelf, recursiveStep ){
  const q = [];
  const did = new Set();
  const cy = eles.cy();
  const hasCompounds = cy.hasCompoundNodes();

  for (let i = 0; i < eles.length; i++ ){
    const ele = eles[i];

    if( includeSelf ){
      q.push( ele );
    } else if( hasCompounds ){
      recursiveStep( q, did, ele );
    }
  }

  while( q.length > 0 ){
    const ele = q.shift();

    fn( ele );

    did.add( ele.id() );

    if( hasCompounds ){
      recursiveStep( q, did, ele );
    }
  }

  return eles;
}

function addChildren( q, did, ele ){
  if( ele.isParent() ){
    const children = ele._private.children;

    for (let i = 0; i < children.length; i++ ){
      const child = children[i];

      if( !did.has( child.id() ) ){
        q.push( child );
      }
    }
  }
}

// very efficient version of eles.add( eles.descendants() ).forEach()
// for internal use
elesfn.forEachDown = function( fn, includeSelf = true ){
  return forEachCompound( this, fn, includeSelf, addChildren );
};

function addParent( q, did, ele ){
  if( ele.isChild() ){
    const parent = ele._private.parent;

    if( !did.has( parent.id() ) ){
      q.push( parent );
    }
  }
}

elesfn.forEachUp = function( fn, includeSelf = true ){
  return forEachCompound( this, fn, includeSelf, addParent );
};

function addParentAndChildren( q, did, ele ){
  addParent( q, did, ele );
  addChildren( q, did, ele );
}

elesfn.forEachUpAndDown = function( fn, includeSelf = true ){
  return forEachCompound( this, fn, includeSelf, addParentAndChildren );
};

// aliases
elesfn.ancestors = elesfn.parents;

export default elesfn;
