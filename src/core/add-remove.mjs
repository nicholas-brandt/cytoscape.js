import * as is from '../is.mjs';
import * as util from '../util/index.mjs';
import Collection from '../collection/index.mjs';
import Element from '../collection/element.mjs';

const corefn = {
  add: function( opts ){

    let elements;
    const cy = this;

    // add the elements
    if( is.elementOrCollection( opts ) ){
      const eles = opts;

      if( eles._private.cy === cy ){ // same instance => just restore
        elements = eles.restore();

      } else { // otherwise, copy from json
        const jsons = [];

        for (let i = 0; i < eles.length; i++ ){
          const ele = eles[ i ];
          jsons.push( ele.json() );
        }

        elements = new Collection( cy, jsons );
      }
    }

    // specify an array of options
    else if( is.array( opts ) ){
      const jsons = opts;

      elements = new Collection( cy, jsons );
    }

    // specify via opts.nodes and opts.edges
    else if( is.plainObject( opts ) && (is.array( opts.nodes ) || is.array( opts.edges )) ){
      const elesByGroup = opts;
      const jsons = [];

      const grs = [ 'nodes', 'edges' ];
      for (let i = 0, il = grs.length; i < il; i++ ){
        const group = grs[ i ];
        const elesArray = elesByGroup[ group ];

        if( is.array( elesArray ) ){

          for (let j = 0, jl = elesArray.length; j < jl; j++ ){
            const json = util.extend( { group: group }, elesArray[ j ] );

            jsons.push( json );
          }
        }
      }

      elements = new Collection( cy, jsons );
    }

    // specify options for one element
    else {
      const json = opts;
      elements = (new Element( cy, json )).collection();
    }

    return elements;
  },

  remove: function( collection ){
    if( is.elementOrCollection( collection ) ){
      // already have right ref
    } else if( is.string( collection ) ){
      const selector = collection;
      collection = this.$( selector );
    }

    return collection.remove();
  }
};

export default corefn;
