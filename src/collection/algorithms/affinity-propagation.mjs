// Implemented by Zoe Xi @zoexi for GSOC 2016
// https://github.com/cytoscape/cytoscape.js-affinity-propagation

// Implemented from the reference library: https://github.com/juhis/affinity-propagation
// Additional reference: http://www.psi.toronto.edu/affinitypropagation/faq.html

import * as util from '../../util/index.mjs';
import * as math from '../../math.mjs';
import * as is from '../../is.mjs';
import clusteringDistance from './clustering-distances.mjs';

const defaults = util.defaults({
  distance: 'euclidean', // distance metric to compare attributes between two nodes
  preference: 'median', // suitability of a data point to serve as an exemplar
  damping: 0.8, // damping factor between [0.5, 1)
  maxIterations: 1000, // max number of iterations to run
  minIterations: 100, // min number of iterations to run in order for clustering to stop
  attributes: [ // functions to quantify the similarity between any two points
    // e.g. node => node.data('weight')
  ]
});

const setOptions = function( options ) {
  const dmp = options.damping;
  const pref = options.preference;

  if( !(0.5 <= dmp && dmp < 1) ){
    util.error(`Damping must range on [0.5, 1).  Got: ${dmp}`);
  }

  const validPrefs = ['median', 'mean', 'min', 'max'];
  if( !( validPrefs.some(v => v === pref) || is.number(pref) ) ){
    util.error(`Preference must be one of [${validPrefs.map( p => `'${p}'` ).join(', ')}] or a number.  Got: ${pref}`);
  }

  return defaults( options );
};

if( process.env.NODE_ENV !== 'production' ){ /* eslint-disable no-console, no-unused-vars */
  const printMatrix = function( M ) { // used for debugging purposes only
    const str = '';
    const log = s => str = str + s + '\n';
    const n = Math.sqrt(M.length);
    for ( const i = 0; i < n; i++ ) {
      const row = '';
      for ( const j = 0; j < n; j++ ) {
        row += M[i*n+j] + ' ';
      }
      log(row);
    }

    console.log(str);
  };
} /* eslint-enable */

const getSimilarity = function( type, n1, n2, attributes ) {
  const attr = (n, i) => attributes[i](n);

  // nb negative because similarity should have an inverse relationship to distance
  return -clusteringDistance( type, attributes.length, i => attr(n1, i), i => attr(n2, i), n1, n2 );
};

const getPreference = function( S, preference ) { // larger preference = greater # of clusters
  const p = null;

  if( preference === 'median' ){
    p = math.median( S );
  } else if( preference === 'mean' ){
    p = math.mean( S );
  } else if ( preference === 'min' ){
    p = math.min( S );
  } else if ( preference === 'max' ){
    p = math.max( S );
  } else { // Custom preference number, as set by user
    p = preference;
  }

  return p;
};

const findExemplars = function( n, R, A ) {
  const indices = [];
  for ( const i = 0; i < n; i++ ) {
    if ( R[i * n + i] + A[i * n + i] > 0 ) {
      indices.push(i);
    }
  }
  return indices;
};

const assignClusters = function( n, S, exemplars ) {
  const clusters = [];

  for ( const i = 0; i < n; i++ ) {
    const index = -1;
    const max = -Infinity;

    for ( const ei = 0; ei < exemplars.length; ei++ ) {
      const e = exemplars[ei];
      if ( S[i * n + e] > max ) {
        index = e;
        max = S[i * n + e];
      }
    }

    if( index > 0 ){
      clusters.push(index);
    }
  }

  for (let ei = 0; ei < exemplars.length; ei++) {
    clusters[ exemplars[ei] ] = exemplars[ei];
  }

  return clusters;
};

const assign = function( n, S, exemplars ) {

  let clusters = assignClusters( n, S, exemplars );

  for ( const ei = 0; ei < exemplars.length; ei++ ) {

    const ii = [];
    for ( const c = 0; c < clusters.length; c++ ) {
      if (clusters[c] === exemplars[ei]) {
        ii.push(c);
      }
    }

    const maxI = -1;
    const maxSum = -Infinity;
    for ( const i = 0; i < ii.length; i++ ) {
      const sum = 0;
      for ( const j = 0; j < ii.length; j++ ) {
        sum += S[ii[j] * n + ii[i]];
      }
      if ( sum > maxSum ) {
        maxI = i;
        maxSum = sum;
      }
    }

    exemplars[ei] = ii[maxI];
  }

  clusters = assignClusters( n, S, exemplars );

  return clusters;
};

