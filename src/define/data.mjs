import * as util from '../util/index.mjs';
import * as is from '../is.mjs';
import get from 'lodash/get.js';
import set from 'lodash/set.js';
import toPath from 'lodash/toPath.js';

const define = {

  // access data field
  data: function( params ){
    const defaults = {
      field: 'data',
      bindingEvent: 'data',
      allowBinding: false,
      allowSetting: false,
      allowGetting: false,
      settingEvent: 'data',
      settingTriggersEvent: false,
      triggerFnName: 'trigger',
      immutableKeys: {}, // key => true if immutable
      updateStyle: false,
      beforeGet: function( self ){},
      beforeSet: function( self, obj ){},
      onSet: function( self ){},
      canSet: function( self ){ return true; }
    };
    params = util.extend( {}, defaults, params );

    return function dataImpl( name, value ){
      const p = params;
      const self = this;
      const selfIsArrayLike = self.length !== undefined;
      const all = selfIsArrayLike ? self : [ self ]; // put in array if not array-like
      const single = selfIsArrayLike ? self[0] : self;

      // .data('foo', ...)
      if (is.string(name)) { // set or get property
        const isPathLike = name.indexOf('.') !== -1; // there might be a normal field with a dot 
        const path = isPathLike && toPath(name);

        // .data('foo')
        if( p.allowGetting && value === undefined ){ // get

          let ret;
          if( single ){
            p.beforeGet( single );

            // check if it's path and a field with the same name doesn't exist
            if (path && single._private[ p.field ][ name ] === undefined) {
              ret = get(single._private[ p.field ], path);
            } else {
              ret = single._private[ p.field ][ name ];
            }
          }
          return ret;

        // .data('foo', 'bar')
        } else if( p.allowSetting && value !== undefined ){ // set
          const valid = !p.immutableKeys[ name ];
          if( valid ){
            const change = { [name]: value };

            p.beforeSet( self, change );

            for (let i = 0, l = all.length; i < l; i++ ){
              const ele = all[i];

              if( p.canSet( ele ) ){
                if (path && single._private[ p.field ][ name ] === undefined) {
                  set(ele._private[ p.field ], path, value);
                } else {
                  ele._private[ p.field ][ name ] = value;
                }
              }
            }

            // update mappers if asked
            if( p.updateStyle ){ self.updateStyle(); }

            // call onSet callback
            p.onSet( self );

            if( p.settingTriggersEvent ){
              self[ p.triggerFnName ]( p.settingEvent );
            }
          }
        }

      // .data({ 'foo': 'bar' })
      } else if( p.allowSetting && is.plainObject( name ) ){ // extend
        const obj = name;
        let k, v;
        const keys = Object.keys( obj );

        p.beforeSet( self, obj );

        for (let i = 0; i < keys.length; i++ ){
          k = keys[ i ];
          v = obj[ k ];

          const valid = !p.immutableKeys[ k ];
          if( valid ){
            for (let j = 0; j < all.length; j++ ){
              const ele = all[j];

              if( p.canSet( ele ) ){
                ele._private[ p.field ][ k ] = v;
              }
            }
          }
        }

        // update mappers if asked
        if( p.updateStyle ){ self.updateStyle(); }

        // call onSet callback
        p.onSet( self );

        if( p.settingTriggersEvent ){
          self[ p.triggerFnName ]( p.settingEvent );
        }

      // .data(function(){ ... })
      } else if( p.allowBinding && is.fn( name ) ){ // bind to event
        const fn = name;
        self.on( p.bindingEvent, fn );

      // .data()
      } else if( p.allowGetting && name === undefined ){ // get whole object
        let ret;
        if( single ){
          p.beforeGet( single );

          ret = single._private[ p.field ];
        }
        return ret;
      }

      return self; // maintain chainability
    }; // function
  }, // data

  // remove data field
  removeData: function( params ){
    const defaults = {
      field: 'data',
      event: 'data',
      triggerFnName: 'trigger',
      triggerEvent: false,
      immutableKeys: {} // key => true if immutable
    };
    params = util.extend( {}, defaults, params );

    return function removeDataImpl( names ){
      const p = params;
      const self = this;
      const selfIsArrayLike = self.length !== undefined;
      const all = selfIsArrayLike ? self : [ self ]; // put in array if not array-like

      // .removeData('foo bar')
      if( is.string( names ) ){ // then get the list of keys, and delete them
        const keys = names.split( /\s+/ );
        const l = keys.length;

        for (let i = 0; i < l; i++ ){ // delete each non-empty key
          const key = keys[ i ];
          if( is.emptyString( key ) ){ continue; }

          const valid = !p.immutableKeys[ key ]; // not valid if immutable
          if( valid ){
            for (let i_a = 0, l_a = all.length; i_a < l_a; i_a++ ){
              all[ i_a ]._private[ p.field ][ key ] = undefined;
            }
          }
        }

        if( p.triggerEvent ){
          self[ p.triggerFnName ]( p.event );
        }

      // .removeData()
      } else if( names === undefined ){ // then delete all keys

        for (let i_a = 0, l_a = all.length; i_a < l_a; i_a++ ){
          const _privateFields = all[ i_a ]._private[ p.field ];
          const keys = Object.keys( _privateFields );

          for (let i = 0; i < keys.length; i++ ){
            const key = keys[i];
            const validKeyToDelete = !p.immutableKeys[ key ];

            if( validKeyToDelete ){
              _privateFields[ key ] = undefined;
            }
          }
        }

        if( p.triggerEvent ){
          self[ p.triggerFnName ]( p.event );
        }
      }

      return self; // maintain chaining
    }; // function
  }, // removeData
}; // define

export default define;
