import * as math from "../../../math.mjs";
import * as is from "../../../is.mjs";
import * as util from "../../../util/index.mjs";

const BRp = {};

BRp.arrowShapeWidth = 0.3;

BRp.registerArrowShapes = function () {
  const arrowShapes = (this.arrowShapes = {});
  const renderer = this;

  // Contract for arrow shapes:
  // 0, 0 is arrow tip
  // (0, 1) is direction towards node
  // (1, 0) is right
  //
  // functional api:
  // collide: check x, y in shape
  // roughCollide: called before collide, no false negatives
  // draw: draw
  // spacing: dist(arrowTip, nodeBoundary)
  // gap: dist(edgeTip, nodeBoundary), edgeTip may != arrowTip

  const bbCollide = function (
    x,
    y,
    size,
    angle,
    translation,
    edgeWidth,
    padding,
  ) {
    const x1 = translation.x - size / 2 - padding;
    const x2 = translation.x + size / 2 + padding;
    const y1 = translation.y - size / 2 - padding;
    const y2 = translation.y + size / 2 + padding;

    const inside = x1 <= x && x <= x2 && y1 <= y && y <= y2;

    return inside;
  };

  const transform = function (x, y, size, angle, translation) {
    const xRotated = x * Math.cos(angle) - y * Math.sin(angle);
    const yRotated = x * Math.sin(angle) + y * Math.cos(angle);

    const xScaled = xRotated * size;
    const yScaled = yRotated * size;

    const xTranslated = xScaled + translation.x;
    const yTranslated = yScaled + translation.y;

    return {
      x: xTranslated,
      y: yTranslated,
    };
  };

  const transformPoints = function (pts, size, angle, translation) {
    const retPts = [];

    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i];
      const y = pts[i + 1];

      retPts.push(transform(x, y, size, angle, translation));
    }

    return retPts;
  };

  const pointsToArr = function (pts) {
    const ret = [];

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];

      ret.push(p.x, p.y);
    }

    return ret;
  };

  const standardGap = function (edge) {
    return (
      edge.pstyle("width").pfValue * edge.pstyle("arrow-scale").pfValue * 2
    );
  };

  const defineArrowShape = function (name, defn) {
    if (is.string(defn)) {
      defn = arrowShapes[defn];
    }

    arrowShapes[name] = util.extend(
      {
        name: name,

        points: [-0.15, -0.3, 0.15, -0.3, 0.15, 0.3, -0.15, 0.3],

        collide: function (x, y, size, angle, translation, padding) {
          const points = pointsToArr(
            transformPoints(
              this.points,
              size + 2 * padding,
              angle,
              translation,
            ),
          );
          const inside = math.pointInsidePolygonPoints(x, y, points);

          return inside;
        },

        roughCollide: bbCollide,

        draw: function (context, size, angle, translation) {
          const points = transformPoints(this.points, size, angle, translation);

          renderer.arrowShapeImpl("polygon")(context, points);
        },

        spacing: function (edge) {
          return 0;
        },

        gap: standardGap,
      },
      defn,
    );
  };

  defineArrowShape("none", {
    collide: util.falsify,

    roughCollide: util.falsify,

    draw: util.noop,

    spacing: util.zeroify,

    gap: util.zeroify,
  });

  defineArrowShape("triangle", {
    points: [-0.15, -0.3, 0, 0, 0.15, -0.3],
  });

  defineArrowShape("arrow", "triangle");

  defineArrowShape("triangle-backcurve", {
    points: arrowShapes["triangle"].points,

    controlPoint: [0, -0.15],

    roughCollide: bbCollide,

    draw: function (context, size, angle, translation, edgeWidth) {
      const ptsTrans = transformPoints(this.points, size, angle, translation);
      const ctrlPt = this.controlPoint;
      const ctrlPtTrans = transform(
        ctrlPt[0],
        ctrlPt[1],
        size,
        angle,
        translation,
      );

      renderer.arrowShapeImpl(this.name)(context, ptsTrans, ctrlPtTrans);
    },

    gap: function (edge) {
      return standardGap(edge) * 0.8;
    },
  });

  defineArrowShape("triangle-tee", {
    points: [0, 0, 0.15, -0.3, -0.15, -0.3, 0, 0],

    pointsTee: [-0.15, -0.4, -0.15, -0.5, 0.15, -0.5, 0.15, -0.4],

    collide: function (x, y, size, angle, translation, edgeWidth, padding) {
      const triPts = pointsToArr(
        transformPoints(this.points, size + 2 * padding, angle, translation),
      );
      const teePts = pointsToArr(
        transformPoints(this.pointsTee, size + 2 * padding, angle, translation),
      );

      const inside =
        math.pointInsidePolygonPoints(x, y, triPts) ||
        math.pointInsidePolygonPoints(x, y, teePts);

      return inside;
    },

    draw: function (context, size, angle, translation, edgeWidth) {
      const triPts = transformPoints(this.points, size, angle, translation);
      const teePts = transformPoints(this.pointsTee, size, angle, translation);

      renderer.arrowShapeImpl(this.name)(context, triPts, teePts);
    },
  });

  defineArrowShape("circle-triangle", {
    radius: 0.15,
    pointsTr: [0, -0.15, 0.15, -0.45, -0.15, -0.45, 0, -0.15],
    collide: function collide(
      x,
      y,
      size,
      angle,
      translation,
      edgeWidth,
      padding,
    ) {
      const t = translation;
      const circleInside =
        Math.pow(t.x - x, 2) + Math.pow(t.y - y, 2) <=
        Math.pow((size + 2 * padding) * this.radius, 2);
      const triPts = pointsToArr(
        transformPoints(this.points, size + 2 * padding, angle, translation),
      );
      return math.pointInsidePolygonPoints(x, y, triPts) || circleInside;
    },
    draw: function draw(context, size, angle, translation, edgeWidth) {
      const triPts = transformPoints(this.pointsTr, size, angle, translation);
      renderer.arrowShapeImpl(this.name)(
        context,
        triPts,
        translation.x,
        translation.y,
        this.radius * size,
      );
    },
    spacing: function spacing(edge) {
      return (
        renderer.getArrowWidth(
          edge.pstyle("width").pfValue,
          edge.pstyle("arrow-scale").value,
        ) * this.radius
      );
    },
  });

  defineArrowShape("triangle-cross", {
    points: [0, 0, 0.15, -0.3, -0.15, -0.3, 0, 0],

    baseCrossLinePts: [
      -0.15,
      -0.4, // first half of the rectangle
      -0.15,
      -0.4,
      0.15,
      -0.4, // second half of the rectangle
      0.15,
      -0.4,
    ],

    crossLinePts: function (size, edgeWidth) {
      // shift points so that the distance between the cross points matches edge width
      const p = this.baseCrossLinePts.slice();
      const shiftFactor = edgeWidth / size;
      const y0 = 3;
      const y1 = 5;

      p[y0] = p[y0] - shiftFactor;
      p[y1] = p[y1] - shiftFactor;

      return p;
    },

    collide: function (x, y, size, angle, translation, edgeWidth, padding) {
      const triPts = pointsToArr(
        transformPoints(this.points, size + 2 * padding, angle, translation),
      );
      const teePts = pointsToArr(
        transformPoints(
          this.crossLinePts(size, edgeWidth),
          size + 2 * padding,
          angle,
          translation,
        ),
      );
      const inside =
        math.pointInsidePolygonPoints(x, y, triPts) ||
        math.pointInsidePolygonPoints(x, y, teePts);

      return inside;
    },

    draw: function (context, size, angle, translation, edgeWidth) {
      const triPts = transformPoints(this.points, size, angle, translation);
      const crossLinePts = transformPoints(
        this.crossLinePts(size, edgeWidth),
        size,
        angle,
        translation,
      );

      renderer.arrowShapeImpl(this.name)(context, triPts, crossLinePts);
    },
  });

  defineArrowShape("vee", {
    points: [-0.15, -0.3, 0, 0, 0.15, -0.3, 0, -0.15],

    gap: function (edge) {
      return standardGap(edge) * 0.525;
    },
  });

  defineArrowShape("circle", {
    radius: 0.15,

    collide: function (x, y, size, angle, translation, edgeWidth, padding) {
      const t = translation;
      const inside =
        Math.pow(t.x - x, 2) + Math.pow(t.y - y, 2) <=
        Math.pow((size + 2 * padding) * this.radius, 2);

      return inside;
    },

    draw: function (context, size, angle, translation, edgeWidth) {
      renderer.arrowShapeImpl(this.name)(
        context,
        translation.x,
        translation.y,
        this.radius * size,
      );
    },

    spacing: function (edge) {
      return (
        renderer.getArrowWidth(
          edge.pstyle("width").pfValue,
          edge.pstyle("arrow-scale").value,
        ) * this.radius
      );
    },
  });

  defineArrowShape("tee", {
    points: [-0.15, 0, -0.15, -0.1, 0.15, -0.1, 0.15, 0],

    spacing: function (edge) {
      return 1;
    },

    gap: function (edge) {
      return 1;
    },
  });

  defineArrowShape("square", {
    points: [-0.15, 0.0, 0.15, 0.0, 0.15, -0.3, -0.15, -0.3],
  });

  defineArrowShape("diamond", {
    points: [-0.15, -0.15, 0, -0.3, 0.15, -0.15, 0, 0],

    gap: function (edge) {
      return edge.pstyle("width").pfValue * edge.pstyle("arrow-scale").value;
    },
  });

  defineArrowShape("chevron", {
    points: [0, 0, -0.15, -0.15, -0.1, -0.2, 0, -0.1, 0.1, -0.2, 0.15, -0.15],

    gap: function (edge) {
      return (
        0.95 * edge.pstyle("width").pfValue * edge.pstyle("arrow-scale").value
      );
    },
  });
};

export default BRp;
