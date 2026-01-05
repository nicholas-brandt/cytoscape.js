export const memoize = ( fn, keyFn ) => {
  if( !keyFn ){
    keyFn = function(){
      if( arguments.length === 1 ){
        return arguments[0];
      } else if( arguments.length === 0 ){
        return 'undefined';
      }

      const args = [];

      for (let i = 0; i < arguments.length; i++ ){
        args.push( arguments[ i ] );
      }

      return args.join( '$' );
    };
  }

  const memoizedFn = function(){
    const self = this;
    const args = arguments;
    let ret;
    const k = keyFn.apply( self, args );
    const cache = memoizedFn.cache;

    if( !(ret = cache[ k ]) ){
      ret = cache[ k ] = fn.apply( self, args );
    }

    return ret;
  };

  memoizedFn.cache = {};

  return memoizedFn;
};