const affinityPropagation = function( options ) {
  const cy    = this.cy();
  const nodes = this.nodes();
  const opts  = setOptions( options );

  // Map each node to its position in node array
  const id2position = {};
  for (let i = 0; i < nodes.length; i++ ){
    id2position[ nodes[i].id() ] = i;
  }

  // Begin affinity propagation algorithm

  let n;  // number of data points
  let n2; // size of matrices
  let S;  // similarity matrix (1D array)
  let p;  // preference/suitability of a data point to serve as an exemplar
  let R;  // responsibility matrix (1D array)
  let A;  // availability matrix (1D array)

  n  = nodes.length;
  n2 = n * n;

  // Initialize and build S similarity matrix
  S  = new Array(n2);
  for ( const i = 0; i < n2; i++ ) {
    S[i] = -Infinity; // for cases where two data points shouldn't be linked together
  }

  for ( const i = 0; i < n; i++ ) {
    for ( const j = 0; j < n; j++ ) {
      if ( i !== j ) {
        S[i * n + j] = getSimilarity( opts.distance, nodes[i], nodes[j], opts.attributes );
      }
    }
  }

  // Place preferences on the diagonal of S
  p = getPreference( S, opts.preference );
  for ( const i = 0; i < n; i++ ) {
    S[i * n + i] = p;
  }

  // Initialize R responsibility matrix
  R = new Array(n2);
  for ( const i = 0; i < n2; i++ ) {
    R[i] = 0.0;
  }

  // Initialize A availability matrix
  A = new Array(n2);
  for ( const i = 0; i < n2; i++ ) {
    A[i] = 0.0;
  }

  const old = new Array(n);
  const Rp  = new Array(n);
  const se  = new Array(n);

  for ( const i = 0; i < n; i ++ ) {
    old[i] = 0.0;
    Rp[i]  = 0.0;
    se[i]  = 0;
  }

  const e = new Array(n * opts.minIterations);
  for ( const i = 0; i < e.length; i++ ) {
    e[i] = 0;
  }

  let iter;
  for ( iter = 0; iter < opts.maxIterations; iter++ ) { // main algorithmic loop

    // Update R responsibility matrix
    for ( const i = 0; i < n; i++ ) {

      const max = -Infinity,
          max2 = -Infinity,
          maxI = -1,
          AS = 0.0;

      for ( const j = 0; j < n; j++ ) {

        old[j] = R[i * n + j];

        AS = A[i * n + j] + S[i * n + j];
        if ( AS >= max ) {
          max2 = max;
          max = AS;
          maxI = j;
        }
        else if ( AS > max2 ) {
          max2 = AS;
        }
      }

      for ( const j = 0; j < n; j++ ) {
        R[i * n + j] = (1 - opts.damping) * (S[i * n + j] - max) + opts.damping * old[j];
      }

      R[i * n + maxI] = (1 - opts.damping) * (S[i * n + maxI] - max2) + opts.damping * old[maxI];
    }

    // Update A availability matrix
    for ( const i = 0; i < n; i++ ) {
      let sum = 0;

      for ( const j = 0; j < n; j++ ) {
        old[j] = A[j * n + i];
        Rp[j] = Math.max(0, R[j * n + i]);
        sum += Rp[j];
      }

      sum -= Rp[i];
      Rp[i] = R[i * n + i];
      sum += Rp[i];

      for ( const j = 0; j < n; j++ ) {
        A[j * n + i] = (1 - opts.damping) * Math.min(0, sum - Rp[j]) + opts.damping * old[j];
      }
      A[i * n + i] = (1 - opts.damping) * (sum - Rp[i]) + opts.damping * old[i];
    }

    // Check for convergence
    const K = 0;
    for ( const i = 0; i < n; i++ ) {
      const E = A[i * n + i] + R[i * n + i] > 0 ? 1 : 0;
      e[(iter % opts.minIterations) * n + i] = E;
      K += E;
    }

    if ( K > 0 && (iter >= opts.minIterations - 1 || iter == opts.maxIterations - 1) ) {

      const sum = 0;
      for ( const i = 0; i < n; i++ ) {
        se[i] = 0;
        for ( const j = 0; j < opts.minIterations; j++ ) {
          se[i] += e[j * n + i];
        }
        if ( se[i] === 0 || se[i] === opts.minIterations ) {
          sum++;
        }
      }

      if ( sum === n ) { // then we have convergence
        break;
      }
    }
  }

  // Identify exemplars (cluster centers)
  const exemplarsIndices = findExemplars( n, R, A );

  // Assign nodes to clusters
  const clusterIndices = assign( n, S, exemplarsIndices, nodes, id2position );

  const clusters = {};
  for ( const c = 0; c < exemplarsIndices.length; c++ ) {
    clusters[ exemplarsIndices[c] ] = [];
  }

  for (let i = 0; i < nodes.length; i++) {
    const pos = id2position[ nodes[i].id() ];
    const clusterIndex = clusterIndices[pos];

    if( clusterIndex != null ){ // the node may have not been assigned a cluster if no valid attributes were specified
      clusters[ clusterIndex ].push( nodes[i] );
    }
  }
  const retClusters = new Array(exemplarsIndices.length);
  for ( const c = 0; c < exemplarsIndices.length; c++ ) {
    retClusters[c] = cy.collection( clusters[ exemplarsIndices[c] ] );
  }

  return retClusters;
};

export default { affinityPropagation, ap: affinityPropagation };
