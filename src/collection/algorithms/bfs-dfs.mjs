import * as is from '../../is.mjs';

const defineSearch = function( params ){
  params = {
    bfs: params.bfs || !params.dfs,
    dfs: params.dfs || !params.bfs
  };

  // from pseudocode on wikipedia
  return function searchFn( roots, fn, directed ){
    let options;
    if( is.plainObject( roots ) && !is.elementOrCollection( roots ) ){
      options = roots;
      roots = options.roots || options.root;
      fn = options.visit;
      directed = options.directed;
    }

    directed = arguments.length === 2 && !is.fn( fn ) ? fn : directed;
    fn = is.fn( fn ) ? fn : function(){};

    const cy = this._private.cy;
    const v = roots = is.string( roots ) ? this.filter( roots ) : roots;
    const Q = [];
    const connectedNodes = [];
    const connectedBy = {};
    const id2depth = {};
    const V = {};
    const j = 0;
    let found;
    let { nodes, edges } = this.byGroup();

    // enqueue v
    for (let i = 0; i < v.length; i++ ){
      const vi = v[i];
      const viId = vi.id();

      if( vi.isNode() ){
        Q.unshift( vi );

        if( params.bfs ){
          V[ viId ] = true;

          connectedNodes.push( vi );
        }

        id2depth[ viId ] = 0;
      }
    }

    while( Q.length !== 0 ){
      const v = params.bfs ? Q.shift() : Q.pop();
      const vId = v.id();

      if( params.dfs ){
        if( V[ vId ] ){ continue; }

        V[ vId ] = true;

        connectedNodes.push( v );
      }

      const depth = id2depth[ vId ];
      const prevEdge = connectedBy[ vId ];
      const src = prevEdge != null ? prevEdge.source() : null;
      const tgt = prevEdge != null ? prevEdge.target() : null;
      const prevNode = prevEdge == null ? undefined : ( v.same(src) ? tgt[0] : src[0] );
      let ret;

      ret = fn( v, prevEdge, prevNode, j++, depth );

      if( ret === true ){
        found = v;
        break;
      }

      if( ret === false ){
        break;
      }

      const vwEdges = v.connectedEdges().filter(e => (!directed || e.source().same(v)) && edges.has(e));
      for (let i = 0; i < vwEdges.length; i++ ){
        const e = vwEdges[ i ];
        const w = e.connectedNodes().filter(n => !n.same(v) && nodes.has(n));
        const wId = w.id();

        if( w.length !== 0 && !V[ wId ] ){
          w = w[0];

          Q.push( w );

          if( params.bfs ){
            V[ wId ] = true;

            connectedNodes.push( w );
          }

          connectedBy[ wId ] = e;

          id2depth[ wId ] = id2depth[ vId ] + 1;
        }
      }

    }

    const connectedEles = cy.collection();

    for (let i = 0; i < connectedNodes.length; i++ ){
      const node = connectedNodes[ i ];
      const edge = connectedBy[ node.id() ];

      if( edge != null ){
        connectedEles.push( edge );
      }

      connectedEles.push( node );
    }

    return {
      path: cy.collection( connectedEles ),
      found: cy.collection( found )
    };
  };
};

// search, spanning trees, etc
const elesfn = ({
  breadthFirstSearch: defineSearch( { bfs: true } ),
  depthFirstSearch: defineSearch( { dfs: true } )
});

// nice, short mathematical alias
elesfn.bfs = elesfn.breadthFirstSearch;
elesfn.dfs = elesfn.depthFirstSearch;

export default elesfn;
