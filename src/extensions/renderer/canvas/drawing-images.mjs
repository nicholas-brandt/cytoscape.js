import * as util from '../../../util/index.mjs';

const CRp = {};

CRp.safeDrawImage = function( context, img, ix, iy, iw, ih, x, y, w, h ){
  // detect problematic cases for old browsers with bad images (cheaper than try-catch)
  if( iw <= 0 || ih <= 0 || w <= 0 || h <= 0 ){
    return;
  }

  try {
    context.drawImage( img, ix, iy, iw, ih, x, y, w, h );
  } catch (e) {
    util.warn(e);
  }
};

CRp.drawInscribedImage = function( context, img, node, index, nodeOpacity ){
  const r = this;
  const pos = node.position();
  const nodeX = pos.x;
  const nodeY = pos.y;
  const styleObj = node.cy().style();
  const getIndexedStyle = styleObj.getIndexedStyle.bind( styleObj );
  const fit = getIndexedStyle( node, 'background-fit', 'value', index );
  const repeat = getIndexedStyle( node, 'background-repeat', 'value', index );
  const nodeW = node.width();
  const nodeH = node.height();
  const paddingX2 = node.padding() * 2;
  const nodeTW = nodeW + ( getIndexedStyle( node, 'background-width-relative-to', 'value', index ) === 'inner' ? 0 : paddingX2 );
  const nodeTH = nodeH + ( getIndexedStyle( node, 'background-height-relative-to', 'value', index ) === 'inner' ? 0 : paddingX2 );
  const rs = node._private.rscratch;
  const clip = getIndexedStyle( node, 'background-clip', 'value', index );
  const shouldClip = clip === 'node';
  const imgOpacity = getIndexedStyle( node, 'background-image-opacity', 'value', index ) * nodeOpacity;
  const smooth = getIndexedStyle( node, 'background-image-smoothing', 'value', index );
  const cornerRadius = node.pstyle('corner-radius').value;
  if (cornerRadius !== 'auto') cornerRadius = node.pstyle('corner-radius').pfValue;

  const imgW = img.width || img.cachedW;
  const imgH = img.height || img.cachedH;

  // workaround for broken browsers like ie
  if( null == imgW || null == imgH ){
    document.body.appendChild( img ); // eslint-disable-line no-undef

    imgW = img.cachedW = img.width || img.offsetWidth;
    imgH = img.cachedH = img.height || img.offsetHeight;

    document.body.removeChild( img ); // eslint-disable-line no-undef
  }

  const w = imgW;
  const h = imgH;

  if( getIndexedStyle( node, 'background-width', 'value', index ) !== 'auto' ){
    if( getIndexedStyle( node, 'background-width', 'units', index ) === '%' ){
      w = getIndexedStyle( node, 'background-width', 'pfValue', index ) * nodeTW;
    } else {
      w = getIndexedStyle( node, 'background-width', 'pfValue', index );
    }
  }

  if( getIndexedStyle( node, 'background-height', 'value', index ) !== 'auto' ){
    if( getIndexedStyle( node, 'background-height', 'units', index ) === '%' ){
      h = getIndexedStyle( node, 'background-height', 'pfValue', index ) * nodeTH;
    } else {
      h = getIndexedStyle( node, 'background-height', 'pfValue', index );
    }
  }

  if( w === 0 || h === 0 ){
    return; // no point in drawing empty image (and chrome is broken in this case)
  }

  if( fit === 'contain' ){
    const scale = Math.min( nodeTW / w, nodeTH / h );

    w *= scale;
    h *= scale;

  } else if( fit === 'cover' ){
    const scale = Math.max( nodeTW / w, nodeTH / h );

    w *= scale;
    h *= scale;
  }

  const x = (nodeX - nodeTW / 2); // left
  const posXUnits = getIndexedStyle( node, 'background-position-x', 'units', index );
  const posXPfVal = getIndexedStyle( node, 'background-position-x', 'pfValue', index );
  if( posXUnits === '%' ){
    x += (nodeTW - w) * posXPfVal;
  } else {
    x += posXPfVal;
  }

  const offXUnits = getIndexedStyle( node, 'background-offset-x', 'units', index );
  const offXPfVal = getIndexedStyle( node, 'background-offset-x', 'pfValue', index );
  if( offXUnits === '%' ){
    x += (nodeTW - w) * offXPfVal;
  } else {
    x += offXPfVal;
  }

  const y = (nodeY - nodeTH / 2); // top
  const posYUnits = getIndexedStyle( node, 'background-position-y', 'units', index );
  const posYPfVal = getIndexedStyle( node, 'background-position-y', 'pfValue', index );
  if( posYUnits === '%' ){
    y += (nodeTH - h) * posYPfVal;
  } else {
    y += posYPfVal;
  }

  const offYUnits = getIndexedStyle( node, 'background-offset-y', 'units', index );
  const offYPfVal = getIndexedStyle( node, 'background-offset-y', 'pfValue', index );
  if( offYUnits === '%' ){
    y += (nodeTH - h) * offYPfVal;
  } else {
    y += offYPfVal;
  }

  if( rs.pathCache ){
    x -= nodeX;
    y -= nodeY;

    nodeX = 0;
    nodeY = 0;
  }

  const gAlpha = context.globalAlpha;

  context.globalAlpha = imgOpacity;

  const smoothingEnabled = r.getImgSmoothing( context );
  const isSmoothingSwitched = false;

  if( smooth === 'no' && smoothingEnabled ){ 
    r.setImgSmoothing( context, false );
    isSmoothingSwitched = true;
  } else if( smooth === 'yes' && !smoothingEnabled ){
    r.setImgSmoothing( context, true );
    isSmoothingSwitched = true;
  }

  if( repeat === 'no-repeat' ){

    if( shouldClip ){
      context.save();

      if( rs.pathCache ){
        context.clip( rs.pathCache );
      } else {
        r.nodeShapes[ r.getNodeShape( node ) ].draw(
          context,
          nodeX, nodeY,
          nodeTW, nodeTH,
          cornerRadius, rs );

        context.clip();
      }
    }

    r.safeDrawImage( context, img, 0, 0, imgW, imgH, x, y, w, h );

    if( shouldClip ){
      context.restore();
    }
  } else {
    const pattern = context.createPattern( img, repeat );
    context.fillStyle = pattern;

    r.nodeShapes[ r.getNodeShape( node ) ].draw(
        context,
        nodeX, nodeY,
        nodeTW, nodeTH, cornerRadius, rs);

    context.translate( x, y );
    context.fill();
    context.translate( -x, -y );
  }

  context.globalAlpha = gAlpha;

  if( isSmoothingSwitched ){ r.setImgSmoothing( context, smoothingEnabled ); }
};

export default CRp;
