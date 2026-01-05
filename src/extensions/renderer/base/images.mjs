const BRp = {};

BRp.getCachedImage = function (url, crossOrigin, onLoad) {
  const r = this;
  const imageCache = (r.imageCache = r.imageCache || {});
  const cache = imageCache[url];

  if (cache) {
    if (!cache.image.complete) {
      cache.image.addEventListener("load", onLoad);
    }

    return cache.image;
  } else {
    cache = imageCache[url] = imageCache[url] || {};

    const image = (cache.image = new Image()); // eslint-disable-line no-undef

    image.addEventListener("load", onLoad);
    image.addEventListener("error", function () {
      image.error = true;
    });

    // #1582 safari doesn't load data uris with crossOrigin properly
    // https://bugs.webkit.org/show_bug.cgi?id=123978
    const dataUriPrefix = "data:";
    const isDataUri =
      url.substring(0, dataUriPrefix.length).toLowerCase() === dataUriPrefix;
    if (!isDataUri) {
      // if crossorigin is 'null'(stringified), then manually set it to null
      crossOrigin = crossOrigin === "null" ? null : crossOrigin;
      image.crossOrigin = crossOrigin; // prevent tainted canvas
    }

    image.src = url;

    return image;
  }
};

export default BRp;
