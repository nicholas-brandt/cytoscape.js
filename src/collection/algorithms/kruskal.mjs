const elesfn = ({

  // kruskal's algorithm (finds min spanning tree, assuming undirected graph)
  // implemented from pseudocode from wikipedia
  kruskal: function( weightFn ){
    weightFn = weightFn || ( edge => 1 );

    let { nodes, edges } = this.byGroup();
    const numNodes = nodes.length;
    const forest = new Array(numNodes);
    const A = nodes; // assumes byGroup() creates new collections that can be safely mutated

    const findSetIndex = ele => {
      for (let i = 0; i < forest.length; i++ ){
        const eles = forest[i];

        if( eles.has(ele) ){ return i; }
      }
    };

    // start with one forest per node
    for (let i = 0; i < numNodes; i++ ){
      forest[i] = this.spawn( nodes[i] );
    }

    const S = edges.sort( (a, b) => weightFn(a) - weightFn(b) );

    for (let i = 0; i < S.length; i++ ){
      const edge = S[i];
      const u = edge.source()[0];
      const v = edge.target()[0];
      const setUIndex = findSetIndex(u);
      const setVIndex = findSetIndex(v);
      const setU = forest[ setUIndex ];
      const setV = forest[ setVIndex ];

      if( setUIndex !== setVIndex ){
        A.merge( edge );

        // combine forests for u and v
        setU.merge( setV );
        forest.splice( setVIndex, 1 );
      }
    }

    return A;
  }
});

export default elesfn;
