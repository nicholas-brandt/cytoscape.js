const CRp = {};

let impl;

function polygon(context, points) {
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];

    context.lineTo(pt.x, pt.y);
  }
}

function triangleBackcurve(context, points, controlPoint) {
  let firstPt;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];

    if (i === 0) {
      firstPt = pt;
    }

    context.lineTo(pt.x, pt.y);
  }

  context.quadraticCurveTo(
    controlPoint.x,
    controlPoint.y,
    firstPt.x,
    firstPt.y,
  );
}

function triangleTee(context, trianglePoints, teePoints) {
  if (context.beginPath) {
    context.beginPath();
  }

  const triPts = trianglePoints;
  for (let i = 0; i < triPts.length; i++) {
    const pt = triPts[i];

    context.lineTo(pt.x, pt.y);
  }

  const teePts = teePoints;
  const firstTeePt = teePoints[0];
  context.moveTo(firstTeePt.x, firstTeePt.y);

  for (let i = 1; i < teePts.length; i++) {
    const pt = teePts[i];

    context.lineTo(pt.x, pt.y);
  }

  if (context.closePath) {
    context.closePath();
  }
}

function circleTriangle(context, trianglePoints, rx, ry, r) {
  if (context.beginPath) {
    context.beginPath();
  }
  context.arc(rx, ry, r, 0, Math.PI * 2, false);
  const triPts = trianglePoints;
  const firstTrPt = triPts[0];
  context.moveTo(firstTrPt.x, firstTrPt.y);
  for (let i = 0; i < triPts.length; i++) {
    const pt = triPts[i];
    context.lineTo(pt.x, pt.y);
  }
  if (context.closePath) {
    context.closePath();
  }
}

function circle(context, rx, ry, r) {
  context.arc(rx, ry, r, 0, Math.PI * 2, false);
}

CRp.arrowShapeImpl = function (name) {
  return (impl ||
    (impl = {
      polygon: polygon,

      "triangle-backcurve": triangleBackcurve,

      "triangle-tee": triangleTee,

      "circle-triangle": circleTriangle,

      "triangle-cross": triangleTee,

      circle: circle,
    }))[name];
};

export default CRp;
