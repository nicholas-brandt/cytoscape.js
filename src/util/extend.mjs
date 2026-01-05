export const extend = Object.assign != null ? Object.assign.bind( Object ) : function( tgt ){
  const args = arguments;

  for (let i = 1; i < args.length; i++ ){
    const obj = args[ i ];

    if( obj == null ){ continue; }

    const keys = Object.keys( obj );

    for (let j = 0; j < keys.length; j++ ){
      const k = keys[j];

      tgt[ k ] = obj[ k ];
    }
  }

  return tgt;
};
