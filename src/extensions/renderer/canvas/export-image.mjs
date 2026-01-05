/* global atob, ArrayBuffer, Uint8Array, Blob */

import * as is from '../../../is.mjs';
import Promise from '../../../promise.mjs';

const CRp = {};

CRp.createBuffer = function( w, h ){
  const buffer = document.createElement( 'canvas' ); // eslint-disable-line no-undef
  buffer.width = w;
  buffer.height = h;

  return [ buffer, buffer.getContext( '2d' ) ];
};

CRp.bufferCanvasImage = function( options ){
  const cy = this.cy;
  const eles = cy.mutableElements();
  const bb = eles.boundingBox();
  const ctrRect = this.findContainerClientCoords();
  const width = options.full ? Math.ceil( bb.w ) : ctrRect[2];
  const height = options.full ? Math.ceil( bb.h ) : ctrRect[3];
  const specdMaxDims = is.number( options.maxWidth ) || is.number( options.maxHeight );
  const pxRatio = this.getPixelRatio();
  const scale = 1;

  if( options.scale !== undefined ){
    width *= options.scale;
    height *= options.scale;

    scale = options.scale;
  } else if( specdMaxDims ){
    const maxScaleW = Infinity;
    const maxScaleH = Infinity;

    if( is.number( options.maxWidth ) ){
      maxScaleW = scale * options.maxWidth / width;
    }

    if( is.number( options.maxHeight ) ){
      maxScaleH = scale * options.maxHeight / height;
    }

    scale = Math.min( maxScaleW, maxScaleH );

    width *= scale;
    height *= scale;
  }

  if( !specdMaxDims ){
    width *= pxRatio;
    height *= pxRatio;
    scale *= pxRatio;
  }

  const buffCanvas = document.createElement( 'canvas' ); // eslint-disable-line no-undef

  buffCanvas.width = width;
  buffCanvas.height = height;

  buffCanvas.style.width = width + 'px';
  buffCanvas.style.height = height + 'px';

  const buffCxt = buffCanvas.getContext( '2d' );

  // Rasterize the layers, but only if container has nonzero size
  if( width > 0 && height > 0 ){

    buffCxt.clearRect( 0, 0, width, height );

    buffCxt.globalCompositeOperation = 'source-over';

    const zsortedEles = this.getCachedZSortedEles();

    if( options.full ){ // draw the full bounds of the graph
      buffCxt.translate( -bb.x1 * scale, -bb.y1 * scale );
      buffCxt.scale( scale, scale );

      this.drawElements( buffCxt, zsortedEles );

      buffCxt.scale( 1/scale, 1/scale );
      buffCxt.translate( bb.x1 * scale, bb.y1 * scale );
    } else { // draw the current view
      const pan = cy.pan();

      const translation = {
        x: pan.x * scale,
        y: pan.y * scale
      };

      scale *= cy.zoom();

      buffCxt.translate( translation.x, translation.y );
      buffCxt.scale( scale, scale );

      this.drawElements( buffCxt, zsortedEles );

      buffCxt.scale( 1/scale, 1/scale );
      buffCxt.translate( -translation.x, -translation.y );
    }

    // need to fill bg at end like this in order to fill cleared transparent pixels in jpgs
    if( options.bg ){
      buffCxt.globalCompositeOperation = 'destination-over';

      buffCxt.fillStyle = options.bg;
      buffCxt.rect( 0, 0, width, height );
      buffCxt.fill();
    }
  }

  return buffCanvas;
};

function b64ToBlob( b64, mimeType ){
  const bytes = atob( b64 );
  const buff = new ArrayBuffer( bytes.length );
  const buffUint8 = new Uint8Array( buff );

  for (let i = 0; i < bytes.length; i++ ){
    buffUint8[i] = bytes.charCodeAt(i);
  }

  return new Blob( [buff], { type: mimeType } );
}

function b64UriToB64( b64uri ){
  const i = b64uri.indexOf(',');

  return b64uri.substr( i + 1 );
}

function output( options, canvas, mimeType ){
  const getB64Uri = () => canvas.toDataURL( mimeType, options.quality );

  switch( options.output ){
    case 'blob-promise':
      return new Promise((resolve, reject) => {
        try {
          canvas.toBlob(blob => {
            if( blob != null ){
              resolve(blob);
            } else {
              reject( new Error('`canvas.toBlob()` sent a null value in its callback') );
            }
          }, mimeType, options.quality);
        } catch( err ){
          reject(err);
        }
      });

    case 'blob':
      return b64ToBlob( b64UriToB64( getB64Uri() ), mimeType );

    case 'base64':
      return b64UriToB64( getB64Uri() );

    case 'base64uri':
    default:
      return getB64Uri();
  }
}

CRp.png = function( options ){
  return output( options, this.bufferCanvasImage( options ), 'image/png' );
};

CRp.jpg = function( options ){
  return output( options, this.bufferCanvasImage( options ), 'image/jpeg' );
};

export default CRp;
