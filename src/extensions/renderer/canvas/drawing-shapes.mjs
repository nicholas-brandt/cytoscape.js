import * as math from "../../../math.mjs";
import * as round from "../../../round.mjs";

const CRp = {};

// @O Polygon drawing
CRp.drawPolygonPath = function (context, x, y, width, height, points) {
  const halfW = width / 2;
  const halfH = height / 2;

  if (context.beginPath) {
    context.beginPath();
  }

  context.moveTo(x + halfW * points[0], y + halfH * points[1]);

  for (let i = 1; i < points.length / 2; i++) {
    context.lineTo(x + halfW * points[i * 2], y + halfH * points[i * 2 + 1]);
  }

  context.closePath();
};

CRp.drawRoundPolygonPath = function (
  context,
  x,
  y,
  width,
  height,
  points,
  corners,
) {
  corners.forEach((corner) => round.drawPreparedRoundCorner(context, corner));
  context.closePath();
};

// Round rectangle drawing
CRp.drawRoundRectanglePath = function (context, x, y, width, height, radius) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const cornerRadius =
    radius === "auto"
      ? math.getRoundRectangleRadius(width, height)
      : Math.min(radius, halfHeight, halfWidth);

  if (context.beginPath) {
    context.beginPath();
  }

  // Start at top middle
  context.moveTo(x, y - halfHeight);
  // Arc from middle top to right side
  context.arcTo(x + halfWidth, y - halfHeight, x + halfWidth, y, cornerRadius);
  // Arc from right side to bottom
  context.arcTo(x + halfWidth, y + halfHeight, x, y + halfHeight, cornerRadius);
  // Arc from bottom to left side
  context.arcTo(x - halfWidth, y + halfHeight, x - halfWidth, y, cornerRadius);
  // Arc from left side to topBorder
  context.arcTo(x - halfWidth, y - halfHeight, x, y - halfHeight, cornerRadius);
  // Join line
  context.lineTo(x, y - halfHeight);

  context.closePath();
};

CRp.drawBottomRoundRectanglePath = function (
  context,
  x,
  y,
  width,
  height,
  radius,
) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const cornerRadius =
    radius === "auto" ? math.getRoundRectangleRadius(width, height) : radius;

  if (context.beginPath) {
    context.beginPath();
  }

  // Start at top middle
  context.moveTo(x, y - halfHeight);
  context.lineTo(x + halfWidth, y - halfHeight);
  context.lineTo(x + halfWidth, y);

  context.arcTo(x + halfWidth, y + halfHeight, x, y + halfHeight, cornerRadius);
  context.arcTo(x - halfWidth, y + halfHeight, x - halfWidth, y, cornerRadius);

  context.lineTo(x - halfWidth, y - halfHeight);
  context.lineTo(x, y - halfHeight);

  context.closePath();
};

CRp.drawCutRectanglePath = function (
  context,
  x,
  y,
  width,
  height,
  points,
  corners,
) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const cornerLength =
    corners === "auto" ? math.getCutRectangleCornerLength() : corners;

  if (context.beginPath) {
    context.beginPath();
  }

  context.moveTo(x - halfWidth + cornerLength, y - halfHeight);

  context.lineTo(x + halfWidth - cornerLength, y - halfHeight);
  context.lineTo(x + halfWidth, y - halfHeight + cornerLength);
  context.lineTo(x + halfWidth, y + halfHeight - cornerLength);
  context.lineTo(x + halfWidth - cornerLength, y + halfHeight);
  context.lineTo(x - halfWidth + cornerLength, y + halfHeight);
  context.lineTo(x - halfWidth, y + halfHeight - cornerLength);
  context.lineTo(x - halfWidth, y - halfHeight + cornerLength);

  context.closePath();
};

CRp.drawBarrelPath = function (context, x, y, width, height) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const xBegin = x - halfWidth;
  const xEnd = x + halfWidth;
  const yBegin = y - halfHeight;
  const yEnd = y + halfHeight;

  const barrelCurveConstants = math.getBarrelCurveConstants(width, height);
  const wOffset = barrelCurveConstants.widthOffset;
  const hOffset = barrelCurveConstants.heightOffset;
  const ctrlPtXOffset = barrelCurveConstants.ctrlPtOffsetPct * wOffset;

  if (context.beginPath) {
    context.beginPath();
  }

  context.moveTo(xBegin, yBegin + hOffset);

  context.lineTo(xBegin, yEnd - hOffset);
  context.quadraticCurveTo(
    xBegin + ctrlPtXOffset,
    yEnd,
    xBegin + wOffset,
    yEnd,
  );

  context.lineTo(xEnd - wOffset, yEnd);
  context.quadraticCurveTo(xEnd - ctrlPtXOffset, yEnd, xEnd, yEnd - hOffset);

  context.lineTo(xEnd, yBegin + hOffset);
  context.quadraticCurveTo(
    xEnd - ctrlPtXOffset,
    yBegin,
    xEnd - wOffset,
    yBegin,
  );

  context.lineTo(xBegin + wOffset, yBegin);
  context.quadraticCurveTo(
    xBegin + ctrlPtXOffset,
    yBegin,
    xBegin,
    yBegin + hOffset,
  );

  context.closePath();
};

const sin0 = Math.sin(0);
const cos0 = Math.cos(0);

const sin = {};
const cos = {};

const ellipseStepSize = Math.PI / 40;

for (let i = 0 * Math.PI; i < 2 * Math.PI; i += ellipseStepSize) {
  sin[i] = Math.sin(i);
  cos[i] = Math.cos(i);
}

CRp.drawEllipsePath = function (context, centerX, centerY, width, height) {
  if (context.beginPath) {
    context.beginPath();
  }

  if (context.ellipse) {
    context.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, 2 * Math.PI);
  } else {
    let xPos, yPos;
    const rw = width / 2;
    const rh = height / 2;
    for (let i = 0 * Math.PI; i < 2 * Math.PI; i += ellipseStepSize) {
      xPos = centerX - rw * sin[i] * sin0 + rw * cos[i] * cos0;
      yPos = centerY + rh * cos[i] * sin0 + rh * sin[i] * cos0;

      if (i === 0) {
        context.moveTo(xPos, yPos);
      } else {
        context.lineTo(xPos, yPos);
      }
    }
  }

  context.closePath();
};

export default CRp;
