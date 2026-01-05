import * as is from '../../is.mjs';
import Heap from '../../heap.mjs';
import { defaults } from '../../util/index.mjs';

const dijkstraDefaults = defaults({
  root: null,
  weight: edge => 1,
  directed: false
});

const elesfn = ({

  dijkstra: function( options ){
    if( !is.plainObject(options) ){
      const args = arguments;

      options = { root: args[0], weight: args[1], directed: args[2] };
    }

    let { root, weight, directed } = dijkstraDefaults(options);

    const eles = this;
    const weightFn = weight;
    const source = is.string( root ) ? this.filter( root )[0] : root[0];
    const dist = {};
    const prev = {};
    const knownDist = {};

    let { nodes, edges } = this.byGroup();
    edges.unmergeBy( ele => ele.isLoop() );

    const getDist = node => dist[ node.id() ];

    const setDist = ( node, d ) => {
      dist[ node.id() ] = d;

      Q.updateItem( node );
    };

    const Q = new Heap( (a, b) => getDist(a) - getDist(b) );

    for (let i = 0; i < nodes.length; i++ ){
      const node = nodes[ i ];

      dist[ node.id() ] = node.same( source ) ? 0 : Infinity;
      Q.push( node );
    }

    const distBetween = ( u, v ) => {
      const uvs = ( directed ? u.edgesTo(v) : u.edgesWith(v) ).intersect( edges );
      const smallestDistance = Infinity;
      let smallestEdge;

      for (let i = 0; i < uvs.length; i++ ){
        const edge = uvs[ i ];
        const weight = weightFn( edge );

        if( weight < smallestDistance || !smallestEdge ){
          smallestDistance = weight;
          smallestEdge = edge;
        }
      }

      return {
        edge: smallestEdge,
        dist: smallestDistance
      };
    };

    while( Q.size() > 0 ){
      const u = Q.pop();
      const smalletsDist = getDist( u );
      const uid = u.id();

      knownDist[ uid ] = smalletsDist;

      if( smalletsDist === Infinity ){
        continue;
      }

      const neighbors = u.neighborhood().intersect( nodes );
      for (let i = 0; i < neighbors.length; i++ ){
        const v = neighbors[ i ];
        const vid = v.id();
        const vDist = distBetween( u, v );

        const alt = smalletsDist + vDist.dist;

        if( alt < getDist( v ) ){
          setDist( v, alt );

          prev[ vid ] = {
            node: u,
            edge: vDist.edge
          };
        }
      } // for
    } // while

    return {
      distanceTo: function( node ){
        const target = is.string( node ) ? nodes.filter( node )[0] : node[0];

        return knownDist[ target.id() ];
      },

      pathTo: function( node ){
        const target = is.string( node ) ? nodes.filter( node )[0] : node[0];
        const S = [];
        const u = target;
        const uid = u.id();

        if( target.length > 0 ){
          S.unshift( target );

          while( prev[ uid ] ){
            const p = prev[ uid ];

            S.unshift( p.edge );
            S.unshift( p.node );

            u = p.node;
            uid = u.id();
          }
        }

        return eles.spawn( S );
      }
    };
  }
});

export default elesfn;
