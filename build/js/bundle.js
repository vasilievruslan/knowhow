(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/*
 * anime.js v3.0.1
 * (c) 2019 Julian Garnier
 * Released under the MIT license
 * animejs.com
 */

'use strict';

// Defaults

var defaultInstanceSettings = {
  update: null,
  begin: null,
  loopBegin: null,
  changeBegin: null,
  change: null,
  changeComplete: null,
  loopComplete: null,
  complete: null,
  loop: 1,
  direction: 'normal',
  autoplay: true,
  timelineOffset: 0
};

var defaultTweenSettings = {
  duration: 1000,
  delay: 0,
  endDelay: 0,
  easing: 'easeOutElastic(1, .5)',
  round: 0
};

var validTransforms = ['translateX', 'translateY', 'translateZ', 'rotate', 'rotateX', 'rotateY', 'rotateZ', 'scale', 'scaleX', 'scaleY', 'scaleZ', 'skew', 'skewX', 'skewY', 'perspective'];

// Caching

var cache = {
  CSS: {},
  springs: {}
};

// Utils

function minMax(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function stringContains(str, text) {
  return str.indexOf(text) > -1;
}

function applyArguments(func, args) {
  return func.apply(null, args);
}

var is = {
  arr: function (a) { return Array.isArray(a); },
  obj: function (a) { return stringContains(Object.prototype.toString.call(a), 'Object'); },
  pth: function (a) { return is.obj(a) && a.hasOwnProperty('totalLength'); },
  svg: function (a) { return a instanceof SVGElement; },
  inp: function (a) { return a instanceof HTMLInputElement; },
  dom: function (a) { return a.nodeType || is.svg(a); },
  str: function (a) { return typeof a === 'string'; },
  fnc: function (a) { return typeof a === 'function'; },
  und: function (a) { return typeof a === 'undefined'; },
  hex: function (a) { return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(a); },
  rgb: function (a) { return /^rgb/.test(a); },
  hsl: function (a) { return /^hsl/.test(a); },
  col: function (a) { return (is.hex(a) || is.rgb(a) || is.hsl(a)); },
  key: function (a) { return !defaultInstanceSettings.hasOwnProperty(a) && !defaultTweenSettings.hasOwnProperty(a) && a !== 'targets' && a !== 'keyframes'; }
};

// Easings

function parseEasingParameters(string) {
  var match = /\(([^)]+)\)/.exec(string);
  return match ? match[1].split(',').map(function (p) { return parseFloat(p); }) : [];
}

// Spring solver inspired by Webkit Copyright © 2016 Apple Inc. All rights reserved. https://webkit.org/demos/spring/spring.js

function spring(string, duration) {

  var params = parseEasingParameters(string);
  var mass = minMax(is.und(params[0]) ? 1 : params[0], .1, 100);
  var stiffness = minMax(is.und(params[1]) ? 100 : params[1], .1, 100);
  var damping = minMax(is.und(params[2]) ? 10 : params[2], .1, 100);
  var velocity =  minMax(is.und(params[3]) ? 0 : params[3], .1, 100);
  var w0 = Math.sqrt(stiffness / mass);
  var zeta = damping / (2 * Math.sqrt(stiffness * mass));
  var wd = zeta < 1 ? w0 * Math.sqrt(1 - zeta * zeta) : 0;
  var a = 1;
  var b = zeta < 1 ? (zeta * w0 + -velocity) / wd : -velocity + w0;

  function solver(t) {
    var progress = duration ? (duration * t) / 1000 : t;
    if (zeta < 1) {
      progress = Math.exp(-progress * zeta * w0) * (a * Math.cos(wd * progress) + b * Math.sin(wd * progress));
    } else {
      progress = (a + b * progress) * Math.exp(-progress * w0);
    }
    if (t === 0 || t === 1) { return t; }
    return 1 - progress;
  }

  function getDuration() {
    var cached = cache.springs[string];
    if (cached) { return cached; }
    var frame = 1/6;
    var elapsed = 0;
    var rest = 0;
    while(true) {
      elapsed += frame;
      if (solver(elapsed) === 1) {
        rest++;
        if (rest >= 16) { break; }
      } else {
        rest = 0;
      }
    }
    var duration = elapsed * frame * 1000;
    cache.springs[string] = duration;
    return duration;
  }

  return duration ? solver : getDuration;

}

// Elastic easing adapted from jQueryUI http://api.jqueryui.com/easings/

function elastic(amplitude, period) {
  if ( amplitude === void 0 ) amplitude = 1;
  if ( period === void 0 ) period = .5;

  var a = minMax(amplitude, 1, 10);
  var p = minMax(period, .1, 2);
  return function (t) {
    return (t === 0 || t === 1) ? t : 
      -a * Math.pow(2, 10 * (t - 1)) * Math.sin((((t - 1) - (p / (Math.PI * 2) * Math.asin(1 / a))) * (Math.PI * 2)) / p);
  }
}

// Basic steps easing implementation https://developer.mozilla.org/fr/docs/Web/CSS/transition-timing-function

function steps(steps) {
  if ( steps === void 0 ) steps = 10;

  return function (t) { return Math.round(t * steps) * (1 / steps); };
}

// BezierEasing https://github.com/gre/bezier-easing

var bezier = (function () {

  var kSplineTableSize = 11;
  var kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);

  function A(aA1, aA2) { return 1.0 - 3.0 * aA2 + 3.0 * aA1 }
  function B(aA1, aA2) { return 3.0 * aA2 - 6.0 * aA1 }
  function C(aA1)      { return 3.0 * aA1 }

  function calcBezier(aT, aA1, aA2) { return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT }
  function getSlope(aT, aA1, aA2) { return 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1) }

  function binarySubdivide(aX, aA, aB, mX1, mX2) {
    var currentX, currentT, i = 0;
    do {
      currentT = aA + (aB - aA) / 2.0;
      currentX = calcBezier(currentT, mX1, mX2) - aX;
      if (currentX > 0.0) { aB = currentT; } else { aA = currentT; }
    } while (Math.abs(currentX) > 0.0000001 && ++i < 10);
    return currentT;
  }

  function newtonRaphsonIterate(aX, aGuessT, mX1, mX2) {
    for (var i = 0; i < 4; ++i) {
      var currentSlope = getSlope(aGuessT, mX1, mX2);
      if (currentSlope === 0.0) { return aGuessT; }
      var currentX = calcBezier(aGuessT, mX1, mX2) - aX;
      aGuessT -= currentX / currentSlope;
    }
    return aGuessT;
  }

  function bezier(mX1, mY1, mX2, mY2) {

    if (!(0 <= mX1 && mX1 <= 1 && 0 <= mX2 && mX2 <= 1)) { return; }
    var sampleValues = new Float32Array(kSplineTableSize);

    if (mX1 !== mY1 || mX2 !== mY2) {
      for (var i = 0; i < kSplineTableSize; ++i) {
        sampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
      }
    }

    function getTForX(aX) {

      var intervalStart = 0;
      var currentSample = 1;
      var lastSample = kSplineTableSize - 1;

      for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; ++currentSample) {
        intervalStart += kSampleStepSize;
      }

      --currentSample;

      var dist = (aX - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
      var guessForT = intervalStart + dist * kSampleStepSize;
      var initialSlope = getSlope(guessForT, mX1, mX2);

      if (initialSlope >= 0.001) {
        return newtonRaphsonIterate(aX, guessForT, mX1, mX2);
      } else if (initialSlope === 0.0) {
        return guessForT;
      } else {
        return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, mX1, mX2);
      }

    }

    return function (x) {
      if (mX1 === mY1 && mX2 === mY2) { return x; }
      if (x === 0 || x === 1) { return x; }
      return calcBezier(getTForX(x), mY1, mY2);
    }

  }

  return bezier;

})();

var penner = (function () {

  var names = ['Quad', 'Cubic', 'Quart', 'Quint', 'Sine', 'Expo', 'Circ', 'Back', 'Elastic'];

  // Approximated Penner equations http://matthewlein.com/ceaser/

  var curves = {
    In: [
      [0.550, 0.085, 0.680, 0.530], /* inQuad */
      [0.550, 0.055, 0.675, 0.190], /* inCubic */
      [0.895, 0.030, 0.685, 0.220], /* inQuart */
      [0.755, 0.050, 0.855, 0.060], /* inQuint */
      [0.470, 0.000, 0.745, 0.715], /* inSine */
      [0.950, 0.050, 0.795, 0.035], /* inExpo */
      [0.600, 0.040, 0.980, 0.335], /* inCirc */
      [0.600,-0.280, 0.735, 0.045], /* inBack */
      elastic /* inElastic */
    ],
    Out: [
      [0.250, 0.460, 0.450, 0.940], /* outQuad */
      [0.215, 0.610, 0.355, 1.000], /* outCubic */
      [0.165, 0.840, 0.440, 1.000], /* outQuart */
      [0.230, 1.000, 0.320, 1.000], /* outQuint */
      [0.390, 0.575, 0.565, 1.000], /* outSine */
      [0.190, 1.000, 0.220, 1.000], /* outExpo */
      [0.075, 0.820, 0.165, 1.000], /* outCirc */
      [0.175, 0.885, 0.320, 1.275], /* outBack */
      function (a, p) { return function (t) { return 1 - elastic(a, p)(1 - t); }; } /* outElastic */
    ],
    InOut: [
      [0.455, 0.030, 0.515, 0.955], /* inOutQuad */
      [0.645, 0.045, 0.355, 1.000], /* inOutCubic */
      [0.770, 0.000, 0.175, 1.000], /* inOutQuart */
      [0.860, 0.000, 0.070, 1.000], /* inOutQuint */
      [0.445, 0.050, 0.550, 0.950], /* inOutSine */
      [1.000, 0.000, 0.000, 1.000], /* inOutExpo */
      [0.785, 0.135, 0.150, 0.860], /* inOutCirc */
      [0.680,-0.550, 0.265, 1.550], /* inOutBack */
      function (a, p) { return function (t) { return t < .5 ? elastic(a, p)(t * 2) / 2 : 1 - elastic(a, p)(t * -2 + 2) / 2; }; } /* inOutElastic */
    ]
  };

  var eases = { 
    linear: [0.250, 0.250, 0.750, 0.750]
  };

  var loop = function ( coords ) {
    curves[coords].forEach(function (ease, i) {
      eases['ease'+coords+names[i]] = ease;
    });
  };

  for (var coords in curves) loop( coords );

  return eases;

})();

function parseEasings(easing, duration) {
  if (is.fnc(easing)) { return easing; }
  var name = easing.split('(')[0];
  var ease = penner[name];
  var args = parseEasingParameters(easing);
  switch (name) {
    case 'spring' : return spring(easing, duration);
    case 'cubicBezier' : return applyArguments(bezier, args);
    case 'steps' : return applyArguments(steps, args);
    default : return is.fnc(ease) ? applyArguments(ease, args) : applyArguments(bezier, ease);
  }
}

// Strings

function selectString(str) {
  try {
    var nodes = document.querySelectorAll(str);
    return nodes;
  } catch(e) {
    return;
  }
}

// Arrays

function filterArray(arr, callback) {
  var len = arr.length;
  var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
  var result = [];
  for (var i = 0; i < len; i++) {
    if (i in arr) {
      var val = arr[i];
      if (callback.call(thisArg, val, i, arr)) {
        result.push(val);
      }
    }
  }
  return result;
}

function flattenArray(arr) {
  return arr.reduce(function (a, b) { return a.concat(is.arr(b) ? flattenArray(b) : b); }, []);
}

function toArray(o) {
  if (is.arr(o)) { return o; }
  if (is.str(o)) { o = selectString(o) || o; }
  if (o instanceof NodeList || o instanceof HTMLCollection) { return [].slice.call(o); }
  return [o];
}

function arrayContains(arr, val) {
  return arr.some(function (a) { return a === val; });
}

// Objects

function cloneObject(o) {
  var clone = {};
  for (var p in o) { clone[p] = o[p]; }
  return clone;
}

function replaceObjectProps(o1, o2) {
  var o = cloneObject(o1);
  for (var p in o1) { o[p] = o2.hasOwnProperty(p) ? o2[p] : o1[p]; }
  return o;
}

function mergeObjects(o1, o2) {
  var o = cloneObject(o1);
  for (var p in o2) { o[p] = is.und(o1[p]) ? o2[p] : o1[p]; }
  return o;
}

// Colors

function rgbToRgba(rgbValue) {
  var rgb = /rgb\((\d+,\s*[\d]+,\s*[\d]+)\)/g.exec(rgbValue);
  return rgb ? ("rgba(" + (rgb[1]) + ",1)") : rgbValue;
}

function hexToRgba(hexValue) {
  var rgx = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  var hex = hexValue.replace(rgx, function (m, r, g, b) { return r + r + g + g + b + b; } );
  var rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  var r = parseInt(rgb[1], 16);
  var g = parseInt(rgb[2], 16);
  var b = parseInt(rgb[3], 16);
  return ("rgba(" + r + "," + g + "," + b + ",1)");
}

function hslToRgba(hslValue) {
  var hsl = /hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/g.exec(hslValue) || /hsla\((\d+),\s*([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)\)/g.exec(hslValue);
  var h = parseInt(hsl[1], 10) / 360;
  var s = parseInt(hsl[2], 10) / 100;
  var l = parseInt(hsl[3], 10) / 100;
  var a = hsl[4] || 1;
  function hue2rgb(p, q, t) {
    if (t < 0) { t += 1; }
    if (t > 1) { t -= 1; }
    if (t < 1/6) { return p + (q - p) * 6 * t; }
    if (t < 1/2) { return q; }
    if (t < 2/3) { return p + (q - p) * (2/3 - t) * 6; }
    return p;
  }
  var r, g, b;
  if (s == 0) {
    r = g = b = l;
  } else {
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return ("rgba(" + (r * 255) + "," + (g * 255) + "," + (b * 255) + "," + a + ")");
}

function colorToRgb(val) {
  if (is.rgb(val)) { return rgbToRgba(val); }
  if (is.hex(val)) { return hexToRgba(val); }
  if (is.hsl(val)) { return hslToRgba(val); }
}

// Units

function getUnit(val) {
  var split = /([\+\-]?[0-9#\.]+)(%|px|pt|em|rem|in|cm|mm|ex|ch|pc|vw|vh|vmin|vmax|deg|rad|turn)?$/.exec(val);
  if (split) { return split[2]; }
}

function getTransformUnit(propName) {
  if (stringContains(propName, 'translate') || propName === 'perspective') { return 'px'; }
  if (stringContains(propName, 'rotate') || stringContains(propName, 'skew')) { return 'deg'; }
}

// Values

function getFunctionValue(val, animatable) {
  if (!is.fnc(val)) { return val; }
  return val(animatable.target, animatable.id, animatable.total);
}

function getAttribute(el, prop) {
  return el.getAttribute(prop);
}

function convertPxToUnit(el, value, unit) {
  var valueUnit = getUnit(value);
  if (arrayContains([unit, 'deg', 'rad', 'turn'], valueUnit)) { return value; }
  var cached = cache.CSS[value + unit];
  if (!is.und(cached)) { return cached; }
  var baseline = 100;
  var tempEl = document.createElement(el.tagName);
  var parentEl = (el.parentNode && (el.parentNode !== document)) ? el.parentNode : document.body;
  parentEl.appendChild(tempEl);
  tempEl.style.position = 'absolute';
  tempEl.style.width = baseline + unit;
  var factor = baseline / tempEl.offsetWidth;
  parentEl.removeChild(tempEl);
  var convertedUnit = factor * parseFloat(value);
  cache.CSS[value + unit] = convertedUnit;
  return convertedUnit;
}

function getCSSValue(el, prop, unit) {
  if (prop in el.style) {
    var uppercasePropName = prop.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    var value = el.style[prop] || getComputedStyle(el).getPropertyValue(uppercasePropName) || '0';
    return unit ? convertPxToUnit(el, value, unit) : value;
  }
}

function getAnimationType(el, prop) {
  if (is.dom(el) && !is.inp(el) && (getAttribute(el, prop) || (is.svg(el) && el[prop]))) { return 'attribute'; }
  if (is.dom(el) && arrayContains(validTransforms, prop)) { return 'transform'; }
  if (is.dom(el) && (prop !== 'transform' && getCSSValue(el, prop))) { return 'css'; }
  if (el[prop] != null) { return 'object'; }
}

function getElementTransforms(el) {
  if (!is.dom(el)) { return; }
  var str = el.style.transform || '';
  var reg  = /(\w+)\(([^)]*)\)/g;
  var transforms = new Map();
  var m; while (m = reg.exec(str)) { transforms.set(m[1], m[2]); }
  return transforms;
}

function getTransformValue(el, propName, animatable, unit) {
  var defaultVal = stringContains(propName, 'scale') ? 1 : 0 + getTransformUnit(propName);
  var value = getElementTransforms(el).get(propName) || defaultVal;
  if (animatable) {
    animatable.transforms.list.set(propName, value);
    animatable.transforms['last'] = propName;
  }
  return unit ? convertPxToUnit(el, value, unit) : value;
}

function getOriginalTargetValue(target, propName, unit, animatable) {
  switch (getAnimationType(target, propName)) {
    case 'transform': return getTransformValue(target, propName, animatable, unit);
    case 'css': return getCSSValue(target, propName, unit);
    case 'attribute': return getAttribute(target, propName);
    default: return target[propName] || 0;
  }
}

function getRelativeValue(to, from) {
  var operator = /^(\*=|\+=|-=)/.exec(to);
  if (!operator) { return to; }
  var u = getUnit(to) || 0;
  var x = parseFloat(from);
  var y = parseFloat(to.replace(operator[0], ''));
  switch (operator[0][0]) {
    case '+': return x + y + u;
    case '-': return x - y + u;
    case '*': return x * y + u;
  }
}

function validateValue(val, unit) {
  if (is.col(val)) { return colorToRgb(val); }
  var originalUnit = getUnit(val);
  var unitLess = originalUnit ? val.substr(0, val.length - originalUnit.length) : val;
  return unit && !/\s/g.test(val) ? unitLess + unit : unitLess;
}

// getTotalLength() equivalent for circle, rect, polyline, polygon and line shapes
// adapted from https://gist.github.com/SebLambla/3e0550c496c236709744

function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function getCircleLength(el) {
  return Math.PI * 2 * getAttribute(el, 'r');
}

function getRectLength(el) {
  return (getAttribute(el, 'width') * 2) + (getAttribute(el, 'height') * 2);
}

function getLineLength(el) {
  return getDistance(
    {x: getAttribute(el, 'x1'), y: getAttribute(el, 'y1')}, 
    {x: getAttribute(el, 'x2'), y: getAttribute(el, 'y2')}
  );
}

function getPolylineLength(el) {
  var points = el.points;
  var totalLength = 0;
  var previousPos;
  for (var i = 0 ; i < points.numberOfItems; i++) {
    var currentPos = points.getItem(i);
    if (i > 0) { totalLength += getDistance(previousPos, currentPos); }
    previousPos = currentPos;
  }
  return totalLength;
}

function getPolygonLength(el) {
  var points = el.points;
  return getPolylineLength(el) + getDistance(points.getItem(points.numberOfItems - 1), points.getItem(0));
}

// Path animation

function getTotalLength(el) {
  if (el.getTotalLength) { return el.getTotalLength(); }
  switch(el.tagName.toLowerCase()) {
    case 'circle': return getCircleLength(el);
    case 'rect': return getRectLength(el);
    case 'line': return getLineLength(el);
    case 'polyline': return getPolylineLength(el);
    case 'polygon': return getPolygonLength(el);
  }
}

function setDashoffset(el) {
  var pathLength = getTotalLength(el);
  el.setAttribute('stroke-dasharray', pathLength);
  return pathLength;
}

// Motion path

function getParentSvgEl(el) {
  var parentEl = el.parentNode;
  while (is.svg(parentEl)) {
    parentEl = parentEl.parentNode;
    if (!is.svg(parentEl.parentNode)) { break; }
  }
  return parentEl;
}

function getParentSvg(pathEl, svgData) {
  var svg = svgData || {};
  var parentSvgEl = svg.el || getParentSvgEl(pathEl);
  var rect = parentSvgEl.getBoundingClientRect();
  var viewBoxAttr = getAttribute(parentSvgEl, 'viewBox');
  var width = rect.width;
  var height = rect.height;
  var viewBox = svg.viewBox || (viewBoxAttr ? viewBoxAttr.split(' ') : [0, 0, width, height]);
  return {
    el: parentSvgEl,
    viewBox: viewBox,
    x: viewBox[0] / 1,
    y: viewBox[1] / 1,
    w: width / viewBox[2],
    h: height / viewBox[3]
  }
}

function getPath(path, percent) {
  var pathEl = is.str(path) ? selectString(path)[0] : path;
  var p = percent || 100;
  return function(property) {
    return {
      property: property,
      el: pathEl,
      svg: getParentSvg(pathEl),
      totalLength: getTotalLength(pathEl) * (p / 100)
    }
  }
}

function getPathProgress(path, progress) {
  function point(offset) {
    if ( offset === void 0 ) offset = 0;

    var l = progress + offset >= 1 ? progress + offset : 0;
    return path.el.getPointAtLength(l);
  }
  var svg = getParentSvg(path.el, path.svg);
  var p = point();
  var p0 = point(-1);
  var p1 = point(+1);
  switch (path.property) {
    case 'x': return (p.x - svg.x) * svg.w;
    case 'y': return (p.y - svg.y) * svg.h;
    case 'angle': return Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
  }
}

// Decompose value

function decomposeValue(val, unit) {
  var rgx = /-?\d*\.?\d+/g;
  var value = validateValue((is.pth(val) ? val.totalLength : val), unit) + '';
  return {
    original: value,
    numbers: value.match(rgx) ? value.match(rgx).map(Number) : [0],
    strings: (is.str(val) || unit) ? value.split(rgx) : []
  }
}

// Animatables

function parseTargets(targets) {
  var targetsArray = targets ? (flattenArray(is.arr(targets) ? targets.map(toArray) : toArray(targets))) : [];
  return filterArray(targetsArray, function (item, pos, self) { return self.indexOf(item) === pos; });
}

function getAnimatables(targets) {
  var parsed = parseTargets(targets);
  return parsed.map(function (t, i) {
    return {target: t, id: i, total: parsed.length, transforms: { list: getElementTransforms(t) } };
  });
}

// Properties

function normalizePropertyTweens(prop, tweenSettings) {
  var settings = cloneObject(tweenSettings);
  // Override duration if easing is a spring
  if (/^spring/.test(settings.easing)) { settings.duration = spring(settings.easing); }
  if (is.arr(prop)) {
    var l = prop.length;
    var isFromTo = (l === 2 && !is.obj(prop[0]));
    if (!isFromTo) {
      // Duration divided by the number of tweens
      if (!is.fnc(tweenSettings.duration)) { settings.duration = tweenSettings.duration / l; }
    } else {
      // Transform [from, to] values shorthand to a valid tween value
      prop = {value: prop};
    }
  }
  var propArray = is.arr(prop) ? prop : [prop];
  return propArray.map(function (v, i) {
    var obj = (is.obj(v) && !is.pth(v)) ? v : {value: v};
    // Default delay value should only be applied to the first tween
    if (is.und(obj.delay)) { obj.delay = !i ? tweenSettings.delay : 0; }
    // Default endDelay value should only be applied to the last tween
    if (is.und(obj.endDelay)) { obj.endDelay = i === propArray.length - 1 ? tweenSettings.endDelay : 0; }
    return obj;
  }).map(function (k) { return mergeObjects(k, settings); });
}


function flattenKeyframes(keyframes) {
  var propertyNames = filterArray(flattenArray(keyframes.map(function (key) { return Object.keys(key); })), function (p) { return is.key(p); })
  .reduce(function (a,b) { if (a.indexOf(b) < 0) { a.push(b); } return a; }, []);
  var properties = {};
  var loop = function ( i ) {
    var propName = propertyNames[i];
    properties[propName] = keyframes.map(function (key) {
      var newKey = {};
      for (var p in key) {
        if (is.key(p)) {
          if (p == propName) { newKey.value = key[p]; }
        } else {
          newKey[p] = key[p];
        }
      }
      return newKey;
    });
  };

  for (var i = 0; i < propertyNames.length; i++) loop( i );
  return properties;
}

function getProperties(tweenSettings, params) {
  var properties = [];
  var keyframes = params.keyframes;
  if (keyframes) { params = mergeObjects(flattenKeyframes(keyframes), params); }
  for (var p in params) {
    if (is.key(p)) {
      properties.push({
        name: p,
        tweens: normalizePropertyTweens(params[p], tweenSettings)
      });
    }
  }
  return properties;
}

// Tweens

function normalizeTweenValues(tween, animatable) {
  var t = {};
  for (var p in tween) {
    var value = getFunctionValue(tween[p], animatable);
    if (is.arr(value)) {
      value = value.map(function (v) { return getFunctionValue(v, animatable); });
      if (value.length === 1) { value = value[0]; }
    }
    t[p] = value;
  }
  t.duration = parseFloat(t.duration);
  t.delay = parseFloat(t.delay);
  return t;
}

function normalizeTweens(prop, animatable) {
  var previousTween;
  return prop.tweens.map(function (t) {
    var tween = normalizeTweenValues(t, animatable);
    var tweenValue = tween.value;
    var to = is.arr(tweenValue) ? tweenValue[1] : tweenValue;
    var toUnit = getUnit(to);
    var originalValue = getOriginalTargetValue(animatable.target, prop.name, toUnit, animatable);
    var previousValue = previousTween ? previousTween.to.original : originalValue;
    var from = is.arr(tweenValue) ? tweenValue[0] : previousValue;
    var fromUnit = getUnit(from) || getUnit(originalValue);
    var unit = toUnit || fromUnit;
    if (is.und(to)) { to = previousValue; }
    tween.from = decomposeValue(from, unit);
    tween.to = decomposeValue(getRelativeValue(to, from), unit);
    tween.start = previousTween ? previousTween.end : 0;
    tween.end = tween.start + tween.delay + tween.duration + tween.endDelay;
    tween.easing = parseEasings(tween.easing, tween.duration);
    tween.isPath = is.pth(tweenValue);
    tween.isColor = is.col(tween.from.original);
    if (tween.isColor) { tween.round = 1; }
    previousTween = tween;
    return tween;
  });
}

// Tween progress

var setProgressValue = {
  css: function (t, p, v) { return t.style[p] = v; },
  attribute: function (t, p, v) { return t.setAttribute(p, v); },
  object: function (t, p, v) { return t[p] = v; },
  transform: function (t, p, v, transforms, manual) {
    transforms.list.set(p, v);
    if (p === transforms.last || manual) {
      var str = '';
      transforms.list.forEach(function (value, prop) { str += prop + "(" + value + ") "; });
      t.style.transform = str;
    }
  }
};

// Set Value helper

function setTargetsValue(targets, properties) {
  var animatables = getAnimatables(targets);
  animatables.forEach(function (animatable) {
    for (var property in properties) {
      var value = getFunctionValue(properties[property], animatable);
      var target = animatable.target;
      var valueUnit = getUnit(value);
      var originalValue = getOriginalTargetValue(target, property, valueUnit, animatable);
      var unit = valueUnit || getUnit(originalValue);
      var to = getRelativeValue(validateValue(value, unit), originalValue);
      var animType = getAnimationType(target, property);
      setProgressValue[animType](target, property, to, animatable.transforms, true);
    }
  });
}

// Animations

function createAnimation(animatable, prop) {
  var animType = getAnimationType(animatable.target, prop.name);
  if (animType) {
    var tweens = normalizeTweens(prop, animatable);
    var lastTween = tweens[tweens.length - 1];
    return {
      type: animType,
      property: prop.name,
      animatable: animatable,
      tweens: tweens,
      duration: lastTween.end,
      delay: tweens[0].delay,
      endDelay: lastTween.endDelay
    }
  }
}

function getAnimations(animatables, properties) {
  return filterArray(flattenArray(animatables.map(function (animatable) {
    return properties.map(function (prop) {
      return createAnimation(animatable, prop);
    });
  })), function (a) { return !is.und(a); });
}

// Create Instance

function getInstanceTimings(animations, tweenSettings) {
  var animLength = animations.length;
  var getTlOffset = function (anim) { return anim.timelineOffset ? anim.timelineOffset : 0; };
  var timings = {};
  timings.duration = animLength ? Math.max.apply(Math, animations.map(function (anim) { return getTlOffset(anim) + anim.duration; })) : tweenSettings.duration;
  timings.delay = animLength ? Math.min.apply(Math, animations.map(function (anim) { return getTlOffset(anim) + anim.delay; })) : tweenSettings.delay;
  timings.endDelay = animLength ? timings.duration - Math.max.apply(Math, animations.map(function (anim) { return getTlOffset(anim) + anim.duration - anim.endDelay; })) : tweenSettings.endDelay;
  return timings;
}

var instanceID = 0;

function createNewInstance(params) {
  var instanceSettings = replaceObjectProps(defaultInstanceSettings, params);
  var tweenSettings = replaceObjectProps(defaultTweenSettings, params);
  var properties = getProperties(tweenSettings, params);
  var animatables = getAnimatables(params.targets);
  var animations = getAnimations(animatables, properties);
  var timings = getInstanceTimings(animations, tweenSettings);
  var id = instanceID;
  instanceID++;
  return mergeObjects(instanceSettings, {
    id: id,
    children: [],
    animatables: animatables,
    animations: animations,
    duration: timings.duration,
    delay: timings.delay,
    endDelay: timings.endDelay
  });
}

// Core

var activeInstances = [];
var pausedInstances = [];
var raf;

var engine = (function () {
  function play() { 
    raf = requestAnimationFrame(step);
  }
  function step(t) {
    var activeInstancesLength = activeInstances.length;
    if (activeInstancesLength) {
      var i = 0;
      while (i < activeInstancesLength) {
        var activeInstance = activeInstances[i];
        if (!activeInstance.paused) {
          activeInstance.tick(t);
        } else {
          var instanceIndex = activeInstances.indexOf(activeInstance);
          if (instanceIndex > -1) {
            activeInstances.splice(instanceIndex, 1);
            activeInstancesLength = activeInstances.length;
          }
        }
        i++;
      }
      play();
    } else {
      raf = cancelAnimationFrame(raf);
    }
  }
  return play;
})();

function handleVisibilityChange() {
  if (document.hidden) {
    activeInstances.forEach(function (ins) { return ins.pause(); });
    pausedInstances = activeInstances.slice(0);
    activeInstances = [];
  } else {
    pausedInstances.forEach(function (ins) { return ins.play(); });
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

// Public Instance

function anime(params) {
  if ( params === void 0 ) params = {};


  var startTime = 0, lastTime = 0, now = 0;
  var children, childrenLength = 0;
  var resolve = null;

  function makePromise(instance) {
    var promise = window.Promise && new Promise(function (_resolve) { return resolve = _resolve; });
    instance.finished = promise;
    return promise;
  }

  var instance = createNewInstance(params);
  var promise = makePromise(instance);

  function toggleInstanceDirection() {
    var direction = instance.direction;
    if (direction !== 'alternate') {
      instance.direction = direction !== 'normal' ? 'normal' : 'reverse';
    }
    instance.reversed = !instance.reversed;
    children.forEach(function (child) { return child.reversed = instance.reversed; });
  }

  function adjustTime(time) {
    return instance.reversed ? instance.duration - time : time;
  }

  function resetTime() {
    startTime = 0;
    lastTime = adjustTime(instance.currentTime) * (1 / anime.speed);
  }

  function seekCild(time, child) {
    if (child) { child.seek(time - child.timelineOffset); }
  }

  function syncInstanceChildren(time) {
    if (!instance.reversePlayback) {
      for (var i = 0; i < childrenLength; i++) { seekCild(time, children[i]); }
    } else {
      for (var i$1 = childrenLength; i$1--;) { seekCild(time, children[i$1]); }
    }
  }

  function setAnimationsProgress(insTime) {
    var i = 0;
    var animations = instance.animations;
    var animationsLength = animations.length;
    while (i < animationsLength) {
      var anim = animations[i];
      var animatable = anim.animatable;
      var tweens = anim.tweens;
      var tweenLength = tweens.length - 1;
      var tween = tweens[tweenLength];
      // Only check for keyframes if there is more than one tween
      if (tweenLength) { tween = filterArray(tweens, function (t) { return (insTime < t.end); })[0] || tween; }
      var elapsed = minMax(insTime - tween.start - tween.delay, 0, tween.duration) / tween.duration;
      var eased = isNaN(elapsed) ? 1 : tween.easing(elapsed);
      var strings = tween.to.strings;
      var round = tween.round;
      var numbers = [];
      var toNumbersLength = tween.to.numbers.length;
      var progress = (void 0);
      for (var n = 0; n < toNumbersLength; n++) {
        var value = (void 0);
        var toNumber = tween.to.numbers[n];
        var fromNumber = tween.from.numbers[n] || 0;
        if (!tween.isPath) {
          value = fromNumber + (eased * (toNumber - fromNumber));
        } else {
          value = getPathProgress(tween.value, eased * toNumber);
        }
        if (round) {
          if (!(tween.isColor && n > 2)) {
            value = Math.round(value * round) / round;
          }
        }
        numbers.push(value);
      }
      // Manual Array.reduce for better performances
      var stringsLength = strings.length;
      if (!stringsLength) {
        progress = numbers[0];
      } else {
        progress = strings[0];
        for (var s = 0; s < stringsLength; s++) {
          var a = strings[s];
          var b = strings[s + 1];
          var n$1 = numbers[s];
          if (!isNaN(n$1)) {
            if (!b) {
              progress += n$1 + ' ';
            } else {
              progress += n$1 + b;
            }
          }
        }
      }
      setProgressValue[anim.type](animatable.target, anim.property, progress, animatable.transforms);
      anim.currentValue = progress;
      i++;
    }
  }

  function setCallback(cb) {
    if (instance[cb] && !instance.passThrough) { instance[cb](instance); }
  }

  function countIteration() {
    if (instance.remaining && instance.remaining !== true) {
      instance.remaining--;
    }
  }

  function setInstanceProgress(engineTime) {
    var insDuration = instance.duration;
    var insDelay = instance.delay;
    var insEndDelay = insDuration - instance.endDelay;
    var insTime = adjustTime(engineTime);
    instance.progress = minMax((insTime / insDuration) * 100, 0, 100);
    instance.reversePlayback = insTime < instance.currentTime;
    if (children) { syncInstanceChildren(insTime); }
    if (!instance.began && instance.currentTime > 0) {
      instance.began = true;
      setCallback('begin');
      setCallback('loopBegin');
    }
    if (insTime <= insDelay && instance.currentTime !== 0) {
      setAnimationsProgress(0);
    }
    if ((insTime >= insEndDelay && instance.currentTime !== insDuration) || !insDuration) {
      setAnimationsProgress(insDuration);
    }
    if (insTime > insDelay && insTime < insEndDelay) {
      if (!instance.changeBegan) {
        instance.changeBegan = true;
        instance.changeCompleted = false;
        setCallback('changeBegin');
      }
      setCallback('change');
      setAnimationsProgress(insTime);
    } else {
      if (instance.changeBegan) {
        instance.changeCompleted = true;
        instance.changeBegan = false;
        setCallback('changeComplete');
      }
    }
    instance.currentTime = minMax(insTime, 0, insDuration);
    if (instance.began) { setCallback('update'); }
    if (engineTime >= insDuration) {
      lastTime = 0;
      countIteration();
      if (instance.remaining) {
        startTime = now;
        setCallback('loopComplete');
        setCallback('loopBegin');
        if (instance.direction === 'alternate') { toggleInstanceDirection(); }
      } else {
        instance.paused = true;
        if (!instance.completed) {
          instance.completed = true;
          setCallback('loopComplete');
          setCallback('complete');
          if (!instance.passThrough && 'Promise' in window) {
            resolve();
            promise = makePromise(instance);
          }
        }
      }
    }
  }

  instance.reset = function() {
    var direction = instance.direction;
    instance.passThrough = false;
    instance.currentTime = 0;
    instance.progress = 0;
    instance.paused = true;
    instance.began = false;
    instance.changeBegan = false;
    instance.completed = false;
    instance.changeCompleted = false;
    instance.reversePlayback = false;
    instance.reversed = direction === 'reverse';
    instance.remaining = instance.loop;
    children = instance.children;
    childrenLength = children.length;
    for (var i = childrenLength; i--;) { instance.children[i].reset(); }
    if (instance.reversed && instance.loop !== true || (direction === 'alternate' && instance.loop === 1)) { instance.remaining++; }
    setAnimationsProgress(0);
  };

  // Set Value helper

  instance.set = function(targets, properties) {
    setTargetsValue(targets, properties);
    return instance;
  };

  instance.tick = function(t) {
    now = t;
    if (!startTime) { startTime = now; }
    setInstanceProgress((now + (lastTime - startTime)) * anime.speed);
  };

  instance.seek = function(time) {
    setInstanceProgress(adjustTime(time));
  };

  instance.pause = function() {
    instance.paused = true;
    resetTime();
  };

  instance.play = function() {
    if (!instance.paused) { return; }
    if (instance.completed) { instance.reset(); }
    instance.paused = false;
    activeInstances.push(instance);
    resetTime();
    if (!raf) { engine(); }
  };

  instance.reverse = function() {
    toggleInstanceDirection();
    resetTime();
  };

  instance.restart = function() {
    instance.reset();
    instance.play();
  };

  instance.reset();

  if (instance.autoplay) { instance.play(); }

  return instance;

}

// Remove targets from animation

function removeTargetsFromAnimations(targetsArray, animations) {
  for (var a = animations.length; a--;) {
    if (arrayContains(targetsArray, animations[a].animatable.target)) {
      animations.splice(a, 1);
    }
  }
}

function removeTargets(targets) {
  var targetsArray = parseTargets(targets);
  for (var i = activeInstances.length; i--;) {
    var instance = activeInstances[i];
    var animations = instance.animations;
    var children = instance.children;
    removeTargetsFromAnimations(targetsArray, animations);
    for (var c = children.length; c--;) {
      var child = children[c];
      var childAnimations = child.animations;
      removeTargetsFromAnimations(targetsArray, childAnimations);
      if (!childAnimations.length && !child.children.length) { children.splice(c, 1); }
    }
    if (!animations.length && !children.length) { instance.pause(); }
  }
}

// Stagger helpers

function stagger(val, params) {
  if ( params === void 0 ) params = {};

  var direction = params.direction || 'normal';
  var easing = params.easing ? parseEasings(params.easing) : null;
  var grid = params.grid;
  var axis = params.axis;
  var fromIndex = params.from || 0;
  var fromFirst = fromIndex === 'first';
  var fromCenter = fromIndex === 'center';
  var fromLast = fromIndex === 'last';
  var isRange = is.arr(val);
  var val1 = isRange ? parseFloat(val[0]) : parseFloat(val);
  var val2 = isRange ? parseFloat(val[1]) : 0;
  var unit = getUnit(isRange ? val[1] : val) || 0;
  var start = params.start || 0 + (isRange ? val1 : 0);
  var values = [];
  var maxValue = 0;
  return function (el, i, t) {
    if (fromFirst) { fromIndex = 0; }
    if (fromCenter) { fromIndex = (t - 1) / 2; }
    if (fromLast) { fromIndex = t - 1; }
    if (!values.length) {
      for (var index = 0; index < t; index++) {
        if (!grid) {
          values.push(Math.abs(fromIndex - index));
        } else {
          var fromX = !fromCenter ? fromIndex%grid[0] : (grid[0]-1)/2;
          var fromY = !fromCenter ? Math.floor(fromIndex/grid[0]) : (grid[1]-1)/2;
          var toX = index%grid[0];
          var toY = Math.floor(index/grid[0]);
          var distanceX = fromX - toX;
          var distanceY = fromY - toY;
          var value = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
          if (axis === 'x') { value = -distanceX; }
          if (axis === 'y') { value = -distanceY; }
          values.push(value);
        }
        maxValue = Math.max.apply(Math, values);
      }
      if (easing) { values = values.map(function (val) { return easing(val / maxValue) * maxValue; }); }
      if (direction === 'reverse') { values = values.map(function (val) { return axis ? (val < 0) ? val * -1 : -val : Math.abs(maxValue - val); }); }
    }
    var spacing = isRange ? (val2 - val1) / maxValue : val1;
    return start + (spacing * (Math.round(values[i] * 100) / 100)) + unit;
  }
}

// Timeline

function timeline(params) {
  if ( params === void 0 ) params = {};

  var tl = anime(params);
  tl.duration = 0;
  tl.add = function(instanceParams, timelineOffset) {
    var tlIndex = activeInstances.indexOf(tl);
    var children = tl.children;
    if (tlIndex > -1) { activeInstances.splice(tlIndex, 1); }
    function passThrough(ins) { ins.passThrough = true; }
    for (var i = 0; i < children.length; i++) { passThrough(children[i]); }
    var insParams = mergeObjects(instanceParams, replaceObjectProps(defaultTweenSettings, params));
    insParams.targets = insParams.targets || params.targets;
    var tlDuration = tl.duration;
    insParams.autoplay = false;
    insParams.direction = tl.direction;
    insParams.timelineOffset = is.und(timelineOffset) ? tlDuration : getRelativeValue(timelineOffset, tlDuration);
    passThrough(tl);
    tl.seek(insParams.timelineOffset);
    var ins = anime(insParams);
    passThrough(ins);
    children.push(ins);
    var timings = getInstanceTimings(children, params);
    tl.delay = timings.delay;
    tl.endDelay = timings.endDelay;
    tl.duration = timings.duration;
    tl.seek(0);
    tl.reset();
    if (tl.autoplay) { tl.play(); }
    return tl;
  };
  return tl;
}

anime.version = '3.0.1';
anime.speed = 1;
anime.running = activeInstances;
anime.remove = removeTargets;
anime.get = getOriginalTargetValue;
anime.set = setTargetsValue;
anime.convertPx = convertPxToUnit;
anime.path = getPath;
anime.setDashoffset = setDashoffset;
anime.stagger = stagger;
anime.timeline = timeline;
anime.easing = parseEasings;
anime.penner = penner;
anime.random = function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; };

module.exports = anime;

},{}],2:[function(require,module,exports){
!function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define([],t):"object"==typeof exports?exports.AOS=t():e.AOS=t()}(this,function(){return function(e){function t(o){if(n[o])return n[o].exports;var i=n[o]={exports:{},id:o,loaded:!1};return e[o].call(i.exports,i,i.exports,t),i.loaded=!0,i.exports}var n={};return t.m=e,t.c=n,t.p="dist/",t(0)}([function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{default:e}}var i=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(e[o]=n[o])}return e},r=n(1),a=(o(r),n(6)),u=o(a),c=n(7),s=o(c),f=n(8),d=o(f),l=n(9),p=o(l),m=n(10),b=o(m),v=n(11),y=o(v),g=n(14),h=o(g),w=[],k=!1,x={offset:120,delay:0,easing:"ease",duration:400,disable:!1,once:!1,startEvent:"DOMContentLoaded",throttleDelay:99,debounceDelay:50,disableMutationObserver:!1},j=function(){var e=arguments.length>0&&void 0!==arguments[0]&&arguments[0];if(e&&(k=!0),k)return w=(0,y.default)(w,x),(0,b.default)(w,x.once),w},O=function(){w=(0,h.default)(),j()},M=function(){w.forEach(function(e,t){e.node.removeAttribute("data-aos"),e.node.removeAttribute("data-aos-easing"),e.node.removeAttribute("data-aos-duration"),e.node.removeAttribute("data-aos-delay")})},S=function(e){return e===!0||"mobile"===e&&p.default.mobile()||"phone"===e&&p.default.phone()||"tablet"===e&&p.default.tablet()||"function"==typeof e&&e()===!0},_=function(e){x=i(x,e),w=(0,h.default)();var t=document.all&&!window.atob;return S(x.disable)||t?M():(x.disableMutationObserver||d.default.isSupported()||(console.info('\n      aos: MutationObserver is not supported on this browser,\n      code mutations observing has been disabled.\n      You may have to call "refreshHard()" by yourself.\n    '),x.disableMutationObserver=!0),document.querySelector("body").setAttribute("data-aos-easing",x.easing),document.querySelector("body").setAttribute("data-aos-duration",x.duration),document.querySelector("body").setAttribute("data-aos-delay",x.delay),"DOMContentLoaded"===x.startEvent&&["complete","interactive"].indexOf(document.readyState)>-1?j(!0):"load"===x.startEvent?window.addEventListener(x.startEvent,function(){j(!0)}):document.addEventListener(x.startEvent,function(){j(!0)}),window.addEventListener("resize",(0,s.default)(j,x.debounceDelay,!0)),window.addEventListener("orientationchange",(0,s.default)(j,x.debounceDelay,!0)),window.addEventListener("scroll",(0,u.default)(function(){(0,b.default)(w,x.once)},x.throttleDelay)),x.disableMutationObserver||d.default.ready("[data-aos]",O),w)};e.exports={init:_,refresh:j,refreshHard:O}},function(e,t){},,,,,function(e,t){(function(t){"use strict";function n(e,t,n){function o(t){var n=b,o=v;return b=v=void 0,k=t,g=e.apply(o,n)}function r(e){return k=e,h=setTimeout(f,t),M?o(e):g}function a(e){var n=e-w,o=e-k,i=t-n;return S?j(i,y-o):i}function c(e){var n=e-w,o=e-k;return void 0===w||n>=t||n<0||S&&o>=y}function f(){var e=O();return c(e)?d(e):void(h=setTimeout(f,a(e)))}function d(e){return h=void 0,_&&b?o(e):(b=v=void 0,g)}function l(){void 0!==h&&clearTimeout(h),k=0,b=w=v=h=void 0}function p(){return void 0===h?g:d(O())}function m(){var e=O(),n=c(e);if(b=arguments,v=this,w=e,n){if(void 0===h)return r(w);if(S)return h=setTimeout(f,t),o(w)}return void 0===h&&(h=setTimeout(f,t)),g}var b,v,y,g,h,w,k=0,M=!1,S=!1,_=!0;if("function"!=typeof e)throw new TypeError(s);return t=u(t)||0,i(n)&&(M=!!n.leading,S="maxWait"in n,y=S?x(u(n.maxWait)||0,t):y,_="trailing"in n?!!n.trailing:_),m.cancel=l,m.flush=p,m}function o(e,t,o){var r=!0,a=!0;if("function"!=typeof e)throw new TypeError(s);return i(o)&&(r="leading"in o?!!o.leading:r,a="trailing"in o?!!o.trailing:a),n(e,t,{leading:r,maxWait:t,trailing:a})}function i(e){var t="undefined"==typeof e?"undefined":c(e);return!!e&&("object"==t||"function"==t)}function r(e){return!!e&&"object"==("undefined"==typeof e?"undefined":c(e))}function a(e){return"symbol"==("undefined"==typeof e?"undefined":c(e))||r(e)&&k.call(e)==d}function u(e){if("number"==typeof e)return e;if(a(e))return f;if(i(e)){var t="function"==typeof e.valueOf?e.valueOf():e;e=i(t)?t+"":t}if("string"!=typeof e)return 0===e?e:+e;e=e.replace(l,"");var n=m.test(e);return n||b.test(e)?v(e.slice(2),n?2:8):p.test(e)?f:+e}var c="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},s="Expected a function",f=NaN,d="[object Symbol]",l=/^\s+|\s+$/g,p=/^[-+]0x[0-9a-f]+$/i,m=/^0b[01]+$/i,b=/^0o[0-7]+$/i,v=parseInt,y="object"==("undefined"==typeof t?"undefined":c(t))&&t&&t.Object===Object&&t,g="object"==("undefined"==typeof self?"undefined":c(self))&&self&&self.Object===Object&&self,h=y||g||Function("return this")(),w=Object.prototype,k=w.toString,x=Math.max,j=Math.min,O=function(){return h.Date.now()};e.exports=o}).call(t,function(){return this}())},function(e,t){(function(t){"use strict";function n(e,t,n){function i(t){var n=b,o=v;return b=v=void 0,O=t,g=e.apply(o,n)}function r(e){return O=e,h=setTimeout(f,t),M?i(e):g}function u(e){var n=e-w,o=e-O,i=t-n;return S?x(i,y-o):i}function s(e){var n=e-w,o=e-O;return void 0===w||n>=t||n<0||S&&o>=y}function f(){var e=j();return s(e)?d(e):void(h=setTimeout(f,u(e)))}function d(e){return h=void 0,_&&b?i(e):(b=v=void 0,g)}function l(){void 0!==h&&clearTimeout(h),O=0,b=w=v=h=void 0}function p(){return void 0===h?g:d(j())}function m(){var e=j(),n=s(e);if(b=arguments,v=this,w=e,n){if(void 0===h)return r(w);if(S)return h=setTimeout(f,t),i(w)}return void 0===h&&(h=setTimeout(f,t)),g}var b,v,y,g,h,w,O=0,M=!1,S=!1,_=!0;if("function"!=typeof e)throw new TypeError(c);return t=a(t)||0,o(n)&&(M=!!n.leading,S="maxWait"in n,y=S?k(a(n.maxWait)||0,t):y,_="trailing"in n?!!n.trailing:_),m.cancel=l,m.flush=p,m}function o(e){var t="undefined"==typeof e?"undefined":u(e);return!!e&&("object"==t||"function"==t)}function i(e){return!!e&&"object"==("undefined"==typeof e?"undefined":u(e))}function r(e){return"symbol"==("undefined"==typeof e?"undefined":u(e))||i(e)&&w.call(e)==f}function a(e){if("number"==typeof e)return e;if(r(e))return s;if(o(e)){var t="function"==typeof e.valueOf?e.valueOf():e;e=o(t)?t+"":t}if("string"!=typeof e)return 0===e?e:+e;e=e.replace(d,"");var n=p.test(e);return n||m.test(e)?b(e.slice(2),n?2:8):l.test(e)?s:+e}var u="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},c="Expected a function",s=NaN,f="[object Symbol]",d=/^\s+|\s+$/g,l=/^[-+]0x[0-9a-f]+$/i,p=/^0b[01]+$/i,m=/^0o[0-7]+$/i,b=parseInt,v="object"==("undefined"==typeof t?"undefined":u(t))&&t&&t.Object===Object&&t,y="object"==("undefined"==typeof self?"undefined":u(self))&&self&&self.Object===Object&&self,g=v||y||Function("return this")(),h=Object.prototype,w=h.toString,k=Math.max,x=Math.min,j=function(){return g.Date.now()};e.exports=n}).call(t,function(){return this}())},function(e,t){"use strict";function n(e){var t=void 0,o=void 0,i=void 0;for(t=0;t<e.length;t+=1){if(o=e[t],o.dataset&&o.dataset.aos)return!0;if(i=o.children&&n(o.children))return!0}return!1}function o(){return window.MutationObserver||window.WebKitMutationObserver||window.MozMutationObserver}function i(){return!!o()}function r(e,t){var n=window.document,i=o(),r=new i(a);u=t,r.observe(n.documentElement,{childList:!0,subtree:!0,removedNodes:!0})}function a(e){e&&e.forEach(function(e){var t=Array.prototype.slice.call(e.addedNodes),o=Array.prototype.slice.call(e.removedNodes),i=t.concat(o);if(n(i))return u()})}Object.defineProperty(t,"__esModule",{value:!0});var u=function(){};t.default={isSupported:i,ready:r}},function(e,t){"use strict";function n(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function o(){return navigator.userAgent||navigator.vendor||window.opera||""}Object.defineProperty(t,"__esModule",{value:!0});var i=function(){function e(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o)}}return function(t,n,o){return n&&e(t.prototype,n),o&&e(t,o),t}}(),r=/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i,a=/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i,u=/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i,c=/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i,s=function(){function e(){n(this,e)}return i(e,[{key:"phone",value:function(){var e=o();return!(!r.test(e)&&!a.test(e.substr(0,4)))}},{key:"mobile",value:function(){var e=o();return!(!u.test(e)&&!c.test(e.substr(0,4)))}},{key:"tablet",value:function(){return this.mobile()&&!this.phone()}}]),e}();t.default=new s},function(e,t){"use strict";Object.defineProperty(t,"__esModule",{value:!0});var n=function(e,t,n){var o=e.node.getAttribute("data-aos-once");t>e.position?e.node.classList.add("aos-animate"):"undefined"!=typeof o&&("false"===o||!n&&"true"!==o)&&e.node.classList.remove("aos-animate")},o=function(e,t){var o=window.pageYOffset,i=window.innerHeight;e.forEach(function(e,r){n(e,i+o,t)})};t.default=o},function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{default:e}}Object.defineProperty(t,"__esModule",{value:!0});var i=n(12),r=o(i),a=function(e,t){return e.forEach(function(e,n){e.node.classList.add("aos-init"),e.position=(0,r.default)(e.node,t.offset)}),e};t.default=a},function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{default:e}}Object.defineProperty(t,"__esModule",{value:!0});var i=n(13),r=o(i),a=function(e,t){var n=0,o=0,i=window.innerHeight,a={offset:e.getAttribute("data-aos-offset"),anchor:e.getAttribute("data-aos-anchor"),anchorPlacement:e.getAttribute("data-aos-anchor-placement")};switch(a.offset&&!isNaN(a.offset)&&(o=parseInt(a.offset)),a.anchor&&document.querySelectorAll(a.anchor)&&(e=document.querySelectorAll(a.anchor)[0]),n=(0,r.default)(e).top,a.anchorPlacement){case"top-bottom":break;case"center-bottom":n+=e.offsetHeight/2;break;case"bottom-bottom":n+=e.offsetHeight;break;case"top-center":n+=i/2;break;case"bottom-center":n+=i/2+e.offsetHeight;break;case"center-center":n+=i/2+e.offsetHeight/2;break;case"top-top":n+=i;break;case"bottom-top":n+=e.offsetHeight+i;break;case"center-top":n+=e.offsetHeight/2+i}return a.anchorPlacement||a.offset||isNaN(t)||(o=t),n+o};t.default=a},function(e,t){"use strict";Object.defineProperty(t,"__esModule",{value:!0});var n=function(e){for(var t=0,n=0;e&&!isNaN(e.offsetLeft)&&!isNaN(e.offsetTop);)t+=e.offsetLeft-("BODY"!=e.tagName?e.scrollLeft:0),n+=e.offsetTop-("BODY"!=e.tagName?e.scrollTop:0),e=e.offsetParent;return{top:n,left:t}};t.default=n},function(e,t){"use strict";Object.defineProperty(t,"__esModule",{value:!0});var n=function(e){return e=e||document.querySelectorAll("[data-aos]"),Array.prototype.map.call(e,function(e){return{node:e}})};t.default=n}])});
},{}],3:[function(require,module,exports){
(function (global){
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.IMask = factory());
}(this, (function () { 'use strict';

  // 7.2.1 RequireObjectCoercible(argument)
  var _defined = function (it) {
    if (it == undefined) throw TypeError("Can't call method on  " + it);
    return it;
  };

  // 7.1.13 ToObject(argument)

  var _toObject = function (it) {
    return Object(_defined(it));
  };

  var hasOwnProperty = {}.hasOwnProperty;
  var _has = function (it, key) {
    return hasOwnProperty.call(it, key);
  };

  var toString = {}.toString;

  var _cof = function (it) {
    return toString.call(it).slice(8, -1);
  };

  // fallback for non-array-like ES3 and non-enumerable old V8 strings

  // eslint-disable-next-line no-prototype-builtins
  var _iobject = Object('z').propertyIsEnumerable(0) ? Object : function (it) {
    return _cof(it) == 'String' ? it.split('') : Object(it);
  };

  // to indexed object, toObject with fallback for non-array-like ES3 strings


  var _toIobject = function (it) {
    return _iobject(_defined(it));
  };

  // 7.1.4 ToInteger
  var ceil = Math.ceil;
  var floor = Math.floor;
  var _toInteger = function (it) {
    return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
  };

  // 7.1.15 ToLength

  var min = Math.min;
  var _toLength = function (it) {
    return it > 0 ? min(_toInteger(it), 0x1fffffffffffff) : 0; // pow(2, 53) - 1 == 9007199254740991
  };

  var max = Math.max;
  var min$1 = Math.min;
  var _toAbsoluteIndex = function (index, length) {
    index = _toInteger(index);
    return index < 0 ? max(index + length, 0) : min$1(index, length);
  };

  // false -> Array#indexOf
  // true  -> Array#includes



  var _arrayIncludes = function (IS_INCLUDES) {
    return function ($this, el, fromIndex) {
      var O = _toIobject($this);
      var length = _toLength(O.length);
      var index = _toAbsoluteIndex(fromIndex, length);
      var value;
      // Array#includes uses SameValueZero equality algorithm
      // eslint-disable-next-line no-self-compare
      if (IS_INCLUDES && el != el) while (length > index) {
        value = O[index++];
        // eslint-disable-next-line no-self-compare
        if (value != value) return true;
      // Array#indexOf ignores holes, Array#includes - not
      } else for (;length > index; index++) if (IS_INCLUDES || index in O) {
        if (O[index] === el) return IS_INCLUDES || index || 0;
      } return !IS_INCLUDES && -1;
    };
  };

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var _global = createCommonjsModule(function (module) {
  // https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
  var global = module.exports = typeof window != 'undefined' && window.Math == Math
    ? window : typeof self != 'undefined' && self.Math == Math ? self
    // eslint-disable-next-line no-new-func
    : Function('return this')();
  if (typeof __g == 'number') __g = global; // eslint-disable-line no-undef
  });

  var SHARED = '__core-js_shared__';
  var store = _global[SHARED] || (_global[SHARED] = {});
  var _shared = function (key) {
    return store[key] || (store[key] = {});
  };

  var id = 0;
  var px = Math.random();
  var _uid = function (key) {
    return 'Symbol('.concat(key === undefined ? '' : key, ')_', (++id + px).toString(36));
  };

  var shared = _shared('keys');

  var _sharedKey = function (key) {
    return shared[key] || (shared[key] = _uid(key));
  };

  var arrayIndexOf = _arrayIncludes(false);
  var IE_PROTO = _sharedKey('IE_PROTO');

  var _objectKeysInternal = function (object, names) {
    var O = _toIobject(object);
    var i = 0;
    var result = [];
    var key;
    for (key in O) if (key != IE_PROTO) _has(O, key) && result.push(key);
    // Don't enum bug & hidden keys
    while (names.length > i) if (_has(O, key = names[i++])) {
      ~arrayIndexOf(result, key) || result.push(key);
    }
    return result;
  };

  // IE 8- don't enum bug keys
  var _enumBugKeys = (
    'constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf'
  ).split(',');

  // 19.1.2.14 / 15.2.3.14 Object.keys(O)



  var _objectKeys = Object.keys || function keys(O) {
    return _objectKeysInternal(O, _enumBugKeys);
  };

  var _core = createCommonjsModule(function (module) {
  var core = module.exports = { version: '2.5.5' };
  if (typeof __e == 'number') __e = core; // eslint-disable-line no-undef
  });
  var _core_1 = _core.version;

  var _isObject = function (it) {
    return typeof it === 'object' ? it !== null : typeof it === 'function';
  };

  var _anObject = function (it) {
    if (!_isObject(it)) throw TypeError(it + ' is not an object!');
    return it;
  };

  var _fails = function (exec) {
    try {
      return !!exec();
    } catch (e) {
      return true;
    }
  };

  // Thank's IE8 for his funny defineProperty
  var _descriptors = !_fails(function () {
    return Object.defineProperty({}, 'a', { get: function () { return 7; } }).a != 7;
  });

  var document$1 = _global.document;
  // typeof document.createElement is 'object' in old IE
  var is = _isObject(document$1) && _isObject(document$1.createElement);
  var _domCreate = function (it) {
    return is ? document$1.createElement(it) : {};
  };

  var _ie8DomDefine = !_descriptors && !_fails(function () {
    return Object.defineProperty(_domCreate('div'), 'a', { get: function () { return 7; } }).a != 7;
  });

  // 7.1.1 ToPrimitive(input [, PreferredType])

  // instead of the ES6 spec version, we didn't implement @@toPrimitive case
  // and the second argument - flag - preferred type is a string
  var _toPrimitive = function (it, S) {
    if (!_isObject(it)) return it;
    var fn, val;
    if (S && typeof (fn = it.toString) == 'function' && !_isObject(val = fn.call(it))) return val;
    if (typeof (fn = it.valueOf) == 'function' && !_isObject(val = fn.call(it))) return val;
    if (!S && typeof (fn = it.toString) == 'function' && !_isObject(val = fn.call(it))) return val;
    throw TypeError("Can't convert object to primitive value");
  };

  var dP = Object.defineProperty;

  var f = _descriptors ? Object.defineProperty : function defineProperty(O, P, Attributes) {
    _anObject(O);
    P = _toPrimitive(P, true);
    _anObject(Attributes);
    if (_ie8DomDefine) try {
      return dP(O, P, Attributes);
    } catch (e) { /* empty */ }
    if ('get' in Attributes || 'set' in Attributes) throw TypeError('Accessors not supported!');
    if ('value' in Attributes) O[P] = Attributes.value;
    return O;
  };

  var _objectDp = {
  	f: f
  };

  var _propertyDesc = function (bitmap, value) {
    return {
      enumerable: !(bitmap & 1),
      configurable: !(bitmap & 2),
      writable: !(bitmap & 4),
      value: value
    };
  };

  var _hide = _descriptors ? function (object, key, value) {
    return _objectDp.f(object, key, _propertyDesc(1, value));
  } : function (object, key, value) {
    object[key] = value;
    return object;
  };

  var _redefine = createCommonjsModule(function (module) {
  var SRC = _uid('src');
  var TO_STRING = 'toString';
  var $toString = Function[TO_STRING];
  var TPL = ('' + $toString).split(TO_STRING);

  _core.inspectSource = function (it) {
    return $toString.call(it);
  };

  (module.exports = function (O, key, val, safe) {
    var isFunction = typeof val == 'function';
    if (isFunction) _has(val, 'name') || _hide(val, 'name', key);
    if (O[key] === val) return;
    if (isFunction) _has(val, SRC) || _hide(val, SRC, O[key] ? '' + O[key] : TPL.join(String(key)));
    if (O === _global) {
      O[key] = val;
    } else if (!safe) {
      delete O[key];
      _hide(O, key, val);
    } else if (O[key]) {
      O[key] = val;
    } else {
      _hide(O, key, val);
    }
  // add fake Function#toString for correct work wrapped methods / constructors with methods like LoDash isNative
  })(Function.prototype, TO_STRING, function toString() {
    return typeof this == 'function' && this[SRC] || $toString.call(this);
  });
  });

  var _aFunction = function (it) {
    if (typeof it != 'function') throw TypeError(it + ' is not a function!');
    return it;
  };

  // optional / simple context binding

  var _ctx = function (fn, that, length) {
    _aFunction(fn);
    if (that === undefined) return fn;
    switch (length) {
      case 1: return function (a) {
        return fn.call(that, a);
      };
      case 2: return function (a, b) {
        return fn.call(that, a, b);
      };
      case 3: return function (a, b, c) {
        return fn.call(that, a, b, c);
      };
    }
    return function (/* ...args */) {
      return fn.apply(that, arguments);
    };
  };

  var PROTOTYPE = 'prototype';

  var $export = function (type, name, source) {
    var IS_FORCED = type & $export.F;
    var IS_GLOBAL = type & $export.G;
    var IS_STATIC = type & $export.S;
    var IS_PROTO = type & $export.P;
    var IS_BIND = type & $export.B;
    var target = IS_GLOBAL ? _global : IS_STATIC ? _global[name] || (_global[name] = {}) : (_global[name] || {})[PROTOTYPE];
    var exports = IS_GLOBAL ? _core : _core[name] || (_core[name] = {});
    var expProto = exports[PROTOTYPE] || (exports[PROTOTYPE] = {});
    var key, own, out, exp;
    if (IS_GLOBAL) source = name;
    for (key in source) {
      // contains in native
      own = !IS_FORCED && target && target[key] !== undefined;
      // export native or passed
      out = (own ? target : source)[key];
      // bind timers to global for call from export context
      exp = IS_BIND && own ? _ctx(out, _global) : IS_PROTO && typeof out == 'function' ? _ctx(Function.call, out) : out;
      // extend global
      if (target) _redefine(target, key, out, type & $export.U);
      // export
      if (exports[key] != out) _hide(exports, key, exp);
      if (IS_PROTO && expProto[key] != out) expProto[key] = out;
    }
  };
  _global.core = _core;
  // type bitmap
  $export.F = 1;   // forced
  $export.G = 2;   // global
  $export.S = 4;   // static
  $export.P = 8;   // proto
  $export.B = 16;  // bind
  $export.W = 32;  // wrap
  $export.U = 64;  // safe
  $export.R = 128; // real proto method for `library`
  var _export = $export;

  // most Object methods by ES6 should accept primitives



  var _objectSap = function (KEY, exec) {
    var fn = (_core.Object || {})[KEY] || Object[KEY];
    var exp = {};
    exp[KEY] = exec(fn);
    _export(_export.S + _export.F * _fails(function () { fn(1); }), 'Object', exp);
  };

  // 19.1.2.14 Object.keys(O)



  _objectSap('keys', function () {
    return function keys(it) {
      return _objectKeys(_toObject(it));
    };
  });

  var keys = _core.Object.keys;

  var _stringRepeat = function repeat(count) {
    var str = String(_defined(this));
    var res = '';
    var n = _toInteger(count);
    if (n < 0 || n == Infinity) throw RangeError("Count can't be negative");
    for (;n > 0; (n >>>= 1) && (str += str)) if (n & 1) res += str;
    return res;
  };

  _export(_export.P, 'String', {
    // 21.1.3.13 String.prototype.repeat(count)
    repeat: _stringRepeat
  });

  var repeat = _core.String.repeat;

  // https://github.com/tc39/proposal-string-pad-start-end




  var _stringPad = function (that, maxLength, fillString, left) {
    var S = String(_defined(that));
    var stringLength = S.length;
    var fillStr = fillString === undefined ? ' ' : String(fillString);
    var intMaxLength = _toLength(maxLength);
    if (intMaxLength <= stringLength || fillStr == '') return S;
    var fillLen = intMaxLength - stringLength;
    var stringFiller = _stringRepeat.call(fillStr, Math.ceil(fillLen / fillStr.length));
    if (stringFiller.length > fillLen) stringFiller = stringFiller.slice(0, fillLen);
    return left ? stringFiller + S : S + stringFiller;
  };

  var navigator = _global.navigator;

  var _userAgent = navigator && navigator.userAgent || '';

  // https://github.com/tc39/proposal-string-pad-start-end




  // https://github.com/zloirock/core-js/issues/280
  _export(_export.P + _export.F * /Version\/10\.\d+(\.\d+)? Safari\//.test(_userAgent), 'String', {
    padStart: function padStart(maxLength /* , fillString = ' ' */) {
      return _stringPad(this, maxLength, arguments.length > 1 ? arguments[1] : undefined, true);
    }
  });

  var padStart = _core.String.padStart;

  // https://github.com/tc39/proposal-string-pad-start-end




  // https://github.com/zloirock/core-js/issues/280
  _export(_export.P + _export.F * /Version\/10\.\d+(\.\d+)? Safari\//.test(_userAgent), 'String', {
    padEnd: function padEnd(maxLength /* , fillString = ' ' */) {
      return _stringPad(this, maxLength, arguments.length > 1 ? arguments[1] : undefined, false);
    }
  });

  var padEnd = _core.String.padEnd;

  function _typeof(obj) {
    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
      _typeof = function (obj) {
        return typeof obj;
      };
    } else {
      _typeof = function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };
    }

    return _typeof(obj);
  }

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  function _extends() {
    _extends = Object.assign || function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];

        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }

      return target;
    };

    return _extends.apply(this, arguments);
  }

  function _objectSpread(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i] != null ? arguments[i] : {};
      var ownKeys = Object.keys(source);

      if (typeof Object.getOwnPropertySymbols === 'function') {
        ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) {
          return Object.getOwnPropertyDescriptor(source, sym).enumerable;
        }));
      }

      ownKeys.forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    }

    return target;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function");
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        writable: true,
        configurable: true
      }
    });
    if (superClass) _setPrototypeOf(subClass, superClass);
  }

  function _getPrototypeOf(o) {
    _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
      return o.__proto__ || Object.getPrototypeOf(o);
    };
    return _getPrototypeOf(o);
  }

  function _setPrototypeOf(o, p) {
    _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
      o.__proto__ = p;
      return o;
    };

    return _setPrototypeOf(o, p);
  }

  function _objectWithoutPropertiesLoose(source, excluded) {
    if (source == null) return {};
    var target = {};
    var sourceKeys = Object.keys(source);
    var key, i;

    for (i = 0; i < sourceKeys.length; i++) {
      key = sourceKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      target[key] = source[key];
    }

    return target;
  }

  function _objectWithoutProperties(source, excluded) {
    if (source == null) return {};

    var target = _objectWithoutPropertiesLoose(source, excluded);

    var key, i;

    if (Object.getOwnPropertySymbols) {
      var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

      for (i = 0; i < sourceSymbolKeys.length; i++) {
        key = sourceSymbolKeys[i];
        if (excluded.indexOf(key) >= 0) continue;
        if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
        target[key] = source[key];
      }
    }

    return target;
  }

  function _assertThisInitialized(self) {
    if (self === void 0) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return self;
  }

  function _possibleConstructorReturn(self, call) {
    if (call && (typeof call === "object" || typeof call === "function")) {
      return call;
    }

    return _assertThisInitialized(self);
  }

  function _superPropBase(object, property) {
    while (!Object.prototype.hasOwnProperty.call(object, property)) {
      object = _getPrototypeOf(object);
      if (object === null) break;
    }

    return object;
  }

  function _get(target, property, receiver) {
    if (typeof Reflect !== "undefined" && Reflect.get) {
      _get = Reflect.get;
    } else {
      _get = function _get(target, property, receiver) {
        var base = _superPropBase(target, property);

        if (!base) return;
        var desc = Object.getOwnPropertyDescriptor(base, property);

        if (desc.get) {
          return desc.get.call(receiver);
        }

        return desc.value;
      };
    }

    return _get(target, property, receiver || target);
  }

  function set(target, property, value, receiver) {
    if (typeof Reflect !== "undefined" && Reflect.set) {
      set = Reflect.set;
    } else {
      set = function set(target, property, value, receiver) {
        var base = _superPropBase(target, property);

        var desc;

        if (base) {
          desc = Object.getOwnPropertyDescriptor(base, property);

          if (desc.set) {
            desc.set.call(receiver, value);
            return true;
          } else if (!desc.writable) {
            return false;
          }
        }

        desc = Object.getOwnPropertyDescriptor(receiver, property);

        if (desc) {
          if (!desc.writable) {
            return false;
          }

          desc.value = value;
          Object.defineProperty(receiver, property, desc);
        } else {
          _defineProperty(receiver, property, value);
        }

        return true;
      };
    }

    return set(target, property, value, receiver);
  }

  function _set(target, property, value, receiver, isStrict) {
    var s = set(target, property, value, receiver || target);

    if (!s && isStrict) {
      throw new Error('failed to set property');
    }

    return value;
  }

  function _slicedToArray(arr, i) {
    return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest();
  }

  function _arrayWithHoles(arr) {
    if (Array.isArray(arr)) return arr;
  }

  function _iterableToArrayLimit(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"] != null) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance");
  }

  /** Checks if value is string */
  function isString(str) {
    return typeof str === 'string' || str instanceof String;
  }
  /**
    Direction
    @prop {string} NONE
    @prop {string} LEFT
    @prop {string} FORCE_LEFT
    @prop {string} RIGHT
    @prop {string} FORCE_RIGHT
  */

  var DIRECTION = {
    NONE: 'NONE',
    LEFT: 'LEFT',
    FORCE_LEFT: 'FORCE_LEFT',
    RIGHT: 'RIGHT',
    FORCE_RIGHT: 'FORCE_RIGHT'
    /**
      Direction
      @enum {string}
    */

  };

  /** Returns next char index in direction */
  function indexInDirection(pos, direction) {
    if (direction === DIRECTION.LEFT) --pos;
    return pos;
  }
  /** Returns next char position in direction */

  function posInDirection(pos, direction) {
    switch (direction) {
      case DIRECTION.LEFT:
      case DIRECTION.FORCE_LEFT:
        return --pos;

      case DIRECTION.RIGHT:
      case DIRECTION.FORCE_RIGHT:
        return ++pos;

      default:
        return pos;
    }
  }
  /** */

  function forceDirection(direction) {
    switch (direction) {
      case DIRECTION.LEFT:
        return DIRECTION.FORCE_LEFT;

      case DIRECTION.RIGHT:
        return DIRECTION.FORCE_RIGHT;

      default:
        return direction;
    }
  }
  /** Escapes regular expression control chars */

  function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1');
  } // cloned from https://github.com/epoberezkin/fast-deep-equal with small changes

  function objectIncludes(b, a) {
    if (a === b) return true;
    var arrA = Array.isArray(a),
        arrB = Array.isArray(b),
        i;

    if (arrA && arrB) {
      if (a.length != b.length) return false;

      for (i = 0; i < a.length; i++) {
        if (!objectIncludes(a[i], b[i])) return false;
      }

      return true;
    }

    if (arrA != arrB) return false;

    if (a && b && _typeof(a) === 'object' && _typeof(b) === 'object') {
      var dateA = a instanceof Date,
          dateB = b instanceof Date;
      if (dateA && dateB) return a.getTime() == b.getTime();
      if (dateA != dateB) return false;
      var regexpA = a instanceof RegExp,
          regexpB = b instanceof RegExp;
      if (regexpA && regexpB) return a.toString() == b.toString();
      if (regexpA != regexpB) return false;
      var keys = Object.keys(a); // if (keys.length !== Object.keys(b).length) return false;

      for (i = 0; i < keys.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
      }

      for (i = 0; i < keys.length; i++) {
        if (!objectIncludes(b[keys[i]], a[keys[i]])) return false;
      }

      return true;
    }

    return false;
  }
  /* eslint-disable no-undef */

  var g = typeof window !== 'undefined' && window || typeof global !== 'undefined' && global.global === global && global || typeof self !== 'undefined' && self.self === self && self || {};
  /* eslint-enable no-undef */

  /** Selection range */

  /** Provides details of changing input */

  var ActionDetails =
  /*#__PURE__*/
  function () {
    /** Current input value */

    /** Current cursor position */

    /** Old input value */

    /** Old selection */
    function ActionDetails(value, cursorPos, oldValue, oldSelection) {
      _classCallCheck(this, ActionDetails);

      this.value = value;
      this.cursorPos = cursorPos;
      this.oldValue = oldValue;
      this.oldSelection = oldSelection; // double check if left part was changed (autofilling, other non-standard input triggers)

      while (this.value.slice(0, this.startChangePos) !== this.oldValue.slice(0, this.startChangePos)) {
        --this.oldSelection.start;
      }
    }
    /**
      Start changing position
      @readonly
    */


    _createClass(ActionDetails, [{
      key: "startChangePos",
      get: function get() {
        return Math.min(this.cursorPos, this.oldSelection.start);
      }
      /**
        Inserted symbols count
        @readonly
      */

    }, {
      key: "insertedCount",
      get: function get() {
        return this.cursorPos - this.startChangePos;
      }
      /**
        Inserted symbols
        @readonly
      */

    }, {
      key: "inserted",
      get: function get() {
        return this.value.substr(this.startChangePos, this.insertedCount);
      }
      /**
        Removed symbols count
        @readonly
      */

    }, {
      key: "removedCount",
      get: function get() {
        // Math.max for opposite operation
        return Math.max(this.oldSelection.end - this.startChangePos || // for Delete
        this.oldValue.length - this.value.length, 0);
      }
      /**
        Removed symbols
        @readonly
      */

    }, {
      key: "removed",
      get: function get() {
        return this.oldValue.substr(this.startChangePos, this.removedCount);
      }
      /**
        Unchanged head symbols
        @readonly
      */

    }, {
      key: "head",
      get: function get() {
        return this.value.substring(0, this.startChangePos);
      }
      /**
        Unchanged tail symbols
        @readonly
      */

    }, {
      key: "tail",
      get: function get() {
        return this.value.substring(this.startChangePos + this.insertedCount);
      }
      /**
        Remove direction
        @readonly
      */

    }, {
      key: "removeDirection",
      get: function get() {
        if (!this.removedCount || this.insertedCount) return DIRECTION.NONE; // align right if delete at right or if range removed (event with backspace)

        return this.oldSelection.end === this.cursorPos || this.oldSelection.start === this.cursorPos ? DIRECTION.RIGHT : DIRECTION.LEFT;
      }
    }]);

    return ActionDetails;
  }();

  /**
    Provides details of changing model value
    @param {Object} [details]
    @param {string} [details.inserted] - Inserted symbols
    @param {boolean} [details.skip] - Can skip chars
    @param {number} [details.removeCount] - Removed symbols count
    @param {number} [details.tailShift] - Additional offset if any changes occurred before tail
  */
  var ChangeDetails =
  /*#__PURE__*/
  function () {
    /** Inserted symbols */

    /** Can skip chars */

    /** Additional offset if any changes occurred before tail */

    /** Raw inserted is used by dynamic mask */
    function ChangeDetails(details) {
      _classCallCheck(this, ChangeDetails);

      _extends(this, {
        inserted: '',
        rawInserted: '',
        skip: false,
        tailShift: 0
      }, details);
    }
    /**
      Aggregate changes
      @returns {ChangeDetails} `this`
    */


    _createClass(ChangeDetails, [{
      key: "aggregate",
      value: function aggregate(details) {
        this.rawInserted += details.rawInserted;
        this.skip = this.skip || details.skip;
        this.inserted += details.inserted;
        this.tailShift += details.tailShift;
        return this;
      }
      /** Total offset considering all changes */

    }, {
      key: "offset",
      get: function get() {
        return this.tailShift + this.inserted.length;
      }
    }]);

    return ChangeDetails;
  }();

  /** Provides common masking stuff */
  var Masked =
  /*#__PURE__*/
  function () {
    // $Shape<MaskedOptions>; TODO after fix https://github.com/facebook/flow/issues/4773

    /** @type {Mask} */

    /** */
    // $FlowFixMe TODO no ideas

    /** Transforms value before mask processing */

    /** Validates if value is acceptable */

    /** Does additional processing in the end of editing */

    /** */
    function Masked(opts) {
      _classCallCheck(this, Masked);

      this._value = '';

      this._update(opts);

      this.isInitialized = true;
    }
    /** Sets and applies new options */


    _createClass(Masked, [{
      key: "updateOptions",
      value: function updateOptions(opts) {
        if (!Object.keys(opts).length) return;
        this.withValueRefresh(this._update.bind(this, opts));
      }
      /**
        Sets new options
        @protected
      */

    }, {
      key: "_update",
      value: function _update(opts) {
        _extends(this, opts);
      }
      /** Mask state */

    }, {
      key: "reset",

      /** Resets value */
      value: function reset() {
        this._value = '';
      }
      /** */

    }, {
      key: "resolve",

      /** Resolve new value */
      value: function resolve(value) {
        this.reset();
        this.append(value, {
          input: true
        }, {
          value: ''
        });
        this.doCommit();
        return this.value;
      }
      /** */

    }, {
      key: "nearestInputPos",

      /** Finds nearest input position in direction */
      value: function nearestInputPos(cursorPos, direction) {
        return cursorPos;
      }
      /** Extracts value in range considering flags */

    }, {
      key: "extractInput",
      value: function extractInput() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        return this.value.slice(fromPos, toPos);
      }
      /** Extracts tail in range */

    }, {
      key: "extractTail",
      value: function extractTail() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        return {
          value: this.extractInput(fromPos, toPos)
        };
      }
      /** Stores state before tail */

    }, {
      key: "_storeBeforeTailState",
      value: function _storeBeforeTailState() {
        this._beforeTailState = this.state;
      }
      /** Restores state before tail */

    }, {
      key: "_restoreBeforeTailState",
      value: function _restoreBeforeTailState() {
        this.state = this._beforeTailState;
      }
      /** Resets state before tail */

    }, {
      key: "_resetBeforeTailState",
      value: function _resetBeforeTailState() {
        this._beforeTailState = null;
      }
      /** Appends tail */

    }, {
      key: "appendTail",
      value: function appendTail(tail) {
        return this.append(tail ? tail.value : '', {
          tail: true
        });
      }
      /** Appends char */

    }, {
      key: "_appendCharRaw",
      value: function _appendCharRaw(ch) {
        this._value += ch;
        return new ChangeDetails({
          inserted: ch,
          rawInserted: ch
        });
      }
      /** Appends char */

    }, {
      key: "_appendChar",
      value: function _appendChar(ch) {
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var checkTail = arguments.length > 2 ? arguments[2] : undefined;
        ch = this.doPrepare(ch, flags);
        if (!ch) return new ChangeDetails();
        var consistentState = this.state;

        var details = this._appendCharRaw(ch, flags);

        if (details.inserted) {
          var appended = this.doValidate(flags) !== false;

          if (appended && checkTail != null) {
            // validation ok, check tail
            this._storeBeforeTailState();

            var tailDetails = this.appendTail(checkTail);
            appended = tailDetails.rawInserted === checkTail.value; // if ok, rollback state after tail

            if (appended && tailDetails.inserted) this._restoreBeforeTailState();
          } // revert all if something went wrong


          if (!appended) {
            details.rawInserted = details.inserted = '';
            this.state = consistentState;
          }
        }

        return details;
      }
      /** Appends symbols considering flags */

    }, {
      key: "append",
      value: function append(str, flags, tail) {
        var oldValueLength = this.value.length;
        var details = new ChangeDetails();

        for (var ci = 0; ci < str.length; ++ci) {
          details.aggregate(this._appendChar(str[ci], flags, tail));
        } // append tail but aggregate only tailShift


        if (tail != null) {
          this._storeBeforeTailState();

          details.tailShift += this.appendTail(tail).tailShift; // TODO it's a good idea to clear state after appending ends
          // but it causes bugs when one append calls another (when dynamic dispatch set rawInputValue)
          // this._resetBeforeTailState();
        }

        return details;
      }
      /** */

    }, {
      key: "remove",
      value: function remove() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        this._value = this.value.slice(0, fromPos) + this.value.slice(toPos);
        return new ChangeDetails();
      }
      /** Calls function and reapplies current value */

    }, {
      key: "withValueRefresh",
      value: function withValueRefresh(fn) {
        if (this._refreshing || !this.isInitialized) return fn();
        this._refreshing = true;
        var unmasked = this.unmaskedValue;
        var value = this.value;
        var ret = fn(); // try to update with raw value first to keep fixed chars

        if (this.resolve(value) !== value) {
          // or fallback to unmasked
          this.unmaskedValue = unmasked;
        }

        delete this._refreshing;
        return ret;
      }
      /**
        Prepares string before mask processing
        @protected
      */

    }, {
      key: "doPrepare",
      value: function doPrepare(str) {
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        return this.prepare ? this.prepare(str, this, flags) : str;
      }
      /**
        Validates if value is acceptable
        @protected
      */

    }, {
      key: "doValidate",
      value: function doValidate(flags) {
        return (!this.validate || this.validate(this.value, this, flags)) && (!this.parent || this.parent.doValidate(flags));
      }
      /**
        Does additional processing in the end of editing
        @protected
      */

    }, {
      key: "doCommit",
      value: function doCommit() {
        if (this.commit) this.commit(this.value, this);
      }
      /** */

    }, {
      key: "splice",
      value: function splice(start, deleteCount, inserted, removeDirection) {
        var tailPos = start + deleteCount;
        var tail = this.extractTail(tailPos);
        var startChangePos = this.nearestInputPos(start, removeDirection);
        var changeDetails = new ChangeDetails({
          tailShift: startChangePos - start // adjust tailShift if start was aligned

        }).aggregate(this.remove(startChangePos)).aggregate(this.append(inserted, {
          input: true
        }, tail));
        return changeDetails;
      }
    }, {
      key: "state",
      get: function get() {
        return {
          _value: this.value
        };
      },
      set: function set(state) {
        this._value = state._value;
      }
    }, {
      key: "value",
      get: function get() {
        return this._value;
      },
      set: function set(value) {
        this.resolve(value);
      }
    }, {
      key: "unmaskedValue",
      get: function get() {
        return this.value;
      },
      set: function set(value) {
        this.reset();
        this.append(value, {}, {
          value: ''
        });
        this.doCommit();
      }
      /** */

    }, {
      key: "typedValue",
      get: function get() {
        return this.unmaskedValue;
      },
      set: function set(value) {
        this.unmaskedValue = value;
      }
      /** Value that includes raw user input */

    }, {
      key: "rawInputValue",
      get: function get() {
        return this.extractInput(0, this.value.length, {
          raw: true
        });
      },
      set: function set(value) {
        this.reset();
        this.append(value, {
          raw: true
        }, {
          value: ''
        });
        this.doCommit();
      }
      /** */

    }, {
      key: "isComplete",
      get: function get() {
        return true;
      }
    }]);

    return Masked;
  }();

  /** Get Masked class by mask type */
  function maskedClass(mask) {
    if (mask == null) {
      throw new Error('mask property should be defined');
    }

    if (mask instanceof RegExp) return g.IMask.MaskedRegExp;
    if (isString(mask)) return g.IMask.MaskedPattern;
    if (mask instanceof Date || mask === Date) return g.IMask.MaskedDate;
    if (mask instanceof Number || typeof mask === 'number' || mask === Number) return g.IMask.MaskedNumber;
    if (Array.isArray(mask) || mask === Array) return g.IMask.MaskedDynamic; // $FlowFixMe

    if (mask.prototype instanceof g.IMask.Masked) return mask; // $FlowFixMe

    if (mask instanceof Function) return g.IMask.MaskedFunction;
    console.warn('Mask not found for mask', mask); // eslint-disable-line no-console

    return g.IMask.Masked;
  }
  /** Creates new {@link Masked} depending on mask type */

  function createMask(opts) {
    opts = _objectSpread({}, opts);
    var mask = opts.mask;
    if (mask instanceof g.IMask.Masked) return mask;
    var MaskedClass = maskedClass(mask);
    return new MaskedClass(opts);
  }

  var DEFAULT_INPUT_DEFINITIONS = {
    '0': /\d/,
    'a': /[\u0041-\u005A\u0061-\u007A\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0\u08A2-\u08AC\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097F\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191C\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA697\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA80-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/,
    // http://stackoverflow.com/a/22075070
    '*': /./
  };
  /** */

  var PatternInputDefinition =
  /*#__PURE__*/
  function () {
    /** */

    /** */

    /** */

    /** */

    /** */

    /** */
    function PatternInputDefinition(opts) {
      _classCallCheck(this, PatternInputDefinition);

      var mask = opts.mask,
          blockOpts = _objectWithoutProperties(opts, ["mask"]);

      this.masked = createMask({
        mask: mask
      });

      _extends(this, blockOpts);
    }

    _createClass(PatternInputDefinition, [{
      key: "reset",
      value: function reset() {
        this._isFilled = false;
        this.masked.reset();
      }
    }, {
      key: "remove",
      value: function remove() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;

        if (fromPos === 0 && toPos >= 1) {
          this._isFilled = false;
          return this.masked.remove(fromPos, toPos);
        }

        return new ChangeDetails();
      }
    }, {
      key: "_appendChar",
      value: function _appendChar(str) {
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        if (this._isFilled) return new ChangeDetails();
        var state = this.masked.state; // simulate input

        var details = this.masked._appendChar(str, flags);

        if (details.inserted && this.doValidate(flags) === false) {
          details.inserted = details.rawInserted = '';
          this.masked.state = state;
        }

        if (!details.inserted && !this.isOptional && !this.lazy && !flags.input) {
          details.inserted = this.placeholderChar;
        }

        details.skip = !details.inserted && !this.isOptional;
        this._isFilled = Boolean(details.inserted);
        return details;
      }
    }, {
      key: "_appendPlaceholder",
      value: function _appendPlaceholder() {
        var details = new ChangeDetails();
        if (this._isFilled || this.isOptional) return details;
        this._isFilled = true;
        details.inserted = this.placeholderChar;
        return details;
      }
    }, {
      key: "extractTail",
      value: function extractTail() {
        var _this$masked;

        return (_this$masked = this.masked).extractTail.apply(_this$masked, arguments);
      }
    }, {
      key: "appendTail",
      value: function appendTail() {
        var _this$masked2;

        return (_this$masked2 = this.masked).appendTail.apply(_this$masked2, arguments);
      }
    }, {
      key: "extractInput",
      value: function extractInput() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        var flags = arguments.length > 2 ? arguments[2] : undefined;
        return this.masked.extractInput(fromPos, toPos, flags);
      }
    }, {
      key: "nearestInputPos",
      value: function nearestInputPos(cursorPos) {
        var direction = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DIRECTION.NONE;
        var minPos = 0;
        var maxPos = this.value.length;
        var boundPos = Math.min(Math.max(cursorPos, minPos), maxPos);

        switch (direction) {
          case DIRECTION.LEFT:
          case DIRECTION.FORCE_LEFT:
            return this.isComplete ? boundPos : minPos;

          case DIRECTION.RIGHT:
          case DIRECTION.FORCE_RIGHT:
            return this.isComplete ? boundPos : maxPos;

          case DIRECTION.NONE:
          default:
            return boundPos;
        }
      }
    }, {
      key: "doValidate",
      value: function doValidate() {
        var _this$masked3, _this$parent;

        return (_this$masked3 = this.masked).doValidate.apply(_this$masked3, arguments) && (!this.parent || (_this$parent = this.parent).doValidate.apply(_this$parent, arguments));
      }
    }, {
      key: "doCommit",
      value: function doCommit() {
        this.masked.doCommit();
      }
    }, {
      key: "value",
      get: function get() {
        return this.masked.value || (this._isFilled && !this.isOptional ? this.placeholderChar : '');
      }
    }, {
      key: "unmaskedValue",
      get: function get() {
        return this.masked.unmaskedValue;
      }
    }, {
      key: "isComplete",
      get: function get() {
        return Boolean(this.masked.value) || this.isOptional;
      }
    }, {
      key: "state",
      get: function get() {
        return {
          masked: this.masked.state,
          _isFilled: this._isFilled
        };
      },
      set: function set(state) {
        this.masked.state = state.masked;
        this._isFilled = state._isFilled;
      }
    }]);

    return PatternInputDefinition;
  }();

  var PatternFixedDefinition =
  /*#__PURE__*/
  function () {
    /** */

    /** */

    /** */

    /** */
    function PatternFixedDefinition(opts) {
      _classCallCheck(this, PatternFixedDefinition);

      _extends(this, opts);

      this._value = '';
    }

    _createClass(PatternFixedDefinition, [{
      key: "reset",
      value: function reset() {
        this._isRawInput = false;
        this._value = '';
      }
    }, {
      key: "remove",
      value: function remove() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this._value.length;
        this._value = this._value.slice(0, fromPos) + this._value.slice(toPos);
        if (!this._value) this._isRawInput = false;
        return new ChangeDetails();
      }
    }, {
      key: "nearestInputPos",
      value: function nearestInputPos(cursorPos) {
        var direction = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DIRECTION.NONE;
        var minPos = 0;
        var maxPos = this._value.length;

        switch (direction) {
          case DIRECTION.LEFT:
          case DIRECTION.FORCE_LEFT:
            return minPos;

          case DIRECTION.NONE:
          case DIRECTION.RIGHT:
          case DIRECTION.FORCE_RIGHT:
          default:
            return maxPos;
        }
      }
    }, {
      key: "extractInput",
      value: function extractInput() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this._value.length;
        var flags = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
        return flags.raw && this._isRawInput && this._value.slice(fromPos, toPos) || '';
      }
    }, {
      key: "_appendChar",
      value: function _appendChar(str, flags) {
        var details = new ChangeDetails();
        if (this._value) return details;
        var appended = this.char === str[0];
        var isResolved = appended && (this.isUnmasking || flags.input || flags.raw) && !flags.tail;
        if (isResolved) details.rawInserted = this.char;
        this._value = details.inserted = this.char;
        this._isRawInput = isResolved && (flags.raw || flags.input);
        return details;
      }
    }, {
      key: "_appendPlaceholder",
      value: function _appendPlaceholder() {
        var details = new ChangeDetails();
        if (this._value) return details;
        this._value = details.inserted = this.char;
        return details;
      }
    }, {
      key: "extractTail",
      value: function extractTail() {
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        return {
          value: ''
        };
      }
    }, {
      key: "appendTail",
      value: function appendTail(tail) {
        return this._appendChar(tail ? tail.value : '', {
          tail: true
        });
      }
    }, {
      key: "doCommit",
      value: function doCommit() {}
    }, {
      key: "value",
      get: function get() {
        return this._value;
      }
    }, {
      key: "unmaskedValue",
      get: function get() {
        return this.isUnmasking ? this.value : '';
      }
    }, {
      key: "isComplete",
      get: function get() {
        return true;
      }
    }, {
      key: "state",
      get: function get() {
        return {
          _value: this._value,
          _isRawInput: this._isRawInput
        };
      },
      set: function set(state) {
        _extends(this, state);
      }
    }]);

    return PatternFixedDefinition;
  }();

  var ChunksTailDetails =
  /*#__PURE__*/
  function () {
    function ChunksTailDetails(chunks) {
      _classCallCheck(this, ChunksTailDetails);

      this.chunks = chunks;
    }

    _createClass(ChunksTailDetails, [{
      key: "value",
      get: function get() {
        return this.chunks.map(function (c) {
          return c.value;
        }).join('');
      }
    }]);

    return ChunksTailDetails;
  }();

  /**
    Pattern mask
    @param {Object} opts
    @param {Object} opts.blocks
    @param {Object} opts.definitions
    @param {string} opts.placeholderChar
    @param {boolean} opts.lazy
  */
  var MaskedPattern =
  /*#__PURE__*/
  function (_Masked) {
    _inherits(MaskedPattern, _Masked);

    /** */

    /** */

    /** Single char for empty input */

    /** Show placeholder only when needed */
    function MaskedPattern() {
      var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      _classCallCheck(this, MaskedPattern);

      // TODO type $Shape<MaskedPatternOptions>={} does not work
      opts.definitions = _extends({}, DEFAULT_INPUT_DEFINITIONS, opts.definitions);
      return _possibleConstructorReturn(this, _getPrototypeOf(MaskedPattern).call(this, _objectSpread({}, MaskedPattern.DEFAULTS, opts)));
    }
    /**
      @override
      @param {Object} opts
    */


    _createClass(MaskedPattern, [{
      key: "_update",
      value: function _update() {
        var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        opts.definitions = _extends({}, this.definitions, opts.definitions);

        _get(_getPrototypeOf(MaskedPattern.prototype), "_update", this).call(this, opts);

        this._rebuildMask();
      }
      /** */

    }, {
      key: "_rebuildMask",
      value: function _rebuildMask() {
        var _this = this;

        var defs = this.definitions;
        this._blocks = [];
        this._stops = [];
        this._maskedBlocks = {};
        var pattern = this.mask;
        if (!pattern || !defs) return;
        var unmaskingBlock = false;
        var optionalBlock = false;

        for (var i = 0; i < pattern.length; ++i) {
          if (this.blocks) {
            var _ret = function () {
              var p = pattern.slice(i);
              var bNames = Object.keys(_this.blocks).filter(function (bName) {
                return p.indexOf(bName) === 0;
              }); // order by key length

              bNames.sort(function (a, b) {
                return b.length - a.length;
              }); // use block name with max length

              var bName = bNames[0];

              if (bName) {
                var maskedBlock = createMask(_objectSpread({
                  parent: _this,
                  lazy: _this.lazy,
                  placeholderChar: _this.placeholderChar
                }, _this.blocks[bName]));

                if (maskedBlock) {
                  _this._blocks.push(maskedBlock); // store block index


                  if (!_this._maskedBlocks[bName]) _this._maskedBlocks[bName] = [];

                  _this._maskedBlocks[bName].push(_this._blocks.length - 1);
                }

                i += bName.length - 1;
                return "continue";
              }
            }();

            if (_ret === "continue") continue;
          }

          var char = pattern[i];

          var _isInput = char in defs;

          if (char === MaskedPattern.STOP_CHAR) {
            this._stops.push(this._blocks.length);

            continue;
          }

          if (char === '{' || char === '}') {
            unmaskingBlock = !unmaskingBlock;
            continue;
          }

          if (char === '[' || char === ']') {
            optionalBlock = !optionalBlock;
            continue;
          }

          if (char === MaskedPattern.ESCAPE_CHAR) {
            ++i;
            char = pattern[i];
            if (!char) break;
            _isInput = false;
          }

          var def = void 0;

          if (_isInput) {
            def = new PatternInputDefinition({
              parent: this,
              lazy: this.lazy,
              placeholderChar: this.placeholderChar,
              mask: defs[char],
              isOptional: optionalBlock
            });
          } else {
            def = new PatternFixedDefinition({
              char: char,
              isUnmasking: unmaskingBlock
            });
          }

          this._blocks.push(def);
        }
      }
      /**
        @override
      */

    }, {
      key: "_storeBeforeTailState",

      /**
        @override
      */
      value: function _storeBeforeTailState() {
        this._blocks.forEach(function (b) {
          // $FlowFixMe _storeBeforeTailState is not exist in PatternBlock
          if (typeof b._storeBeforeTailState === 'function') {
            b._storeBeforeTailState();
          }
        });

        _get(_getPrototypeOf(MaskedPattern.prototype), "_storeBeforeTailState", this).call(this);
      }
      /**
        @override
      */

    }, {
      key: "_restoreBeforeTailState",
      value: function _restoreBeforeTailState() {
        this._blocks.forEach(function (b) {
          // $FlowFixMe _restoreBeforeTailState is not exist in PatternBlock
          if (typeof b._restoreBeforeTailState === 'function') {
            b._restoreBeforeTailState();
          }
        });

        _get(_getPrototypeOf(MaskedPattern.prototype), "_restoreBeforeTailState", this).call(this);
      }
      /**
        @override
      */

    }, {
      key: "_resetBeforeTailState",
      value: function _resetBeforeTailState() {
        this._blocks.forEach(function (b) {
          // $FlowFixMe _resetBeforeTailState is not exist in PatternBlock
          if (typeof b._resetBeforeTailState === 'function') {
            b._resetBeforeTailState();
          }
        });

        _get(_getPrototypeOf(MaskedPattern.prototype), "_resetBeforeTailState", this).call(this);
      }
      /**
        @override
      */

    }, {
      key: "reset",
      value: function reset() {
        _get(_getPrototypeOf(MaskedPattern.prototype), "reset", this).call(this);

        this._blocks.forEach(function (b) {
          return b.reset();
        });
      }
      /**
        @override
      */

    }, {
      key: "doCommit",

      /**
        @override
      */
      value: function doCommit() {
        this._blocks.forEach(function (b) {
          return b.doCommit();
        });

        _get(_getPrototypeOf(MaskedPattern.prototype), "doCommit", this).call(this);
      }
      /**
        @override
      */

    }, {
      key: "appendTail",

      /**
        @override
      */
      value: function appendTail(tail) {
        var details = new ChangeDetails();

        if (tail) {
          details.aggregate(tail instanceof ChunksTailDetails ? this._appendTailChunks(tail.chunks) : _get(_getPrototypeOf(MaskedPattern.prototype), "appendTail", this).call(this, tail));
        }

        return details.aggregate(this._appendPlaceholder());
      }
      /**
        @override
      */

    }, {
      key: "_appendCharRaw",
      value: function _appendCharRaw(ch) {
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var blockData = this._mapPosToBlock(this.value.length);

        var details = new ChangeDetails();
        if (!blockData) return details;

        for (var bi = blockData.index;; ++bi) {
          var _block = this._blocks[bi];
          if (!_block) break;

          var blockDetails = _block._appendChar(ch, flags);

          var skip = blockDetails.skip;
          details.aggregate(blockDetails);
          if (skip || blockDetails.rawInserted) break; // go next char
        }

        return details;
      }
      /** Appends chunks splitted by stop chars */

    }, {
      key: "_appendTailChunks",
      value: function _appendTailChunks(chunks) {
        var details = new ChangeDetails();

        for (var ci = 0; ci < chunks.length && !details.skip; ++ci) {
          var chunk = chunks[ci];

          var lastBlock = this._mapPosToBlock(this.value.length);

          var chunkBlock = chunk instanceof ChunksTailDetails && chunk.index != null && (!lastBlock || lastBlock.index <= chunk.index) && this._blocks[chunk.index];

          if (chunkBlock) {
            // $FlowFixMe we already check index above
            details.aggregate(this._appendPlaceholder(chunk.index));
            var tailDetails = chunkBlock.appendTail(chunk);
            tailDetails.skip = false; // always ignore skip, it will be set on last

            details.aggregate(tailDetails);
            this._value += tailDetails.inserted; // get not inserted chars

            var remainChars = chunk.value.slice(tailDetails.rawInserted.length);
            if (remainChars) details.aggregate(this.append(remainChars, {
              tail: true
            }));
          } else {
            var _ref = chunk,
                stop = _ref.stop,
                value = _ref.value;
            if (stop != null && this._stops.indexOf(stop) >= 0) details.aggregate(this._appendPlaceholder(stop));
            details.aggregate(this.append(value, {
              tail: true
            }));
          }
        }
        return details;
      }
      /**
        @override
      */

    }, {
      key: "extractTail",
      value: function extractTail() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        return new ChunksTailDetails(this._extractTailChunks(fromPos, toPos));
      }
      /**
        @override
      */

    }, {
      key: "extractInput",
      value: function extractInput() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        var flags = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
        if (fromPos === toPos) return '';
        var input = '';

        this._forEachBlocksInRange(fromPos, toPos, function (b, _, fromPos, toPos) {
          input += b.extractInput(fromPos, toPos, flags);
        });

        return input;
      }
      /** Extracts chunks from input splitted by stop chars */

    }, {
      key: "_extractTailChunks",
      value: function _extractTailChunks() {
        var _this2 = this;

        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        if (fromPos === toPos) return [];
        var chunks = [];
        var lastChunk;

        this._forEachBlocksInRange(fromPos, toPos, function (b, bi, fromPos, toPos) {
          var blockChunk = b.extractTail(fromPos, toPos);
          var nearestStop;

          for (var si = 0; si < _this2._stops.length; ++si) {
            var stop = _this2._stops[si];
            if (stop <= bi) nearestStop = stop;else break;
          }

          if (blockChunk instanceof ChunksTailDetails) {
            // TODO append to lastChunk with same index
            if (nearestStop == null) {
              // try append floating chunks to existed lastChunk
              var headFloatChunksCount = blockChunk.chunks.length;

              for (var ci = 0; ci < blockChunk.chunks.length; ++ci) {
                if (blockChunk.chunks[ci].stop != null) {
                  headFloatChunksCount = ci;
                  break;
                }
              }

              var headFloatChunks = blockChunk.chunks.splice(0, headFloatChunksCount);
              headFloatChunks.filter(function (chunk) {
                return chunk.value;
              }).forEach(function (chunk) {
                if (lastChunk) lastChunk.value += chunk.value; // will flat nested chunks
                else lastChunk = {
                    value: chunk.value
                  };
              });
            } // if block chunk has stops


            if (blockChunk.chunks.length) {
              if (lastChunk) chunks.push(lastChunk);
              blockChunk.index = nearestStop;
              chunks.push(blockChunk); // we cant append to ChunksTailDetails, so just reset lastChunk to force adding new

              lastChunk = null;
            }
          } else {
            if (nearestStop != null) {
              // on middle chunks consider stop flag and do not consider value
              // add block even if it is empty
              if (lastChunk) chunks.push(lastChunk);
              blockChunk.stop = nearestStop;
            } else if (lastChunk) {
              lastChunk.value += blockChunk.value;
              return;
            }

            lastChunk = blockChunk;
          }
        });

        if (lastChunk && lastChunk.value) chunks.push(lastChunk);
        return chunks;
      }
      /** Appends placeholder depending on laziness */

    }, {
      key: "_appendPlaceholder",
      value: function _appendPlaceholder(toBlockIndex) {
        var _this3 = this;

        var details = new ChangeDetails();
        if (this.lazy && toBlockIndex == null) return details;

        var startBlockData = this._mapPosToBlock(this.value.length);

        if (!startBlockData) return details;
        var startBlockIndex = startBlockData.index;
        var endBlockIndex = toBlockIndex != null ? toBlockIndex : this._blocks.length;

        this._blocks.slice(startBlockIndex, endBlockIndex).forEach(function (b) {
          if (typeof b._appendPlaceholder === 'function') {
            // $FlowFixMe `_blocks` may not be present
            var args = b._blocks != null ? [b._blocks.length] : [];

            var bDetails = b._appendPlaceholder.apply(b, args);

            _this3._value += bDetails.inserted;
            details.aggregate(bDetails);
          }
        });

        return details;
      }
      /** Finds block in pos */

    }, {
      key: "_mapPosToBlock",
      value: function _mapPosToBlock(pos) {
        var accVal = '';

        for (var bi = 0; bi < this._blocks.length; ++bi) {
          var _block2 = this._blocks[bi];
          var blockStartPos = accVal.length;
          accVal += _block2.value;

          if (pos <= accVal.length) {
            return {
              index: bi,
              offset: pos - blockStartPos
            };
          }
        }
      }
      /** */

    }, {
      key: "_blockStartPos",
      value: function _blockStartPos(blockIndex) {
        return this._blocks.slice(0, blockIndex).reduce(function (pos, b) {
          return pos += b.value.length;
        }, 0);
      }
      /** */

    }, {
      key: "_forEachBlocksInRange",
      value: function _forEachBlocksInRange(fromPos) {
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        var fn = arguments.length > 2 ? arguments[2] : undefined;

        var fromBlock = this._mapPosToBlock(fromPos);

        if (fromBlock) {
          var toBlock = this._mapPosToBlock(toPos); // process first block


          var isSameBlock = toBlock && fromBlock.index === toBlock.index;
          var fromBlockRemoveBegin = fromBlock.offset;
          var fromBlockRemoveEnd = toBlock && isSameBlock ? toBlock.offset : undefined;
          fn(this._blocks[fromBlock.index], fromBlock.index, fromBlockRemoveBegin, fromBlockRemoveEnd);

          if (toBlock && !isSameBlock) {
            // process intermediate blocks
            for (var bi = fromBlock.index + 1; bi < toBlock.index; ++bi) {
              fn(this._blocks[bi], bi);
            } // process last block


            fn(this._blocks[toBlock.index], toBlock.index, 0, toBlock.offset);
          }
        }
      }
      /**
        @override
      */

    }, {
      key: "remove",
      value: function remove() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;

        var removeDetails = _get(_getPrototypeOf(MaskedPattern.prototype), "remove", this).call(this, fromPos, toPos);

        this._forEachBlocksInRange(fromPos, toPos, function (b, _, bFromPos, bToPos) {
          removeDetails.aggregate(b.remove(bFromPos, bToPos));
        });

        return removeDetails;
      }
      /**
        @override
      */

    }, {
      key: "nearestInputPos",
      value: function nearestInputPos(cursorPos) {
        var direction = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DIRECTION.NONE;
        // TODO refactor - extract alignblock
        var beginBlockData = this._mapPosToBlock(cursorPos) || {
          index: 0,
          offset: 0
        };
        var beginBlockOffset = beginBlockData.offset,
            beginBlockIndex = beginBlockData.index;
        var beginBlock = this._blocks[beginBlockIndex];
        if (!beginBlock) return cursorPos;
        var beginBlockCursorPos = beginBlockOffset; // if position inside block - try to adjust it

        if (beginBlockCursorPos !== 0 && beginBlockCursorPos < beginBlock.value.length) {
          beginBlockCursorPos = beginBlock.nearestInputPos(beginBlockOffset, forceDirection(direction));
        }

        var cursorAtRight = beginBlockCursorPos === beginBlock.value.length;
        var cursorAtLeft = beginBlockCursorPos === 0; //  cursor is INSIDE first block (not at bounds)

        if (!cursorAtLeft && !cursorAtRight) return this._blockStartPos(beginBlockIndex) + beginBlockCursorPos;
        var searchBlockIndex = cursorAtRight ? beginBlockIndex + 1 : beginBlockIndex;

        if (direction === DIRECTION.NONE) {
          // NONE direction used to calculate start input position if no chars were removed
          // FOR NONE:
          // -
          // input|any
          // ->
          //  any|input
          // <-
          //  filled-input|any
          // check if first block at left is input
          if (searchBlockIndex > 0) {
            var blockIndexAtLeft = searchBlockIndex - 1;
            var blockAtLeft = this._blocks[blockIndexAtLeft];
            var blockInputPos = blockAtLeft.nearestInputPos(0, DIRECTION.NONE); // is input

            if (!blockAtLeft.value.length || blockInputPos !== blockAtLeft.value.length) {
              return this._blockStartPos(searchBlockIndex);
            }
          } // ->


          var firstInputAtRight = searchBlockIndex;

          for (var bi = firstInputAtRight; bi < this._blocks.length; ++bi) {
            var _block3 = this._blocks[bi];

            var _blockInputPos = _block3.nearestInputPos(0, DIRECTION.NONE);

            if (_blockInputPos !== _block3.value.length) {
              return this._blockStartPos(bi) + _blockInputPos;
            }
          }

          return this.value.length;
        }

        if (direction === DIRECTION.LEFT || direction === DIRECTION.FORCE_LEFT) {
          // -
          //  any|filled-input
          // <-
          //  any|first not empty is not-len-aligned
          //  not-0-aligned|any
          // ->
          //  any|not-len-aligned or end
          // check if first block at right is filled input
          var firstFilledBlockIndexAtRight;

          for (var _bi = searchBlockIndex; _bi < this._blocks.length; ++_bi) {
            if (this._blocks[_bi].value) {
              firstFilledBlockIndexAtRight = _bi;
              break;
            }
          }

          if (firstFilledBlockIndexAtRight != null) {
            var filledBlock = this._blocks[firstFilledBlockIndexAtRight];

            var _blockInputPos2 = filledBlock.nearestInputPos(0, DIRECTION.RIGHT);

            if (_blockInputPos2 === 0 && filledBlock.unmaskedValue.length) {
              // filled block is input
              return this._blockStartPos(firstFilledBlockIndexAtRight) + _blockInputPos2;
            }
          } // <-
          // find this vars


          var firstFilledInputBlockIndex = -1;
          var firstEmptyInputBlockIndex; // TODO consider nested empty inputs

          for (var _bi2 = searchBlockIndex - 1; _bi2 >= 0; --_bi2) {
            var _block4 = this._blocks[_bi2];

            var _blockInputPos3 = _block4.nearestInputPos(_block4.value.length, DIRECTION.FORCE_LEFT);

            if (firstEmptyInputBlockIndex == null && (!_block4.value || _blockInputPos3 !== 0)) {
              firstEmptyInputBlockIndex = _bi2;
            }

            if (_blockInputPos3 !== 0) {
              if (_blockInputPos3 !== _block4.value.length) {
                // aligned inside block - return immediately
                return this._blockStartPos(_bi2) + _blockInputPos3;
              } else {
                // found filled
                firstFilledInputBlockIndex = _bi2;
                break;
              }
            }
          }

          if (direction === DIRECTION.LEFT) {
            // try find first empty input before start searching position only when not forced
            for (var _bi3 = firstFilledInputBlockIndex + 1; _bi3 <= Math.min(searchBlockIndex, this._blocks.length - 1); ++_bi3) {
              var _block5 = this._blocks[_bi3];

              var _blockInputPos4 = _block5.nearestInputPos(0, DIRECTION.NONE);

              var blockAlignedPos = this._blockStartPos(_bi3) + _blockInputPos4; // if block is empty and last or not lazy input


              if ((!_block5.value.length && blockAlignedPos === this.value.length || _blockInputPos4 !== _block5.value.length) && blockAlignedPos <= cursorPos) {
                return blockAlignedPos;
              }
            }
          } // process overflow


          if (firstFilledInputBlockIndex >= 0) {
            return this._blockStartPos(firstFilledInputBlockIndex) + this._blocks[firstFilledInputBlockIndex].value.length;
          } // for lazy if has aligned left inside fixed and has came to the start - use start position


          if (direction === DIRECTION.FORCE_LEFT || this.lazy && !this.extractInput() && !isInput(this._blocks[searchBlockIndex])) {
            return 0;
          }

          if (firstEmptyInputBlockIndex != null) {
            return this._blockStartPos(firstEmptyInputBlockIndex);
          } // find first input


          for (var _bi4 = searchBlockIndex; _bi4 < this._blocks.length; ++_bi4) {
            var _block6 = this._blocks[_bi4];

            var _blockInputPos5 = _block6.nearestInputPos(0, DIRECTION.NONE); // is input


            if (!_block6.value.length || _blockInputPos5 !== _block6.value.length) {
              return this._blockStartPos(_bi4) + _blockInputPos5;
            }
          }

          return 0;
        }

        if (direction === DIRECTION.RIGHT || direction === DIRECTION.FORCE_RIGHT) {
          // ->
          //  any|not-len-aligned and filled
          //  any|not-len-aligned
          // <-
          var firstInputBlockAlignedIndex;
          var firstInputBlockAlignedPos;

          for (var _bi5 = searchBlockIndex; _bi5 < this._blocks.length; ++_bi5) {
            var _block7 = this._blocks[_bi5];

            var _blockInputPos6 = _block7.nearestInputPos(0, DIRECTION.NONE);

            if (_blockInputPos6 !== _block7.value.length) {
              firstInputBlockAlignedPos = this._blockStartPos(_bi5) + _blockInputPos6;
              firstInputBlockAlignedIndex = _bi5;
              break;
            }
          }

          if (firstInputBlockAlignedIndex != null && firstInputBlockAlignedPos != null) {
            for (var _bi6 = firstInputBlockAlignedIndex; _bi6 < this._blocks.length; ++_bi6) {
              var _block8 = this._blocks[_bi6];

              var _blockInputPos7 = _block8.nearestInputPos(0, DIRECTION.FORCE_RIGHT);

              if (_blockInputPos7 !== _block8.value.length) {
                return this._blockStartPos(_bi6) + _blockInputPos7;
              }
            }

            return direction === DIRECTION.FORCE_RIGHT ? this.value.length : firstInputBlockAlignedPos;
          }

          for (var _bi7 = Math.min(searchBlockIndex, this._blocks.length - 1); _bi7 >= 0; --_bi7) {
            var _block9 = this._blocks[_bi7];

            var _blockInputPos8 = _block9.nearestInputPos(_block9.value.length, DIRECTION.LEFT);

            if (_blockInputPos8 !== 0) {
              var alignedPos = this._blockStartPos(_bi7) + _blockInputPos8;

              if (alignedPos >= cursorPos) return alignedPos;
              break;
            }
          }
        }

        return cursorPos;
      }
      /** Get block by name */

    }, {
      key: "maskedBlock",
      value: function maskedBlock(name) {
        return this.maskedBlocks(name)[0];
      }
      /** Get all blocks by name */

    }, {
      key: "maskedBlocks",
      value: function maskedBlocks(name) {
        var _this4 = this;

        var indices = this._maskedBlocks[name];
        if (!indices) return [];
        return indices.map(function (gi) {
          return _this4._blocks[gi];
        });
      }
    }, {
      key: "state",
      get: function get$$1() {
        return _objectSpread({}, _get(_getPrototypeOf(MaskedPattern.prototype), "state", this), {
          _blocks: this._blocks.map(function (b) {
            return b.state;
          })
        });
      },
      set: function set$$1(state) {
        var _blocks = state._blocks,
            maskedState = _objectWithoutProperties(state, ["_blocks"]);

        this._blocks.forEach(function (b, bi) {
          return b.state = _blocks[bi];
        });

        _set(_getPrototypeOf(MaskedPattern.prototype), "state", maskedState, this, true);
      }
    }, {
      key: "isComplete",
      get: function get$$1() {
        return this._blocks.every(function (b) {
          return b.isComplete;
        });
      }
    }, {
      key: "unmaskedValue",
      get: function get$$1() {
        return this._blocks.reduce(function (str, b) {
          return str += b.unmaskedValue;
        }, '');
      },
      set: function set$$1(unmaskedValue) {
        _set(_getPrototypeOf(MaskedPattern.prototype), "unmaskedValue", unmaskedValue, this, true);
      }
      /**
        @override
      */

    }, {
      key: "value",
      get: function get$$1() {
        // TODO return _value when not in change?
        return this._blocks.reduce(function (str, b) {
          return str += b.value;
        }, '');
      },
      set: function set$$1(value) {
        _set(_getPrototypeOf(MaskedPattern.prototype), "value", value, this, true);
      }
    }]);

    return MaskedPattern;
  }(Masked);
  MaskedPattern.DEFAULTS = {
    lazy: true,
    placeholderChar: '_'
  };
  MaskedPattern.STOP_CHAR = '`';
  MaskedPattern.ESCAPE_CHAR = '\\';
  MaskedPattern.InputDefinition = PatternInputDefinition;
  MaskedPattern.FixedDefinition = PatternFixedDefinition;

  function isInput(block) {
    if (!block) return false;
    var value = block.value;
    return !value || block.nearestInputPos(0, DIRECTION.NONE) !== value.length;
  }

  /** Pattern which accepts ranges */

  var MaskedRange =
  /*#__PURE__*/
  function (_MaskedPattern) {
    _inherits(MaskedRange, _MaskedPattern);

    function MaskedRange() {
      _classCallCheck(this, MaskedRange);

      return _possibleConstructorReturn(this, _getPrototypeOf(MaskedRange).apply(this, arguments));
    }

    _createClass(MaskedRange, [{
      key: "_update",

      /**
        @override
      */
      value: function _update(opts) {
        // TODO type
        opts = _objectSpread({
          to: this.to || 0,
          from: this.from || 0
        }, opts);
        var maxLength = String(opts.to).length;
        if (opts.maxLength != null) maxLength = Math.max(maxLength, opts.maxLength);
        opts.maxLength = maxLength;
        var toStr = String(opts.to).padStart(maxLength, '0');
        var fromStr = String(opts.from).padStart(maxLength, '0');
        var sameCharsCount = 0;

        while (sameCharsCount < toStr.length && toStr[sameCharsCount] === fromStr[sameCharsCount]) {
          ++sameCharsCount;
        }

        opts.mask = toStr.slice(0, sameCharsCount).replace(/0/g, '\\0') + '0'.repeat(maxLength - sameCharsCount);

        _get(_getPrototypeOf(MaskedRange.prototype), "_update", this).call(this, opts);
      }
      /**
        @override
      */

    }, {
      key: "doValidate",

      /**
        @override
      */
      value: function doValidate() {
        var _get2;

        var str = this.value;
        var minstr = '';
        var maxstr = '';

        var _ref = str.match(/^(\D*)(\d*)(\D*)/) || [],
            _ref2 = _slicedToArray(_ref, 3),
            placeholder = _ref2[1],
            num = _ref2[2];

        if (num) {
          minstr = '0'.repeat(placeholder.length) + num;
          maxstr = '9'.repeat(placeholder.length) + num;
        }

        var firstNonZero = str.search(/[^0]/);
        if (firstNonZero === -1 && str.length <= this._matchFrom) return true;
        minstr = minstr.padEnd(this.maxLength, '0');
        maxstr = maxstr.padEnd(this.maxLength, '9');

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        return this.from <= Number(maxstr) && Number(minstr) <= this.to && (_get2 = _get(_getPrototypeOf(MaskedRange.prototype), "doValidate", this)).call.apply(_get2, [this].concat(args));
      }
    }, {
      key: "_matchFrom",

      /**
        Optionally sets max length of pattern.
        Used when pattern length is longer then `to` param length. Pads zeros at start in this case.
      */

      /** Min bound */

      /** Max bound */
      get: function get$$1() {
        return this.maxLength - String(this.from).length;
      }
    }, {
      key: "isComplete",
      get: function get$$1() {
        return _get(_getPrototypeOf(MaskedRange.prototype), "isComplete", this) && Boolean(this.value);
      }
    }]);

    return MaskedRange;
  }(MaskedPattern);

  /** Date mask */

  var MaskedDate =
  /*#__PURE__*/
  function (_MaskedPattern) {
    _inherits(MaskedDate, _MaskedPattern);

    /** Parse string to Date */

    /** Format Date to string */

    /** Pattern mask for date according to {@link MaskedDate#format} */

    /** Start date */

    /** End date */

    /**
      @param {Object} opts
    */
    function MaskedDate(opts) {
      _classCallCheck(this, MaskedDate);

      return _possibleConstructorReturn(this, _getPrototypeOf(MaskedDate).call(this, _objectSpread({}, MaskedDate.DEFAULTS, opts)));
    }
    /**
      @override
    */


    _createClass(MaskedDate, [{
      key: "_update",
      value: function _update(opts) {
        if (opts.mask === Date) delete opts.mask;

        if (opts.pattern) {
          opts.mask = opts.pattern;
          delete opts.pattern;
        }

        var blocks = opts.blocks;
        opts.blocks = _extends({}, MaskedDate.GET_DEFAULT_BLOCKS()); // adjust year block

        if (opts.min) opts.blocks.Y.from = opts.min.getFullYear();
        if (opts.max) opts.blocks.Y.to = opts.max.getFullYear();

        if (opts.min && opts.max && opts.blocks.Y.from === opts.blocks.Y.to) {
          opts.blocks.m.from = opts.min.getMonth() + 1;
          opts.blocks.m.to = opts.max.getMonth() + 1;

          if (opts.blocks.m.from === opts.blocks.m.to) {
            opts.blocks.d.from = opts.min.getDate();
            opts.blocks.d.to = opts.max.getDate();
          }
        }

        _extends(opts.blocks, blocks);

        _get(_getPrototypeOf(MaskedDate.prototype), "_update", this).call(this, opts);
      }
      /**
        @override
      */

    }, {
      key: "doValidate",
      value: function doValidate() {
        var _get2;

        var date = this.date;

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        return (_get2 = _get(_getPrototypeOf(MaskedDate.prototype), "doValidate", this)).call.apply(_get2, [this].concat(args)) && (!this.isComplete || this.isDateExist(this.value) && date != null && (this.min == null || this.min <= date) && (this.max == null || date <= this.max));
      }
      /** Checks if date is exists */

    }, {
      key: "isDateExist",
      value: function isDateExist(str) {
        return this.format(this.parse(str)) === str;
      }
      /** Parsed Date */

    }, {
      key: "date",
      get: function get$$1() {
        return this.isComplete ? this.parse(this.value) : null;
      },
      set: function set(date) {
        this.value = this.format(date);
      }
      /**
        @override
      */

    }, {
      key: "typedValue",
      get: function get$$1() {
        return this.date;
      },
      set: function set(value) {
        this.date = value;
      }
    }]);

    return MaskedDate;
  }(MaskedPattern);
  MaskedDate.DEFAULTS = {
    pattern: 'd{.}`m{.}`Y',
    format: function format(date) {
      var day = String(date.getDate()).padStart(2, '0');
      var month = String(date.getMonth() + 1).padStart(2, '0');
      var year = date.getFullYear();
      return [day, month, year].join('.');
    },
    parse: function parse(str) {
      var _str$split = str.split('.'),
          _str$split2 = _slicedToArray(_str$split, 3),
          day = _str$split2[0],
          month = _str$split2[1],
          year = _str$split2[2];

      return new Date(year, month - 1, day);
    }
  };

  MaskedDate.GET_DEFAULT_BLOCKS = function () {
    return {
      d: {
        mask: MaskedRange,
        from: 1,
        to: 31,
        maxLength: 2
      },
      m: {
        mask: MaskedRange,
        from: 1,
        to: 12,
        maxLength: 2
      },
      Y: {
        mask: MaskedRange,
        from: 1900,
        to: 9999
      }
    };
  };

  /**
    Generic element API to use with mask
    @interface
  */
  var MaskElement =
  /*#__PURE__*/
  function () {
    function MaskElement() {
      _classCallCheck(this, MaskElement);
    }

    _createClass(MaskElement, [{
      key: "select",

      /** Safely sets element selection */
      value: function select(start, end) {
        if (start == null || end == null || start === this.selectionStart && end === this.selectionEnd) return;

        try {
          this._unsafeSelect(start, end);
        } catch (e) {}
      }
      /** Should be overriden in subclasses */

    }, {
      key: "_unsafeSelect",
      value: function _unsafeSelect(start, end) {}
      /** Should be overriden in subclasses */

    }, {
      key: "bindEvents",

      /** Should be overriden in subclasses */
      value: function bindEvents(handlers) {}
      /** Should be overriden in subclasses */

    }, {
      key: "unbindEvents",
      value: function unbindEvents() {}
    }, {
      key: "selectionStart",

      /** */

      /** */

      /** */

      /** Safely returns selection start */
      get: function get() {
        var start;

        try {
          start = this._unsafeSelectionStart;
        } catch (e) {}

        return start != null ? start : this.value.length;
      }
      /** Safely returns selection end */

    }, {
      key: "selectionEnd",
      get: function get() {
        var end;

        try {
          end = this._unsafeSelectionEnd;
        } catch (e) {}

        return end != null ? end : this.value.length;
      }
    }, {
      key: "isActive",
      get: function get() {
        return false;
      }
    }]);

    return MaskElement;
  }();

  /** Bridge between HTMLElement and {@link Masked} */

  var HTMLMaskElement =
  /*#__PURE__*/
  function (_MaskElement) {
    _inherits(HTMLMaskElement, _MaskElement);

    /** Mapping between HTMLElement events and mask internal events */

    /** HTMLElement to use mask on */

    /**
      @param {HTMLInputElement|HTMLTextAreaElement} input
    */
    function HTMLMaskElement(input) {
      var _this;

      _classCallCheck(this, HTMLMaskElement);

      _this = _possibleConstructorReturn(this, _getPrototypeOf(HTMLMaskElement).call(this));
      _this.input = input;
      _this._handlers = {};
      return _this;
    }
    /**
      Is element in focus
      @readonly
    */


    _createClass(HTMLMaskElement, [{
      key: "_unsafeSelect",

      /**
        Sets HTMLElement selection
        @override
      */
      value: function _unsafeSelect(start, end) {
        this.input.setSelectionRange(start, end);
      }
      /**
        HTMLElement value
        @override
      */

    }, {
      key: "bindEvents",

      /**
        Binds HTMLElement events to mask internal events
        @override
      */
      value: function bindEvents(handlers) {
        var _this2 = this;

        Object.keys(handlers).forEach(function (event) {
          return _this2._toggleEventHandler(HTMLMaskElement.EVENTS_MAP[event], handlers[event]);
        });
      }
      /**
        Unbinds HTMLElement events to mask internal events
        @override
      */

    }, {
      key: "unbindEvents",
      value: function unbindEvents() {
        var _this3 = this;

        Object.keys(this._handlers).forEach(function (event) {
          return _this3._toggleEventHandler(event);
        });
      }
      /** */

    }, {
      key: "_toggleEventHandler",
      value: function _toggleEventHandler(event, handler) {
        if (this._handlers[event]) {
          this.input.removeEventListener(event, this._handlers[event]);
          delete this._handlers[event];
        }

        if (handler) {
          this.input.addEventListener(event, handler);
          this._handlers[event] = handler;
        }
      }
    }, {
      key: "isActive",
      get: function get() {
        return this.input === document.activeElement;
      }
      /**
        Returns HTMLElement selection start
        @override
      */

    }, {
      key: "_unsafeSelectionStart",
      get: function get() {
        return this.input.selectionStart;
      }
      /**
        Returns HTMLElement selection end
        @override
      */

    }, {
      key: "_unsafeSelectionEnd",
      get: function get() {
        return this.input.selectionEnd;
      }
    }, {
      key: "value",
      get: function get() {
        return this.input.value;
      },
      set: function set(value) {
        this.input.value = value;
      }
    }]);

    return HTMLMaskElement;
  }(MaskElement);
  HTMLMaskElement.EVENTS_MAP = {
    selectionChange: 'keydown',
    input: 'input',
    drop: 'drop',
    click: 'click',
    focus: 'focus',
    commit: 'change'
  };

  /** Listens to element events and controls changes between element and {@link Masked} */

  var InputMask =
  /*#__PURE__*/
  function () {
    /**
      View element
      @readonly
    */

    /**
      Internal {@link Masked} model
      @readonly
    */

    /**
      @param {MaskElement|HTMLInputElement|HTMLTextAreaElement} el
      @param {Object} opts
    */
    function InputMask(el, opts) {
      _classCallCheck(this, InputMask);

      this.el = el instanceof MaskElement ? el : new HTMLMaskElement(el);
      this.masked = createMask(opts);
      this._listeners = {};
      this._value = '';
      this._unmaskedValue = '';
      this._saveSelection = this._saveSelection.bind(this);
      this._onInput = this._onInput.bind(this);
      this._onChange = this._onChange.bind(this);
      this._onDrop = this._onDrop.bind(this);
      this.alignCursor = this.alignCursor.bind(this);
      this.alignCursorFriendly = this.alignCursorFriendly.bind(this);

      this._bindEvents(); // refresh


      this.updateValue();

      this._onChange();
    }
    /** Read or update mask */


    _createClass(InputMask, [{
      key: "_bindEvents",

      /**
        Starts listening to element events
        @protected
      */
      value: function _bindEvents() {
        this.el.bindEvents({
          selectionChange: this._saveSelection,
          input: this._onInput,
          drop: this._onDrop,
          click: this.alignCursorFriendly,
          focus: this.alignCursorFriendly,
          commit: this._onChange
        });
      }
      /**
        Stops listening to element events
        @protected
       */

    }, {
      key: "_unbindEvents",
      value: function _unbindEvents() {
        this.el.unbindEvents();
      }
      /**
        Fires custom event
        @protected
       */

    }, {
      key: "_fireEvent",
      value: function _fireEvent(ev) {
        var listeners = this._listeners[ev];
        if (!listeners) return;
        listeners.forEach(function (l) {
          return l();
        });
      }
      /**
        Current selection start
        @readonly
      */

    }, {
      key: "_saveSelection",

      /**
        Stores current selection
        @protected
      */
      value: function _saveSelection()
      /* ev */
      {
        if (this.value !== this.el.value) {
          console.warn('Element value was changed outside of mask. Syncronize mask using `mask.updateValue()` to work properly.'); // eslint-disable-line no-console
        }

        this._selection = {
          start: this.selectionStart,
          end: this.cursorPos
        };
      }
      /** Syncronizes model value from view */

    }, {
      key: "updateValue",
      value: function updateValue() {
        this.masked.value = this.el.value;
        this._value = this.masked.value;
      }
      /** Syncronizes view from model value, fires change events */

    }, {
      key: "updateControl",
      value: function updateControl() {
        var newUnmaskedValue = this.masked.unmaskedValue;
        var newValue = this.masked.value;
        var isChanged = this.unmaskedValue !== newUnmaskedValue || this.value !== newValue;
        this._unmaskedValue = newUnmaskedValue;
        this._value = newValue;
        if (this.el.value !== newValue) this.el.value = newValue;
        if (isChanged) this._fireChangeEvents();
      }
      /** Updates options with deep equal check, recreates @{link Masked} model if mask type changes */

    }, {
      key: "updateOptions",
      value: function updateOptions(opts) {
        if (objectIncludes(this.masked, opts)) return;

        var mask = opts.mask,
            restOpts = _objectWithoutProperties(opts, ["mask"]);

        this.mask = mask;
        this.masked.updateOptions(restOpts);
        this.updateControl();
      }
      /** Updates cursor */

    }, {
      key: "updateCursor",
      value: function updateCursor(cursorPos) {
        if (cursorPos == null) return;
        this.cursorPos = cursorPos; // also queue change cursor for mobile browsers

        this._delayUpdateCursor(cursorPos);
      }
      /**
        Delays cursor update to support mobile browsers
        @private
      */

    }, {
      key: "_delayUpdateCursor",
      value: function _delayUpdateCursor(cursorPos) {
        var _this = this;

        this._abortUpdateCursor();

        this._changingCursorPos = cursorPos;
        this._cursorChanging = setTimeout(function () {
          if (!_this.el) return; // if was destroyed

          _this.cursorPos = _this._changingCursorPos;

          _this._abortUpdateCursor();
        }, 10);
      }
      /**
        Fires custom events
        @protected
      */

    }, {
      key: "_fireChangeEvents",
      value: function _fireChangeEvents() {
        this._fireEvent('accept');

        if (this.masked.isComplete) this._fireEvent('complete');
      }
      /**
        Aborts delayed cursor update
        @private
      */

    }, {
      key: "_abortUpdateCursor",
      value: function _abortUpdateCursor() {
        if (this._cursorChanging) {
          clearTimeout(this._cursorChanging);
          delete this._cursorChanging;
        }
      }
      /** Aligns cursor to nearest available position */

    }, {
      key: "alignCursor",
      value: function alignCursor() {
        this.cursorPos = this.masked.nearestInputPos(this.cursorPos, DIRECTION.LEFT);
      }
      /** Aligns cursor only if selection is empty */

    }, {
      key: "alignCursorFriendly",
      value: function alignCursorFriendly() {
        if (this.selectionStart !== this.cursorPos) return;
        this.alignCursor();
      }
      /** Adds listener on custom event */

    }, {
      key: "on",
      value: function on(ev, handler) {
        if (!this._listeners[ev]) this._listeners[ev] = [];

        this._listeners[ev].push(handler);

        return this;
      }
      /** Removes custom event listener */

    }, {
      key: "off",
      value: function off(ev, handler) {
        if (!this._listeners[ev]) return;

        if (!handler) {
          delete this._listeners[ev];
          return;
        }

        var hIndex = this._listeners[ev].indexOf(handler);

        if (hIndex >= 0) this._listeners[ev].splice(hIndex, 1);
        return this;
      }
      /** Handles view input event */

    }, {
      key: "_onInput",
      value: function _onInput() {
        this._abortUpdateCursor(); // fix strange IE behavior


        if (!this._selection) return this.updateValue();
        var details = new ActionDetails( // new state
        this.el.value, this.cursorPos, // old state
        this.value, this._selection);
        var oldRawValue = this.masked.rawInputValue;
        var offset = this.masked.splice(details.startChangePos, details.removed.length, details.inserted, details.removeDirection).offset; // force align in remove direction only if no input chars were removed
        // otherwise we still need to align with NONE (to get out from fixed symbols for instance)

        var removeDirection = oldRawValue === this.masked.rawInputValue ? details.removeDirection : DIRECTION.NONE;
        var cursorPos = this.masked.nearestInputPos(details.startChangePos + offset, removeDirection);
        this.updateControl();
        this.updateCursor(cursorPos);
      }
      /** Handles view change event and commits model value */

    }, {
      key: "_onChange",
      value: function _onChange() {
        if (this.value !== this.el.value) {
          this.updateValue();
        }

        this.masked.doCommit();
        this.updateControl();
      }
      /** Handles view drop event, prevents by default */

    }, {
      key: "_onDrop",
      value: function _onDrop(ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      /** Unbind view events and removes element reference */

    }, {
      key: "destroy",
      value: function destroy() {
        this._unbindEvents(); // $FlowFixMe why not do so?


        this._listeners.length = 0;
        delete this.el;
      }
    }, {
      key: "mask",
      get: function get() {
        return this.masked.mask;
      },
      set: function set(mask) {
        if (mask == null || mask === this.masked.mask || mask === Date && this.masked instanceof MaskedDate) return;

        if (this.masked.constructor === maskedClass(mask)) {
          this.masked.updateOptions({
            mask: mask
          });
          return;
        }

        var masked = createMask({
          mask: mask
        });
        masked.unmaskedValue = this.masked.unmaskedValue;
        this.masked = masked;
      }
      /** Raw value */

    }, {
      key: "value",
      get: function get() {
        return this._value;
      },
      set: function set(str) {
        this.masked.value = str;
        this.updateControl();
        this.alignCursor();
      }
      /** Unmasked value */

    }, {
      key: "unmaskedValue",
      get: function get() {
        return this._unmaskedValue;
      },
      set: function set(str) {
        this.masked.unmaskedValue = str;
        this.updateControl();
        this.alignCursor();
      }
      /** Typed unmasked value */

    }, {
      key: "typedValue",
      get: function get() {
        return this.masked.typedValue;
      },
      set: function set(val) {
        this.masked.typedValue = val;
        this.updateControl();
        this.alignCursor();
      }
    }, {
      key: "selectionStart",
      get: function get() {
        return this._cursorChanging ? this._changingCursorPos : this.el.selectionStart;
      }
      /** Current cursor position */

    }, {
      key: "cursorPos",
      get: function get() {
        return this._cursorChanging ? this._changingCursorPos : this.el.selectionEnd;
      },
      set: function set(pos) {
        if (!this.el.isActive) return;
        this.el.select(pos, pos);

        this._saveSelection();
      }
    }]);

    return InputMask;
  }();

  /** Pattern which validates enum values */

  var MaskedEnum =
  /*#__PURE__*/
  function (_MaskedPattern) {
    _inherits(MaskedEnum, _MaskedPattern);

    function MaskedEnum() {
      _classCallCheck(this, MaskedEnum);

      return _possibleConstructorReturn(this, _getPrototypeOf(MaskedEnum).apply(this, arguments));
    }

    _createClass(MaskedEnum, [{
      key: "_update",

      /**
        @override
        @param {Object} opts
      */
      value: function _update(opts) {
        // TODO type
        if (opts.enum) opts.mask = '*'.repeat(opts.enum[0].length);

        _get(_getPrototypeOf(MaskedEnum.prototype), "_update", this).call(this, opts);
      }
      /**
        @override
      */

    }, {
      key: "doValidate",
      value: function doValidate() {
        var _this = this,
            _get2;

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        return this.enum.some(function (e) {
          return e.indexOf(_this.unmaskedValue) >= 0;
        }) && (_get2 = _get(_getPrototypeOf(MaskedEnum.prototype), "doValidate", this)).call.apply(_get2, [this].concat(args));
      }
    }]);

    return MaskedEnum;
  }(MaskedPattern);

  /**
    Number mask
    @param {Object} opts
    @param {string} opts.radix - Single char
    @param {string} opts.thousandsSeparator - Single char
    @param {Array<string>} opts.mapToRadix - Array of single chars
    @param {number} opts.min
    @param {number} opts.max
    @param {number} opts.scale - Digits after point
    @param {boolean} opts.signed - Allow negative
    @param {boolean} opts.normalizeZeros - Flag to remove leading and trailing zeros in the end of editing
    @param {boolean} opts.padFractionalZeros - Flag to pad trailing zeros after point in the end of editing
  */
  var MaskedNumber =
  /*#__PURE__*/
  function (_Masked) {
    _inherits(MaskedNumber, _Masked);

    /** Single char */

    /** Single char */

    /** Array of single chars */

    /** */

    /** */

    /** Digits after point */

    /** */

    /** Flag to remove leading and trailing zeros in the end of editing */

    /** Flag to pad trailing zeros after point in the end of editing */
    function MaskedNumber(opts) {
      _classCallCheck(this, MaskedNumber);

      return _possibleConstructorReturn(this, _getPrototypeOf(MaskedNumber).call(this, _objectSpread({}, MaskedNumber.DEFAULTS, opts)));
    }
    /**
      @override
    */


    _createClass(MaskedNumber, [{
      key: "_update",
      value: function _update(opts) {
        _get(_getPrototypeOf(MaskedNumber.prototype), "_update", this).call(this, opts);

        this._updateRegExps();
      }
      /** */

    }, {
      key: "_updateRegExps",
      value: function _updateRegExps() {
        // use different regexp to process user input (more strict, input suffix) and tail shifting
        var start = '^';
        var midInput = '';
        var mid = '';

        if (this.allowNegative) {
          midInput += '([+|\\-]?|([+|\\-]?(0|([1-9]+\\d*))))';
          mid += '[+|\\-]?';
        } else {
          midInput += '(0|([1-9]+\\d*))';
        }

        mid += '\\d*';
        var end = (this.scale ? '(' + escapeRegExp(this.radix) + '\\d{0,' + this.scale + '})?' : '') + '$';
        this._numberRegExpInput = new RegExp(start + midInput + end);
        this._numberRegExp = new RegExp(start + mid + end);
        this._mapToRadixRegExp = new RegExp('[' + this.mapToRadix.map(escapeRegExp).join('') + ']', 'g');
        this._thousandsSeparatorRegExp = new RegExp(escapeRegExp(this.thousandsSeparator), 'g');
      }
      /**
        @override
      */

    }, {
      key: "extractTail",
      value: function extractTail() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;

        var tail = _get(_getPrototypeOf(MaskedNumber.prototype), "extractTail", this).call(this, fromPos, toPos); // $FlowFixMe no ideas


        return _objectSpread({}, tail, {
          value: this._removeThousandsSeparators(tail.value)
        });
      }
      /** */

    }, {
      key: "_removeThousandsSeparators",
      value: function _removeThousandsSeparators(value) {
        return value.replace(this._thousandsSeparatorRegExp, '');
      }
      /** */

    }, {
      key: "_insertThousandsSeparators",
      value: function _insertThousandsSeparators(value) {
        // https://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
        var parts = value.split(this.radix);
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, this.thousandsSeparator);
        return parts.join(this.radix);
      }
      /**
        @override
      */

    }, {
      key: "doPrepare",
      value: function doPrepare(str) {
        var _get2;

        for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }

        return (_get2 = _get(_getPrototypeOf(MaskedNumber.prototype), "doPrepare", this)).call.apply(_get2, [this, this._removeThousandsSeparators(str.replace(this._mapToRadixRegExp, this.radix))].concat(args));
      }
      /** */

    }, {
      key: "_separatorsCount",
      value: function _separatorsCount() {
        var value = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this._value;

        var rawValueLength = this._removeThousandsSeparators(value).length;

        var valueWithSeparatorsLength = rawValueLength;

        for (var pos = 0; pos <= valueWithSeparatorsLength; ++pos) {
          if (this._value[pos] === this.thousandsSeparator) ++valueWithSeparatorsLength;
        }

        return valueWithSeparatorsLength - rawValueLength;
      }
      /**
        @override
      */

    }, {
      key: "extractInput",
      value: function extractInput() {
        var _get3;

        for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }

        return this._removeThousandsSeparators((_get3 = _get(_getPrototypeOf(MaskedNumber.prototype), "extractInput", this)).call.apply(_get3, [this].concat(args)));
      }
      /**
        @override
      */

    }, {
      key: "_appendCharRaw",
      value: function _appendCharRaw(ch) {
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        if (!this.thousandsSeparator) return _get(_getPrototypeOf(MaskedNumber.prototype), "_appendCharRaw", this).call(this, ch, flags);

        var previousBeforeTailSeparatorsCount = this._separatorsCount(flags.tail && this._beforeTailState ? this._beforeTailState._value : this._value);

        this._value = this._removeThousandsSeparators(this.value);

        var appendDetails = _get(_getPrototypeOf(MaskedNumber.prototype), "_appendCharRaw", this).call(this, ch, flags);

        this._value = this._insertThousandsSeparators(this._value);

        var beforeTailSeparatorsCount = this._separatorsCount(flags.tail && this._beforeTailState ? this._beforeTailState._value : this._value);

        appendDetails.tailShift += beforeTailSeparatorsCount - previousBeforeTailSeparatorsCount;
        return appendDetails;
      }
      /**
        @override
      */

    }, {
      key: "remove",
      value: function remove() {
        var fromPos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var toPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.value.length;
        var valueBeforePos = this.value.slice(0, fromPos);
        var valueAfterPos = this.value.slice(toPos);

        var previousBeforeTailSeparatorsCount = this._separatorsCount(valueBeforePos);

        this._value = this._insertThousandsSeparators(this._removeThousandsSeparators(valueBeforePos + valueAfterPos));

        var beforeTailSeparatorsCount = this._separatorsCount(valueBeforePos);

        return new ChangeDetails({
          tailShift: beforeTailSeparatorsCount - previousBeforeTailSeparatorsCount
        });
      }
      /**
        @override
      */

    }, {
      key: "nearestInputPos",
      value: function nearestInputPos(cursorPos, direction) {
        if (!direction || direction === DIRECTION.LEFT) return cursorPos;
        var nextPos = indexInDirection(cursorPos, direction);
        if (this.value[nextPos] === this.thousandsSeparator) cursorPos = posInDirection(cursorPos, direction);
        return cursorPos;
      }
      /**
        @override
      */

    }, {
      key: "doValidate",
      value: function doValidate(flags) {
        var regexp = flags.input ? this._numberRegExpInput : this._numberRegExp; // validate as string

        var valid = regexp.test(this._removeThousandsSeparators(this.value));

        if (valid) {
          // validate as number
          var number = this.number;
          valid = valid && !isNaN(number) && ( // check min bound for negative values
          this.min == null || this.min >= 0 || this.min <= this.number) && ( // check max bound for positive values
          this.max == null || this.max <= 0 || this.number <= this.max);
        }

        return valid && _get(_getPrototypeOf(MaskedNumber.prototype), "doValidate", this).call(this, flags);
      }
      /**
        @override
      */

    }, {
      key: "doCommit",
      value: function doCommit() {
        var number = this.number;
        var validnum = number; // check bounds

        if (this.min != null) validnum = Math.max(validnum, this.min);
        if (this.max != null) validnum = Math.min(validnum, this.max);
        if (validnum !== number) this.unmaskedValue = String(validnum);
        var formatted = this.value;
        if (this.normalizeZeros) formatted = this._normalizeZeros(formatted);
        if (this.padFractionalZeros) formatted = this._padFractionalZeros(formatted);
        this._value = this._insertThousandsSeparators(formatted);

        _get(_getPrototypeOf(MaskedNumber.prototype), "doCommit", this).call(this);
      }
      /** */

    }, {
      key: "_normalizeZeros",
      value: function _normalizeZeros(value) {
        var parts = this._removeThousandsSeparators(value).split(this.radix); // remove leading zeros


        parts[0] = parts[0].replace(/^(\D*)(0*)(\d*)/, function (match, sign, zeros, num) {
          return sign + num;
        }); // add leading zero

        if (value.length && !/\d$/.test(parts[0])) parts[0] = parts[0] + '0';

        if (parts.length > 1) {
          parts[1] = parts[1].replace(/0*$/, ''); // remove trailing zeros

          if (!parts[1].length) parts.length = 1; // remove fractional
        }

        return this._insertThousandsSeparators(parts.join(this.radix));
      }
      /** */

    }, {
      key: "_padFractionalZeros",
      value: function _padFractionalZeros(value) {
        if (!value) return value;
        var parts = value.split(this.radix);
        if (parts.length < 2) parts.push('');
        parts[1] = parts[1].padEnd(this.scale, '0');
        return parts.join(this.radix);
      }
      /**
        @override
      */

    }, {
      key: "unmaskedValue",
      get: function get$$1() {
        return this._removeThousandsSeparators(this._normalizeZeros(this.value)).replace(this.radix, '.');
      },
      set: function set$$1(unmaskedValue) {
        _set(_getPrototypeOf(MaskedNumber.prototype), "unmaskedValue", unmaskedValue.replace('.', this.radix), this, true);
      }
      /** Parsed Number */

    }, {
      key: "number",
      get: function get$$1() {
        return Number(this.unmaskedValue);
      },
      set: function set$$1(number) {
        this.unmaskedValue = String(number);
      }
      /**
        @override
      */

    }, {
      key: "typedValue",
      get: function get$$1() {
        return this.number;
      },
      set: function set$$1(value) {
        this.number = value;
      }
      /**
        Is negative allowed
        @readonly
      */

    }, {
      key: "allowNegative",
      get: function get$$1() {
        return this.signed || this.min != null && this.min < 0 || this.max != null && this.max < 0;
      }
    }]);

    return MaskedNumber;
  }(Masked);
  MaskedNumber.DEFAULTS = {
    radix: ',',
    thousandsSeparator: '',
    mapToRadix: ['.'],
    scale: 2,
    signed: false,
    normalizeZeros: true,
    padFractionalZeros: false
  };

  /** Masking by RegExp */

  var MaskedRegExp =
  /*#__PURE__*/
  function (_Masked) {
    _inherits(MaskedRegExp, _Masked);

    function MaskedRegExp() {
      _classCallCheck(this, MaskedRegExp);

      return _possibleConstructorReturn(this, _getPrototypeOf(MaskedRegExp).apply(this, arguments));
    }

    _createClass(MaskedRegExp, [{
      key: "_update",

      /**
        @override
        @param {Object} opts
      */
      value: function _update(opts) {
        if (opts.mask) opts.validate = function (value) {
          return value.search(opts.mask) >= 0;
        };

        _get(_getPrototypeOf(MaskedRegExp.prototype), "_update", this).call(this, opts);
      }
    }]);

    return MaskedRegExp;
  }(Masked);

  /** Masking by custom Function */

  var MaskedFunction =
  /*#__PURE__*/
  function (_Masked) {
    _inherits(MaskedFunction, _Masked);

    function MaskedFunction() {
      _classCallCheck(this, MaskedFunction);

      return _possibleConstructorReturn(this, _getPrototypeOf(MaskedFunction).apply(this, arguments));
    }

    _createClass(MaskedFunction, [{
      key: "_update",

      /**
        @override
        @param {Object} opts
      */
      value: function _update(opts) {
        if (opts.mask) opts.validate = opts.mask;

        _get(_getPrototypeOf(MaskedFunction.prototype), "_update", this).call(this, opts);
      }
    }]);

    return MaskedFunction;
  }(Masked);

  /** Dynamic mask for choosing apropriate mask in run-time */
  var MaskedDynamic =
  /*#__PURE__*/
  function (_Masked) {
    _inherits(MaskedDynamic, _Masked);

    /** Currently chosen mask */

    /** Compliled {@link Masked} options */

    /** Chooses {@link Masked} depending on input value */

    /**
      @param {Object} opts
    */
    function MaskedDynamic(opts) {
      var _this;

      _classCallCheck(this, MaskedDynamic);

      _this = _possibleConstructorReturn(this, _getPrototypeOf(MaskedDynamic).call(this, _objectSpread({}, MaskedDynamic.DEFAULTS, opts)));
      _this.currentMask = null;
      return _this;
    }
    /**
      @override
    */


    _createClass(MaskedDynamic, [{
      key: "_update",
      value: function _update(opts) {
        _get(_getPrototypeOf(MaskedDynamic.prototype), "_update", this).call(this, opts);

        if ('mask' in opts) {
          // mask could be totally dynamic with only `dispatch` option
          this.compiledMasks = Array.isArray(opts.mask) ? opts.mask.map(function (m) {
            return createMask(m);
          }) : [];
        }
      }
      /**
        @override
      */

    }, {
      key: "_appendCharRaw",
      value: function _appendCharRaw() {
        var details = this._applyDispatch.apply(this, arguments);

        if (this.currentMask) {
          var _this$currentMask;

          details.aggregate((_this$currentMask = this.currentMask)._appendChar.apply(_this$currentMask, arguments));
        }

        return details;
      }
    }, {
      key: "_applyDispatch",
      value: function _applyDispatch() {
        var appended = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var prevValueBeforeTail = flags.tail && this._beforeTailState ? this._beforeTailState._value : this.value;
        var inputValue = this.rawInputValue;
        var insertValue = flags.tail && this._beforeTailState ? // $FlowFixMe - tired to fight with type system
        this._beforeTailState._rawInputValue : inputValue;
        var tailValue = inputValue.slice(insertValue.length);
        var prevMask = this.currentMask;
        var details = new ChangeDetails();
        var prevMaskState = prevMask && prevMask.state;
        var prevMaskBeforeTailState = prevMask && prevMask._beforeTailState;
        this.currentMask = this.doDispatch(appended, flags); // restore state after dispatch

        if (this.currentMask) {
          if (this.currentMask !== prevMask) {
            // if mask changed reapply input
            this.currentMask.reset(); // $FlowFixMe - it's ok, we don't change current mask above

            var d = this.currentMask.append(insertValue, {
              raw: true
            });
            details.tailShift = d.inserted.length - prevValueBeforeTail.length;

            if (tailValue) {
              // $FlowFixMe - it's ok, we don't change current mask above
              details.tailShift += this.currentMask.append(tailValue, {
                raw: true,
                tail: true
              }).tailShift;
            }
          } else {
            // Dispatch can do something bad with state, so
            // restore prev mask state
            this.currentMask.state = prevMaskState;
            this.currentMask._beforeTailState = prevMaskBeforeTailState;
          }
        }

        return details;
      }
      /**
        @override
      */

    }, {
      key: "doDispatch",
      value: function doDispatch(appended) {
        var flags = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        return this.dispatch(appended, this, flags);
      }
      /**
        @override
      */

    }, {
      key: "doValidate",
      value: function doValidate() {
        var _get2, _this$currentMask2;

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        return (_get2 = _get(_getPrototypeOf(MaskedDynamic.prototype), "doValidate", this)).call.apply(_get2, [this].concat(args)) && (!this.currentMask || (_this$currentMask2 = this.currentMask).doValidate.apply(_this$currentMask2, args));
      }
      /**
        @override
      */

    }, {
      key: "reset",
      value: function reset() {
        if (this.currentMask) this.currentMask.reset();
        this.compiledMasks.forEach(function (m) {
          return m.reset();
        });
      }
      /**
        @override
      */

    }, {
      key: "remove",

      /**
        @override
      */
      value: function remove() {
        var details = new ChangeDetails();

        if (this.currentMask) {
          var _this$currentMask3;

          details.aggregate((_this$currentMask3 = this.currentMask).remove.apply(_this$currentMask3, arguments)) // update with dispatch
          .aggregate(this._applyDispatch());
        }

        return details;
      }
      /**
        @override
      */

    }, {
      key: "extractInput",

      /**
        @override
      */
      value: function extractInput() {
        var _this$currentMask4;

        return this.currentMask ? (_this$currentMask4 = this.currentMask).extractInput.apply(_this$currentMask4, arguments) : '';
      }
      /**
        @override
      */

    }, {
      key: "extractTail",
      value: function extractTail() {
        var _this$currentMask5, _get3;

        for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }

        return this.currentMask ? (_this$currentMask5 = this.currentMask).extractTail.apply(_this$currentMask5, args) : (_get3 = _get(_getPrototypeOf(MaskedDynamic.prototype), "extractTail", this)).call.apply(_get3, [this].concat(args));
      }
      /**
        @override
      */

    }, {
      key: "doCommit",
      value: function doCommit() {
        if (this.currentMask) this.currentMask.doCommit();

        _get(_getPrototypeOf(MaskedDynamic.prototype), "doCommit", this).call(this);
      }
      /**
        @override
      */

    }, {
      key: "nearestInputPos",
      value: function nearestInputPos() {
        var _this$currentMask6, _get4;

        for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          args[_key3] = arguments[_key3];
        }

        return this.currentMask ? (_this$currentMask6 = this.currentMask).nearestInputPos.apply(_this$currentMask6, args) : (_get4 = _get(_getPrototypeOf(MaskedDynamic.prototype), "nearestInputPos", this)).call.apply(_get4, [this].concat(args));
      }
    }, {
      key: "value",
      get: function get$$1() {
        return this.currentMask ? this.currentMask.value : '';
      },
      set: function set$$1(value) {
        _set(_getPrototypeOf(MaskedDynamic.prototype), "value", value, this, true);
      }
      /**
        @override
      */

    }, {
      key: "unmaskedValue",
      get: function get$$1() {
        return this.currentMask ? this.currentMask.unmaskedValue : '';
      },
      set: function set$$1(unmaskedValue) {
        _set(_getPrototypeOf(MaskedDynamic.prototype), "unmaskedValue", unmaskedValue, this, true);
      }
      /**
        @override
      */

    }, {
      key: "typedValue",
      get: function get$$1() {
        return this.currentMask ? this.currentMask.typedValue : '';
      } // probably typedValue should not be used with dynamic
      ,
      set: function set$$1(value) {
        var unmaskedValue = String(value); // double check it

        if (this.currentMask) {
          this.currentMask.typedValue = value;
          unmaskedValue = this.currentMask.unmaskedValue;
        }

        this.unmaskedValue = unmaskedValue;
      }
      /**
        @override
      */

    }, {
      key: "isComplete",
      get: function get$$1() {
        return !!this.currentMask && this.currentMask.isComplete;
      }
    }, {
      key: "state",
      get: function get$$1() {
        return _objectSpread({}, _get(_getPrototypeOf(MaskedDynamic.prototype), "state", this), {
          _rawInputValue: this.rawInputValue,
          compiledMasks: this.compiledMasks.map(function (m) {
            return m.state;
          }),
          currentMaskRef: this.currentMask,
          currentMask: this.currentMask && this.currentMask.state
        });
      },
      set: function set$$1(state) {
        var compiledMasks = state.compiledMasks,
            currentMaskRef = state.currentMaskRef,
            currentMask = state.currentMask,
            maskedState = _objectWithoutProperties(state, ["compiledMasks", "currentMaskRef", "currentMask"]);

        this.compiledMasks.forEach(function (m, mi) {
          return m.state = compiledMasks[mi];
        });

        if (currentMaskRef != null) {
          this.currentMask = currentMaskRef;
          this.currentMask.state = currentMask;
        }

        _set(_getPrototypeOf(MaskedDynamic.prototype), "state", maskedState, this, true);
      }
    }]);

    return MaskedDynamic;
  }(Masked);
  MaskedDynamic.DEFAULTS = {
    dispatch: function dispatch(appended, masked, flags) {
      if (!masked.compiledMasks.length) return;
      var inputValue = masked.rawInputValue; // simulate input

      var inputs = masked.compiledMasks.map(function (m, index) {
        m.rawInputValue = inputValue;
        m.append(appended, flags);
        var weight = m.rawInputValue.length;
        return {
          weight: weight,
          index: index
        };
      }); // pop masks with longer values first

      inputs.sort(function (i1, i2) {
        return i2.weight - i1.weight;
      });
      return masked.compiledMasks[inputs[0].index];
    }
  };

  /**
   * Applies mask on element.
   * @constructor
   * @param {HTMLInputElement|HTMLTextAreaElement|MaskElement} el - Element to apply mask
   * @param {Object} opts - Custom mask options
   * @return {InputMask}
   */

  function IMask(el) {
    var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    // currently available only for input-like elements
    return new InputMask(el, opts);
  }
  /** {@link InputMask} */

  IMask.InputMask = InputMask;
  /** {@link Masked} */

  IMask.Masked = Masked;
  /** {@link MaskedPattern} */

  IMask.MaskedPattern = MaskedPattern;
  /** {@link MaskedEnum} */

  IMask.MaskedEnum = MaskedEnum;
  /** {@link MaskedRange} */

  IMask.MaskedRange = MaskedRange;
  /** {@link MaskedNumber} */

  IMask.MaskedNumber = MaskedNumber;
  /** {@link MaskedDate} */

  IMask.MaskedDate = MaskedDate;
  /** {@link MaskedRegExp} */

  IMask.MaskedRegExp = MaskedRegExp;
  /** {@link MaskedFunction} */

  IMask.MaskedFunction = MaskedFunction;
  /** {@link MaskedDynamic} */

  IMask.MaskedDynamic = MaskedDynamic;
  /** {@link createMask} */

  IMask.createMask = createMask;
  /** {@link MaskElement} */

  IMask.MaskElement = MaskElement;
  /** {@link HTMLMaskElement} */

  IMask.HTMLMaskElement = HTMLMaskElement;
  g.IMask = IMask;

  return IMask;

})));


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],4:[function(require,module,exports){
/*!
 * jQuery JavaScript Library v3.3.1
 * https://jquery.com/
 *
 * Includes Sizzle.js
 * https://sizzlejs.com/
 *
 * Copyright JS Foundation and other contributors
 * Released under the MIT license
 * https://jquery.org/license
 *
 * Date: 2018-01-20T17:24Z
 */
( function( global, factory ) {

	"use strict";

	if ( typeof module === "object" && typeof module.exports === "object" ) {

		// For CommonJS and CommonJS-like environments where a proper `window`
		// is present, execute the factory and get jQuery.
		// For environments that do not have a `window` with a `document`
		// (such as Node.js), expose a factory as module.exports.
		// This accentuates the need for the creation of a real `window`.
		// e.g. var jQuery = require("jquery")(window);
		// See ticket #14549 for more info.
		module.exports = global.document ?
			factory( global, true ) :
			function( w ) {
				if ( !w.document ) {
					throw new Error( "jQuery requires a window with a document" );
				}
				return factory( w );
			};
	} else {
		factory( global );
	}

// Pass this if window is not defined yet
} )( typeof window !== "undefined" ? window : this, function( window, noGlobal ) {

// Edge <= 12 - 13+, Firefox <=18 - 45+, IE 10 - 11, Safari 5.1 - 9+, iOS 6 - 9.1
// throw exceptions when non-strict code (e.g., ASP.NET 4.5) accesses strict mode
// arguments.callee.caller (trac-13335). But as of jQuery 3.0 (2016), strict mode should be common
// enough that all such attempts are guarded in a try block.
"use strict";

var arr = [];

var document = window.document;

var getProto = Object.getPrototypeOf;

var slice = arr.slice;

var concat = arr.concat;

var push = arr.push;

var indexOf = arr.indexOf;

var class2type = {};

var toString = class2type.toString;

var hasOwn = class2type.hasOwnProperty;

var fnToString = hasOwn.toString;

var ObjectFunctionString = fnToString.call( Object );

var support = {};

var isFunction = function isFunction( obj ) {

      // Support: Chrome <=57, Firefox <=52
      // In some browsers, typeof returns "function" for HTML <object> elements
      // (i.e., `typeof document.createElement( "object" ) === "function"`).
      // We don't want to classify *any* DOM node as a function.
      return typeof obj === "function" && typeof obj.nodeType !== "number";
  };


var isWindow = function isWindow( obj ) {
		return obj != null && obj === obj.window;
	};




	var preservedScriptAttributes = {
		type: true,
		src: true,
		noModule: true
	};

	function DOMEval( code, doc, node ) {
		doc = doc || document;

		var i,
			script = doc.createElement( "script" );

		script.text = code;
		if ( node ) {
			for ( i in preservedScriptAttributes ) {
				if ( node[ i ] ) {
					script[ i ] = node[ i ];
				}
			}
		}
		doc.head.appendChild( script ).parentNode.removeChild( script );
	}


function toType( obj ) {
	if ( obj == null ) {
		return obj + "";
	}

	// Support: Android <=2.3 only (functionish RegExp)
	return typeof obj === "object" || typeof obj === "function" ?
		class2type[ toString.call( obj ) ] || "object" :
		typeof obj;
}
/* global Symbol */
// Defining this global in .eslintrc.json would create a danger of using the global
// unguarded in another place, it seems safer to define global only for this module



var
	version = "3.3.1",

	// Define a local copy of jQuery
	jQuery = function( selector, context ) {

		// The jQuery object is actually just the init constructor 'enhanced'
		// Need init if jQuery is called (just allow error to be thrown if not included)
		return new jQuery.fn.init( selector, context );
	},

	// Support: Android <=4.0 only
	// Make sure we trim BOM and NBSP
	rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;

jQuery.fn = jQuery.prototype = {

	// The current version of jQuery being used
	jquery: version,

	constructor: jQuery,

	// The default length of a jQuery object is 0
	length: 0,

	toArray: function() {
		return slice.call( this );
	},

	// Get the Nth element in the matched element set OR
	// Get the whole matched element set as a clean array
	get: function( num ) {

		// Return all the elements in a clean array
		if ( num == null ) {
			return slice.call( this );
		}

		// Return just the one element from the set
		return num < 0 ? this[ num + this.length ] : this[ num ];
	},

	// Take an array of elements and push it onto the stack
	// (returning the new matched element set)
	pushStack: function( elems ) {

		// Build a new jQuery matched element set
		var ret = jQuery.merge( this.constructor(), elems );

		// Add the old object onto the stack (as a reference)
		ret.prevObject = this;

		// Return the newly-formed element set
		return ret;
	},

	// Execute a callback for every element in the matched set.
	each: function( callback ) {
		return jQuery.each( this, callback );
	},

	map: function( callback ) {
		return this.pushStack( jQuery.map( this, function( elem, i ) {
			return callback.call( elem, i, elem );
		} ) );
	},

	slice: function() {
		return this.pushStack( slice.apply( this, arguments ) );
	},

	first: function() {
		return this.eq( 0 );
	},

	last: function() {
		return this.eq( -1 );
	},

	eq: function( i ) {
		var len = this.length,
			j = +i + ( i < 0 ? len : 0 );
		return this.pushStack( j >= 0 && j < len ? [ this[ j ] ] : [] );
	},

	end: function() {
		return this.prevObject || this.constructor();
	},

	// For internal use only.
	// Behaves like an Array's method, not like a jQuery method.
	push: push,
	sort: arr.sort,
	splice: arr.splice
};

jQuery.extend = jQuery.fn.extend = function() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[ 0 ] || {},
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;

		// Skip the boolean and the target
		target = arguments[ i ] || {};
		i++;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !isFunction( target ) ) {
		target = {};
	}

	// Extend jQuery itself if only one argument is passed
	if ( i === length ) {
		target = this;
		i--;
	}

	for ( ; i < length; i++ ) {

		// Only deal with non-null/undefined values
		if ( ( options = arguments[ i ] ) != null ) {

			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( jQuery.isPlainObject( copy ) ||
					( copyIsArray = Array.isArray( copy ) ) ) ) {

					if ( copyIsArray ) {
						copyIsArray = false;
						clone = src && Array.isArray( src ) ? src : [];

					} else {
						clone = src && jQuery.isPlainObject( src ) ? src : {};
					}

					// Never move original objects, clone them
					target[ name ] = jQuery.extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};

jQuery.extend( {

	// Unique for each copy of jQuery on the page
	expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),

	// Assume jQuery is ready without the ready module
	isReady: true,

	error: function( msg ) {
		throw new Error( msg );
	},

	noop: function() {},

	isPlainObject: function( obj ) {
		var proto, Ctor;

		// Detect obvious negatives
		// Use toString instead of jQuery.type to catch host objects
		if ( !obj || toString.call( obj ) !== "[object Object]" ) {
			return false;
		}

		proto = getProto( obj );

		// Objects with no prototype (e.g., `Object.create( null )`) are plain
		if ( !proto ) {
			return true;
		}

		// Objects with prototype are plain iff they were constructed by a global Object function
		Ctor = hasOwn.call( proto, "constructor" ) && proto.constructor;
		return typeof Ctor === "function" && fnToString.call( Ctor ) === ObjectFunctionString;
	},

	isEmptyObject: function( obj ) {

		/* eslint-disable no-unused-vars */
		// See https://github.com/eslint/eslint/issues/6125
		var name;

		for ( name in obj ) {
			return false;
		}
		return true;
	},

	// Evaluates a script in a global context
	globalEval: function( code ) {
		DOMEval( code );
	},

	each: function( obj, callback ) {
		var length, i = 0;

		if ( isArrayLike( obj ) ) {
			length = obj.length;
			for ( ; i < length; i++ ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		} else {
			for ( i in obj ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		}

		return obj;
	},

	// Support: Android <=4.0 only
	trim: function( text ) {
		return text == null ?
			"" :
			( text + "" ).replace( rtrim, "" );
	},

	// results is for internal usage only
	makeArray: function( arr, results ) {
		var ret = results || [];

		if ( arr != null ) {
			if ( isArrayLike( Object( arr ) ) ) {
				jQuery.merge( ret,
					typeof arr === "string" ?
					[ arr ] : arr
				);
			} else {
				push.call( ret, arr );
			}
		}

		return ret;
	},

	inArray: function( elem, arr, i ) {
		return arr == null ? -1 : indexOf.call( arr, elem, i );
	},

	// Support: Android <=4.0 only, PhantomJS 1 only
	// push.apply(_, arraylike) throws on ancient WebKit
	merge: function( first, second ) {
		var len = +second.length,
			j = 0,
			i = first.length;

		for ( ; j < len; j++ ) {
			first[ i++ ] = second[ j ];
		}

		first.length = i;

		return first;
	},

	grep: function( elems, callback, invert ) {
		var callbackInverse,
			matches = [],
			i = 0,
			length = elems.length,
			callbackExpect = !invert;

		// Go through the array, only saving the items
		// that pass the validator function
		for ( ; i < length; i++ ) {
			callbackInverse = !callback( elems[ i ], i );
			if ( callbackInverse !== callbackExpect ) {
				matches.push( elems[ i ] );
			}
		}

		return matches;
	},

	// arg is for internal usage only
	map: function( elems, callback, arg ) {
		var length, value,
			i = 0,
			ret = [];

		// Go through the array, translating each of the items to their new values
		if ( isArrayLike( elems ) ) {
			length = elems.length;
			for ( ; i < length; i++ ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}

		// Go through every key on the object,
		} else {
			for ( i in elems ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}
		}

		// Flatten any nested arrays
		return concat.apply( [], ret );
	},

	// A global GUID counter for objects
	guid: 1,

	// jQuery.support is not used in Core but other projects attach their
	// properties to it so it needs to exist.
	support: support
} );

if ( typeof Symbol === "function" ) {
	jQuery.fn[ Symbol.iterator ] = arr[ Symbol.iterator ];
}

// Populate the class2type map
jQuery.each( "Boolean Number String Function Array Date RegExp Object Error Symbol".split( " " ),
function( i, name ) {
	class2type[ "[object " + name + "]" ] = name.toLowerCase();
} );

function isArrayLike( obj ) {

	// Support: real iOS 8.2 only (not reproducible in simulator)
	// `in` check used to prevent JIT error (gh-2145)
	// hasOwn isn't used here due to false negatives
	// regarding Nodelist length in IE
	var length = !!obj && "length" in obj && obj.length,
		type = toType( obj );

	if ( isFunction( obj ) || isWindow( obj ) ) {
		return false;
	}

	return type === "array" || length === 0 ||
		typeof length === "number" && length > 0 && ( length - 1 ) in obj;
}
var Sizzle =
/*!
 * Sizzle CSS Selector Engine v2.3.3
 * https://sizzlejs.com/
 *
 * Copyright jQuery Foundation and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * Date: 2016-08-08
 */
(function( window ) {

var i,
	support,
	Expr,
	getText,
	isXML,
	tokenize,
	compile,
	select,
	outermostContext,
	sortInput,
	hasDuplicate,

	// Local document vars
	setDocument,
	document,
	docElem,
	documentIsHTML,
	rbuggyQSA,
	rbuggyMatches,
	matches,
	contains,

	// Instance-specific data
	expando = "sizzle" + 1 * new Date(),
	preferredDoc = window.document,
	dirruns = 0,
	done = 0,
	classCache = createCache(),
	tokenCache = createCache(),
	compilerCache = createCache(),
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
		}
		return 0;
	},

	// Instance methods
	hasOwn = ({}).hasOwnProperty,
	arr = [],
	pop = arr.pop,
	push_native = arr.push,
	push = arr.push,
	slice = arr.slice,
	// Use a stripped-down indexOf as it's faster than native
	// https://jsperf.com/thor-indexof-vs-for/5
	indexOf = function( list, elem ) {
		var i = 0,
			len = list.length;
		for ( ; i < len; i++ ) {
			if ( list[i] === elem ) {
				return i;
			}
		}
		return -1;
	},

	booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",

	// Regular expressions

	// http://www.w3.org/TR/css3-selectors/#whitespace
	whitespace = "[\\x20\\t\\r\\n\\f]",

	// http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
	identifier = "(?:\\\\.|[\\w-]|[^\0-\\xa0])+",

	// Attribute selectors: http://www.w3.org/TR/selectors/#attribute-selectors
	attributes = "\\[" + whitespace + "*(" + identifier + ")(?:" + whitespace +
		// Operator (capture 2)
		"*([*^$|!~]?=)" + whitespace +
		// "Attribute values must be CSS identifiers [capture 5] or strings [capture 3 or capture 4]"
		"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" + whitespace +
		"*\\]",

	pseudos = ":(" + identifier + ")(?:\\((" +
		// To reduce the number of selectors needing tokenize in the preFilter, prefer arguments:
		// 1. quoted (capture 3; capture 4 or capture 5)
		"('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" +
		// 2. simple (capture 6)
		"((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" +
		// 3. anything else (capture 2)
		".*" +
		")\\)|)",

	// Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
	rwhitespace = new RegExp( whitespace + "+", "g" ),
	rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g" ),

	rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
	rcombinators = new RegExp( "^" + whitespace + "*([>+~]|" + whitespace + ")" + whitespace + "*" ),

	rattributeQuotes = new RegExp( "=" + whitespace + "*([^\\]'\"]*?)" + whitespace + "*\\]", "g" ),

	rpseudo = new RegExp( pseudos ),
	ridentifier = new RegExp( "^" + identifier + "$" ),

	matchExpr = {
		"ID": new RegExp( "^#(" + identifier + ")" ),
		"CLASS": new RegExp( "^\\.(" + identifier + ")" ),
		"TAG": new RegExp( "^(" + identifier + "|[*])" ),
		"ATTR": new RegExp( "^" + attributes ),
		"PSEUDO": new RegExp( "^" + pseudos ),
		"CHILD": new RegExp( "^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + whitespace +
			"*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" + whitespace +
			"*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
		"bool": new RegExp( "^(?:" + booleans + ")$", "i" ),
		// For use in libraries implementing .is()
		// We use this for POS matching in `select`
		"needsContext": new RegExp( "^" + whitespace + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" +
			whitespace + "*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i" )
	},

	rinputs = /^(?:input|select|textarea|button)$/i,
	rheader = /^h\d$/i,

	rnative = /^[^{]+\{\s*\[native \w/,

	// Easily-parseable/retrievable ID or TAG or CLASS selectors
	rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,

	rsibling = /[+~]/,

	// CSS escapes
	// http://www.w3.org/TR/CSS21/syndata.html#escaped-characters
	runescape = new RegExp( "\\\\([\\da-f]{1,6}" + whitespace + "?|(" + whitespace + ")|.)", "ig" ),
	funescape = function( _, escaped, escapedWhitespace ) {
		var high = "0x" + escaped - 0x10000;
		// NaN means non-codepoint
		// Support: Firefox<24
		// Workaround erroneous numeric interpretation of +"0x"
		return high !== high || escapedWhitespace ?
			escaped :
			high < 0 ?
				// BMP codepoint
				String.fromCharCode( high + 0x10000 ) :
				// Supplemental Plane codepoint (surrogate pair)
				String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
	},

	// CSS string/identifier serialization
	// https://drafts.csswg.org/cssom/#common-serializing-idioms
	rcssescape = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\0-\x1f\x7f-\uFFFF\w-]/g,
	fcssescape = function( ch, asCodePoint ) {
		if ( asCodePoint ) {

			// U+0000 NULL becomes U+FFFD REPLACEMENT CHARACTER
			if ( ch === "\0" ) {
				return "\uFFFD";
			}

			// Control characters and (dependent upon position) numbers get escaped as code points
			return ch.slice( 0, -1 ) + "\\" + ch.charCodeAt( ch.length - 1 ).toString( 16 ) + " ";
		}

		// Other potentially-special ASCII characters get backslash-escaped
		return "\\" + ch;
	},

	// Used for iframes
	// See setDocument()
	// Removing the function wrapper causes a "Permission Denied"
	// error in IE
	unloadHandler = function() {
		setDocument();
	},

	disabledAncestor = addCombinator(
		function( elem ) {
			return elem.disabled === true && ("form" in elem || "label" in elem);
		},
		{ dir: "parentNode", next: "legend" }
	);

// Optimize for push.apply( _, NodeList )
try {
	push.apply(
		(arr = slice.call( preferredDoc.childNodes )),
		preferredDoc.childNodes
	);
	// Support: Android<4.0
	// Detect silently failing push.apply
	arr[ preferredDoc.childNodes.length ].nodeType;
} catch ( e ) {
	push = { apply: arr.length ?

		// Leverage slice if possible
		function( target, els ) {
			push_native.apply( target, slice.call(els) );
		} :

		// Support: IE<9
		// Otherwise append directly
		function( target, els ) {
			var j = target.length,
				i = 0;
			// Can't trust NodeList.length
			while ( (target[j++] = els[i++]) ) {}
			target.length = j - 1;
		}
	};
}

function Sizzle( selector, context, results, seed ) {
	var m, i, elem, nid, match, groups, newSelector,
		newContext = context && context.ownerDocument,

		// nodeType defaults to 9, since context defaults to document
		nodeType = context ? context.nodeType : 9;

	results = results || [];

	// Return early from calls with invalid selector or context
	if ( typeof selector !== "string" || !selector ||
		nodeType !== 1 && nodeType !== 9 && nodeType !== 11 ) {

		return results;
	}

	// Try to shortcut find operations (as opposed to filters) in HTML documents
	if ( !seed ) {

		if ( ( context ? context.ownerDocument || context : preferredDoc ) !== document ) {
			setDocument( context );
		}
		context = context || document;

		if ( documentIsHTML ) {

			// If the selector is sufficiently simple, try using a "get*By*" DOM method
			// (excepting DocumentFragment context, where the methods don't exist)
			if ( nodeType !== 11 && (match = rquickExpr.exec( selector )) ) {

				// ID selector
				if ( (m = match[1]) ) {

					// Document context
					if ( nodeType === 9 ) {
						if ( (elem = context.getElementById( m )) ) {

							// Support: IE, Opera, Webkit
							// TODO: identify versions
							// getElementById can match elements by name instead of ID
							if ( elem.id === m ) {
								results.push( elem );
								return results;
							}
						} else {
							return results;
						}

					// Element context
					} else {

						// Support: IE, Opera, Webkit
						// TODO: identify versions
						// getElementById can match elements by name instead of ID
						if ( newContext && (elem = newContext.getElementById( m )) &&
							contains( context, elem ) &&
							elem.id === m ) {

							results.push( elem );
							return results;
						}
					}

				// Type selector
				} else if ( match[2] ) {
					push.apply( results, context.getElementsByTagName( selector ) );
					return results;

				// Class selector
				} else if ( (m = match[3]) && support.getElementsByClassName &&
					context.getElementsByClassName ) {

					push.apply( results, context.getElementsByClassName( m ) );
					return results;
				}
			}

			// Take advantage of querySelectorAll
			if ( support.qsa &&
				!compilerCache[ selector + " " ] &&
				(!rbuggyQSA || !rbuggyQSA.test( selector )) ) {

				if ( nodeType !== 1 ) {
					newContext = context;
					newSelector = selector;

				// qSA looks outside Element context, which is not what we want
				// Thanks to Andrew Dupont for this workaround technique
				// Support: IE <=8
				// Exclude object elements
				} else if ( context.nodeName.toLowerCase() !== "object" ) {

					// Capture the context ID, setting it first if necessary
					if ( (nid = context.getAttribute( "id" )) ) {
						nid = nid.replace( rcssescape, fcssescape );
					} else {
						context.setAttribute( "id", (nid = expando) );
					}

					// Prefix every selector in the list
					groups = tokenize( selector );
					i = groups.length;
					while ( i-- ) {
						groups[i] = "#" + nid + " " + toSelector( groups[i] );
					}
					newSelector = groups.join( "," );

					// Expand context for sibling selectors
					newContext = rsibling.test( selector ) && testContext( context.parentNode ) ||
						context;
				}

				if ( newSelector ) {
					try {
						push.apply( results,
							newContext.querySelectorAll( newSelector )
						);
						return results;
					} catch ( qsaError ) {
					} finally {
						if ( nid === expando ) {
							context.removeAttribute( "id" );
						}
					}
				}
			}
		}
	}

	// All others
	return select( selector.replace( rtrim, "$1" ), context, results, seed );
}

/**
 * Create key-value caches of limited size
 * @returns {function(string, object)} Returns the Object data after storing it on itself with
 *	property name the (space-suffixed) string and (if the cache is larger than Expr.cacheLength)
 *	deleting the oldest entry
 */
function createCache() {
	var keys = [];

	function cache( key, value ) {
		// Use (key + " ") to avoid collision with native prototype properties (see Issue #157)
		if ( keys.push( key + " " ) > Expr.cacheLength ) {
			// Only keep the most recent entries
			delete cache[ keys.shift() ];
		}
		return (cache[ key + " " ] = value);
	}
	return cache;
}

/**
 * Mark a function for special use by Sizzle
 * @param {Function} fn The function to mark
 */
function markFunction( fn ) {
	fn[ expando ] = true;
	return fn;
}

/**
 * Support testing using an element
 * @param {Function} fn Passed the created element and returns a boolean result
 */
function assert( fn ) {
	var el = document.createElement("fieldset");

	try {
		return !!fn( el );
	} catch (e) {
		return false;
	} finally {
		// Remove from its parent by default
		if ( el.parentNode ) {
			el.parentNode.removeChild( el );
		}
		// release memory in IE
		el = null;
	}
}

/**
 * Adds the same handler for all of the specified attrs
 * @param {String} attrs Pipe-separated list of attributes
 * @param {Function} handler The method that will be applied
 */
function addHandle( attrs, handler ) {
	var arr = attrs.split("|"),
		i = arr.length;

	while ( i-- ) {
		Expr.attrHandle[ arr[i] ] = handler;
	}
}

/**
 * Checks document order of two siblings
 * @param {Element} a
 * @param {Element} b
 * @returns {Number} Returns less than 0 if a precedes b, greater than 0 if a follows b
 */
function siblingCheck( a, b ) {
	var cur = b && a,
		diff = cur && a.nodeType === 1 && b.nodeType === 1 &&
			a.sourceIndex - b.sourceIndex;

	// Use IE sourceIndex if available on both nodes
	if ( diff ) {
		return diff;
	}

	// Check if b follows a
	if ( cur ) {
		while ( (cur = cur.nextSibling) ) {
			if ( cur === b ) {
				return -1;
			}
		}
	}

	return a ? 1 : -1;
}

/**
 * Returns a function to use in pseudos for input types
 * @param {String} type
 */
function createInputPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return name === "input" && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for buttons
 * @param {String} type
 */
function createButtonPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return (name === "input" || name === "button") && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for :enabled/:disabled
 * @param {Boolean} disabled true for :disabled; false for :enabled
 */
function createDisabledPseudo( disabled ) {

	// Known :disabled false positives: fieldset[disabled] > legend:nth-of-type(n+2) :can-disable
	return function( elem ) {

		// Only certain elements can match :enabled or :disabled
		// https://html.spec.whatwg.org/multipage/scripting.html#selector-enabled
		// https://html.spec.whatwg.org/multipage/scripting.html#selector-disabled
		if ( "form" in elem ) {

			// Check for inherited disabledness on relevant non-disabled elements:
			// * listed form-associated elements in a disabled fieldset
			//   https://html.spec.whatwg.org/multipage/forms.html#category-listed
			//   https://html.spec.whatwg.org/multipage/forms.html#concept-fe-disabled
			// * option elements in a disabled optgroup
			//   https://html.spec.whatwg.org/multipage/forms.html#concept-option-disabled
			// All such elements have a "form" property.
			if ( elem.parentNode && elem.disabled === false ) {

				// Option elements defer to a parent optgroup if present
				if ( "label" in elem ) {
					if ( "label" in elem.parentNode ) {
						return elem.parentNode.disabled === disabled;
					} else {
						return elem.disabled === disabled;
					}
				}

				// Support: IE 6 - 11
				// Use the isDisabled shortcut property to check for disabled fieldset ancestors
				return elem.isDisabled === disabled ||

					// Where there is no isDisabled, check manually
					/* jshint -W018 */
					elem.isDisabled !== !disabled &&
						disabledAncestor( elem ) === disabled;
			}

			return elem.disabled === disabled;

		// Try to winnow out elements that can't be disabled before trusting the disabled property.
		// Some victims get caught in our net (label, legend, menu, track), but it shouldn't
		// even exist on them, let alone have a boolean value.
		} else if ( "label" in elem ) {
			return elem.disabled === disabled;
		}

		// Remaining elements are neither :enabled nor :disabled
		return false;
	};
}

/**
 * Returns a function to use in pseudos for positionals
 * @param {Function} fn
 */
function createPositionalPseudo( fn ) {
	return markFunction(function( argument ) {
		argument = +argument;
		return markFunction(function( seed, matches ) {
			var j,
				matchIndexes = fn( [], seed.length, argument ),
				i = matchIndexes.length;

			// Match elements found at the specified indexes
			while ( i-- ) {
				if ( seed[ (j = matchIndexes[i]) ] ) {
					seed[j] = !(matches[j] = seed[j]);
				}
			}
		});
	});
}

/**
 * Checks a node for validity as a Sizzle context
 * @param {Element|Object=} context
 * @returns {Element|Object|Boolean} The input node if acceptable, otherwise a falsy value
 */
function testContext( context ) {
	return context && typeof context.getElementsByTagName !== "undefined" && context;
}

// Expose support vars for convenience
support = Sizzle.support = {};

/**
 * Detects XML nodes
 * @param {Element|Object} elem An element or a document
 * @returns {Boolean} True iff elem is a non-HTML XML node
 */
isXML = Sizzle.isXML = function( elem ) {
	// documentElement is verified for cases where it doesn't yet exist
	// (such as loading iframes in IE - #4833)
	var documentElement = elem && (elem.ownerDocument || elem).documentElement;
	return documentElement ? documentElement.nodeName !== "HTML" : false;
};

/**
 * Sets document-related variables once based on the current document
 * @param {Element|Object} [doc] An element or document object to use to set the document
 * @returns {Object} Returns the current document
 */
setDocument = Sizzle.setDocument = function( node ) {
	var hasCompare, subWindow,
		doc = node ? node.ownerDocument || node : preferredDoc;

	// Return early if doc is invalid or already selected
	if ( doc === document || doc.nodeType !== 9 || !doc.documentElement ) {
		return document;
	}

	// Update global variables
	document = doc;
	docElem = document.documentElement;
	documentIsHTML = !isXML( document );

	// Support: IE 9-11, Edge
	// Accessing iframe documents after unload throws "permission denied" errors (jQuery #13936)
	if ( preferredDoc !== document &&
		(subWindow = document.defaultView) && subWindow.top !== subWindow ) {

		// Support: IE 11, Edge
		if ( subWindow.addEventListener ) {
			subWindow.addEventListener( "unload", unloadHandler, false );

		// Support: IE 9 - 10 only
		} else if ( subWindow.attachEvent ) {
			subWindow.attachEvent( "onunload", unloadHandler );
		}
	}

	/* Attributes
	---------------------------------------------------------------------- */

	// Support: IE<8
	// Verify that getAttribute really returns attributes and not properties
	// (excepting IE8 booleans)
	support.attributes = assert(function( el ) {
		el.className = "i";
		return !el.getAttribute("className");
	});

	/* getElement(s)By*
	---------------------------------------------------------------------- */

	// Check if getElementsByTagName("*") returns only elements
	support.getElementsByTagName = assert(function( el ) {
		el.appendChild( document.createComment("") );
		return !el.getElementsByTagName("*").length;
	});

	// Support: IE<9
	support.getElementsByClassName = rnative.test( document.getElementsByClassName );

	// Support: IE<10
	// Check if getElementById returns elements by name
	// The broken getElementById methods don't pick up programmatically-set names,
	// so use a roundabout getElementsByName test
	support.getById = assert(function( el ) {
		docElem.appendChild( el ).id = expando;
		return !document.getElementsByName || !document.getElementsByName( expando ).length;
	});

	// ID filter and find
	if ( support.getById ) {
		Expr.filter["ID"] = function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				return elem.getAttribute("id") === attrId;
			};
		};
		Expr.find["ID"] = function( id, context ) {
			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
				var elem = context.getElementById( id );
				return elem ? [ elem ] : [];
			}
		};
	} else {
		Expr.filter["ID"] =  function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				var node = typeof elem.getAttributeNode !== "undefined" &&
					elem.getAttributeNode("id");
				return node && node.value === attrId;
			};
		};

		// Support: IE 6 - 7 only
		// getElementById is not reliable as a find shortcut
		Expr.find["ID"] = function( id, context ) {
			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
				var node, i, elems,
					elem = context.getElementById( id );

				if ( elem ) {

					// Verify the id attribute
					node = elem.getAttributeNode("id");
					if ( node && node.value === id ) {
						return [ elem ];
					}

					// Fall back on getElementsByName
					elems = context.getElementsByName( id );
					i = 0;
					while ( (elem = elems[i++]) ) {
						node = elem.getAttributeNode("id");
						if ( node && node.value === id ) {
							return [ elem ];
						}
					}
				}

				return [];
			}
		};
	}

	// Tag
	Expr.find["TAG"] = support.getElementsByTagName ?
		function( tag, context ) {
			if ( typeof context.getElementsByTagName !== "undefined" ) {
				return context.getElementsByTagName( tag );

			// DocumentFragment nodes don't have gEBTN
			} else if ( support.qsa ) {
				return context.querySelectorAll( tag );
			}
		} :

		function( tag, context ) {
			var elem,
				tmp = [],
				i = 0,
				// By happy coincidence, a (broken) gEBTN appears on DocumentFragment nodes too
				results = context.getElementsByTagName( tag );

			// Filter out possible comments
			if ( tag === "*" ) {
				while ( (elem = results[i++]) ) {
					if ( elem.nodeType === 1 ) {
						tmp.push( elem );
					}
				}

				return tmp;
			}
			return results;
		};

	// Class
	Expr.find["CLASS"] = support.getElementsByClassName && function( className, context ) {
		if ( typeof context.getElementsByClassName !== "undefined" && documentIsHTML ) {
			return context.getElementsByClassName( className );
		}
	};

	/* QSA/matchesSelector
	---------------------------------------------------------------------- */

	// QSA and matchesSelector support

	// matchesSelector(:active) reports false when true (IE9/Opera 11.5)
	rbuggyMatches = [];

	// qSa(:focus) reports false when true (Chrome 21)
	// We allow this because of a bug in IE8/9 that throws an error
	// whenever `document.activeElement` is accessed on an iframe
	// So, we allow :focus to pass through QSA all the time to avoid the IE error
	// See https://bugs.jquery.com/ticket/13378
	rbuggyQSA = [];

	if ( (support.qsa = rnative.test( document.querySelectorAll )) ) {
		// Build QSA regex
		// Regex strategy adopted from Diego Perini
		assert(function( el ) {
			// Select is set to empty string on purpose
			// This is to test IE's treatment of not explicitly
			// setting a boolean content attribute,
			// since its presence should be enough
			// https://bugs.jquery.com/ticket/12359
			docElem.appendChild( el ).innerHTML = "<a id='" + expando + "'></a>" +
				"<select id='" + expando + "-\r\\' msallowcapture=''>" +
				"<option selected=''></option></select>";

			// Support: IE8, Opera 11-12.16
			// Nothing should be selected when empty strings follow ^= or $= or *=
			// The test attribute must be unknown in Opera but "safe" for WinRT
			// https://msdn.microsoft.com/en-us/library/ie/hh465388.aspx#attribute_section
			if ( el.querySelectorAll("[msallowcapture^='']").length ) {
				rbuggyQSA.push( "[*^$]=" + whitespace + "*(?:''|\"\")" );
			}

			// Support: IE8
			// Boolean attributes and "value" are not treated correctly
			if ( !el.querySelectorAll("[selected]").length ) {
				rbuggyQSA.push( "\\[" + whitespace + "*(?:value|" + booleans + ")" );
			}

			// Support: Chrome<29, Android<4.4, Safari<7.0+, iOS<7.0+, PhantomJS<1.9.8+
			if ( !el.querySelectorAll( "[id~=" + expando + "-]" ).length ) {
				rbuggyQSA.push("~=");
			}

			// Webkit/Opera - :checked should return selected option elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			// IE8 throws error here and will not see later tests
			if ( !el.querySelectorAll(":checked").length ) {
				rbuggyQSA.push(":checked");
			}

			// Support: Safari 8+, iOS 8+
			// https://bugs.webkit.org/show_bug.cgi?id=136851
			// In-page `selector#id sibling-combinator selector` fails
			if ( !el.querySelectorAll( "a#" + expando + "+*" ).length ) {
				rbuggyQSA.push(".#.+[+~]");
			}
		});

		assert(function( el ) {
			el.innerHTML = "<a href='' disabled='disabled'></a>" +
				"<select disabled='disabled'><option/></select>";

			// Support: Windows 8 Native Apps
			// The type and name attributes are restricted during .innerHTML assignment
			var input = document.createElement("input");
			input.setAttribute( "type", "hidden" );
			el.appendChild( input ).setAttribute( "name", "D" );

			// Support: IE8
			// Enforce case-sensitivity of name attribute
			if ( el.querySelectorAll("[name=d]").length ) {
				rbuggyQSA.push( "name" + whitespace + "*[*^$|!~]?=" );
			}

			// FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
			// IE8 throws error here and will not see later tests
			if ( el.querySelectorAll(":enabled").length !== 2 ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}

			// Support: IE9-11+
			// IE's :disabled selector does not pick up the children of disabled fieldsets
			docElem.appendChild( el ).disabled = true;
			if ( el.querySelectorAll(":disabled").length !== 2 ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}

			// Opera 10-11 does not throw on post-comma invalid pseudos
			el.querySelectorAll("*,:x");
			rbuggyQSA.push(",.*:");
		});
	}

	if ( (support.matchesSelector = rnative.test( (matches = docElem.matches ||
		docElem.webkitMatchesSelector ||
		docElem.mozMatchesSelector ||
		docElem.oMatchesSelector ||
		docElem.msMatchesSelector) )) ) {

		assert(function( el ) {
			// Check to see if it's possible to do matchesSelector
			// on a disconnected node (IE 9)
			support.disconnectedMatch = matches.call( el, "*" );

			// This should fail with an exception
			// Gecko does not error, returns false instead
			matches.call( el, "[s!='']:x" );
			rbuggyMatches.push( "!=", pseudos );
		});
	}

	rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join("|") );
	rbuggyMatches = rbuggyMatches.length && new RegExp( rbuggyMatches.join("|") );

	/* Contains
	---------------------------------------------------------------------- */
	hasCompare = rnative.test( docElem.compareDocumentPosition );

	// Element contains another
	// Purposefully self-exclusive
	// As in, an element does not contain itself
	contains = hasCompare || rnative.test( docElem.contains ) ?
		function( a, b ) {
			var adown = a.nodeType === 9 ? a.documentElement : a,
				bup = b && b.parentNode;
			return a === bup || !!( bup && bup.nodeType === 1 && (
				adown.contains ?
					adown.contains( bup ) :
					a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
			));
		} :
		function( a, b ) {
			if ( b ) {
				while ( (b = b.parentNode) ) {
					if ( b === a ) {
						return true;
					}
				}
			}
			return false;
		};

	/* Sorting
	---------------------------------------------------------------------- */

	// Document order sorting
	sortOrder = hasCompare ?
	function( a, b ) {

		// Flag for duplicate removal
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		// Sort on method existence if only one input has compareDocumentPosition
		var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
		if ( compare ) {
			return compare;
		}

		// Calculate position if both inputs belong to the same document
		compare = ( a.ownerDocument || a ) === ( b.ownerDocument || b ) ?
			a.compareDocumentPosition( b ) :

			// Otherwise we know they are disconnected
			1;

		// Disconnected nodes
		if ( compare & 1 ||
			(!support.sortDetached && b.compareDocumentPosition( a ) === compare) ) {

			// Choose the first element that is related to our preferred document
			if ( a === document || a.ownerDocument === preferredDoc && contains(preferredDoc, a) ) {
				return -1;
			}
			if ( b === document || b.ownerDocument === preferredDoc && contains(preferredDoc, b) ) {
				return 1;
			}

			// Maintain original order
			return sortInput ?
				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
				0;
		}

		return compare & 4 ? -1 : 1;
	} :
	function( a, b ) {
		// Exit early if the nodes are identical
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		var cur,
			i = 0,
			aup = a.parentNode,
			bup = b.parentNode,
			ap = [ a ],
			bp = [ b ];

		// Parentless nodes are either documents or disconnected
		if ( !aup || !bup ) {
			return a === document ? -1 :
				b === document ? 1 :
				aup ? -1 :
				bup ? 1 :
				sortInput ?
				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
				0;

		// If the nodes are siblings, we can do a quick check
		} else if ( aup === bup ) {
			return siblingCheck( a, b );
		}

		// Otherwise we need full lists of their ancestors for comparison
		cur = a;
		while ( (cur = cur.parentNode) ) {
			ap.unshift( cur );
		}
		cur = b;
		while ( (cur = cur.parentNode) ) {
			bp.unshift( cur );
		}

		// Walk down the tree looking for a discrepancy
		while ( ap[i] === bp[i] ) {
			i++;
		}

		return i ?
			// Do a sibling check if the nodes have a common ancestor
			siblingCheck( ap[i], bp[i] ) :

			// Otherwise nodes in our document sort first
			ap[i] === preferredDoc ? -1 :
			bp[i] === preferredDoc ? 1 :
			0;
	};

	return document;
};

Sizzle.matches = function( expr, elements ) {
	return Sizzle( expr, null, null, elements );
};

Sizzle.matchesSelector = function( elem, expr ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	// Make sure that attribute selectors are quoted
	expr = expr.replace( rattributeQuotes, "='$1']" );

	if ( support.matchesSelector && documentIsHTML &&
		!compilerCache[ expr + " " ] &&
		( !rbuggyMatches || !rbuggyMatches.test( expr ) ) &&
		( !rbuggyQSA     || !rbuggyQSA.test( expr ) ) ) {

		try {
			var ret = matches.call( elem, expr );

			// IE 9's matchesSelector returns false on disconnected nodes
			if ( ret || support.disconnectedMatch ||
					// As well, disconnected nodes are said to be in a document
					// fragment in IE 9
					elem.document && elem.document.nodeType !== 11 ) {
				return ret;
			}
		} catch (e) {}
	}

	return Sizzle( expr, document, null, [ elem ] ).length > 0;
};

Sizzle.contains = function( context, elem ) {
	// Set document vars if needed
	if ( ( context.ownerDocument || context ) !== document ) {
		setDocument( context );
	}
	return contains( context, elem );
};

Sizzle.attr = function( elem, name ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	var fn = Expr.attrHandle[ name.toLowerCase() ],
		// Don't get fooled by Object.prototype properties (jQuery #13807)
		val = fn && hasOwn.call( Expr.attrHandle, name.toLowerCase() ) ?
			fn( elem, name, !documentIsHTML ) :
			undefined;

	return val !== undefined ?
		val :
		support.attributes || !documentIsHTML ?
			elem.getAttribute( name ) :
			(val = elem.getAttributeNode(name)) && val.specified ?
				val.value :
				null;
};

Sizzle.escape = function( sel ) {
	return (sel + "").replace( rcssescape, fcssescape );
};

Sizzle.error = function( msg ) {
	throw new Error( "Syntax error, unrecognized expression: " + msg );
};

/**
 * Document sorting and removing duplicates
 * @param {ArrayLike} results
 */
Sizzle.uniqueSort = function( results ) {
	var elem,
		duplicates = [],
		j = 0,
		i = 0;

	// Unless we *know* we can detect duplicates, assume their presence
	hasDuplicate = !support.detectDuplicates;
	sortInput = !support.sortStable && results.slice( 0 );
	results.sort( sortOrder );

	if ( hasDuplicate ) {
		while ( (elem = results[i++]) ) {
			if ( elem === results[ i ] ) {
				j = duplicates.push( i );
			}
		}
		while ( j-- ) {
			results.splice( duplicates[ j ], 1 );
		}
	}

	// Clear input after sorting to release objects
	// See https://github.com/jquery/sizzle/pull/225
	sortInput = null;

	return results;
};

/**
 * Utility function for retrieving the text value of an array of DOM nodes
 * @param {Array|Element} elem
 */
getText = Sizzle.getText = function( elem ) {
	var node,
		ret = "",
		i = 0,
		nodeType = elem.nodeType;

	if ( !nodeType ) {
		// If no nodeType, this is expected to be an array
		while ( (node = elem[i++]) ) {
			// Do not traverse comment nodes
			ret += getText( node );
		}
	} else if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
		// Use textContent for elements
		// innerText usage removed for consistency of new lines (jQuery #11153)
		if ( typeof elem.textContent === "string" ) {
			return elem.textContent;
		} else {
			// Traverse its children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				ret += getText( elem );
			}
		}
	} else if ( nodeType === 3 || nodeType === 4 ) {
		return elem.nodeValue;
	}
	// Do not include comment or processing instruction nodes

	return ret;
};

Expr = Sizzle.selectors = {

	// Can be adjusted by the user
	cacheLength: 50,

	createPseudo: markFunction,

	match: matchExpr,

	attrHandle: {},

	find: {},

	relative: {
		">": { dir: "parentNode", first: true },
		" ": { dir: "parentNode" },
		"+": { dir: "previousSibling", first: true },
		"~": { dir: "previousSibling" }
	},

	preFilter: {
		"ATTR": function( match ) {
			match[1] = match[1].replace( runescape, funescape );

			// Move the given value to match[3] whether quoted or unquoted
			match[3] = ( match[3] || match[4] || match[5] || "" ).replace( runescape, funescape );

			if ( match[2] === "~=" ) {
				match[3] = " " + match[3] + " ";
			}

			return match.slice( 0, 4 );
		},

		"CHILD": function( match ) {
			/* matches from matchExpr["CHILD"]
				1 type (only|nth|...)
				2 what (child|of-type)
				3 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
				4 xn-component of xn+y argument ([+-]?\d*n|)
				5 sign of xn-component
				6 x of xn-component
				7 sign of y-component
				8 y of y-component
			*/
			match[1] = match[1].toLowerCase();

			if ( match[1].slice( 0, 3 ) === "nth" ) {
				// nth-* requires argument
				if ( !match[3] ) {
					Sizzle.error( match[0] );
				}

				// numeric x and y parameters for Expr.filter.CHILD
				// remember that false/true cast respectively to 0/1
				match[4] = +( match[4] ? match[5] + (match[6] || 1) : 2 * ( match[3] === "even" || match[3] === "odd" ) );
				match[5] = +( ( match[7] + match[8] ) || match[3] === "odd" );

			// other types prohibit arguments
			} else if ( match[3] ) {
				Sizzle.error( match[0] );
			}

			return match;
		},

		"PSEUDO": function( match ) {
			var excess,
				unquoted = !match[6] && match[2];

			if ( matchExpr["CHILD"].test( match[0] ) ) {
				return null;
			}

			// Accept quoted arguments as-is
			if ( match[3] ) {
				match[2] = match[4] || match[5] || "";

			// Strip excess characters from unquoted arguments
			} else if ( unquoted && rpseudo.test( unquoted ) &&
				// Get excess from tokenize (recursively)
				(excess = tokenize( unquoted, true )) &&
				// advance to the next closing parenthesis
				(excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length) ) {

				// excess is a negative index
				match[0] = match[0].slice( 0, excess );
				match[2] = unquoted.slice( 0, excess );
			}

			// Return only captures needed by the pseudo filter method (type and argument)
			return match.slice( 0, 3 );
		}
	},

	filter: {

		"TAG": function( nodeNameSelector ) {
			var nodeName = nodeNameSelector.replace( runescape, funescape ).toLowerCase();
			return nodeNameSelector === "*" ?
				function() { return true; } :
				function( elem ) {
					return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
				};
		},

		"CLASS": function( className ) {
			var pattern = classCache[ className + " " ];

			return pattern ||
				(pattern = new RegExp( "(^|" + whitespace + ")" + className + "(" + whitespace + "|$)" )) &&
				classCache( className, function( elem ) {
					return pattern.test( typeof elem.className === "string" && elem.className || typeof elem.getAttribute !== "undefined" && elem.getAttribute("class") || "" );
				});
		},

		"ATTR": function( name, operator, check ) {
			return function( elem ) {
				var result = Sizzle.attr( elem, name );

				if ( result == null ) {
					return operator === "!=";
				}
				if ( !operator ) {
					return true;
				}

				result += "";

				return operator === "=" ? result === check :
					operator === "!=" ? result !== check :
					operator === "^=" ? check && result.indexOf( check ) === 0 :
					operator === "*=" ? check && result.indexOf( check ) > -1 :
					operator === "$=" ? check && result.slice( -check.length ) === check :
					operator === "~=" ? ( " " + result.replace( rwhitespace, " " ) + " " ).indexOf( check ) > -1 :
					operator === "|=" ? result === check || result.slice( 0, check.length + 1 ) === check + "-" :
					false;
			};
		},

		"CHILD": function( type, what, argument, first, last ) {
			var simple = type.slice( 0, 3 ) !== "nth",
				forward = type.slice( -4 ) !== "last",
				ofType = what === "of-type";

			return first === 1 && last === 0 ?

				// Shortcut for :nth-*(n)
				function( elem ) {
					return !!elem.parentNode;
				} :

				function( elem, context, xml ) {
					var cache, uniqueCache, outerCache, node, nodeIndex, start,
						dir = simple !== forward ? "nextSibling" : "previousSibling",
						parent = elem.parentNode,
						name = ofType && elem.nodeName.toLowerCase(),
						useCache = !xml && !ofType,
						diff = false;

					if ( parent ) {

						// :(first|last|only)-(child|of-type)
						if ( simple ) {
							while ( dir ) {
								node = elem;
								while ( (node = node[ dir ]) ) {
									if ( ofType ?
										node.nodeName.toLowerCase() === name :
										node.nodeType === 1 ) {

										return false;
									}
								}
								// Reverse direction for :only-* (if we haven't yet done so)
								start = dir = type === "only" && !start && "nextSibling";
							}
							return true;
						}

						start = [ forward ? parent.firstChild : parent.lastChild ];

						// non-xml :nth-child(...) stores cache data on `parent`
						if ( forward && useCache ) {

							// Seek `elem` from a previously-cached index

							// ...in a gzip-friendly way
							node = parent;
							outerCache = node[ expando ] || (node[ expando ] = {});

							// Support: IE <9 only
							// Defend against cloned attroperties (jQuery gh-1709)
							uniqueCache = outerCache[ node.uniqueID ] ||
								(outerCache[ node.uniqueID ] = {});

							cache = uniqueCache[ type ] || [];
							nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
							diff = nodeIndex && cache[ 2 ];
							node = nodeIndex && parent.childNodes[ nodeIndex ];

							while ( (node = ++nodeIndex && node && node[ dir ] ||

								// Fallback to seeking `elem` from the start
								(diff = nodeIndex = 0) || start.pop()) ) {

								// When found, cache indexes on `parent` and break
								if ( node.nodeType === 1 && ++diff && node === elem ) {
									uniqueCache[ type ] = [ dirruns, nodeIndex, diff ];
									break;
								}
							}

						} else {
							// Use previously-cached element index if available
							if ( useCache ) {
								// ...in a gzip-friendly way
								node = elem;
								outerCache = node[ expando ] || (node[ expando ] = {});

								// Support: IE <9 only
								// Defend against cloned attroperties (jQuery gh-1709)
								uniqueCache = outerCache[ node.uniqueID ] ||
									(outerCache[ node.uniqueID ] = {});

								cache = uniqueCache[ type ] || [];
								nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
								diff = nodeIndex;
							}

							// xml :nth-child(...)
							// or :nth-last-child(...) or :nth(-last)?-of-type(...)
							if ( diff === false ) {
								// Use the same loop as above to seek `elem` from the start
								while ( (node = ++nodeIndex && node && node[ dir ] ||
									(diff = nodeIndex = 0) || start.pop()) ) {

									if ( ( ofType ?
										node.nodeName.toLowerCase() === name :
										node.nodeType === 1 ) &&
										++diff ) {

										// Cache the index of each encountered element
										if ( useCache ) {
											outerCache = node[ expando ] || (node[ expando ] = {});

											// Support: IE <9 only
											// Defend against cloned attroperties (jQuery gh-1709)
											uniqueCache = outerCache[ node.uniqueID ] ||
												(outerCache[ node.uniqueID ] = {});

											uniqueCache[ type ] = [ dirruns, diff ];
										}

										if ( node === elem ) {
											break;
										}
									}
								}
							}
						}

						// Incorporate the offset, then check against cycle size
						diff -= last;
						return diff === first || ( diff % first === 0 && diff / first >= 0 );
					}
				};
		},

		"PSEUDO": function( pseudo, argument ) {
			// pseudo-class names are case-insensitive
			// http://www.w3.org/TR/selectors/#pseudo-classes
			// Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
			// Remember that setFilters inherits from pseudos
			var args,
				fn = Expr.pseudos[ pseudo ] || Expr.setFilters[ pseudo.toLowerCase() ] ||
					Sizzle.error( "unsupported pseudo: " + pseudo );

			// The user may use createPseudo to indicate that
			// arguments are needed to create the filter function
			// just as Sizzle does
			if ( fn[ expando ] ) {
				return fn( argument );
			}

			// But maintain support for old signatures
			if ( fn.length > 1 ) {
				args = [ pseudo, pseudo, "", argument ];
				return Expr.setFilters.hasOwnProperty( pseudo.toLowerCase() ) ?
					markFunction(function( seed, matches ) {
						var idx,
							matched = fn( seed, argument ),
							i = matched.length;
						while ( i-- ) {
							idx = indexOf( seed, matched[i] );
							seed[ idx ] = !( matches[ idx ] = matched[i] );
						}
					}) :
					function( elem ) {
						return fn( elem, 0, args );
					};
			}

			return fn;
		}
	},

	pseudos: {
		// Potentially complex pseudos
		"not": markFunction(function( selector ) {
			// Trim the selector passed to compile
			// to avoid treating leading and trailing
			// spaces as combinators
			var input = [],
				results = [],
				matcher = compile( selector.replace( rtrim, "$1" ) );

			return matcher[ expando ] ?
				markFunction(function( seed, matches, context, xml ) {
					var elem,
						unmatched = matcher( seed, null, xml, [] ),
						i = seed.length;

					// Match elements unmatched by `matcher`
					while ( i-- ) {
						if ( (elem = unmatched[i]) ) {
							seed[i] = !(matches[i] = elem);
						}
					}
				}) :
				function( elem, context, xml ) {
					input[0] = elem;
					matcher( input, null, xml, results );
					// Don't keep the element (issue #299)
					input[0] = null;
					return !results.pop();
				};
		}),

		"has": markFunction(function( selector ) {
			return function( elem ) {
				return Sizzle( selector, elem ).length > 0;
			};
		}),

		"contains": markFunction(function( text ) {
			text = text.replace( runescape, funescape );
			return function( elem ) {
				return ( elem.textContent || elem.innerText || getText( elem ) ).indexOf( text ) > -1;
			};
		}),

		// "Whether an element is represented by a :lang() selector
		// is based solely on the element's language value
		// being equal to the identifier C,
		// or beginning with the identifier C immediately followed by "-".
		// The matching of C against the element's language value is performed case-insensitively.
		// The identifier C does not have to be a valid language name."
		// http://www.w3.org/TR/selectors/#lang-pseudo
		"lang": markFunction( function( lang ) {
			// lang value must be a valid identifier
			if ( !ridentifier.test(lang || "") ) {
				Sizzle.error( "unsupported lang: " + lang );
			}
			lang = lang.replace( runescape, funescape ).toLowerCase();
			return function( elem ) {
				var elemLang;
				do {
					if ( (elemLang = documentIsHTML ?
						elem.lang :
						elem.getAttribute("xml:lang") || elem.getAttribute("lang")) ) {

						elemLang = elemLang.toLowerCase();
						return elemLang === lang || elemLang.indexOf( lang + "-" ) === 0;
					}
				} while ( (elem = elem.parentNode) && elem.nodeType === 1 );
				return false;
			};
		}),

		// Miscellaneous
		"target": function( elem ) {
			var hash = window.location && window.location.hash;
			return hash && hash.slice( 1 ) === elem.id;
		},

		"root": function( elem ) {
			return elem === docElem;
		},

		"focus": function( elem ) {
			return elem === document.activeElement && (!document.hasFocus || document.hasFocus()) && !!(elem.type || elem.href || ~elem.tabIndex);
		},

		// Boolean properties
		"enabled": createDisabledPseudo( false ),
		"disabled": createDisabledPseudo( true ),

		"checked": function( elem ) {
			// In CSS3, :checked should return both checked and selected elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			var nodeName = elem.nodeName.toLowerCase();
			return (nodeName === "input" && !!elem.checked) || (nodeName === "option" && !!elem.selected);
		},

		"selected": function( elem ) {
			// Accessing this property makes selected-by-default
			// options in Safari work properly
			if ( elem.parentNode ) {
				elem.parentNode.selectedIndex;
			}

			return elem.selected === true;
		},

		// Contents
		"empty": function( elem ) {
			// http://www.w3.org/TR/selectors/#empty-pseudo
			// :empty is negated by element (1) or content nodes (text: 3; cdata: 4; entity ref: 5),
			//   but not by others (comment: 8; processing instruction: 7; etc.)
			// nodeType < 6 works because attributes (2) do not appear as children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				if ( elem.nodeType < 6 ) {
					return false;
				}
			}
			return true;
		},

		"parent": function( elem ) {
			return !Expr.pseudos["empty"]( elem );
		},

		// Element/input types
		"header": function( elem ) {
			return rheader.test( elem.nodeName );
		},

		"input": function( elem ) {
			return rinputs.test( elem.nodeName );
		},

		"button": function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return name === "input" && elem.type === "button" || name === "button";
		},

		"text": function( elem ) {
			var attr;
			return elem.nodeName.toLowerCase() === "input" &&
				elem.type === "text" &&

				// Support: IE<8
				// New HTML5 attribute values (e.g., "search") appear with elem.type === "text"
				( (attr = elem.getAttribute("type")) == null || attr.toLowerCase() === "text" );
		},

		// Position-in-collection
		"first": createPositionalPseudo(function() {
			return [ 0 ];
		}),

		"last": createPositionalPseudo(function( matchIndexes, length ) {
			return [ length - 1 ];
		}),

		"eq": createPositionalPseudo(function( matchIndexes, length, argument ) {
			return [ argument < 0 ? argument + length : argument ];
		}),

		"even": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 0;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"odd": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 1;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"lt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; --i >= 0; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"gt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; ++i < length; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		})
	}
};

Expr.pseudos["nth"] = Expr.pseudos["eq"];

// Add button/input type pseudos
for ( i in { radio: true, checkbox: true, file: true, password: true, image: true } ) {
	Expr.pseudos[ i ] = createInputPseudo( i );
}
for ( i in { submit: true, reset: true } ) {
	Expr.pseudos[ i ] = createButtonPseudo( i );
}

// Easy API for creating new setFilters
function setFilters() {}
setFilters.prototype = Expr.filters = Expr.pseudos;
Expr.setFilters = new setFilters();

tokenize = Sizzle.tokenize = function( selector, parseOnly ) {
	var matched, match, tokens, type,
		soFar, groups, preFilters,
		cached = tokenCache[ selector + " " ];

	if ( cached ) {
		return parseOnly ? 0 : cached.slice( 0 );
	}

	soFar = selector;
	groups = [];
	preFilters = Expr.preFilter;

	while ( soFar ) {

		// Comma and first run
		if ( !matched || (match = rcomma.exec( soFar )) ) {
			if ( match ) {
				// Don't consume trailing commas as valid
				soFar = soFar.slice( match[0].length ) || soFar;
			}
			groups.push( (tokens = []) );
		}

		matched = false;

		// Combinators
		if ( (match = rcombinators.exec( soFar )) ) {
			matched = match.shift();
			tokens.push({
				value: matched,
				// Cast descendant combinators to space
				type: match[0].replace( rtrim, " " )
			});
			soFar = soFar.slice( matched.length );
		}

		// Filters
		for ( type in Expr.filter ) {
			if ( (match = matchExpr[ type ].exec( soFar )) && (!preFilters[ type ] ||
				(match = preFilters[ type ]( match ))) ) {
				matched = match.shift();
				tokens.push({
					value: matched,
					type: type,
					matches: match
				});
				soFar = soFar.slice( matched.length );
			}
		}

		if ( !matched ) {
			break;
		}
	}

	// Return the length of the invalid excess
	// if we're just parsing
	// Otherwise, throw an error or return tokens
	return parseOnly ?
		soFar.length :
		soFar ?
			Sizzle.error( selector ) :
			// Cache the tokens
			tokenCache( selector, groups ).slice( 0 );
};

function toSelector( tokens ) {
	var i = 0,
		len = tokens.length,
		selector = "";
	for ( ; i < len; i++ ) {
		selector += tokens[i].value;
	}
	return selector;
}

function addCombinator( matcher, combinator, base ) {
	var dir = combinator.dir,
		skip = combinator.next,
		key = skip || dir,
		checkNonElements = base && key === "parentNode",
		doneName = done++;

	return combinator.first ?
		// Check against closest ancestor/preceding element
		function( elem, context, xml ) {
			while ( (elem = elem[ dir ]) ) {
				if ( elem.nodeType === 1 || checkNonElements ) {
					return matcher( elem, context, xml );
				}
			}
			return false;
		} :

		// Check against all ancestor/preceding elements
		function( elem, context, xml ) {
			var oldCache, uniqueCache, outerCache,
				newCache = [ dirruns, doneName ];

			// We can't set arbitrary data on XML nodes, so they don't benefit from combinator caching
			if ( xml ) {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						if ( matcher( elem, context, xml ) ) {
							return true;
						}
					}
				}
			} else {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						outerCache = elem[ expando ] || (elem[ expando ] = {});

						// Support: IE <9 only
						// Defend against cloned attroperties (jQuery gh-1709)
						uniqueCache = outerCache[ elem.uniqueID ] || (outerCache[ elem.uniqueID ] = {});

						if ( skip && skip === elem.nodeName.toLowerCase() ) {
							elem = elem[ dir ] || elem;
						} else if ( (oldCache = uniqueCache[ key ]) &&
							oldCache[ 0 ] === dirruns && oldCache[ 1 ] === doneName ) {

							// Assign to newCache so results back-propagate to previous elements
							return (newCache[ 2 ] = oldCache[ 2 ]);
						} else {
							// Reuse newcache so results back-propagate to previous elements
							uniqueCache[ key ] = newCache;

							// A match means we're done; a fail means we have to keep checking
							if ( (newCache[ 2 ] = matcher( elem, context, xml )) ) {
								return true;
							}
						}
					}
				}
			}
			return false;
		};
}

function elementMatcher( matchers ) {
	return matchers.length > 1 ?
		function( elem, context, xml ) {
			var i = matchers.length;
			while ( i-- ) {
				if ( !matchers[i]( elem, context, xml ) ) {
					return false;
				}
			}
			return true;
		} :
		matchers[0];
}

function multipleContexts( selector, contexts, results ) {
	var i = 0,
		len = contexts.length;
	for ( ; i < len; i++ ) {
		Sizzle( selector, contexts[i], results );
	}
	return results;
}

function condense( unmatched, map, filter, context, xml ) {
	var elem,
		newUnmatched = [],
		i = 0,
		len = unmatched.length,
		mapped = map != null;

	for ( ; i < len; i++ ) {
		if ( (elem = unmatched[i]) ) {
			if ( !filter || filter( elem, context, xml ) ) {
				newUnmatched.push( elem );
				if ( mapped ) {
					map.push( i );
				}
			}
		}
	}

	return newUnmatched;
}

function setMatcher( preFilter, selector, matcher, postFilter, postFinder, postSelector ) {
	if ( postFilter && !postFilter[ expando ] ) {
		postFilter = setMatcher( postFilter );
	}
	if ( postFinder && !postFinder[ expando ] ) {
		postFinder = setMatcher( postFinder, postSelector );
	}
	return markFunction(function( seed, results, context, xml ) {
		var temp, i, elem,
			preMap = [],
			postMap = [],
			preexisting = results.length,

			// Get initial elements from seed or context
			elems = seed || multipleContexts( selector || "*", context.nodeType ? [ context ] : context, [] ),

			// Prefilter to get matcher input, preserving a map for seed-results synchronization
			matcherIn = preFilter && ( seed || !selector ) ?
				condense( elems, preMap, preFilter, context, xml ) :
				elems,

			matcherOut = matcher ?
				// If we have a postFinder, or filtered seed, or non-seed postFilter or preexisting results,
				postFinder || ( seed ? preFilter : preexisting || postFilter ) ?

					// ...intermediate processing is necessary
					[] :

					// ...otherwise use results directly
					results :
				matcherIn;

		// Find primary matches
		if ( matcher ) {
			matcher( matcherIn, matcherOut, context, xml );
		}

		// Apply postFilter
		if ( postFilter ) {
			temp = condense( matcherOut, postMap );
			postFilter( temp, [], context, xml );

			// Un-match failing elements by moving them back to matcherIn
			i = temp.length;
			while ( i-- ) {
				if ( (elem = temp[i]) ) {
					matcherOut[ postMap[i] ] = !(matcherIn[ postMap[i] ] = elem);
				}
			}
		}

		if ( seed ) {
			if ( postFinder || preFilter ) {
				if ( postFinder ) {
					// Get the final matcherOut by condensing this intermediate into postFinder contexts
					temp = [];
					i = matcherOut.length;
					while ( i-- ) {
						if ( (elem = matcherOut[i]) ) {
							// Restore matcherIn since elem is not yet a final match
							temp.push( (matcherIn[i] = elem) );
						}
					}
					postFinder( null, (matcherOut = []), temp, xml );
				}

				// Move matched elements from seed to results to keep them synchronized
				i = matcherOut.length;
				while ( i-- ) {
					if ( (elem = matcherOut[i]) &&
						(temp = postFinder ? indexOf( seed, elem ) : preMap[i]) > -1 ) {

						seed[temp] = !(results[temp] = elem);
					}
				}
			}

		// Add elements to results, through postFinder if defined
		} else {
			matcherOut = condense(
				matcherOut === results ?
					matcherOut.splice( preexisting, matcherOut.length ) :
					matcherOut
			);
			if ( postFinder ) {
				postFinder( null, results, matcherOut, xml );
			} else {
				push.apply( results, matcherOut );
			}
		}
	});
}

function matcherFromTokens( tokens ) {
	var checkContext, matcher, j,
		len = tokens.length,
		leadingRelative = Expr.relative[ tokens[0].type ],
		implicitRelative = leadingRelative || Expr.relative[" "],
		i = leadingRelative ? 1 : 0,

		// The foundational matcher ensures that elements are reachable from top-level context(s)
		matchContext = addCombinator( function( elem ) {
			return elem === checkContext;
		}, implicitRelative, true ),
		matchAnyContext = addCombinator( function( elem ) {
			return indexOf( checkContext, elem ) > -1;
		}, implicitRelative, true ),
		matchers = [ function( elem, context, xml ) {
			var ret = ( !leadingRelative && ( xml || context !== outermostContext ) ) || (
				(checkContext = context).nodeType ?
					matchContext( elem, context, xml ) :
					matchAnyContext( elem, context, xml ) );
			// Avoid hanging onto element (issue #299)
			checkContext = null;
			return ret;
		} ];

	for ( ; i < len; i++ ) {
		if ( (matcher = Expr.relative[ tokens[i].type ]) ) {
			matchers = [ addCombinator(elementMatcher( matchers ), matcher) ];
		} else {
			matcher = Expr.filter[ tokens[i].type ].apply( null, tokens[i].matches );

			// Return special upon seeing a positional matcher
			if ( matcher[ expando ] ) {
				// Find the next relative operator (if any) for proper handling
				j = ++i;
				for ( ; j < len; j++ ) {
					if ( Expr.relative[ tokens[j].type ] ) {
						break;
					}
				}
				return setMatcher(
					i > 1 && elementMatcher( matchers ),
					i > 1 && toSelector(
						// If the preceding token was a descendant combinator, insert an implicit any-element `*`
						tokens.slice( 0, i - 1 ).concat({ value: tokens[ i - 2 ].type === " " ? "*" : "" })
					).replace( rtrim, "$1" ),
					matcher,
					i < j && matcherFromTokens( tokens.slice( i, j ) ),
					j < len && matcherFromTokens( (tokens = tokens.slice( j )) ),
					j < len && toSelector( tokens )
				);
			}
			matchers.push( matcher );
		}
	}

	return elementMatcher( matchers );
}

function matcherFromGroupMatchers( elementMatchers, setMatchers ) {
	var bySet = setMatchers.length > 0,
		byElement = elementMatchers.length > 0,
		superMatcher = function( seed, context, xml, results, outermost ) {
			var elem, j, matcher,
				matchedCount = 0,
				i = "0",
				unmatched = seed && [],
				setMatched = [],
				contextBackup = outermostContext,
				// We must always have either seed elements or outermost context
				elems = seed || byElement && Expr.find["TAG"]( "*", outermost ),
				// Use integer dirruns iff this is the outermost matcher
				dirrunsUnique = (dirruns += contextBackup == null ? 1 : Math.random() || 0.1),
				len = elems.length;

			if ( outermost ) {
				outermostContext = context === document || context || outermost;
			}

			// Add elements passing elementMatchers directly to results
			// Support: IE<9, Safari
			// Tolerate NodeList properties (IE: "length"; Safari: <number>) matching elements by id
			for ( ; i !== len && (elem = elems[i]) != null; i++ ) {
				if ( byElement && elem ) {
					j = 0;
					if ( !context && elem.ownerDocument !== document ) {
						setDocument( elem );
						xml = !documentIsHTML;
					}
					while ( (matcher = elementMatchers[j++]) ) {
						if ( matcher( elem, context || document, xml) ) {
							results.push( elem );
							break;
						}
					}
					if ( outermost ) {
						dirruns = dirrunsUnique;
					}
				}

				// Track unmatched elements for set filters
				if ( bySet ) {
					// They will have gone through all possible matchers
					if ( (elem = !matcher && elem) ) {
						matchedCount--;
					}

					// Lengthen the array for every element, matched or not
					if ( seed ) {
						unmatched.push( elem );
					}
				}
			}

			// `i` is now the count of elements visited above, and adding it to `matchedCount`
			// makes the latter nonnegative.
			matchedCount += i;

			// Apply set filters to unmatched elements
			// NOTE: This can be skipped if there are no unmatched elements (i.e., `matchedCount`
			// equals `i`), unless we didn't visit _any_ elements in the above loop because we have
			// no element matchers and no seed.
			// Incrementing an initially-string "0" `i` allows `i` to remain a string only in that
			// case, which will result in a "00" `matchedCount` that differs from `i` but is also
			// numerically zero.
			if ( bySet && i !== matchedCount ) {
				j = 0;
				while ( (matcher = setMatchers[j++]) ) {
					matcher( unmatched, setMatched, context, xml );
				}

				if ( seed ) {
					// Reintegrate element matches to eliminate the need for sorting
					if ( matchedCount > 0 ) {
						while ( i-- ) {
							if ( !(unmatched[i] || setMatched[i]) ) {
								setMatched[i] = pop.call( results );
							}
						}
					}

					// Discard index placeholder values to get only actual matches
					setMatched = condense( setMatched );
				}

				// Add matches to results
				push.apply( results, setMatched );

				// Seedless set matches succeeding multiple successful matchers stipulate sorting
				if ( outermost && !seed && setMatched.length > 0 &&
					( matchedCount + setMatchers.length ) > 1 ) {

					Sizzle.uniqueSort( results );
				}
			}

			// Override manipulation of globals by nested matchers
			if ( outermost ) {
				dirruns = dirrunsUnique;
				outermostContext = contextBackup;
			}

			return unmatched;
		};

	return bySet ?
		markFunction( superMatcher ) :
		superMatcher;
}

compile = Sizzle.compile = function( selector, match /* Internal Use Only */ ) {
	var i,
		setMatchers = [],
		elementMatchers = [],
		cached = compilerCache[ selector + " " ];

	if ( !cached ) {
		// Generate a function of recursive functions that can be used to check each element
		if ( !match ) {
			match = tokenize( selector );
		}
		i = match.length;
		while ( i-- ) {
			cached = matcherFromTokens( match[i] );
			if ( cached[ expando ] ) {
				setMatchers.push( cached );
			} else {
				elementMatchers.push( cached );
			}
		}

		// Cache the compiled function
		cached = compilerCache( selector, matcherFromGroupMatchers( elementMatchers, setMatchers ) );

		// Save selector and tokenization
		cached.selector = selector;
	}
	return cached;
};

/**
 * A low-level selection function that works with Sizzle's compiled
 *  selector functions
 * @param {String|Function} selector A selector or a pre-compiled
 *  selector function built with Sizzle.compile
 * @param {Element} context
 * @param {Array} [results]
 * @param {Array} [seed] A set of elements to match against
 */
select = Sizzle.select = function( selector, context, results, seed ) {
	var i, tokens, token, type, find,
		compiled = typeof selector === "function" && selector,
		match = !seed && tokenize( (selector = compiled.selector || selector) );

	results = results || [];

	// Try to minimize operations if there is only one selector in the list and no seed
	// (the latter of which guarantees us context)
	if ( match.length === 1 ) {

		// Reduce context if the leading compound selector is an ID
		tokens = match[0] = match[0].slice( 0 );
		if ( tokens.length > 2 && (token = tokens[0]).type === "ID" &&
				context.nodeType === 9 && documentIsHTML && Expr.relative[ tokens[1].type ] ) {

			context = ( Expr.find["ID"]( token.matches[0].replace(runescape, funescape), context ) || [] )[0];
			if ( !context ) {
				return results;

			// Precompiled matchers will still verify ancestry, so step up a level
			} else if ( compiled ) {
				context = context.parentNode;
			}

			selector = selector.slice( tokens.shift().value.length );
		}

		// Fetch a seed set for right-to-left matching
		i = matchExpr["needsContext"].test( selector ) ? 0 : tokens.length;
		while ( i-- ) {
			token = tokens[i];

			// Abort if we hit a combinator
			if ( Expr.relative[ (type = token.type) ] ) {
				break;
			}
			if ( (find = Expr.find[ type ]) ) {
				// Search, expanding context for leading sibling combinators
				if ( (seed = find(
					token.matches[0].replace( runescape, funescape ),
					rsibling.test( tokens[0].type ) && testContext( context.parentNode ) || context
				)) ) {

					// If seed is empty or no tokens remain, we can return early
					tokens.splice( i, 1 );
					selector = seed.length && toSelector( tokens );
					if ( !selector ) {
						push.apply( results, seed );
						return results;
					}

					break;
				}
			}
		}
	}

	// Compile and execute a filtering function if one is not provided
	// Provide `match` to avoid retokenization if we modified the selector above
	( compiled || compile( selector, match ) )(
		seed,
		context,
		!documentIsHTML,
		results,
		!context || rsibling.test( selector ) && testContext( context.parentNode ) || context
	);
	return results;
};

// One-time assignments

// Sort stability
support.sortStable = expando.split("").sort( sortOrder ).join("") === expando;

// Support: Chrome 14-35+
// Always assume duplicates if they aren't passed to the comparison function
support.detectDuplicates = !!hasDuplicate;

// Initialize against the default document
setDocument();

// Support: Webkit<537.32 - Safari 6.0.3/Chrome 25 (fixed in Chrome 27)
// Detached nodes confoundingly follow *each other*
support.sortDetached = assert(function( el ) {
	// Should return 1, but returns 4 (following)
	return el.compareDocumentPosition( document.createElement("fieldset") ) & 1;
});

// Support: IE<8
// Prevent attribute/property "interpolation"
// https://msdn.microsoft.com/en-us/library/ms536429%28VS.85%29.aspx
if ( !assert(function( el ) {
	el.innerHTML = "<a href='#'></a>";
	return el.firstChild.getAttribute("href") === "#" ;
}) ) {
	addHandle( "type|href|height|width", function( elem, name, isXML ) {
		if ( !isXML ) {
			return elem.getAttribute( name, name.toLowerCase() === "type" ? 1 : 2 );
		}
	});
}

// Support: IE<9
// Use defaultValue in place of getAttribute("value")
if ( !support.attributes || !assert(function( el ) {
	el.innerHTML = "<input/>";
	el.firstChild.setAttribute( "value", "" );
	return el.firstChild.getAttribute( "value" ) === "";
}) ) {
	addHandle( "value", function( elem, name, isXML ) {
		if ( !isXML && elem.nodeName.toLowerCase() === "input" ) {
			return elem.defaultValue;
		}
	});
}

// Support: IE<9
// Use getAttributeNode to fetch booleans when getAttribute lies
if ( !assert(function( el ) {
	return el.getAttribute("disabled") == null;
}) ) {
	addHandle( booleans, function( elem, name, isXML ) {
		var val;
		if ( !isXML ) {
			return elem[ name ] === true ? name.toLowerCase() :
					(val = elem.getAttributeNode( name )) && val.specified ?
					val.value :
				null;
		}
	});
}

return Sizzle;

})( window );



jQuery.find = Sizzle;
jQuery.expr = Sizzle.selectors;

// Deprecated
jQuery.expr[ ":" ] = jQuery.expr.pseudos;
jQuery.uniqueSort = jQuery.unique = Sizzle.uniqueSort;
jQuery.text = Sizzle.getText;
jQuery.isXMLDoc = Sizzle.isXML;
jQuery.contains = Sizzle.contains;
jQuery.escapeSelector = Sizzle.escape;




var dir = function( elem, dir, until ) {
	var matched = [],
		truncate = until !== undefined;

	while ( ( elem = elem[ dir ] ) && elem.nodeType !== 9 ) {
		if ( elem.nodeType === 1 ) {
			if ( truncate && jQuery( elem ).is( until ) ) {
				break;
			}
			matched.push( elem );
		}
	}
	return matched;
};


var siblings = function( n, elem ) {
	var matched = [];

	for ( ; n; n = n.nextSibling ) {
		if ( n.nodeType === 1 && n !== elem ) {
			matched.push( n );
		}
	}

	return matched;
};


var rneedsContext = jQuery.expr.match.needsContext;



function nodeName( elem, name ) {

  return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();

};
var rsingleTag = ( /^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i );



// Implement the identical functionality for filter and not
function winnow( elements, qualifier, not ) {
	if ( isFunction( qualifier ) ) {
		return jQuery.grep( elements, function( elem, i ) {
			return !!qualifier.call( elem, i, elem ) !== not;
		} );
	}

	// Single element
	if ( qualifier.nodeType ) {
		return jQuery.grep( elements, function( elem ) {
			return ( elem === qualifier ) !== not;
		} );
	}

	// Arraylike of elements (jQuery, arguments, Array)
	if ( typeof qualifier !== "string" ) {
		return jQuery.grep( elements, function( elem ) {
			return ( indexOf.call( qualifier, elem ) > -1 ) !== not;
		} );
	}

	// Filtered directly for both simple and complex selectors
	return jQuery.filter( qualifier, elements, not );
}

jQuery.filter = function( expr, elems, not ) {
	var elem = elems[ 0 ];

	if ( not ) {
		expr = ":not(" + expr + ")";
	}

	if ( elems.length === 1 && elem.nodeType === 1 ) {
		return jQuery.find.matchesSelector( elem, expr ) ? [ elem ] : [];
	}

	return jQuery.find.matches( expr, jQuery.grep( elems, function( elem ) {
		return elem.nodeType === 1;
	} ) );
};

jQuery.fn.extend( {
	find: function( selector ) {
		var i, ret,
			len = this.length,
			self = this;

		if ( typeof selector !== "string" ) {
			return this.pushStack( jQuery( selector ).filter( function() {
				for ( i = 0; i < len; i++ ) {
					if ( jQuery.contains( self[ i ], this ) ) {
						return true;
					}
				}
			} ) );
		}

		ret = this.pushStack( [] );

		for ( i = 0; i < len; i++ ) {
			jQuery.find( selector, self[ i ], ret );
		}

		return len > 1 ? jQuery.uniqueSort( ret ) : ret;
	},
	filter: function( selector ) {
		return this.pushStack( winnow( this, selector || [], false ) );
	},
	not: function( selector ) {
		return this.pushStack( winnow( this, selector || [], true ) );
	},
	is: function( selector ) {
		return !!winnow(
			this,

			// If this is a positional/relative selector, check membership in the returned set
			// so $("p:first").is("p:last") won't return true for a doc with two "p".
			typeof selector === "string" && rneedsContext.test( selector ) ?
				jQuery( selector ) :
				selector || [],
			false
		).length;
	}
} );


// Initialize a jQuery object


// A central reference to the root jQuery(document)
var rootjQuery,

	// A simple way to check for HTML strings
	// Prioritize #id over <tag> to avoid XSS via location.hash (#9521)
	// Strict HTML recognition (#11290: must start with <)
	// Shortcut simple #id case for speed
	rquickExpr = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/,

	init = jQuery.fn.init = function( selector, context, root ) {
		var match, elem;

		// HANDLE: $(""), $(null), $(undefined), $(false)
		if ( !selector ) {
			return this;
		}

		// Method init() accepts an alternate rootjQuery
		// so migrate can support jQuery.sub (gh-2101)
		root = root || rootjQuery;

		// Handle HTML strings
		if ( typeof selector === "string" ) {
			if ( selector[ 0 ] === "<" &&
				selector[ selector.length - 1 ] === ">" &&
				selector.length >= 3 ) {

				// Assume that strings that start and end with <> are HTML and skip the regex check
				match = [ null, selector, null ];

			} else {
				match = rquickExpr.exec( selector );
			}

			// Match html or make sure no context is specified for #id
			if ( match && ( match[ 1 ] || !context ) ) {

				// HANDLE: $(html) -> $(array)
				if ( match[ 1 ] ) {
					context = context instanceof jQuery ? context[ 0 ] : context;

					// Option to run scripts is true for back-compat
					// Intentionally let the error be thrown if parseHTML is not present
					jQuery.merge( this, jQuery.parseHTML(
						match[ 1 ],
						context && context.nodeType ? context.ownerDocument || context : document,
						true
					) );

					// HANDLE: $(html, props)
					if ( rsingleTag.test( match[ 1 ] ) && jQuery.isPlainObject( context ) ) {
						for ( match in context ) {

							// Properties of context are called as methods if possible
							if ( isFunction( this[ match ] ) ) {
								this[ match ]( context[ match ] );

							// ...and otherwise set as attributes
							} else {
								this.attr( match, context[ match ] );
							}
						}
					}

					return this;

				// HANDLE: $(#id)
				} else {
					elem = document.getElementById( match[ 2 ] );

					if ( elem ) {

						// Inject the element directly into the jQuery object
						this[ 0 ] = elem;
						this.length = 1;
					}
					return this;
				}

			// HANDLE: $(expr, $(...))
			} else if ( !context || context.jquery ) {
				return ( context || root ).find( selector );

			// HANDLE: $(expr, context)
			// (which is just equivalent to: $(context).find(expr)
			} else {
				return this.constructor( context ).find( selector );
			}

		// HANDLE: $(DOMElement)
		} else if ( selector.nodeType ) {
			this[ 0 ] = selector;
			this.length = 1;
			return this;

		// HANDLE: $(function)
		// Shortcut for document ready
		} else if ( isFunction( selector ) ) {
			return root.ready !== undefined ?
				root.ready( selector ) :

				// Execute immediately if ready is not present
				selector( jQuery );
		}

		return jQuery.makeArray( selector, this );
	};

// Give the init function the jQuery prototype for later instantiation
init.prototype = jQuery.fn;

// Initialize central reference
rootjQuery = jQuery( document );


var rparentsprev = /^(?:parents|prev(?:Until|All))/,

	// Methods guaranteed to produce a unique set when starting from a unique set
	guaranteedUnique = {
		children: true,
		contents: true,
		next: true,
		prev: true
	};

jQuery.fn.extend( {
	has: function( target ) {
		var targets = jQuery( target, this ),
			l = targets.length;

		return this.filter( function() {
			var i = 0;
			for ( ; i < l; i++ ) {
				if ( jQuery.contains( this, targets[ i ] ) ) {
					return true;
				}
			}
		} );
	},

	closest: function( selectors, context ) {
		var cur,
			i = 0,
			l = this.length,
			matched = [],
			targets = typeof selectors !== "string" && jQuery( selectors );

		// Positional selectors never match, since there's no _selection_ context
		if ( !rneedsContext.test( selectors ) ) {
			for ( ; i < l; i++ ) {
				for ( cur = this[ i ]; cur && cur !== context; cur = cur.parentNode ) {

					// Always skip document fragments
					if ( cur.nodeType < 11 && ( targets ?
						targets.index( cur ) > -1 :

						// Don't pass non-elements to Sizzle
						cur.nodeType === 1 &&
							jQuery.find.matchesSelector( cur, selectors ) ) ) {

						matched.push( cur );
						break;
					}
				}
			}
		}

		return this.pushStack( matched.length > 1 ? jQuery.uniqueSort( matched ) : matched );
	},

	// Determine the position of an element within the set
	index: function( elem ) {

		// No argument, return index in parent
		if ( !elem ) {
			return ( this[ 0 ] && this[ 0 ].parentNode ) ? this.first().prevAll().length : -1;
		}

		// Index in selector
		if ( typeof elem === "string" ) {
			return indexOf.call( jQuery( elem ), this[ 0 ] );
		}

		// Locate the position of the desired element
		return indexOf.call( this,

			// If it receives a jQuery object, the first element is used
			elem.jquery ? elem[ 0 ] : elem
		);
	},

	add: function( selector, context ) {
		return this.pushStack(
			jQuery.uniqueSort(
				jQuery.merge( this.get(), jQuery( selector, context ) )
			)
		);
	},

	addBack: function( selector ) {
		return this.add( selector == null ?
			this.prevObject : this.prevObject.filter( selector )
		);
	}
} );

function sibling( cur, dir ) {
	while ( ( cur = cur[ dir ] ) && cur.nodeType !== 1 ) {}
	return cur;
}

jQuery.each( {
	parent: function( elem ) {
		var parent = elem.parentNode;
		return parent && parent.nodeType !== 11 ? parent : null;
	},
	parents: function( elem ) {
		return dir( elem, "parentNode" );
	},
	parentsUntil: function( elem, i, until ) {
		return dir( elem, "parentNode", until );
	},
	next: function( elem ) {
		return sibling( elem, "nextSibling" );
	},
	prev: function( elem ) {
		return sibling( elem, "previousSibling" );
	},
	nextAll: function( elem ) {
		return dir( elem, "nextSibling" );
	},
	prevAll: function( elem ) {
		return dir( elem, "previousSibling" );
	},
	nextUntil: function( elem, i, until ) {
		return dir( elem, "nextSibling", until );
	},
	prevUntil: function( elem, i, until ) {
		return dir( elem, "previousSibling", until );
	},
	siblings: function( elem ) {
		return siblings( ( elem.parentNode || {} ).firstChild, elem );
	},
	children: function( elem ) {
		return siblings( elem.firstChild );
	},
	contents: function( elem ) {
        if ( nodeName( elem, "iframe" ) ) {
            return elem.contentDocument;
        }

        // Support: IE 9 - 11 only, iOS 7 only, Android Browser <=4.3 only
        // Treat the template element as a regular one in browsers that
        // don't support it.
        if ( nodeName( elem, "template" ) ) {
            elem = elem.content || elem;
        }

        return jQuery.merge( [], elem.childNodes );
	}
}, function( name, fn ) {
	jQuery.fn[ name ] = function( until, selector ) {
		var matched = jQuery.map( this, fn, until );

		if ( name.slice( -5 ) !== "Until" ) {
			selector = until;
		}

		if ( selector && typeof selector === "string" ) {
			matched = jQuery.filter( selector, matched );
		}

		if ( this.length > 1 ) {

			// Remove duplicates
			if ( !guaranteedUnique[ name ] ) {
				jQuery.uniqueSort( matched );
			}

			// Reverse order for parents* and prev-derivatives
			if ( rparentsprev.test( name ) ) {
				matched.reverse();
			}
		}

		return this.pushStack( matched );
	};
} );
var rnothtmlwhite = ( /[^\x20\t\r\n\f]+/g );



// Convert String-formatted options into Object-formatted ones
function createOptions( options ) {
	var object = {};
	jQuery.each( options.match( rnothtmlwhite ) || [], function( _, flag ) {
		object[ flag ] = true;
	} );
	return object;
}

/*
 * Create a callback list using the following parameters:
 *
 *	options: an optional list of space-separated options that will change how
 *			the callback list behaves or a more traditional option object
 *
 * By default a callback list will act like an event callback list and can be
 * "fired" multiple times.
 *
 * Possible options:
 *
 *	once:			will ensure the callback list can only be fired once (like a Deferred)
 *
 *	memory:			will keep track of previous values and will call any callback added
 *					after the list has been fired right away with the latest "memorized"
 *					values (like a Deferred)
 *
 *	unique:			will ensure a callback can only be added once (no duplicate in the list)
 *
 *	stopOnFalse:	interrupt callings when a callback returns false
 *
 */
jQuery.Callbacks = function( options ) {

	// Convert options from String-formatted to Object-formatted if needed
	// (we check in cache first)
	options = typeof options === "string" ?
		createOptions( options ) :
		jQuery.extend( {}, options );

	var // Flag to know if list is currently firing
		firing,

		// Last fire value for non-forgettable lists
		memory,

		// Flag to know if list was already fired
		fired,

		// Flag to prevent firing
		locked,

		// Actual callback list
		list = [],

		// Queue of execution data for repeatable lists
		queue = [],

		// Index of currently firing callback (modified by add/remove as needed)
		firingIndex = -1,

		// Fire callbacks
		fire = function() {

			// Enforce single-firing
			locked = locked || options.once;

			// Execute callbacks for all pending executions,
			// respecting firingIndex overrides and runtime changes
			fired = firing = true;
			for ( ; queue.length; firingIndex = -1 ) {
				memory = queue.shift();
				while ( ++firingIndex < list.length ) {

					// Run callback and check for early termination
					if ( list[ firingIndex ].apply( memory[ 0 ], memory[ 1 ] ) === false &&
						options.stopOnFalse ) {

						// Jump to end and forget the data so .add doesn't re-fire
						firingIndex = list.length;
						memory = false;
					}
				}
			}

			// Forget the data if we're done with it
			if ( !options.memory ) {
				memory = false;
			}

			firing = false;

			// Clean up if we're done firing for good
			if ( locked ) {

				// Keep an empty list if we have data for future add calls
				if ( memory ) {
					list = [];

				// Otherwise, this object is spent
				} else {
					list = "";
				}
			}
		},

		// Actual Callbacks object
		self = {

			// Add a callback or a collection of callbacks to the list
			add: function() {
				if ( list ) {

					// If we have memory from a past run, we should fire after adding
					if ( memory && !firing ) {
						firingIndex = list.length - 1;
						queue.push( memory );
					}

					( function add( args ) {
						jQuery.each( args, function( _, arg ) {
							if ( isFunction( arg ) ) {
								if ( !options.unique || !self.has( arg ) ) {
									list.push( arg );
								}
							} else if ( arg && arg.length && toType( arg ) !== "string" ) {

								// Inspect recursively
								add( arg );
							}
						} );
					} )( arguments );

					if ( memory && !firing ) {
						fire();
					}
				}
				return this;
			},

			// Remove a callback from the list
			remove: function() {
				jQuery.each( arguments, function( _, arg ) {
					var index;
					while ( ( index = jQuery.inArray( arg, list, index ) ) > -1 ) {
						list.splice( index, 1 );

						// Handle firing indexes
						if ( index <= firingIndex ) {
							firingIndex--;
						}
					}
				} );
				return this;
			},

			// Check if a given callback is in the list.
			// If no argument is given, return whether or not list has callbacks attached.
			has: function( fn ) {
				return fn ?
					jQuery.inArray( fn, list ) > -1 :
					list.length > 0;
			},

			// Remove all callbacks from the list
			empty: function() {
				if ( list ) {
					list = [];
				}
				return this;
			},

			// Disable .fire and .add
			// Abort any current/pending executions
			// Clear all callbacks and values
			disable: function() {
				locked = queue = [];
				list = memory = "";
				return this;
			},
			disabled: function() {
				return !list;
			},

			// Disable .fire
			// Also disable .add unless we have memory (since it would have no effect)
			// Abort any pending executions
			lock: function() {
				locked = queue = [];
				if ( !memory && !firing ) {
					list = memory = "";
				}
				return this;
			},
			locked: function() {
				return !!locked;
			},

			// Call all callbacks with the given context and arguments
			fireWith: function( context, args ) {
				if ( !locked ) {
					args = args || [];
					args = [ context, args.slice ? args.slice() : args ];
					queue.push( args );
					if ( !firing ) {
						fire();
					}
				}
				return this;
			},

			// Call all the callbacks with the given arguments
			fire: function() {
				self.fireWith( this, arguments );
				return this;
			},

			// To know if the callbacks have already been called at least once
			fired: function() {
				return !!fired;
			}
		};

	return self;
};


function Identity( v ) {
	return v;
}
function Thrower( ex ) {
	throw ex;
}

function adoptValue( value, resolve, reject, noValue ) {
	var method;

	try {

		// Check for promise aspect first to privilege synchronous behavior
		if ( value && isFunction( ( method = value.promise ) ) ) {
			method.call( value ).done( resolve ).fail( reject );

		// Other thenables
		} else if ( value && isFunction( ( method = value.then ) ) ) {
			method.call( value, resolve, reject );

		// Other non-thenables
		} else {

			// Control `resolve` arguments by letting Array#slice cast boolean `noValue` to integer:
			// * false: [ value ].slice( 0 ) => resolve( value )
			// * true: [ value ].slice( 1 ) => resolve()
			resolve.apply( undefined, [ value ].slice( noValue ) );
		}

	// For Promises/A+, convert exceptions into rejections
	// Since jQuery.when doesn't unwrap thenables, we can skip the extra checks appearing in
	// Deferred#then to conditionally suppress rejection.
	} catch ( value ) {

		// Support: Android 4.0 only
		// Strict mode functions invoked without .call/.apply get global-object context
		reject.apply( undefined, [ value ] );
	}
}

jQuery.extend( {

	Deferred: function( func ) {
		var tuples = [

				// action, add listener, callbacks,
				// ... .then handlers, argument index, [final state]
				[ "notify", "progress", jQuery.Callbacks( "memory" ),
					jQuery.Callbacks( "memory" ), 2 ],
				[ "resolve", "done", jQuery.Callbacks( "once memory" ),
					jQuery.Callbacks( "once memory" ), 0, "resolved" ],
				[ "reject", "fail", jQuery.Callbacks( "once memory" ),
					jQuery.Callbacks( "once memory" ), 1, "rejected" ]
			],
			state = "pending",
			promise = {
				state: function() {
					return state;
				},
				always: function() {
					deferred.done( arguments ).fail( arguments );
					return this;
				},
				"catch": function( fn ) {
					return promise.then( null, fn );
				},

				// Keep pipe for back-compat
				pipe: function( /* fnDone, fnFail, fnProgress */ ) {
					var fns = arguments;

					return jQuery.Deferred( function( newDefer ) {
						jQuery.each( tuples, function( i, tuple ) {

							// Map tuples (progress, done, fail) to arguments (done, fail, progress)
							var fn = isFunction( fns[ tuple[ 4 ] ] ) && fns[ tuple[ 4 ] ];

							// deferred.progress(function() { bind to newDefer or newDefer.notify })
							// deferred.done(function() { bind to newDefer or newDefer.resolve })
							// deferred.fail(function() { bind to newDefer or newDefer.reject })
							deferred[ tuple[ 1 ] ]( function() {
								var returned = fn && fn.apply( this, arguments );
								if ( returned && isFunction( returned.promise ) ) {
									returned.promise()
										.progress( newDefer.notify )
										.done( newDefer.resolve )
										.fail( newDefer.reject );
								} else {
									newDefer[ tuple[ 0 ] + "With" ](
										this,
										fn ? [ returned ] : arguments
									);
								}
							} );
						} );
						fns = null;
					} ).promise();
				},
				then: function( onFulfilled, onRejected, onProgress ) {
					var maxDepth = 0;
					function resolve( depth, deferred, handler, special ) {
						return function() {
							var that = this,
								args = arguments,
								mightThrow = function() {
									var returned, then;

									// Support: Promises/A+ section 2.3.3.3.3
									// https://promisesaplus.com/#point-59
									// Ignore double-resolution attempts
									if ( depth < maxDepth ) {
										return;
									}

									returned = handler.apply( that, args );

									// Support: Promises/A+ section 2.3.1
									// https://promisesaplus.com/#point-48
									if ( returned === deferred.promise() ) {
										throw new TypeError( "Thenable self-resolution" );
									}

									// Support: Promises/A+ sections 2.3.3.1, 3.5
									// https://promisesaplus.com/#point-54
									// https://promisesaplus.com/#point-75
									// Retrieve `then` only once
									then = returned &&

										// Support: Promises/A+ section 2.3.4
										// https://promisesaplus.com/#point-64
										// Only check objects and functions for thenability
										( typeof returned === "object" ||
											typeof returned === "function" ) &&
										returned.then;

									// Handle a returned thenable
									if ( isFunction( then ) ) {

										// Special processors (notify) just wait for resolution
										if ( special ) {
											then.call(
												returned,
												resolve( maxDepth, deferred, Identity, special ),
												resolve( maxDepth, deferred, Thrower, special )
											);

										// Normal processors (resolve) also hook into progress
										} else {

											// ...and disregard older resolution values
											maxDepth++;

											then.call(
												returned,
												resolve( maxDepth, deferred, Identity, special ),
												resolve( maxDepth, deferred, Thrower, special ),
												resolve( maxDepth, deferred, Identity,
													deferred.notifyWith )
											);
										}

									// Handle all other returned values
									} else {

										// Only substitute handlers pass on context
										// and multiple values (non-spec behavior)
										if ( handler !== Identity ) {
											that = undefined;
											args = [ returned ];
										}

										// Process the value(s)
										// Default process is resolve
										( special || deferred.resolveWith )( that, args );
									}
								},

								// Only normal processors (resolve) catch and reject exceptions
								process = special ?
									mightThrow :
									function() {
										try {
											mightThrow();
										} catch ( e ) {

											if ( jQuery.Deferred.exceptionHook ) {
												jQuery.Deferred.exceptionHook( e,
													process.stackTrace );
											}

											// Support: Promises/A+ section 2.3.3.3.4.1
											// https://promisesaplus.com/#point-61
											// Ignore post-resolution exceptions
											if ( depth + 1 >= maxDepth ) {

												// Only substitute handlers pass on context
												// and multiple values (non-spec behavior)
												if ( handler !== Thrower ) {
													that = undefined;
													args = [ e ];
												}

												deferred.rejectWith( that, args );
											}
										}
									};

							// Support: Promises/A+ section 2.3.3.3.1
							// https://promisesaplus.com/#point-57
							// Re-resolve promises immediately to dodge false rejection from
							// subsequent errors
							if ( depth ) {
								process();
							} else {

								// Call an optional hook to record the stack, in case of exception
								// since it's otherwise lost when execution goes async
								if ( jQuery.Deferred.getStackHook ) {
									process.stackTrace = jQuery.Deferred.getStackHook();
								}
								window.setTimeout( process );
							}
						};
					}

					return jQuery.Deferred( function( newDefer ) {

						// progress_handlers.add( ... )
						tuples[ 0 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								isFunction( onProgress ) ?
									onProgress :
									Identity,
								newDefer.notifyWith
							)
						);

						// fulfilled_handlers.add( ... )
						tuples[ 1 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								isFunction( onFulfilled ) ?
									onFulfilled :
									Identity
							)
						);

						// rejected_handlers.add( ... )
						tuples[ 2 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								isFunction( onRejected ) ?
									onRejected :
									Thrower
							)
						);
					} ).promise();
				},

				// Get a promise for this deferred
				// If obj is provided, the promise aspect is added to the object
				promise: function( obj ) {
					return obj != null ? jQuery.extend( obj, promise ) : promise;
				}
			},
			deferred = {};

		// Add list-specific methods
		jQuery.each( tuples, function( i, tuple ) {
			var list = tuple[ 2 ],
				stateString = tuple[ 5 ];

			// promise.progress = list.add
			// promise.done = list.add
			// promise.fail = list.add
			promise[ tuple[ 1 ] ] = list.add;

			// Handle state
			if ( stateString ) {
				list.add(
					function() {

						// state = "resolved" (i.e., fulfilled)
						// state = "rejected"
						state = stateString;
					},

					// rejected_callbacks.disable
					// fulfilled_callbacks.disable
					tuples[ 3 - i ][ 2 ].disable,

					// rejected_handlers.disable
					// fulfilled_handlers.disable
					tuples[ 3 - i ][ 3 ].disable,

					// progress_callbacks.lock
					tuples[ 0 ][ 2 ].lock,

					// progress_handlers.lock
					tuples[ 0 ][ 3 ].lock
				);
			}

			// progress_handlers.fire
			// fulfilled_handlers.fire
			// rejected_handlers.fire
			list.add( tuple[ 3 ].fire );

			// deferred.notify = function() { deferred.notifyWith(...) }
			// deferred.resolve = function() { deferred.resolveWith(...) }
			// deferred.reject = function() { deferred.rejectWith(...) }
			deferred[ tuple[ 0 ] ] = function() {
				deferred[ tuple[ 0 ] + "With" ]( this === deferred ? undefined : this, arguments );
				return this;
			};

			// deferred.notifyWith = list.fireWith
			// deferred.resolveWith = list.fireWith
			// deferred.rejectWith = list.fireWith
			deferred[ tuple[ 0 ] + "With" ] = list.fireWith;
		} );

		// Make the deferred a promise
		promise.promise( deferred );

		// Call given func if any
		if ( func ) {
			func.call( deferred, deferred );
		}

		// All done!
		return deferred;
	},

	// Deferred helper
	when: function( singleValue ) {
		var

			// count of uncompleted subordinates
			remaining = arguments.length,

			// count of unprocessed arguments
			i = remaining,

			// subordinate fulfillment data
			resolveContexts = Array( i ),
			resolveValues = slice.call( arguments ),

			// the master Deferred
			master = jQuery.Deferred(),

			// subordinate callback factory
			updateFunc = function( i ) {
				return function( value ) {
					resolveContexts[ i ] = this;
					resolveValues[ i ] = arguments.length > 1 ? slice.call( arguments ) : value;
					if ( !( --remaining ) ) {
						master.resolveWith( resolveContexts, resolveValues );
					}
				};
			};

		// Single- and empty arguments are adopted like Promise.resolve
		if ( remaining <= 1 ) {
			adoptValue( singleValue, master.done( updateFunc( i ) ).resolve, master.reject,
				!remaining );

			// Use .then() to unwrap secondary thenables (cf. gh-3000)
			if ( master.state() === "pending" ||
				isFunction( resolveValues[ i ] && resolveValues[ i ].then ) ) {

				return master.then();
			}
		}

		// Multiple arguments are aggregated like Promise.all array elements
		while ( i-- ) {
			adoptValue( resolveValues[ i ], updateFunc( i ), master.reject );
		}

		return master.promise();
	}
} );


// These usually indicate a programmer mistake during development,
// warn about them ASAP rather than swallowing them by default.
var rerrorNames = /^(Eval|Internal|Range|Reference|Syntax|Type|URI)Error$/;

jQuery.Deferred.exceptionHook = function( error, stack ) {

	// Support: IE 8 - 9 only
	// Console exists when dev tools are open, which can happen at any time
	if ( window.console && window.console.warn && error && rerrorNames.test( error.name ) ) {
		window.console.warn( "jQuery.Deferred exception: " + error.message, error.stack, stack );
	}
};




jQuery.readyException = function( error ) {
	window.setTimeout( function() {
		throw error;
	} );
};




// The deferred used on DOM ready
var readyList = jQuery.Deferred();

jQuery.fn.ready = function( fn ) {

	readyList
		.then( fn )

		// Wrap jQuery.readyException in a function so that the lookup
		// happens at the time of error handling instead of callback
		// registration.
		.catch( function( error ) {
			jQuery.readyException( error );
		} );

	return this;
};

jQuery.extend( {

	// Is the DOM ready to be used? Set to true once it occurs.
	isReady: false,

	// A counter to track how many items to wait for before
	// the ready event fires. See #6781
	readyWait: 1,

	// Handle when the DOM is ready
	ready: function( wait ) {

		// Abort if there are pending holds or we're already ready
		if ( wait === true ? --jQuery.readyWait : jQuery.isReady ) {
			return;
		}

		// Remember that the DOM is ready
		jQuery.isReady = true;

		// If a normal DOM Ready event fired, decrement, and wait if need be
		if ( wait !== true && --jQuery.readyWait > 0 ) {
			return;
		}

		// If there are functions bound, to execute
		readyList.resolveWith( document, [ jQuery ] );
	}
} );

jQuery.ready.then = readyList.then;

// The ready event handler and self cleanup method
function completed() {
	document.removeEventListener( "DOMContentLoaded", completed );
	window.removeEventListener( "load", completed );
	jQuery.ready();
}

// Catch cases where $(document).ready() is called
// after the browser event has already occurred.
// Support: IE <=9 - 10 only
// Older IE sometimes signals "interactive" too soon
if ( document.readyState === "complete" ||
	( document.readyState !== "loading" && !document.documentElement.doScroll ) ) {

	// Handle it asynchronously to allow scripts the opportunity to delay ready
	window.setTimeout( jQuery.ready );

} else {

	// Use the handy event callback
	document.addEventListener( "DOMContentLoaded", completed );

	// A fallback to window.onload, that will always work
	window.addEventListener( "load", completed );
}




// Multifunctional method to get and set values of a collection
// The value/s can optionally be executed if it's a function
var access = function( elems, fn, key, value, chainable, emptyGet, raw ) {
	var i = 0,
		len = elems.length,
		bulk = key == null;

	// Sets many values
	if ( toType( key ) === "object" ) {
		chainable = true;
		for ( i in key ) {
			access( elems, fn, i, key[ i ], true, emptyGet, raw );
		}

	// Sets one value
	} else if ( value !== undefined ) {
		chainable = true;

		if ( !isFunction( value ) ) {
			raw = true;
		}

		if ( bulk ) {

			// Bulk operations run against the entire set
			if ( raw ) {
				fn.call( elems, value );
				fn = null;

			// ...except when executing function values
			} else {
				bulk = fn;
				fn = function( elem, key, value ) {
					return bulk.call( jQuery( elem ), value );
				};
			}
		}

		if ( fn ) {
			for ( ; i < len; i++ ) {
				fn(
					elems[ i ], key, raw ?
					value :
					value.call( elems[ i ], i, fn( elems[ i ], key ) )
				);
			}
		}
	}

	if ( chainable ) {
		return elems;
	}

	// Gets
	if ( bulk ) {
		return fn.call( elems );
	}

	return len ? fn( elems[ 0 ], key ) : emptyGet;
};


// Matches dashed string for camelizing
var rmsPrefix = /^-ms-/,
	rdashAlpha = /-([a-z])/g;

// Used by camelCase as callback to replace()
function fcamelCase( all, letter ) {
	return letter.toUpperCase();
}

// Convert dashed to camelCase; used by the css and data modules
// Support: IE <=9 - 11, Edge 12 - 15
// Microsoft forgot to hump their vendor prefix (#9572)
function camelCase( string ) {
	return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
}
var acceptData = function( owner ) {

	// Accepts only:
	//  - Node
	//    - Node.ELEMENT_NODE
	//    - Node.DOCUMENT_NODE
	//  - Object
	//    - Any
	return owner.nodeType === 1 || owner.nodeType === 9 || !( +owner.nodeType );
};




function Data() {
	this.expando = jQuery.expando + Data.uid++;
}

Data.uid = 1;

Data.prototype = {

	cache: function( owner ) {

		// Check if the owner object already has a cache
		var value = owner[ this.expando ];

		// If not, create one
		if ( !value ) {
			value = {};

			// We can accept data for non-element nodes in modern browsers,
			// but we should not, see #8335.
			// Always return an empty object.
			if ( acceptData( owner ) ) {

				// If it is a node unlikely to be stringify-ed or looped over
				// use plain assignment
				if ( owner.nodeType ) {
					owner[ this.expando ] = value;

				// Otherwise secure it in a non-enumerable property
				// configurable must be true to allow the property to be
				// deleted when data is removed
				} else {
					Object.defineProperty( owner, this.expando, {
						value: value,
						configurable: true
					} );
				}
			}
		}

		return value;
	},
	set: function( owner, data, value ) {
		var prop,
			cache = this.cache( owner );

		// Handle: [ owner, key, value ] args
		// Always use camelCase key (gh-2257)
		if ( typeof data === "string" ) {
			cache[ camelCase( data ) ] = value;

		// Handle: [ owner, { properties } ] args
		} else {

			// Copy the properties one-by-one to the cache object
			for ( prop in data ) {
				cache[ camelCase( prop ) ] = data[ prop ];
			}
		}
		return cache;
	},
	get: function( owner, key ) {
		return key === undefined ?
			this.cache( owner ) :

			// Always use camelCase key (gh-2257)
			owner[ this.expando ] && owner[ this.expando ][ camelCase( key ) ];
	},
	access: function( owner, key, value ) {

		// In cases where either:
		//
		//   1. No key was specified
		//   2. A string key was specified, but no value provided
		//
		// Take the "read" path and allow the get method to determine
		// which value to return, respectively either:
		//
		//   1. The entire cache object
		//   2. The data stored at the key
		//
		if ( key === undefined ||
				( ( key && typeof key === "string" ) && value === undefined ) ) {

			return this.get( owner, key );
		}

		// When the key is not a string, or both a key and value
		// are specified, set or extend (existing objects) with either:
		//
		//   1. An object of properties
		//   2. A key and value
		//
		this.set( owner, key, value );

		// Since the "set" path can have two possible entry points
		// return the expected data based on which path was taken[*]
		return value !== undefined ? value : key;
	},
	remove: function( owner, key ) {
		var i,
			cache = owner[ this.expando ];

		if ( cache === undefined ) {
			return;
		}

		if ( key !== undefined ) {

			// Support array or space separated string of keys
			if ( Array.isArray( key ) ) {

				// If key is an array of keys...
				// We always set camelCase keys, so remove that.
				key = key.map( camelCase );
			} else {
				key = camelCase( key );

				// If a key with the spaces exists, use it.
				// Otherwise, create an array by matching non-whitespace
				key = key in cache ?
					[ key ] :
					( key.match( rnothtmlwhite ) || [] );
			}

			i = key.length;

			while ( i-- ) {
				delete cache[ key[ i ] ];
			}
		}

		// Remove the expando if there's no more data
		if ( key === undefined || jQuery.isEmptyObject( cache ) ) {

			// Support: Chrome <=35 - 45
			// Webkit & Blink performance suffers when deleting properties
			// from DOM nodes, so set to undefined instead
			// https://bugs.chromium.org/p/chromium/issues/detail?id=378607 (bug restricted)
			if ( owner.nodeType ) {
				owner[ this.expando ] = undefined;
			} else {
				delete owner[ this.expando ];
			}
		}
	},
	hasData: function( owner ) {
		var cache = owner[ this.expando ];
		return cache !== undefined && !jQuery.isEmptyObject( cache );
	}
};
var dataPriv = new Data();

var dataUser = new Data();



//	Implementation Summary
//
//	1. Enforce API surface and semantic compatibility with 1.9.x branch
//	2. Improve the module's maintainability by reducing the storage
//		paths to a single mechanism.
//	3. Use the same single mechanism to support "private" and "user" data.
//	4. _Never_ expose "private" data to user code (TODO: Drop _data, _removeData)
//	5. Avoid exposing implementation details on user objects (eg. expando properties)
//	6. Provide a clear path for implementation upgrade to WeakMap in 2014

var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
	rmultiDash = /[A-Z]/g;

function getData( data ) {
	if ( data === "true" ) {
		return true;
	}

	if ( data === "false" ) {
		return false;
	}

	if ( data === "null" ) {
		return null;
	}

	// Only convert to a number if it doesn't change the string
	if ( data === +data + "" ) {
		return +data;
	}

	if ( rbrace.test( data ) ) {
		return JSON.parse( data );
	}

	return data;
}

function dataAttr( elem, key, data ) {
	var name;

	// If nothing was found internally, try to fetch any
	// data from the HTML5 data-* attribute
	if ( data === undefined && elem.nodeType === 1 ) {
		name = "data-" + key.replace( rmultiDash, "-$&" ).toLowerCase();
		data = elem.getAttribute( name );

		if ( typeof data === "string" ) {
			try {
				data = getData( data );
			} catch ( e ) {}

			// Make sure we set the data so it isn't changed later
			dataUser.set( elem, key, data );
		} else {
			data = undefined;
		}
	}
	return data;
}

jQuery.extend( {
	hasData: function( elem ) {
		return dataUser.hasData( elem ) || dataPriv.hasData( elem );
	},

	data: function( elem, name, data ) {
		return dataUser.access( elem, name, data );
	},

	removeData: function( elem, name ) {
		dataUser.remove( elem, name );
	},

	// TODO: Now that all calls to _data and _removeData have been replaced
	// with direct calls to dataPriv methods, these can be deprecated.
	_data: function( elem, name, data ) {
		return dataPriv.access( elem, name, data );
	},

	_removeData: function( elem, name ) {
		dataPriv.remove( elem, name );
	}
} );

jQuery.fn.extend( {
	data: function( key, value ) {
		var i, name, data,
			elem = this[ 0 ],
			attrs = elem && elem.attributes;

		// Gets all values
		if ( key === undefined ) {
			if ( this.length ) {
				data = dataUser.get( elem );

				if ( elem.nodeType === 1 && !dataPriv.get( elem, "hasDataAttrs" ) ) {
					i = attrs.length;
					while ( i-- ) {

						// Support: IE 11 only
						// The attrs elements can be null (#14894)
						if ( attrs[ i ] ) {
							name = attrs[ i ].name;
							if ( name.indexOf( "data-" ) === 0 ) {
								name = camelCase( name.slice( 5 ) );
								dataAttr( elem, name, data[ name ] );
							}
						}
					}
					dataPriv.set( elem, "hasDataAttrs", true );
				}
			}

			return data;
		}

		// Sets multiple values
		if ( typeof key === "object" ) {
			return this.each( function() {
				dataUser.set( this, key );
			} );
		}

		return access( this, function( value ) {
			var data;

			// The calling jQuery object (element matches) is not empty
			// (and therefore has an element appears at this[ 0 ]) and the
			// `value` parameter was not undefined. An empty jQuery object
			// will result in `undefined` for elem = this[ 0 ] which will
			// throw an exception if an attempt to read a data cache is made.
			if ( elem && value === undefined ) {

				// Attempt to get data from the cache
				// The key will always be camelCased in Data
				data = dataUser.get( elem, key );
				if ( data !== undefined ) {
					return data;
				}

				// Attempt to "discover" the data in
				// HTML5 custom data-* attrs
				data = dataAttr( elem, key );
				if ( data !== undefined ) {
					return data;
				}

				// We tried really hard, but the data doesn't exist.
				return;
			}

			// Set the data...
			this.each( function() {

				// We always store the camelCased key
				dataUser.set( this, key, value );
			} );
		}, null, value, arguments.length > 1, null, true );
	},

	removeData: function( key ) {
		return this.each( function() {
			dataUser.remove( this, key );
		} );
	}
} );


jQuery.extend( {
	queue: function( elem, type, data ) {
		var queue;

		if ( elem ) {
			type = ( type || "fx" ) + "queue";
			queue = dataPriv.get( elem, type );

			// Speed up dequeue by getting out quickly if this is just a lookup
			if ( data ) {
				if ( !queue || Array.isArray( data ) ) {
					queue = dataPriv.access( elem, type, jQuery.makeArray( data ) );
				} else {
					queue.push( data );
				}
			}
			return queue || [];
		}
	},

	dequeue: function( elem, type ) {
		type = type || "fx";

		var queue = jQuery.queue( elem, type ),
			startLength = queue.length,
			fn = queue.shift(),
			hooks = jQuery._queueHooks( elem, type ),
			next = function() {
				jQuery.dequeue( elem, type );
			};

		// If the fx queue is dequeued, always remove the progress sentinel
		if ( fn === "inprogress" ) {
			fn = queue.shift();
			startLength--;
		}

		if ( fn ) {

			// Add a progress sentinel to prevent the fx queue from being
			// automatically dequeued
			if ( type === "fx" ) {
				queue.unshift( "inprogress" );
			}

			// Clear up the last queue stop function
			delete hooks.stop;
			fn.call( elem, next, hooks );
		}

		if ( !startLength && hooks ) {
			hooks.empty.fire();
		}
	},

	// Not public - generate a queueHooks object, or return the current one
	_queueHooks: function( elem, type ) {
		var key = type + "queueHooks";
		return dataPriv.get( elem, key ) || dataPriv.access( elem, key, {
			empty: jQuery.Callbacks( "once memory" ).add( function() {
				dataPriv.remove( elem, [ type + "queue", key ] );
			} )
		} );
	}
} );

jQuery.fn.extend( {
	queue: function( type, data ) {
		var setter = 2;

		if ( typeof type !== "string" ) {
			data = type;
			type = "fx";
			setter--;
		}

		if ( arguments.length < setter ) {
			return jQuery.queue( this[ 0 ], type );
		}

		return data === undefined ?
			this :
			this.each( function() {
				var queue = jQuery.queue( this, type, data );

				// Ensure a hooks for this queue
				jQuery._queueHooks( this, type );

				if ( type === "fx" && queue[ 0 ] !== "inprogress" ) {
					jQuery.dequeue( this, type );
				}
			} );
	},
	dequeue: function( type ) {
		return this.each( function() {
			jQuery.dequeue( this, type );
		} );
	},
	clearQueue: function( type ) {
		return this.queue( type || "fx", [] );
	},

	// Get a promise resolved when queues of a certain type
	// are emptied (fx is the type by default)
	promise: function( type, obj ) {
		var tmp,
			count = 1,
			defer = jQuery.Deferred(),
			elements = this,
			i = this.length,
			resolve = function() {
				if ( !( --count ) ) {
					defer.resolveWith( elements, [ elements ] );
				}
			};

		if ( typeof type !== "string" ) {
			obj = type;
			type = undefined;
		}
		type = type || "fx";

		while ( i-- ) {
			tmp = dataPriv.get( elements[ i ], type + "queueHooks" );
			if ( tmp && tmp.empty ) {
				count++;
				tmp.empty.add( resolve );
			}
		}
		resolve();
		return defer.promise( obj );
	}
} );
var pnum = ( /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/ ).source;

var rcssNum = new RegExp( "^(?:([+-])=|)(" + pnum + ")([a-z%]*)$", "i" );


var cssExpand = [ "Top", "Right", "Bottom", "Left" ];

var isHiddenWithinTree = function( elem, el ) {

		// isHiddenWithinTree might be called from jQuery#filter function;
		// in that case, element will be second argument
		elem = el || elem;

		// Inline style trumps all
		return elem.style.display === "none" ||
			elem.style.display === "" &&

			// Otherwise, check computed style
			// Support: Firefox <=43 - 45
			// Disconnected elements can have computed display: none, so first confirm that elem is
			// in the document.
			jQuery.contains( elem.ownerDocument, elem ) &&

			jQuery.css( elem, "display" ) === "none";
	};

var swap = function( elem, options, callback, args ) {
	var ret, name,
		old = {};

	// Remember the old values, and insert the new ones
	for ( name in options ) {
		old[ name ] = elem.style[ name ];
		elem.style[ name ] = options[ name ];
	}

	ret = callback.apply( elem, args || [] );

	// Revert the old values
	for ( name in options ) {
		elem.style[ name ] = old[ name ];
	}

	return ret;
};




function adjustCSS( elem, prop, valueParts, tween ) {
	var adjusted, scale,
		maxIterations = 20,
		currentValue = tween ?
			function() {
				return tween.cur();
			} :
			function() {
				return jQuery.css( elem, prop, "" );
			},
		initial = currentValue(),
		unit = valueParts && valueParts[ 3 ] || ( jQuery.cssNumber[ prop ] ? "" : "px" ),

		// Starting value computation is required for potential unit mismatches
		initialInUnit = ( jQuery.cssNumber[ prop ] || unit !== "px" && +initial ) &&
			rcssNum.exec( jQuery.css( elem, prop ) );

	if ( initialInUnit && initialInUnit[ 3 ] !== unit ) {

		// Support: Firefox <=54
		// Halve the iteration target value to prevent interference from CSS upper bounds (gh-2144)
		initial = initial / 2;

		// Trust units reported by jQuery.css
		unit = unit || initialInUnit[ 3 ];

		// Iteratively approximate from a nonzero starting point
		initialInUnit = +initial || 1;

		while ( maxIterations-- ) {

			// Evaluate and update our best guess (doubling guesses that zero out).
			// Finish if the scale equals or crosses 1 (making the old*new product non-positive).
			jQuery.style( elem, prop, initialInUnit + unit );
			if ( ( 1 - scale ) * ( 1 - ( scale = currentValue() / initial || 0.5 ) ) <= 0 ) {
				maxIterations = 0;
			}
			initialInUnit = initialInUnit / scale;

		}

		initialInUnit = initialInUnit * 2;
		jQuery.style( elem, prop, initialInUnit + unit );

		// Make sure we update the tween properties later on
		valueParts = valueParts || [];
	}

	if ( valueParts ) {
		initialInUnit = +initialInUnit || +initial || 0;

		// Apply relative offset (+=/-=) if specified
		adjusted = valueParts[ 1 ] ?
			initialInUnit + ( valueParts[ 1 ] + 1 ) * valueParts[ 2 ] :
			+valueParts[ 2 ];
		if ( tween ) {
			tween.unit = unit;
			tween.start = initialInUnit;
			tween.end = adjusted;
		}
	}
	return adjusted;
}


var defaultDisplayMap = {};

function getDefaultDisplay( elem ) {
	var temp,
		doc = elem.ownerDocument,
		nodeName = elem.nodeName,
		display = defaultDisplayMap[ nodeName ];

	if ( display ) {
		return display;
	}

	temp = doc.body.appendChild( doc.createElement( nodeName ) );
	display = jQuery.css( temp, "display" );

	temp.parentNode.removeChild( temp );

	if ( display === "none" ) {
		display = "block";
	}
	defaultDisplayMap[ nodeName ] = display;

	return display;
}

function showHide( elements, show ) {
	var display, elem,
		values = [],
		index = 0,
		length = elements.length;

	// Determine new display value for elements that need to change
	for ( ; index < length; index++ ) {
		elem = elements[ index ];
		if ( !elem.style ) {
			continue;
		}

		display = elem.style.display;
		if ( show ) {

			// Since we force visibility upon cascade-hidden elements, an immediate (and slow)
			// check is required in this first loop unless we have a nonempty display value (either
			// inline or about-to-be-restored)
			if ( display === "none" ) {
				values[ index ] = dataPriv.get( elem, "display" ) || null;
				if ( !values[ index ] ) {
					elem.style.display = "";
				}
			}
			if ( elem.style.display === "" && isHiddenWithinTree( elem ) ) {
				values[ index ] = getDefaultDisplay( elem );
			}
		} else {
			if ( display !== "none" ) {
				values[ index ] = "none";

				// Remember what we're overwriting
				dataPriv.set( elem, "display", display );
			}
		}
	}

	// Set the display of the elements in a second loop to avoid constant reflow
	for ( index = 0; index < length; index++ ) {
		if ( values[ index ] != null ) {
			elements[ index ].style.display = values[ index ];
		}
	}

	return elements;
}

jQuery.fn.extend( {
	show: function() {
		return showHide( this, true );
	},
	hide: function() {
		return showHide( this );
	},
	toggle: function( state ) {
		if ( typeof state === "boolean" ) {
			return state ? this.show() : this.hide();
		}

		return this.each( function() {
			if ( isHiddenWithinTree( this ) ) {
				jQuery( this ).show();
			} else {
				jQuery( this ).hide();
			}
		} );
	}
} );
var rcheckableType = ( /^(?:checkbox|radio)$/i );

var rtagName = ( /<([a-z][^\/\0>\x20\t\r\n\f]+)/i );

var rscriptType = ( /^$|^module$|\/(?:java|ecma)script/i );



// We have to close these tags to support XHTML (#13200)
var wrapMap = {

	// Support: IE <=9 only
	option: [ 1, "<select multiple='multiple'>", "</select>" ],

	// XHTML parsers do not magically insert elements in the
	// same way that tag soup parsers do. So we cannot shorten
	// this by omitting <tbody> or other required elements.
	thead: [ 1, "<table>", "</table>" ],
	col: [ 2, "<table><colgroup>", "</colgroup></table>" ],
	tr: [ 2, "<table><tbody>", "</tbody></table>" ],
	td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],

	_default: [ 0, "", "" ]
};

// Support: IE <=9 only
wrapMap.optgroup = wrapMap.option;

wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
wrapMap.th = wrapMap.td;


function getAll( context, tag ) {

	// Support: IE <=9 - 11 only
	// Use typeof to avoid zero-argument method invocation on host objects (#15151)
	var ret;

	if ( typeof context.getElementsByTagName !== "undefined" ) {
		ret = context.getElementsByTagName( tag || "*" );

	} else if ( typeof context.querySelectorAll !== "undefined" ) {
		ret = context.querySelectorAll( tag || "*" );

	} else {
		ret = [];
	}

	if ( tag === undefined || tag && nodeName( context, tag ) ) {
		return jQuery.merge( [ context ], ret );
	}

	return ret;
}


// Mark scripts as having already been evaluated
function setGlobalEval( elems, refElements ) {
	var i = 0,
		l = elems.length;

	for ( ; i < l; i++ ) {
		dataPriv.set(
			elems[ i ],
			"globalEval",
			!refElements || dataPriv.get( refElements[ i ], "globalEval" )
		);
	}
}


var rhtml = /<|&#?\w+;/;

function buildFragment( elems, context, scripts, selection, ignored ) {
	var elem, tmp, tag, wrap, contains, j,
		fragment = context.createDocumentFragment(),
		nodes = [],
		i = 0,
		l = elems.length;

	for ( ; i < l; i++ ) {
		elem = elems[ i ];

		if ( elem || elem === 0 ) {

			// Add nodes directly
			if ( toType( elem ) === "object" ) {

				// Support: Android <=4.0 only, PhantomJS 1 only
				// push.apply(_, arraylike) throws on ancient WebKit
				jQuery.merge( nodes, elem.nodeType ? [ elem ] : elem );

			// Convert non-html into a text node
			} else if ( !rhtml.test( elem ) ) {
				nodes.push( context.createTextNode( elem ) );

			// Convert html into DOM nodes
			} else {
				tmp = tmp || fragment.appendChild( context.createElement( "div" ) );

				// Deserialize a standard representation
				tag = ( rtagName.exec( elem ) || [ "", "" ] )[ 1 ].toLowerCase();
				wrap = wrapMap[ tag ] || wrapMap._default;
				tmp.innerHTML = wrap[ 1 ] + jQuery.htmlPrefilter( elem ) + wrap[ 2 ];

				// Descend through wrappers to the right content
				j = wrap[ 0 ];
				while ( j-- ) {
					tmp = tmp.lastChild;
				}

				// Support: Android <=4.0 only, PhantomJS 1 only
				// push.apply(_, arraylike) throws on ancient WebKit
				jQuery.merge( nodes, tmp.childNodes );

				// Remember the top-level container
				tmp = fragment.firstChild;

				// Ensure the created nodes are orphaned (#12392)
				tmp.textContent = "";
			}
		}
	}

	// Remove wrapper from fragment
	fragment.textContent = "";

	i = 0;
	while ( ( elem = nodes[ i++ ] ) ) {

		// Skip elements already in the context collection (trac-4087)
		if ( selection && jQuery.inArray( elem, selection ) > -1 ) {
			if ( ignored ) {
				ignored.push( elem );
			}
			continue;
		}

		contains = jQuery.contains( elem.ownerDocument, elem );

		// Append to fragment
		tmp = getAll( fragment.appendChild( elem ), "script" );

		// Preserve script evaluation history
		if ( contains ) {
			setGlobalEval( tmp );
		}

		// Capture executables
		if ( scripts ) {
			j = 0;
			while ( ( elem = tmp[ j++ ] ) ) {
				if ( rscriptType.test( elem.type || "" ) ) {
					scripts.push( elem );
				}
			}
		}
	}

	return fragment;
}


( function() {
	var fragment = document.createDocumentFragment(),
		div = fragment.appendChild( document.createElement( "div" ) ),
		input = document.createElement( "input" );

	// Support: Android 4.0 - 4.3 only
	// Check state lost if the name is set (#11217)
	// Support: Windows Web Apps (WWA)
	// `name` and `type` must use .setAttribute for WWA (#14901)
	input.setAttribute( "type", "radio" );
	input.setAttribute( "checked", "checked" );
	input.setAttribute( "name", "t" );

	div.appendChild( input );

	// Support: Android <=4.1 only
	// Older WebKit doesn't clone checked state correctly in fragments
	support.checkClone = div.cloneNode( true ).cloneNode( true ).lastChild.checked;

	// Support: IE <=11 only
	// Make sure textarea (and checkbox) defaultValue is properly cloned
	div.innerHTML = "<textarea>x</textarea>";
	support.noCloneChecked = !!div.cloneNode( true ).lastChild.defaultValue;
} )();
var documentElement = document.documentElement;



var
	rkeyEvent = /^key/,
	rmouseEvent = /^(?:mouse|pointer|contextmenu|drag|drop)|click/,
	rtypenamespace = /^([^.]*)(?:\.(.+)|)/;

function returnTrue() {
	return true;
}

function returnFalse() {
	return false;
}

// Support: IE <=9 only
// See #13393 for more info
function safeActiveElement() {
	try {
		return document.activeElement;
	} catch ( err ) { }
}

function on( elem, types, selector, data, fn, one ) {
	var origFn, type;

	// Types can be a map of types/handlers
	if ( typeof types === "object" ) {

		// ( types-Object, selector, data )
		if ( typeof selector !== "string" ) {

			// ( types-Object, data )
			data = data || selector;
			selector = undefined;
		}
		for ( type in types ) {
			on( elem, type, selector, data, types[ type ], one );
		}
		return elem;
	}

	if ( data == null && fn == null ) {

		// ( types, fn )
		fn = selector;
		data = selector = undefined;
	} else if ( fn == null ) {
		if ( typeof selector === "string" ) {

			// ( types, selector, fn )
			fn = data;
			data = undefined;
		} else {

			// ( types, data, fn )
			fn = data;
			data = selector;
			selector = undefined;
		}
	}
	if ( fn === false ) {
		fn = returnFalse;
	} else if ( !fn ) {
		return elem;
	}

	if ( one === 1 ) {
		origFn = fn;
		fn = function( event ) {

			// Can use an empty set, since event contains the info
			jQuery().off( event );
			return origFn.apply( this, arguments );
		};

		// Use same guid so caller can remove using origFn
		fn.guid = origFn.guid || ( origFn.guid = jQuery.guid++ );
	}
	return elem.each( function() {
		jQuery.event.add( this, types, fn, data, selector );
	} );
}

/*
 * Helper functions for managing events -- not part of the public interface.
 * Props to Dean Edwards' addEvent library for many of the ideas.
 */
jQuery.event = {

	global: {},

	add: function( elem, types, handler, data, selector ) {

		var handleObjIn, eventHandle, tmp,
			events, t, handleObj,
			special, handlers, type, namespaces, origType,
			elemData = dataPriv.get( elem );

		// Don't attach events to noData or text/comment nodes (but allow plain objects)
		if ( !elemData ) {
			return;
		}

		// Caller can pass in an object of custom data in lieu of the handler
		if ( handler.handler ) {
			handleObjIn = handler;
			handler = handleObjIn.handler;
			selector = handleObjIn.selector;
		}

		// Ensure that invalid selectors throw exceptions at attach time
		// Evaluate against documentElement in case elem is a non-element node (e.g., document)
		if ( selector ) {
			jQuery.find.matchesSelector( documentElement, selector );
		}

		// Make sure that the handler has a unique ID, used to find/remove it later
		if ( !handler.guid ) {
			handler.guid = jQuery.guid++;
		}

		// Init the element's event structure and main handler, if this is the first
		if ( !( events = elemData.events ) ) {
			events = elemData.events = {};
		}
		if ( !( eventHandle = elemData.handle ) ) {
			eventHandle = elemData.handle = function( e ) {

				// Discard the second event of a jQuery.event.trigger() and
				// when an event is called after a page has unloaded
				return typeof jQuery !== "undefined" && jQuery.event.triggered !== e.type ?
					jQuery.event.dispatch.apply( elem, arguments ) : undefined;
			};
		}

		// Handle multiple events separated by a space
		types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[ t ] ) || [];
			type = origType = tmp[ 1 ];
			namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

			// There *must* be a type, no attaching namespace-only handlers
			if ( !type ) {
				continue;
			}

			// If event changes its type, use the special event handlers for the changed type
			special = jQuery.event.special[ type ] || {};

			// If selector defined, determine special event api type, otherwise given type
			type = ( selector ? special.delegateType : special.bindType ) || type;

			// Update special based on newly reset type
			special = jQuery.event.special[ type ] || {};

			// handleObj is passed to all event handlers
			handleObj = jQuery.extend( {
				type: type,
				origType: origType,
				data: data,
				handler: handler,
				guid: handler.guid,
				selector: selector,
				needsContext: selector && jQuery.expr.match.needsContext.test( selector ),
				namespace: namespaces.join( "." )
			}, handleObjIn );

			// Init the event handler queue if we're the first
			if ( !( handlers = events[ type ] ) ) {
				handlers = events[ type ] = [];
				handlers.delegateCount = 0;

				// Only use addEventListener if the special events handler returns false
				if ( !special.setup ||
					special.setup.call( elem, data, namespaces, eventHandle ) === false ) {

					if ( elem.addEventListener ) {
						elem.addEventListener( type, eventHandle );
					}
				}
			}

			if ( special.add ) {
				special.add.call( elem, handleObj );

				if ( !handleObj.handler.guid ) {
					handleObj.handler.guid = handler.guid;
				}
			}

			// Add to the element's handler list, delegates in front
			if ( selector ) {
				handlers.splice( handlers.delegateCount++, 0, handleObj );
			} else {
				handlers.push( handleObj );
			}

			// Keep track of which events have ever been used, for event optimization
			jQuery.event.global[ type ] = true;
		}

	},

	// Detach an event or set of events from an element
	remove: function( elem, types, handler, selector, mappedTypes ) {

		var j, origCount, tmp,
			events, t, handleObj,
			special, handlers, type, namespaces, origType,
			elemData = dataPriv.hasData( elem ) && dataPriv.get( elem );

		if ( !elemData || !( events = elemData.events ) ) {
			return;
		}

		// Once for each type.namespace in types; type may be omitted
		types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[ t ] ) || [];
			type = origType = tmp[ 1 ];
			namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

			// Unbind all events (on this namespace, if provided) for the element
			if ( !type ) {
				for ( type in events ) {
					jQuery.event.remove( elem, type + types[ t ], handler, selector, true );
				}
				continue;
			}

			special = jQuery.event.special[ type ] || {};
			type = ( selector ? special.delegateType : special.bindType ) || type;
			handlers = events[ type ] || [];
			tmp = tmp[ 2 ] &&
				new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" );

			// Remove matching events
			origCount = j = handlers.length;
			while ( j-- ) {
				handleObj = handlers[ j ];

				if ( ( mappedTypes || origType === handleObj.origType ) &&
					( !handler || handler.guid === handleObj.guid ) &&
					( !tmp || tmp.test( handleObj.namespace ) ) &&
					( !selector || selector === handleObj.selector ||
						selector === "**" && handleObj.selector ) ) {
					handlers.splice( j, 1 );

					if ( handleObj.selector ) {
						handlers.delegateCount--;
					}
					if ( special.remove ) {
						special.remove.call( elem, handleObj );
					}
				}
			}

			// Remove generic event handler if we removed something and no more handlers exist
			// (avoids potential for endless recursion during removal of special event handlers)
			if ( origCount && !handlers.length ) {
				if ( !special.teardown ||
					special.teardown.call( elem, namespaces, elemData.handle ) === false ) {

					jQuery.removeEvent( elem, type, elemData.handle );
				}

				delete events[ type ];
			}
		}

		// Remove data and the expando if it's no longer used
		if ( jQuery.isEmptyObject( events ) ) {
			dataPriv.remove( elem, "handle events" );
		}
	},

	dispatch: function( nativeEvent ) {

		// Make a writable jQuery.Event from the native event object
		var event = jQuery.event.fix( nativeEvent );

		var i, j, ret, matched, handleObj, handlerQueue,
			args = new Array( arguments.length ),
			handlers = ( dataPriv.get( this, "events" ) || {} )[ event.type ] || [],
			special = jQuery.event.special[ event.type ] || {};

		// Use the fix-ed jQuery.Event rather than the (read-only) native event
		args[ 0 ] = event;

		for ( i = 1; i < arguments.length; i++ ) {
			args[ i ] = arguments[ i ];
		}

		event.delegateTarget = this;

		// Call the preDispatch hook for the mapped type, and let it bail if desired
		if ( special.preDispatch && special.preDispatch.call( this, event ) === false ) {
			return;
		}

		// Determine handlers
		handlerQueue = jQuery.event.handlers.call( this, event, handlers );

		// Run delegates first; they may want to stop propagation beneath us
		i = 0;
		while ( ( matched = handlerQueue[ i++ ] ) && !event.isPropagationStopped() ) {
			event.currentTarget = matched.elem;

			j = 0;
			while ( ( handleObj = matched.handlers[ j++ ] ) &&
				!event.isImmediatePropagationStopped() ) {

				// Triggered event must either 1) have no namespace, or 2) have namespace(s)
				// a subset or equal to those in the bound event (both can have no namespace).
				if ( !event.rnamespace || event.rnamespace.test( handleObj.namespace ) ) {

					event.handleObj = handleObj;
					event.data = handleObj.data;

					ret = ( ( jQuery.event.special[ handleObj.origType ] || {} ).handle ||
						handleObj.handler ).apply( matched.elem, args );

					if ( ret !== undefined ) {
						if ( ( event.result = ret ) === false ) {
							event.preventDefault();
							event.stopPropagation();
						}
					}
				}
			}
		}

		// Call the postDispatch hook for the mapped type
		if ( special.postDispatch ) {
			special.postDispatch.call( this, event );
		}

		return event.result;
	},

	handlers: function( event, handlers ) {
		var i, handleObj, sel, matchedHandlers, matchedSelectors,
			handlerQueue = [],
			delegateCount = handlers.delegateCount,
			cur = event.target;

		// Find delegate handlers
		if ( delegateCount &&

			// Support: IE <=9
			// Black-hole SVG <use> instance trees (trac-13180)
			cur.nodeType &&

			// Support: Firefox <=42
			// Suppress spec-violating clicks indicating a non-primary pointer button (trac-3861)
			// https://www.w3.org/TR/DOM-Level-3-Events/#event-type-click
			// Support: IE 11 only
			// ...but not arrow key "clicks" of radio inputs, which can have `button` -1 (gh-2343)
			!( event.type === "click" && event.button >= 1 ) ) {

			for ( ; cur !== this; cur = cur.parentNode || this ) {

				// Don't check non-elements (#13208)
				// Don't process clicks on disabled elements (#6911, #8165, #11382, #11764)
				if ( cur.nodeType === 1 && !( event.type === "click" && cur.disabled === true ) ) {
					matchedHandlers = [];
					matchedSelectors = {};
					for ( i = 0; i < delegateCount; i++ ) {
						handleObj = handlers[ i ];

						// Don't conflict with Object.prototype properties (#13203)
						sel = handleObj.selector + " ";

						if ( matchedSelectors[ sel ] === undefined ) {
							matchedSelectors[ sel ] = handleObj.needsContext ?
								jQuery( sel, this ).index( cur ) > -1 :
								jQuery.find( sel, this, null, [ cur ] ).length;
						}
						if ( matchedSelectors[ sel ] ) {
							matchedHandlers.push( handleObj );
						}
					}
					if ( matchedHandlers.length ) {
						handlerQueue.push( { elem: cur, handlers: matchedHandlers } );
					}
				}
			}
		}

		// Add the remaining (directly-bound) handlers
		cur = this;
		if ( delegateCount < handlers.length ) {
			handlerQueue.push( { elem: cur, handlers: handlers.slice( delegateCount ) } );
		}

		return handlerQueue;
	},

	addProp: function( name, hook ) {
		Object.defineProperty( jQuery.Event.prototype, name, {
			enumerable: true,
			configurable: true,

			get: isFunction( hook ) ?
				function() {
					if ( this.originalEvent ) {
							return hook( this.originalEvent );
					}
				} :
				function() {
					if ( this.originalEvent ) {
							return this.originalEvent[ name ];
					}
				},

			set: function( value ) {
				Object.defineProperty( this, name, {
					enumerable: true,
					configurable: true,
					writable: true,
					value: value
				} );
			}
		} );
	},

	fix: function( originalEvent ) {
		return originalEvent[ jQuery.expando ] ?
			originalEvent :
			new jQuery.Event( originalEvent );
	},

	special: {
		load: {

			// Prevent triggered image.load events from bubbling to window.load
			noBubble: true
		},
		focus: {

			// Fire native event if possible so blur/focus sequence is correct
			trigger: function() {
				if ( this !== safeActiveElement() && this.focus ) {
					this.focus();
					return false;
				}
			},
			delegateType: "focusin"
		},
		blur: {
			trigger: function() {
				if ( this === safeActiveElement() && this.blur ) {
					this.blur();
					return false;
				}
			},
			delegateType: "focusout"
		},
		click: {

			// For checkbox, fire native event so checked state will be right
			trigger: function() {
				if ( this.type === "checkbox" && this.click && nodeName( this, "input" ) ) {
					this.click();
					return false;
				}
			},

			// For cross-browser consistency, don't fire native .click() on links
			_default: function( event ) {
				return nodeName( event.target, "a" );
			}
		},

		beforeunload: {
			postDispatch: function( event ) {

				// Support: Firefox 20+
				// Firefox doesn't alert if the returnValue field is not set.
				if ( event.result !== undefined && event.originalEvent ) {
					event.originalEvent.returnValue = event.result;
				}
			}
		}
	}
};

jQuery.removeEvent = function( elem, type, handle ) {

	// This "if" is needed for plain objects
	if ( elem.removeEventListener ) {
		elem.removeEventListener( type, handle );
	}
};

jQuery.Event = function( src, props ) {

	// Allow instantiation without the 'new' keyword
	if ( !( this instanceof jQuery.Event ) ) {
		return new jQuery.Event( src, props );
	}

	// Event object
	if ( src && src.type ) {
		this.originalEvent = src;
		this.type = src.type;

		// Events bubbling up the document may have been marked as prevented
		// by a handler lower down the tree; reflect the correct value.
		this.isDefaultPrevented = src.defaultPrevented ||
				src.defaultPrevented === undefined &&

				// Support: Android <=2.3 only
				src.returnValue === false ?
			returnTrue :
			returnFalse;

		// Create target properties
		// Support: Safari <=6 - 7 only
		// Target should not be a text node (#504, #13143)
		this.target = ( src.target && src.target.nodeType === 3 ) ?
			src.target.parentNode :
			src.target;

		this.currentTarget = src.currentTarget;
		this.relatedTarget = src.relatedTarget;

	// Event type
	} else {
		this.type = src;
	}

	// Put explicitly provided properties onto the event object
	if ( props ) {
		jQuery.extend( this, props );
	}

	// Create a timestamp if incoming event doesn't have one
	this.timeStamp = src && src.timeStamp || Date.now();

	// Mark it as fixed
	this[ jQuery.expando ] = true;
};

// jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
// https://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
jQuery.Event.prototype = {
	constructor: jQuery.Event,
	isDefaultPrevented: returnFalse,
	isPropagationStopped: returnFalse,
	isImmediatePropagationStopped: returnFalse,
	isSimulated: false,

	preventDefault: function() {
		var e = this.originalEvent;

		this.isDefaultPrevented = returnTrue;

		if ( e && !this.isSimulated ) {
			e.preventDefault();
		}
	},
	stopPropagation: function() {
		var e = this.originalEvent;

		this.isPropagationStopped = returnTrue;

		if ( e && !this.isSimulated ) {
			e.stopPropagation();
		}
	},
	stopImmediatePropagation: function() {
		var e = this.originalEvent;

		this.isImmediatePropagationStopped = returnTrue;

		if ( e && !this.isSimulated ) {
			e.stopImmediatePropagation();
		}

		this.stopPropagation();
	}
};

// Includes all common event props including KeyEvent and MouseEvent specific props
jQuery.each( {
	altKey: true,
	bubbles: true,
	cancelable: true,
	changedTouches: true,
	ctrlKey: true,
	detail: true,
	eventPhase: true,
	metaKey: true,
	pageX: true,
	pageY: true,
	shiftKey: true,
	view: true,
	"char": true,
	charCode: true,
	key: true,
	keyCode: true,
	button: true,
	buttons: true,
	clientX: true,
	clientY: true,
	offsetX: true,
	offsetY: true,
	pointerId: true,
	pointerType: true,
	screenX: true,
	screenY: true,
	targetTouches: true,
	toElement: true,
	touches: true,

	which: function( event ) {
		var button = event.button;

		// Add which for key events
		if ( event.which == null && rkeyEvent.test( event.type ) ) {
			return event.charCode != null ? event.charCode : event.keyCode;
		}

		// Add which for click: 1 === left; 2 === middle; 3 === right
		if ( !event.which && button !== undefined && rmouseEvent.test( event.type ) ) {
			if ( button & 1 ) {
				return 1;
			}

			if ( button & 2 ) {
				return 3;
			}

			if ( button & 4 ) {
				return 2;
			}

			return 0;
		}

		return event.which;
	}
}, jQuery.event.addProp );

// Create mouseenter/leave events using mouseover/out and event-time checks
// so that event delegation works in jQuery.
// Do the same for pointerenter/pointerleave and pointerover/pointerout
//
// Support: Safari 7 only
// Safari sends mouseenter too often; see:
// https://bugs.chromium.org/p/chromium/issues/detail?id=470258
// for the description of the bug (it existed in older Chrome versions as well).
jQuery.each( {
	mouseenter: "mouseover",
	mouseleave: "mouseout",
	pointerenter: "pointerover",
	pointerleave: "pointerout"
}, function( orig, fix ) {
	jQuery.event.special[ orig ] = {
		delegateType: fix,
		bindType: fix,

		handle: function( event ) {
			var ret,
				target = this,
				related = event.relatedTarget,
				handleObj = event.handleObj;

			// For mouseenter/leave call the handler if related is outside the target.
			// NB: No relatedTarget if the mouse left/entered the browser window
			if ( !related || ( related !== target && !jQuery.contains( target, related ) ) ) {
				event.type = handleObj.origType;
				ret = handleObj.handler.apply( this, arguments );
				event.type = fix;
			}
			return ret;
		}
	};
} );

jQuery.fn.extend( {

	on: function( types, selector, data, fn ) {
		return on( this, types, selector, data, fn );
	},
	one: function( types, selector, data, fn ) {
		return on( this, types, selector, data, fn, 1 );
	},
	off: function( types, selector, fn ) {
		var handleObj, type;
		if ( types && types.preventDefault && types.handleObj ) {

			// ( event )  dispatched jQuery.Event
			handleObj = types.handleObj;
			jQuery( types.delegateTarget ).off(
				handleObj.namespace ?
					handleObj.origType + "." + handleObj.namespace :
					handleObj.origType,
				handleObj.selector,
				handleObj.handler
			);
			return this;
		}
		if ( typeof types === "object" ) {

			// ( types-object [, selector] )
			for ( type in types ) {
				this.off( type, selector, types[ type ] );
			}
			return this;
		}
		if ( selector === false || typeof selector === "function" ) {

			// ( types [, fn] )
			fn = selector;
			selector = undefined;
		}
		if ( fn === false ) {
			fn = returnFalse;
		}
		return this.each( function() {
			jQuery.event.remove( this, types, fn, selector );
		} );
	}
} );


var

	/* eslint-disable max-len */

	// See https://github.com/eslint/eslint/issues/3229
	rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([a-z][^\/\0>\x20\t\r\n\f]*)[^>]*)\/>/gi,

	/* eslint-enable */

	// Support: IE <=10 - 11, Edge 12 - 13 only
	// In IE/Edge using regex groups here causes severe slowdowns.
	// See https://connect.microsoft.com/IE/feedback/details/1736512/
	rnoInnerhtml = /<script|<style|<link/i,

	// checked="checked" or checked
	rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,
	rcleanScript = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g;

// Prefer a tbody over its parent table for containing new rows
function manipulationTarget( elem, content ) {
	if ( nodeName( elem, "table" ) &&
		nodeName( content.nodeType !== 11 ? content : content.firstChild, "tr" ) ) {

		return jQuery( elem ).children( "tbody" )[ 0 ] || elem;
	}

	return elem;
}

// Replace/restore the type attribute of script elements for safe DOM manipulation
function disableScript( elem ) {
	elem.type = ( elem.getAttribute( "type" ) !== null ) + "/" + elem.type;
	return elem;
}
function restoreScript( elem ) {
	if ( ( elem.type || "" ).slice( 0, 5 ) === "true/" ) {
		elem.type = elem.type.slice( 5 );
	} else {
		elem.removeAttribute( "type" );
	}

	return elem;
}

function cloneCopyEvent( src, dest ) {
	var i, l, type, pdataOld, pdataCur, udataOld, udataCur, events;

	if ( dest.nodeType !== 1 ) {
		return;
	}

	// 1. Copy private data: events, handlers, etc.
	if ( dataPriv.hasData( src ) ) {
		pdataOld = dataPriv.access( src );
		pdataCur = dataPriv.set( dest, pdataOld );
		events = pdataOld.events;

		if ( events ) {
			delete pdataCur.handle;
			pdataCur.events = {};

			for ( type in events ) {
				for ( i = 0, l = events[ type ].length; i < l; i++ ) {
					jQuery.event.add( dest, type, events[ type ][ i ] );
				}
			}
		}
	}

	// 2. Copy user data
	if ( dataUser.hasData( src ) ) {
		udataOld = dataUser.access( src );
		udataCur = jQuery.extend( {}, udataOld );

		dataUser.set( dest, udataCur );
	}
}

// Fix IE bugs, see support tests
function fixInput( src, dest ) {
	var nodeName = dest.nodeName.toLowerCase();

	// Fails to persist the checked state of a cloned checkbox or radio button.
	if ( nodeName === "input" && rcheckableType.test( src.type ) ) {
		dest.checked = src.checked;

	// Fails to return the selected option to the default selected state when cloning options
	} else if ( nodeName === "input" || nodeName === "textarea" ) {
		dest.defaultValue = src.defaultValue;
	}
}

function domManip( collection, args, callback, ignored ) {

	// Flatten any nested arrays
	args = concat.apply( [], args );

	var fragment, first, scripts, hasScripts, node, doc,
		i = 0,
		l = collection.length,
		iNoClone = l - 1,
		value = args[ 0 ],
		valueIsFunction = isFunction( value );

	// We can't cloneNode fragments that contain checked, in WebKit
	if ( valueIsFunction ||
			( l > 1 && typeof value === "string" &&
				!support.checkClone && rchecked.test( value ) ) ) {
		return collection.each( function( index ) {
			var self = collection.eq( index );
			if ( valueIsFunction ) {
				args[ 0 ] = value.call( this, index, self.html() );
			}
			domManip( self, args, callback, ignored );
		} );
	}

	if ( l ) {
		fragment = buildFragment( args, collection[ 0 ].ownerDocument, false, collection, ignored );
		first = fragment.firstChild;

		if ( fragment.childNodes.length === 1 ) {
			fragment = first;
		}

		// Require either new content or an interest in ignored elements to invoke the callback
		if ( first || ignored ) {
			scripts = jQuery.map( getAll( fragment, "script" ), disableScript );
			hasScripts = scripts.length;

			// Use the original fragment for the last item
			// instead of the first because it can end up
			// being emptied incorrectly in certain situations (#8070).
			for ( ; i < l; i++ ) {
				node = fragment;

				if ( i !== iNoClone ) {
					node = jQuery.clone( node, true, true );

					// Keep references to cloned scripts for later restoration
					if ( hasScripts ) {

						// Support: Android <=4.0 only, PhantomJS 1 only
						// push.apply(_, arraylike) throws on ancient WebKit
						jQuery.merge( scripts, getAll( node, "script" ) );
					}
				}

				callback.call( collection[ i ], node, i );
			}

			if ( hasScripts ) {
				doc = scripts[ scripts.length - 1 ].ownerDocument;

				// Reenable scripts
				jQuery.map( scripts, restoreScript );

				// Evaluate executable scripts on first document insertion
				for ( i = 0; i < hasScripts; i++ ) {
					node = scripts[ i ];
					if ( rscriptType.test( node.type || "" ) &&
						!dataPriv.access( node, "globalEval" ) &&
						jQuery.contains( doc, node ) ) {

						if ( node.src && ( node.type || "" ).toLowerCase()  !== "module" ) {

							// Optional AJAX dependency, but won't run scripts if not present
							if ( jQuery._evalUrl ) {
								jQuery._evalUrl( node.src );
							}
						} else {
							DOMEval( node.textContent.replace( rcleanScript, "" ), doc, node );
						}
					}
				}
			}
		}
	}

	return collection;
}

function remove( elem, selector, keepData ) {
	var node,
		nodes = selector ? jQuery.filter( selector, elem ) : elem,
		i = 0;

	for ( ; ( node = nodes[ i ] ) != null; i++ ) {
		if ( !keepData && node.nodeType === 1 ) {
			jQuery.cleanData( getAll( node ) );
		}

		if ( node.parentNode ) {
			if ( keepData && jQuery.contains( node.ownerDocument, node ) ) {
				setGlobalEval( getAll( node, "script" ) );
			}
			node.parentNode.removeChild( node );
		}
	}

	return elem;
}

jQuery.extend( {
	htmlPrefilter: function( html ) {
		return html.replace( rxhtmlTag, "<$1></$2>" );
	},

	clone: function( elem, dataAndEvents, deepDataAndEvents ) {
		var i, l, srcElements, destElements,
			clone = elem.cloneNode( true ),
			inPage = jQuery.contains( elem.ownerDocument, elem );

		// Fix IE cloning issues
		if ( !support.noCloneChecked && ( elem.nodeType === 1 || elem.nodeType === 11 ) &&
				!jQuery.isXMLDoc( elem ) ) {

			// We eschew Sizzle here for performance reasons: https://jsperf.com/getall-vs-sizzle/2
			destElements = getAll( clone );
			srcElements = getAll( elem );

			for ( i = 0, l = srcElements.length; i < l; i++ ) {
				fixInput( srcElements[ i ], destElements[ i ] );
			}
		}

		// Copy the events from the original to the clone
		if ( dataAndEvents ) {
			if ( deepDataAndEvents ) {
				srcElements = srcElements || getAll( elem );
				destElements = destElements || getAll( clone );

				for ( i = 0, l = srcElements.length; i < l; i++ ) {
					cloneCopyEvent( srcElements[ i ], destElements[ i ] );
				}
			} else {
				cloneCopyEvent( elem, clone );
			}
		}

		// Preserve script evaluation history
		destElements = getAll( clone, "script" );
		if ( destElements.length > 0 ) {
			setGlobalEval( destElements, !inPage && getAll( elem, "script" ) );
		}

		// Return the cloned set
		return clone;
	},

	cleanData: function( elems ) {
		var data, elem, type,
			special = jQuery.event.special,
			i = 0;

		for ( ; ( elem = elems[ i ] ) !== undefined; i++ ) {
			if ( acceptData( elem ) ) {
				if ( ( data = elem[ dataPriv.expando ] ) ) {
					if ( data.events ) {
						for ( type in data.events ) {
							if ( special[ type ] ) {
								jQuery.event.remove( elem, type );

							// This is a shortcut to avoid jQuery.event.remove's overhead
							} else {
								jQuery.removeEvent( elem, type, data.handle );
							}
						}
					}

					// Support: Chrome <=35 - 45+
					// Assign undefined instead of using delete, see Data#remove
					elem[ dataPriv.expando ] = undefined;
				}
				if ( elem[ dataUser.expando ] ) {

					// Support: Chrome <=35 - 45+
					// Assign undefined instead of using delete, see Data#remove
					elem[ dataUser.expando ] = undefined;
				}
			}
		}
	}
} );

jQuery.fn.extend( {
	detach: function( selector ) {
		return remove( this, selector, true );
	},

	remove: function( selector ) {
		return remove( this, selector );
	},

	text: function( value ) {
		return access( this, function( value ) {
			return value === undefined ?
				jQuery.text( this ) :
				this.empty().each( function() {
					if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
						this.textContent = value;
					}
				} );
		}, null, value, arguments.length );
	},

	append: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.appendChild( elem );
			}
		} );
	},

	prepend: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.insertBefore( elem, target.firstChild );
			}
		} );
	},

	before: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this );
			}
		} );
	},

	after: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this.nextSibling );
			}
		} );
	},

	empty: function() {
		var elem,
			i = 0;

		for ( ; ( elem = this[ i ] ) != null; i++ ) {
			if ( elem.nodeType === 1 ) {

				// Prevent memory leaks
				jQuery.cleanData( getAll( elem, false ) );

				// Remove any remaining nodes
				elem.textContent = "";
			}
		}

		return this;
	},

	clone: function( dataAndEvents, deepDataAndEvents ) {
		dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
		deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

		return this.map( function() {
			return jQuery.clone( this, dataAndEvents, deepDataAndEvents );
		} );
	},

	html: function( value ) {
		return access( this, function( value ) {
			var elem = this[ 0 ] || {},
				i = 0,
				l = this.length;

			if ( value === undefined && elem.nodeType === 1 ) {
				return elem.innerHTML;
			}

			// See if we can take a shortcut and just use innerHTML
			if ( typeof value === "string" && !rnoInnerhtml.test( value ) &&
				!wrapMap[ ( rtagName.exec( value ) || [ "", "" ] )[ 1 ].toLowerCase() ] ) {

				value = jQuery.htmlPrefilter( value );

				try {
					for ( ; i < l; i++ ) {
						elem = this[ i ] || {};

						// Remove element nodes and prevent memory leaks
						if ( elem.nodeType === 1 ) {
							jQuery.cleanData( getAll( elem, false ) );
							elem.innerHTML = value;
						}
					}

					elem = 0;

				// If using innerHTML throws an exception, use the fallback method
				} catch ( e ) {}
			}

			if ( elem ) {
				this.empty().append( value );
			}
		}, null, value, arguments.length );
	},

	replaceWith: function() {
		var ignored = [];

		// Make the changes, replacing each non-ignored context element with the new content
		return domManip( this, arguments, function( elem ) {
			var parent = this.parentNode;

			if ( jQuery.inArray( this, ignored ) < 0 ) {
				jQuery.cleanData( getAll( this ) );
				if ( parent ) {
					parent.replaceChild( elem, this );
				}
			}

		// Force callback invocation
		}, ignored );
	}
} );

jQuery.each( {
	appendTo: "append",
	prependTo: "prepend",
	insertBefore: "before",
	insertAfter: "after",
	replaceAll: "replaceWith"
}, function( name, original ) {
	jQuery.fn[ name ] = function( selector ) {
		var elems,
			ret = [],
			insert = jQuery( selector ),
			last = insert.length - 1,
			i = 0;

		for ( ; i <= last; i++ ) {
			elems = i === last ? this : this.clone( true );
			jQuery( insert[ i ] )[ original ]( elems );

			// Support: Android <=4.0 only, PhantomJS 1 only
			// .get() because push.apply(_, arraylike) throws on ancient WebKit
			push.apply( ret, elems.get() );
		}

		return this.pushStack( ret );
	};
} );
var rnumnonpx = new RegExp( "^(" + pnum + ")(?!px)[a-z%]+$", "i" );

var getStyles = function( elem ) {

		// Support: IE <=11 only, Firefox <=30 (#15098, #14150)
		// IE throws on elements created in popups
		// FF meanwhile throws on frame elements through "defaultView.getComputedStyle"
		var view = elem.ownerDocument.defaultView;

		if ( !view || !view.opener ) {
			view = window;
		}

		return view.getComputedStyle( elem );
	};

var rboxStyle = new RegExp( cssExpand.join( "|" ), "i" );



( function() {

	// Executing both pixelPosition & boxSizingReliable tests require only one layout
	// so they're executed at the same time to save the second computation.
	function computeStyleTests() {

		// This is a singleton, we need to execute it only once
		if ( !div ) {
			return;
		}

		container.style.cssText = "position:absolute;left:-11111px;width:60px;" +
			"margin-top:1px;padding:0;border:0";
		div.style.cssText =
			"position:relative;display:block;box-sizing:border-box;overflow:scroll;" +
			"margin:auto;border:1px;padding:1px;" +
			"width:60%;top:1%";
		documentElement.appendChild( container ).appendChild( div );

		var divStyle = window.getComputedStyle( div );
		pixelPositionVal = divStyle.top !== "1%";

		// Support: Android 4.0 - 4.3 only, Firefox <=3 - 44
		reliableMarginLeftVal = roundPixelMeasures( divStyle.marginLeft ) === 12;

		// Support: Android 4.0 - 4.3 only, Safari <=9.1 - 10.1, iOS <=7.0 - 9.3
		// Some styles come back with percentage values, even though they shouldn't
		div.style.right = "60%";
		pixelBoxStylesVal = roundPixelMeasures( divStyle.right ) === 36;

		// Support: IE 9 - 11 only
		// Detect misreporting of content dimensions for box-sizing:border-box elements
		boxSizingReliableVal = roundPixelMeasures( divStyle.width ) === 36;

		// Support: IE 9 only
		// Detect overflow:scroll screwiness (gh-3699)
		div.style.position = "absolute";
		scrollboxSizeVal = div.offsetWidth === 36 || "absolute";

		documentElement.removeChild( container );

		// Nullify the div so it wouldn't be stored in the memory and
		// it will also be a sign that checks already performed
		div = null;
	}

	function roundPixelMeasures( measure ) {
		return Math.round( parseFloat( measure ) );
	}

	var pixelPositionVal, boxSizingReliableVal, scrollboxSizeVal, pixelBoxStylesVal,
		reliableMarginLeftVal,
		container = document.createElement( "div" ),
		div = document.createElement( "div" );

	// Finish early in limited (non-browser) environments
	if ( !div.style ) {
		return;
	}

	// Support: IE <=9 - 11 only
	// Style of cloned element affects source element cloned (#8908)
	div.style.backgroundClip = "content-box";
	div.cloneNode( true ).style.backgroundClip = "";
	support.clearCloneStyle = div.style.backgroundClip === "content-box";

	jQuery.extend( support, {
		boxSizingReliable: function() {
			computeStyleTests();
			return boxSizingReliableVal;
		},
		pixelBoxStyles: function() {
			computeStyleTests();
			return pixelBoxStylesVal;
		},
		pixelPosition: function() {
			computeStyleTests();
			return pixelPositionVal;
		},
		reliableMarginLeft: function() {
			computeStyleTests();
			return reliableMarginLeftVal;
		},
		scrollboxSize: function() {
			computeStyleTests();
			return scrollboxSizeVal;
		}
	} );
} )();


function curCSS( elem, name, computed ) {
	var width, minWidth, maxWidth, ret,

		// Support: Firefox 51+
		// Retrieving style before computed somehow
		// fixes an issue with getting wrong values
		// on detached elements
		style = elem.style;

	computed = computed || getStyles( elem );

	// getPropertyValue is needed for:
	//   .css('filter') (IE 9 only, #12537)
	//   .css('--customProperty) (#3144)
	if ( computed ) {
		ret = computed.getPropertyValue( name ) || computed[ name ];

		if ( ret === "" && !jQuery.contains( elem.ownerDocument, elem ) ) {
			ret = jQuery.style( elem, name );
		}

		// A tribute to the "awesome hack by Dean Edwards"
		// Android Browser returns percentage for some values,
		// but width seems to be reliably pixels.
		// This is against the CSSOM draft spec:
		// https://drafts.csswg.org/cssom/#resolved-values
		if ( !support.pixelBoxStyles() && rnumnonpx.test( ret ) && rboxStyle.test( name ) ) {

			// Remember the original values
			width = style.width;
			minWidth = style.minWidth;
			maxWidth = style.maxWidth;

			// Put in the new values to get a computed value out
			style.minWidth = style.maxWidth = style.width = ret;
			ret = computed.width;

			// Revert the changed values
			style.width = width;
			style.minWidth = minWidth;
			style.maxWidth = maxWidth;
		}
	}

	return ret !== undefined ?

		// Support: IE <=9 - 11 only
		// IE returns zIndex value as an integer.
		ret + "" :
		ret;
}


function addGetHookIf( conditionFn, hookFn ) {

	// Define the hook, we'll check on the first run if it's really needed.
	return {
		get: function() {
			if ( conditionFn() ) {

				// Hook not needed (or it's not possible to use it due
				// to missing dependency), remove it.
				delete this.get;
				return;
			}

			// Hook needed; redefine it so that the support test is not executed again.
			return ( this.get = hookFn ).apply( this, arguments );
		}
	};
}


var

	// Swappable if display is none or starts with table
	// except "table", "table-cell", or "table-caption"
	// See here for display values: https://developer.mozilla.org/en-US/docs/CSS/display
	rdisplayswap = /^(none|table(?!-c[ea]).+)/,
	rcustomProp = /^--/,
	cssShow = { position: "absolute", visibility: "hidden", display: "block" },
	cssNormalTransform = {
		letterSpacing: "0",
		fontWeight: "400"
	},

	cssPrefixes = [ "Webkit", "Moz", "ms" ],
	emptyStyle = document.createElement( "div" ).style;

// Return a css property mapped to a potentially vendor prefixed property
function vendorPropName( name ) {

	// Shortcut for names that are not vendor prefixed
	if ( name in emptyStyle ) {
		return name;
	}

	// Check for vendor prefixed names
	var capName = name[ 0 ].toUpperCase() + name.slice( 1 ),
		i = cssPrefixes.length;

	while ( i-- ) {
		name = cssPrefixes[ i ] + capName;
		if ( name in emptyStyle ) {
			return name;
		}
	}
}

// Return a property mapped along what jQuery.cssProps suggests or to
// a vendor prefixed property.
function finalPropName( name ) {
	var ret = jQuery.cssProps[ name ];
	if ( !ret ) {
		ret = jQuery.cssProps[ name ] = vendorPropName( name ) || name;
	}
	return ret;
}

function setPositiveNumber( elem, value, subtract ) {

	// Any relative (+/-) values have already been
	// normalized at this point
	var matches = rcssNum.exec( value );
	return matches ?

		// Guard against undefined "subtract", e.g., when used as in cssHooks
		Math.max( 0, matches[ 2 ] - ( subtract || 0 ) ) + ( matches[ 3 ] || "px" ) :
		value;
}

function boxModelAdjustment( elem, dimension, box, isBorderBox, styles, computedVal ) {
	var i = dimension === "width" ? 1 : 0,
		extra = 0,
		delta = 0;

	// Adjustment may not be necessary
	if ( box === ( isBorderBox ? "border" : "content" ) ) {
		return 0;
	}

	for ( ; i < 4; i += 2 ) {

		// Both box models exclude margin
		if ( box === "margin" ) {
			delta += jQuery.css( elem, box + cssExpand[ i ], true, styles );
		}

		// If we get here with a content-box, we're seeking "padding" or "border" or "margin"
		if ( !isBorderBox ) {

			// Add padding
			delta += jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );

			// For "border" or "margin", add border
			if ( box !== "padding" ) {
				delta += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );

			// But still keep track of it otherwise
			} else {
				extra += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}

		// If we get here with a border-box (content + padding + border), we're seeking "content" or
		// "padding" or "margin"
		} else {

			// For "content", subtract padding
			if ( box === "content" ) {
				delta -= jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );
			}

			// For "content" or "padding", subtract border
			if ( box !== "margin" ) {
				delta -= jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}
		}
	}

	// Account for positive content-box scroll gutter when requested by providing computedVal
	if ( !isBorderBox && computedVal >= 0 ) {

		// offsetWidth/offsetHeight is a rounded sum of content, padding, scroll gutter, and border
		// Assuming integer scroll gutter, subtract the rest and round down
		delta += Math.max( 0, Math.ceil(
			elem[ "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 ) ] -
			computedVal -
			delta -
			extra -
			0.5
		) );
	}

	return delta;
}

function getWidthOrHeight( elem, dimension, extra ) {

	// Start with computed style
	var styles = getStyles( elem ),
		val = curCSS( elem, dimension, styles ),
		isBorderBox = jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
		valueIsBorderBox = isBorderBox;

	// Support: Firefox <=54
	// Return a confounding non-pixel value or feign ignorance, as appropriate.
	if ( rnumnonpx.test( val ) ) {
		if ( !extra ) {
			return val;
		}
		val = "auto";
	}

	// Check for style in case a browser which returns unreliable values
	// for getComputedStyle silently falls back to the reliable elem.style
	valueIsBorderBox = valueIsBorderBox &&
		( support.boxSizingReliable() || val === elem.style[ dimension ] );

	// Fall back to offsetWidth/offsetHeight when value is "auto"
	// This happens for inline elements with no explicit setting (gh-3571)
	// Support: Android <=4.1 - 4.3 only
	// Also use offsetWidth/offsetHeight for misreported inline dimensions (gh-3602)
	if ( val === "auto" ||
		!parseFloat( val ) && jQuery.css( elem, "display", false, styles ) === "inline" ) {

		val = elem[ "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 ) ];

		// offsetWidth/offsetHeight provide border-box values
		valueIsBorderBox = true;
	}

	// Normalize "" and auto
	val = parseFloat( val ) || 0;

	// Adjust for the element's box model
	return ( val +
		boxModelAdjustment(
			elem,
			dimension,
			extra || ( isBorderBox ? "border" : "content" ),
			valueIsBorderBox,
			styles,

			// Provide the current computed size to request scroll gutter calculation (gh-3589)
			val
		)
	) + "px";
}

jQuery.extend( {

	// Add in style property hooks for overriding the default
	// behavior of getting and setting a style property
	cssHooks: {
		opacity: {
			get: function( elem, computed ) {
				if ( computed ) {

					// We should always get a number back from opacity
					var ret = curCSS( elem, "opacity" );
					return ret === "" ? "1" : ret;
				}
			}
		}
	},

	// Don't automatically add "px" to these possibly-unitless properties
	cssNumber: {
		"animationIterationCount": true,
		"columnCount": true,
		"fillOpacity": true,
		"flexGrow": true,
		"flexShrink": true,
		"fontWeight": true,
		"lineHeight": true,
		"opacity": true,
		"order": true,
		"orphans": true,
		"widows": true,
		"zIndex": true,
		"zoom": true
	},

	// Add in properties whose names you wish to fix before
	// setting or getting the value
	cssProps: {},

	// Get and set the style property on a DOM Node
	style: function( elem, name, value, extra ) {

		// Don't set styles on text and comment nodes
		if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style ) {
			return;
		}

		// Make sure that we're working with the right name
		var ret, type, hooks,
			origName = camelCase( name ),
			isCustomProp = rcustomProp.test( name ),
			style = elem.style;

		// Make sure that we're working with the right name. We don't
		// want to query the value if it is a CSS custom property
		// since they are user-defined.
		if ( !isCustomProp ) {
			name = finalPropName( origName );
		}

		// Gets hook for the prefixed version, then unprefixed version
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// Check if we're setting a value
		if ( value !== undefined ) {
			type = typeof value;

			// Convert "+=" or "-=" to relative numbers (#7345)
			if ( type === "string" && ( ret = rcssNum.exec( value ) ) && ret[ 1 ] ) {
				value = adjustCSS( elem, name, ret );

				// Fixes bug #9237
				type = "number";
			}

			// Make sure that null and NaN values aren't set (#7116)
			if ( value == null || value !== value ) {
				return;
			}

			// If a number was passed in, add the unit (except for certain CSS properties)
			if ( type === "number" ) {
				value += ret && ret[ 3 ] || ( jQuery.cssNumber[ origName ] ? "" : "px" );
			}

			// background-* props affect original clone's values
			if ( !support.clearCloneStyle && value === "" && name.indexOf( "background" ) === 0 ) {
				style[ name ] = "inherit";
			}

			// If a hook was provided, use that value, otherwise just set the specified value
			if ( !hooks || !( "set" in hooks ) ||
				( value = hooks.set( elem, value, extra ) ) !== undefined ) {

				if ( isCustomProp ) {
					style.setProperty( name, value );
				} else {
					style[ name ] = value;
				}
			}

		} else {

			// If a hook was provided get the non-computed value from there
			if ( hooks && "get" in hooks &&
				( ret = hooks.get( elem, false, extra ) ) !== undefined ) {

				return ret;
			}

			// Otherwise just get the value from the style object
			return style[ name ];
		}
	},

	css: function( elem, name, extra, styles ) {
		var val, num, hooks,
			origName = camelCase( name ),
			isCustomProp = rcustomProp.test( name );

		// Make sure that we're working with the right name. We don't
		// want to modify the value if it is a CSS custom property
		// since they are user-defined.
		if ( !isCustomProp ) {
			name = finalPropName( origName );
		}

		// Try prefixed name followed by the unprefixed name
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// If a hook was provided get the computed value from there
		if ( hooks && "get" in hooks ) {
			val = hooks.get( elem, true, extra );
		}

		// Otherwise, if a way to get the computed value exists, use that
		if ( val === undefined ) {
			val = curCSS( elem, name, styles );
		}

		// Convert "normal" to computed value
		if ( val === "normal" && name in cssNormalTransform ) {
			val = cssNormalTransform[ name ];
		}

		// Make numeric if forced or a qualifier was provided and val looks numeric
		if ( extra === "" || extra ) {
			num = parseFloat( val );
			return extra === true || isFinite( num ) ? num || 0 : val;
		}

		return val;
	}
} );

jQuery.each( [ "height", "width" ], function( i, dimension ) {
	jQuery.cssHooks[ dimension ] = {
		get: function( elem, computed, extra ) {
			if ( computed ) {

				// Certain elements can have dimension info if we invisibly show them
				// but it must have a current display style that would benefit
				return rdisplayswap.test( jQuery.css( elem, "display" ) ) &&

					// Support: Safari 8+
					// Table columns in Safari have non-zero offsetWidth & zero
					// getBoundingClientRect().width unless display is changed.
					// Support: IE <=11 only
					// Running getBoundingClientRect on a disconnected node
					// in IE throws an error.
					( !elem.getClientRects().length || !elem.getBoundingClientRect().width ) ?
						swap( elem, cssShow, function() {
							return getWidthOrHeight( elem, dimension, extra );
						} ) :
						getWidthOrHeight( elem, dimension, extra );
			}
		},

		set: function( elem, value, extra ) {
			var matches,
				styles = getStyles( elem ),
				isBorderBox = jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
				subtract = extra && boxModelAdjustment(
					elem,
					dimension,
					extra,
					isBorderBox,
					styles
				);

			// Account for unreliable border-box dimensions by comparing offset* to computed and
			// faking a content-box to get border and padding (gh-3699)
			if ( isBorderBox && support.scrollboxSize() === styles.position ) {
				subtract -= Math.ceil(
					elem[ "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 ) ] -
					parseFloat( styles[ dimension ] ) -
					boxModelAdjustment( elem, dimension, "border", false, styles ) -
					0.5
				);
			}

			// Convert to pixels if value adjustment is needed
			if ( subtract && ( matches = rcssNum.exec( value ) ) &&
				( matches[ 3 ] || "px" ) !== "px" ) {

				elem.style[ dimension ] = value;
				value = jQuery.css( elem, dimension );
			}

			return setPositiveNumber( elem, value, subtract );
		}
	};
} );

jQuery.cssHooks.marginLeft = addGetHookIf( support.reliableMarginLeft,
	function( elem, computed ) {
		if ( computed ) {
			return ( parseFloat( curCSS( elem, "marginLeft" ) ) ||
				elem.getBoundingClientRect().left -
					swap( elem, { marginLeft: 0 }, function() {
						return elem.getBoundingClientRect().left;
					} )
				) + "px";
		}
	}
);

// These hooks are used by animate to expand properties
jQuery.each( {
	margin: "",
	padding: "",
	border: "Width"
}, function( prefix, suffix ) {
	jQuery.cssHooks[ prefix + suffix ] = {
		expand: function( value ) {
			var i = 0,
				expanded = {},

				// Assumes a single number if not a string
				parts = typeof value === "string" ? value.split( " " ) : [ value ];

			for ( ; i < 4; i++ ) {
				expanded[ prefix + cssExpand[ i ] + suffix ] =
					parts[ i ] || parts[ i - 2 ] || parts[ 0 ];
			}

			return expanded;
		}
	};

	if ( prefix !== "margin" ) {
		jQuery.cssHooks[ prefix + suffix ].set = setPositiveNumber;
	}
} );

jQuery.fn.extend( {
	css: function( name, value ) {
		return access( this, function( elem, name, value ) {
			var styles, len,
				map = {},
				i = 0;

			if ( Array.isArray( name ) ) {
				styles = getStyles( elem );
				len = name.length;

				for ( ; i < len; i++ ) {
					map[ name[ i ] ] = jQuery.css( elem, name[ i ], false, styles );
				}

				return map;
			}

			return value !== undefined ?
				jQuery.style( elem, name, value ) :
				jQuery.css( elem, name );
		}, name, value, arguments.length > 1 );
	}
} );


function Tween( elem, options, prop, end, easing ) {
	return new Tween.prototype.init( elem, options, prop, end, easing );
}
jQuery.Tween = Tween;

Tween.prototype = {
	constructor: Tween,
	init: function( elem, options, prop, end, easing, unit ) {
		this.elem = elem;
		this.prop = prop;
		this.easing = easing || jQuery.easing._default;
		this.options = options;
		this.start = this.now = this.cur();
		this.end = end;
		this.unit = unit || ( jQuery.cssNumber[ prop ] ? "" : "px" );
	},
	cur: function() {
		var hooks = Tween.propHooks[ this.prop ];

		return hooks && hooks.get ?
			hooks.get( this ) :
			Tween.propHooks._default.get( this );
	},
	run: function( percent ) {
		var eased,
			hooks = Tween.propHooks[ this.prop ];

		if ( this.options.duration ) {
			this.pos = eased = jQuery.easing[ this.easing ](
				percent, this.options.duration * percent, 0, 1, this.options.duration
			);
		} else {
			this.pos = eased = percent;
		}
		this.now = ( this.end - this.start ) * eased + this.start;

		if ( this.options.step ) {
			this.options.step.call( this.elem, this.now, this );
		}

		if ( hooks && hooks.set ) {
			hooks.set( this );
		} else {
			Tween.propHooks._default.set( this );
		}
		return this;
	}
};

Tween.prototype.init.prototype = Tween.prototype;

Tween.propHooks = {
	_default: {
		get: function( tween ) {
			var result;

			// Use a property on the element directly when it is not a DOM element,
			// or when there is no matching style property that exists.
			if ( tween.elem.nodeType !== 1 ||
				tween.elem[ tween.prop ] != null && tween.elem.style[ tween.prop ] == null ) {
				return tween.elem[ tween.prop ];
			}

			// Passing an empty string as a 3rd parameter to .css will automatically
			// attempt a parseFloat and fallback to a string if the parse fails.
			// Simple values such as "10px" are parsed to Float;
			// complex values such as "rotate(1rad)" are returned as-is.
			result = jQuery.css( tween.elem, tween.prop, "" );

			// Empty strings, null, undefined and "auto" are converted to 0.
			return !result || result === "auto" ? 0 : result;
		},
		set: function( tween ) {

			// Use step hook for back compat.
			// Use cssHook if its there.
			// Use .style if available and use plain properties where available.
			if ( jQuery.fx.step[ tween.prop ] ) {
				jQuery.fx.step[ tween.prop ]( tween );
			} else if ( tween.elem.nodeType === 1 &&
				( tween.elem.style[ jQuery.cssProps[ tween.prop ] ] != null ||
					jQuery.cssHooks[ tween.prop ] ) ) {
				jQuery.style( tween.elem, tween.prop, tween.now + tween.unit );
			} else {
				tween.elem[ tween.prop ] = tween.now;
			}
		}
	}
};

// Support: IE <=9 only
// Panic based approach to setting things on disconnected nodes
Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
	set: function( tween ) {
		if ( tween.elem.nodeType && tween.elem.parentNode ) {
			tween.elem[ tween.prop ] = tween.now;
		}
	}
};

jQuery.easing = {
	linear: function( p ) {
		return p;
	},
	swing: function( p ) {
		return 0.5 - Math.cos( p * Math.PI ) / 2;
	},
	_default: "swing"
};

jQuery.fx = Tween.prototype.init;

// Back compat <1.8 extension point
jQuery.fx.step = {};




var
	fxNow, inProgress,
	rfxtypes = /^(?:toggle|show|hide)$/,
	rrun = /queueHooks$/;

function schedule() {
	if ( inProgress ) {
		if ( document.hidden === false && window.requestAnimationFrame ) {
			window.requestAnimationFrame( schedule );
		} else {
			window.setTimeout( schedule, jQuery.fx.interval );
		}

		jQuery.fx.tick();
	}
}

// Animations created synchronously will run synchronously
function createFxNow() {
	window.setTimeout( function() {
		fxNow = undefined;
	} );
	return ( fxNow = Date.now() );
}

// Generate parameters to create a standard animation
function genFx( type, includeWidth ) {
	var which,
		i = 0,
		attrs = { height: type };

	// If we include width, step value is 1 to do all cssExpand values,
	// otherwise step value is 2 to skip over Left and Right
	includeWidth = includeWidth ? 1 : 0;
	for ( ; i < 4; i += 2 - includeWidth ) {
		which = cssExpand[ i ];
		attrs[ "margin" + which ] = attrs[ "padding" + which ] = type;
	}

	if ( includeWidth ) {
		attrs.opacity = attrs.width = type;
	}

	return attrs;
}

function createTween( value, prop, animation ) {
	var tween,
		collection = ( Animation.tweeners[ prop ] || [] ).concat( Animation.tweeners[ "*" ] ),
		index = 0,
		length = collection.length;
	for ( ; index < length; index++ ) {
		if ( ( tween = collection[ index ].call( animation, prop, value ) ) ) {

			// We're done with this property
			return tween;
		}
	}
}

function defaultPrefilter( elem, props, opts ) {
	var prop, value, toggle, hooks, oldfire, propTween, restoreDisplay, display,
		isBox = "width" in props || "height" in props,
		anim = this,
		orig = {},
		style = elem.style,
		hidden = elem.nodeType && isHiddenWithinTree( elem ),
		dataShow = dataPriv.get( elem, "fxshow" );

	// Queue-skipping animations hijack the fx hooks
	if ( !opts.queue ) {
		hooks = jQuery._queueHooks( elem, "fx" );
		if ( hooks.unqueued == null ) {
			hooks.unqueued = 0;
			oldfire = hooks.empty.fire;
			hooks.empty.fire = function() {
				if ( !hooks.unqueued ) {
					oldfire();
				}
			};
		}
		hooks.unqueued++;

		anim.always( function() {

			// Ensure the complete handler is called before this completes
			anim.always( function() {
				hooks.unqueued--;
				if ( !jQuery.queue( elem, "fx" ).length ) {
					hooks.empty.fire();
				}
			} );
		} );
	}

	// Detect show/hide animations
	for ( prop in props ) {
		value = props[ prop ];
		if ( rfxtypes.test( value ) ) {
			delete props[ prop ];
			toggle = toggle || value === "toggle";
			if ( value === ( hidden ? "hide" : "show" ) ) {

				// Pretend to be hidden if this is a "show" and
				// there is still data from a stopped show/hide
				if ( value === "show" && dataShow && dataShow[ prop ] !== undefined ) {
					hidden = true;

				// Ignore all other no-op show/hide data
				} else {
					continue;
				}
			}
			orig[ prop ] = dataShow && dataShow[ prop ] || jQuery.style( elem, prop );
		}
	}

	// Bail out if this is a no-op like .hide().hide()
	propTween = !jQuery.isEmptyObject( props );
	if ( !propTween && jQuery.isEmptyObject( orig ) ) {
		return;
	}

	// Restrict "overflow" and "display" styles during box animations
	if ( isBox && elem.nodeType === 1 ) {

		// Support: IE <=9 - 11, Edge 12 - 15
		// Record all 3 overflow attributes because IE does not infer the shorthand
		// from identically-valued overflowX and overflowY and Edge just mirrors
		// the overflowX value there.
		opts.overflow = [ style.overflow, style.overflowX, style.overflowY ];

		// Identify a display type, preferring old show/hide data over the CSS cascade
		restoreDisplay = dataShow && dataShow.display;
		if ( restoreDisplay == null ) {
			restoreDisplay = dataPriv.get( elem, "display" );
		}
		display = jQuery.css( elem, "display" );
		if ( display === "none" ) {
			if ( restoreDisplay ) {
				display = restoreDisplay;
			} else {

				// Get nonempty value(s) by temporarily forcing visibility
				showHide( [ elem ], true );
				restoreDisplay = elem.style.display || restoreDisplay;
				display = jQuery.css( elem, "display" );
				showHide( [ elem ] );
			}
		}

		// Animate inline elements as inline-block
		if ( display === "inline" || display === "inline-block" && restoreDisplay != null ) {
			if ( jQuery.css( elem, "float" ) === "none" ) {

				// Restore the original display value at the end of pure show/hide animations
				if ( !propTween ) {
					anim.done( function() {
						style.display = restoreDisplay;
					} );
					if ( restoreDisplay == null ) {
						display = style.display;
						restoreDisplay = display === "none" ? "" : display;
					}
				}
				style.display = "inline-block";
			}
		}
	}

	if ( opts.overflow ) {
		style.overflow = "hidden";
		anim.always( function() {
			style.overflow = opts.overflow[ 0 ];
			style.overflowX = opts.overflow[ 1 ];
			style.overflowY = opts.overflow[ 2 ];
		} );
	}

	// Implement show/hide animations
	propTween = false;
	for ( prop in orig ) {

		// General show/hide setup for this element animation
		if ( !propTween ) {
			if ( dataShow ) {
				if ( "hidden" in dataShow ) {
					hidden = dataShow.hidden;
				}
			} else {
				dataShow = dataPriv.access( elem, "fxshow", { display: restoreDisplay } );
			}

			// Store hidden/visible for toggle so `.stop().toggle()` "reverses"
			if ( toggle ) {
				dataShow.hidden = !hidden;
			}

			// Show elements before animating them
			if ( hidden ) {
				showHide( [ elem ], true );
			}

			/* eslint-disable no-loop-func */

			anim.done( function() {

			/* eslint-enable no-loop-func */

				// The final step of a "hide" animation is actually hiding the element
				if ( !hidden ) {
					showHide( [ elem ] );
				}
				dataPriv.remove( elem, "fxshow" );
				for ( prop in orig ) {
					jQuery.style( elem, prop, orig[ prop ] );
				}
			} );
		}

		// Per-property setup
		propTween = createTween( hidden ? dataShow[ prop ] : 0, prop, anim );
		if ( !( prop in dataShow ) ) {
			dataShow[ prop ] = propTween.start;
			if ( hidden ) {
				propTween.end = propTween.start;
				propTween.start = 0;
			}
		}
	}
}

function propFilter( props, specialEasing ) {
	var index, name, easing, value, hooks;

	// camelCase, specialEasing and expand cssHook pass
	for ( index in props ) {
		name = camelCase( index );
		easing = specialEasing[ name ];
		value = props[ index ];
		if ( Array.isArray( value ) ) {
			easing = value[ 1 ];
			value = props[ index ] = value[ 0 ];
		}

		if ( index !== name ) {
			props[ name ] = value;
			delete props[ index ];
		}

		hooks = jQuery.cssHooks[ name ];
		if ( hooks && "expand" in hooks ) {
			value = hooks.expand( value );
			delete props[ name ];

			// Not quite $.extend, this won't overwrite existing keys.
			// Reusing 'index' because we have the correct "name"
			for ( index in value ) {
				if ( !( index in props ) ) {
					props[ index ] = value[ index ];
					specialEasing[ index ] = easing;
				}
			}
		} else {
			specialEasing[ name ] = easing;
		}
	}
}

function Animation( elem, properties, options ) {
	var result,
		stopped,
		index = 0,
		length = Animation.prefilters.length,
		deferred = jQuery.Deferred().always( function() {

			// Don't match elem in the :animated selector
			delete tick.elem;
		} ),
		tick = function() {
			if ( stopped ) {
				return false;
			}
			var currentTime = fxNow || createFxNow(),
				remaining = Math.max( 0, animation.startTime + animation.duration - currentTime ),

				// Support: Android 2.3 only
				// Archaic crash bug won't allow us to use `1 - ( 0.5 || 0 )` (#12497)
				temp = remaining / animation.duration || 0,
				percent = 1 - temp,
				index = 0,
				length = animation.tweens.length;

			for ( ; index < length; index++ ) {
				animation.tweens[ index ].run( percent );
			}

			deferred.notifyWith( elem, [ animation, percent, remaining ] );

			// If there's more to do, yield
			if ( percent < 1 && length ) {
				return remaining;
			}

			// If this was an empty animation, synthesize a final progress notification
			if ( !length ) {
				deferred.notifyWith( elem, [ animation, 1, 0 ] );
			}

			// Resolve the animation and report its conclusion
			deferred.resolveWith( elem, [ animation ] );
			return false;
		},
		animation = deferred.promise( {
			elem: elem,
			props: jQuery.extend( {}, properties ),
			opts: jQuery.extend( true, {
				specialEasing: {},
				easing: jQuery.easing._default
			}, options ),
			originalProperties: properties,
			originalOptions: options,
			startTime: fxNow || createFxNow(),
			duration: options.duration,
			tweens: [],
			createTween: function( prop, end ) {
				var tween = jQuery.Tween( elem, animation.opts, prop, end,
						animation.opts.specialEasing[ prop ] || animation.opts.easing );
				animation.tweens.push( tween );
				return tween;
			},
			stop: function( gotoEnd ) {
				var index = 0,

					// If we are going to the end, we want to run all the tweens
					// otherwise we skip this part
					length = gotoEnd ? animation.tweens.length : 0;
				if ( stopped ) {
					return this;
				}
				stopped = true;
				for ( ; index < length; index++ ) {
					animation.tweens[ index ].run( 1 );
				}

				// Resolve when we played the last frame; otherwise, reject
				if ( gotoEnd ) {
					deferred.notifyWith( elem, [ animation, 1, 0 ] );
					deferred.resolveWith( elem, [ animation, gotoEnd ] );
				} else {
					deferred.rejectWith( elem, [ animation, gotoEnd ] );
				}
				return this;
			}
		} ),
		props = animation.props;

	propFilter( props, animation.opts.specialEasing );

	for ( ; index < length; index++ ) {
		result = Animation.prefilters[ index ].call( animation, elem, props, animation.opts );
		if ( result ) {
			if ( isFunction( result.stop ) ) {
				jQuery._queueHooks( animation.elem, animation.opts.queue ).stop =
					result.stop.bind( result );
			}
			return result;
		}
	}

	jQuery.map( props, createTween, animation );

	if ( isFunction( animation.opts.start ) ) {
		animation.opts.start.call( elem, animation );
	}

	// Attach callbacks from options
	animation
		.progress( animation.opts.progress )
		.done( animation.opts.done, animation.opts.complete )
		.fail( animation.opts.fail )
		.always( animation.opts.always );

	jQuery.fx.timer(
		jQuery.extend( tick, {
			elem: elem,
			anim: animation,
			queue: animation.opts.queue
		} )
	);

	return animation;
}

jQuery.Animation = jQuery.extend( Animation, {

	tweeners: {
		"*": [ function( prop, value ) {
			var tween = this.createTween( prop, value );
			adjustCSS( tween.elem, prop, rcssNum.exec( value ), tween );
			return tween;
		} ]
	},

	tweener: function( props, callback ) {
		if ( isFunction( props ) ) {
			callback = props;
			props = [ "*" ];
		} else {
			props = props.match( rnothtmlwhite );
		}

		var prop,
			index = 0,
			length = props.length;

		for ( ; index < length; index++ ) {
			prop = props[ index ];
			Animation.tweeners[ prop ] = Animation.tweeners[ prop ] || [];
			Animation.tweeners[ prop ].unshift( callback );
		}
	},

	prefilters: [ defaultPrefilter ],

	prefilter: function( callback, prepend ) {
		if ( prepend ) {
			Animation.prefilters.unshift( callback );
		} else {
			Animation.prefilters.push( callback );
		}
	}
} );

jQuery.speed = function( speed, easing, fn ) {
	var opt = speed && typeof speed === "object" ? jQuery.extend( {}, speed ) : {
		complete: fn || !fn && easing ||
			isFunction( speed ) && speed,
		duration: speed,
		easing: fn && easing || easing && !isFunction( easing ) && easing
	};

	// Go to the end state if fx are off
	if ( jQuery.fx.off ) {
		opt.duration = 0;

	} else {
		if ( typeof opt.duration !== "number" ) {
			if ( opt.duration in jQuery.fx.speeds ) {
				opt.duration = jQuery.fx.speeds[ opt.duration ];

			} else {
				opt.duration = jQuery.fx.speeds._default;
			}
		}
	}

	// Normalize opt.queue - true/undefined/null -> "fx"
	if ( opt.queue == null || opt.queue === true ) {
		opt.queue = "fx";
	}

	// Queueing
	opt.old = opt.complete;

	opt.complete = function() {
		if ( isFunction( opt.old ) ) {
			opt.old.call( this );
		}

		if ( opt.queue ) {
			jQuery.dequeue( this, opt.queue );
		}
	};

	return opt;
};

jQuery.fn.extend( {
	fadeTo: function( speed, to, easing, callback ) {

		// Show any hidden elements after setting opacity to 0
		return this.filter( isHiddenWithinTree ).css( "opacity", 0 ).show()

			// Animate to the value specified
			.end().animate( { opacity: to }, speed, easing, callback );
	},
	animate: function( prop, speed, easing, callback ) {
		var empty = jQuery.isEmptyObject( prop ),
			optall = jQuery.speed( speed, easing, callback ),
			doAnimation = function() {

				// Operate on a copy of prop so per-property easing won't be lost
				var anim = Animation( this, jQuery.extend( {}, prop ), optall );

				// Empty animations, or finishing resolves immediately
				if ( empty || dataPriv.get( this, "finish" ) ) {
					anim.stop( true );
				}
			};
			doAnimation.finish = doAnimation;

		return empty || optall.queue === false ?
			this.each( doAnimation ) :
			this.queue( optall.queue, doAnimation );
	},
	stop: function( type, clearQueue, gotoEnd ) {
		var stopQueue = function( hooks ) {
			var stop = hooks.stop;
			delete hooks.stop;
			stop( gotoEnd );
		};

		if ( typeof type !== "string" ) {
			gotoEnd = clearQueue;
			clearQueue = type;
			type = undefined;
		}
		if ( clearQueue && type !== false ) {
			this.queue( type || "fx", [] );
		}

		return this.each( function() {
			var dequeue = true,
				index = type != null && type + "queueHooks",
				timers = jQuery.timers,
				data = dataPriv.get( this );

			if ( index ) {
				if ( data[ index ] && data[ index ].stop ) {
					stopQueue( data[ index ] );
				}
			} else {
				for ( index in data ) {
					if ( data[ index ] && data[ index ].stop && rrun.test( index ) ) {
						stopQueue( data[ index ] );
					}
				}
			}

			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this &&
					( type == null || timers[ index ].queue === type ) ) {

					timers[ index ].anim.stop( gotoEnd );
					dequeue = false;
					timers.splice( index, 1 );
				}
			}

			// Start the next in the queue if the last step wasn't forced.
			// Timers currently will call their complete callbacks, which
			// will dequeue but only if they were gotoEnd.
			if ( dequeue || !gotoEnd ) {
				jQuery.dequeue( this, type );
			}
		} );
	},
	finish: function( type ) {
		if ( type !== false ) {
			type = type || "fx";
		}
		return this.each( function() {
			var index,
				data = dataPriv.get( this ),
				queue = data[ type + "queue" ],
				hooks = data[ type + "queueHooks" ],
				timers = jQuery.timers,
				length = queue ? queue.length : 0;

			// Enable finishing flag on private data
			data.finish = true;

			// Empty the queue first
			jQuery.queue( this, type, [] );

			if ( hooks && hooks.stop ) {
				hooks.stop.call( this, true );
			}

			// Look for any active animations, and finish them
			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this && timers[ index ].queue === type ) {
					timers[ index ].anim.stop( true );
					timers.splice( index, 1 );
				}
			}

			// Look for any animations in the old queue and finish them
			for ( index = 0; index < length; index++ ) {
				if ( queue[ index ] && queue[ index ].finish ) {
					queue[ index ].finish.call( this );
				}
			}

			// Turn off finishing flag
			delete data.finish;
		} );
	}
} );

jQuery.each( [ "toggle", "show", "hide" ], function( i, name ) {
	var cssFn = jQuery.fn[ name ];
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return speed == null || typeof speed === "boolean" ?
			cssFn.apply( this, arguments ) :
			this.animate( genFx( name, true ), speed, easing, callback );
	};
} );

// Generate shortcuts for custom animations
jQuery.each( {
	slideDown: genFx( "show" ),
	slideUp: genFx( "hide" ),
	slideToggle: genFx( "toggle" ),
	fadeIn: { opacity: "show" },
	fadeOut: { opacity: "hide" },
	fadeToggle: { opacity: "toggle" }
}, function( name, props ) {
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return this.animate( props, speed, easing, callback );
	};
} );

jQuery.timers = [];
jQuery.fx.tick = function() {
	var timer,
		i = 0,
		timers = jQuery.timers;

	fxNow = Date.now();

	for ( ; i < timers.length; i++ ) {
		timer = timers[ i ];

		// Run the timer and safely remove it when done (allowing for external removal)
		if ( !timer() && timers[ i ] === timer ) {
			timers.splice( i--, 1 );
		}
	}

	if ( !timers.length ) {
		jQuery.fx.stop();
	}
	fxNow = undefined;
};

jQuery.fx.timer = function( timer ) {
	jQuery.timers.push( timer );
	jQuery.fx.start();
};

jQuery.fx.interval = 13;
jQuery.fx.start = function() {
	if ( inProgress ) {
		return;
	}

	inProgress = true;
	schedule();
};

jQuery.fx.stop = function() {
	inProgress = null;
};

jQuery.fx.speeds = {
	slow: 600,
	fast: 200,

	// Default speed
	_default: 400
};


// Based off of the plugin by Clint Helfers, with permission.
// https://web.archive.org/web/20100324014747/http://blindsignals.com/index.php/2009/07/jquery-delay/
jQuery.fn.delay = function( time, type ) {
	time = jQuery.fx ? jQuery.fx.speeds[ time ] || time : time;
	type = type || "fx";

	return this.queue( type, function( next, hooks ) {
		var timeout = window.setTimeout( next, time );
		hooks.stop = function() {
			window.clearTimeout( timeout );
		};
	} );
};


( function() {
	var input = document.createElement( "input" ),
		select = document.createElement( "select" ),
		opt = select.appendChild( document.createElement( "option" ) );

	input.type = "checkbox";

	// Support: Android <=4.3 only
	// Default value for a checkbox should be "on"
	support.checkOn = input.value !== "";

	// Support: IE <=11 only
	// Must access selectedIndex to make default options select
	support.optSelected = opt.selected;

	// Support: IE <=11 only
	// An input loses its value after becoming a radio
	input = document.createElement( "input" );
	input.value = "t";
	input.type = "radio";
	support.radioValue = input.value === "t";
} )();


var boolHook,
	attrHandle = jQuery.expr.attrHandle;

jQuery.fn.extend( {
	attr: function( name, value ) {
		return access( this, jQuery.attr, name, value, arguments.length > 1 );
	},

	removeAttr: function( name ) {
		return this.each( function() {
			jQuery.removeAttr( this, name );
		} );
	}
} );

jQuery.extend( {
	attr: function( elem, name, value ) {
		var ret, hooks,
			nType = elem.nodeType;

		// Don't get/set attributes on text, comment and attribute nodes
		if ( nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		// Fallback to prop when attributes are not supported
		if ( typeof elem.getAttribute === "undefined" ) {
			return jQuery.prop( elem, name, value );
		}

		// Attribute hooks are determined by the lowercase version
		// Grab necessary hook if one is defined
		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {
			hooks = jQuery.attrHooks[ name.toLowerCase() ] ||
				( jQuery.expr.match.bool.test( name ) ? boolHook : undefined );
		}

		if ( value !== undefined ) {
			if ( value === null ) {
				jQuery.removeAttr( elem, name );
				return;
			}

			if ( hooks && "set" in hooks &&
				( ret = hooks.set( elem, value, name ) ) !== undefined ) {
				return ret;
			}

			elem.setAttribute( name, value + "" );
			return value;
		}

		if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
			return ret;
		}

		ret = jQuery.find.attr( elem, name );

		// Non-existent attributes return null, we normalize to undefined
		return ret == null ? undefined : ret;
	},

	attrHooks: {
		type: {
			set: function( elem, value ) {
				if ( !support.radioValue && value === "radio" &&
					nodeName( elem, "input" ) ) {
					var val = elem.value;
					elem.setAttribute( "type", value );
					if ( val ) {
						elem.value = val;
					}
					return value;
				}
			}
		}
	},

	removeAttr: function( elem, value ) {
		var name,
			i = 0,

			// Attribute names can contain non-HTML whitespace characters
			// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
			attrNames = value && value.match( rnothtmlwhite );

		if ( attrNames && elem.nodeType === 1 ) {
			while ( ( name = attrNames[ i++ ] ) ) {
				elem.removeAttribute( name );
			}
		}
	}
} );

// Hooks for boolean attributes
boolHook = {
	set: function( elem, value, name ) {
		if ( value === false ) {

			// Remove boolean attributes when set to false
			jQuery.removeAttr( elem, name );
		} else {
			elem.setAttribute( name, name );
		}
		return name;
	}
};

jQuery.each( jQuery.expr.match.bool.source.match( /\w+/g ), function( i, name ) {
	var getter = attrHandle[ name ] || jQuery.find.attr;

	attrHandle[ name ] = function( elem, name, isXML ) {
		var ret, handle,
			lowercaseName = name.toLowerCase();

		if ( !isXML ) {

			// Avoid an infinite loop by temporarily removing this function from the getter
			handle = attrHandle[ lowercaseName ];
			attrHandle[ lowercaseName ] = ret;
			ret = getter( elem, name, isXML ) != null ?
				lowercaseName :
				null;
			attrHandle[ lowercaseName ] = handle;
		}
		return ret;
	};
} );




var rfocusable = /^(?:input|select|textarea|button)$/i,
	rclickable = /^(?:a|area)$/i;

jQuery.fn.extend( {
	prop: function( name, value ) {
		return access( this, jQuery.prop, name, value, arguments.length > 1 );
	},

	removeProp: function( name ) {
		return this.each( function() {
			delete this[ jQuery.propFix[ name ] || name ];
		} );
	}
} );

jQuery.extend( {
	prop: function( elem, name, value ) {
		var ret, hooks,
			nType = elem.nodeType;

		// Don't get/set properties on text, comment and attribute nodes
		if ( nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {

			// Fix name and attach hooks
			name = jQuery.propFix[ name ] || name;
			hooks = jQuery.propHooks[ name ];
		}

		if ( value !== undefined ) {
			if ( hooks && "set" in hooks &&
				( ret = hooks.set( elem, value, name ) ) !== undefined ) {
				return ret;
			}

			return ( elem[ name ] = value );
		}

		if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
			return ret;
		}

		return elem[ name ];
	},

	propHooks: {
		tabIndex: {
			get: function( elem ) {

				// Support: IE <=9 - 11 only
				// elem.tabIndex doesn't always return the
				// correct value when it hasn't been explicitly set
				// https://web.archive.org/web/20141116233347/http://fluidproject.org/blog/2008/01/09/getting-setting-and-removing-tabindex-values-with-javascript/
				// Use proper attribute retrieval(#12072)
				var tabindex = jQuery.find.attr( elem, "tabindex" );

				if ( tabindex ) {
					return parseInt( tabindex, 10 );
				}

				if (
					rfocusable.test( elem.nodeName ) ||
					rclickable.test( elem.nodeName ) &&
					elem.href
				) {
					return 0;
				}

				return -1;
			}
		}
	},

	propFix: {
		"for": "htmlFor",
		"class": "className"
	}
} );

// Support: IE <=11 only
// Accessing the selectedIndex property
// forces the browser to respect setting selected
// on the option
// The getter ensures a default option is selected
// when in an optgroup
// eslint rule "no-unused-expressions" is disabled for this code
// since it considers such accessions noop
if ( !support.optSelected ) {
	jQuery.propHooks.selected = {
		get: function( elem ) {

			/* eslint no-unused-expressions: "off" */

			var parent = elem.parentNode;
			if ( parent && parent.parentNode ) {
				parent.parentNode.selectedIndex;
			}
			return null;
		},
		set: function( elem ) {

			/* eslint no-unused-expressions: "off" */

			var parent = elem.parentNode;
			if ( parent ) {
				parent.selectedIndex;

				if ( parent.parentNode ) {
					parent.parentNode.selectedIndex;
				}
			}
		}
	};
}

jQuery.each( [
	"tabIndex",
	"readOnly",
	"maxLength",
	"cellSpacing",
	"cellPadding",
	"rowSpan",
	"colSpan",
	"useMap",
	"frameBorder",
	"contentEditable"
], function() {
	jQuery.propFix[ this.toLowerCase() ] = this;
} );




	// Strip and collapse whitespace according to HTML spec
	// https://infra.spec.whatwg.org/#strip-and-collapse-ascii-whitespace
	function stripAndCollapse( value ) {
		var tokens = value.match( rnothtmlwhite ) || [];
		return tokens.join( " " );
	}


function getClass( elem ) {
	return elem.getAttribute && elem.getAttribute( "class" ) || "";
}

function classesToArray( value ) {
	if ( Array.isArray( value ) ) {
		return value;
	}
	if ( typeof value === "string" ) {
		return value.match( rnothtmlwhite ) || [];
	}
	return [];
}

jQuery.fn.extend( {
	addClass: function( value ) {
		var classes, elem, cur, curValue, clazz, j, finalValue,
			i = 0;

		if ( isFunction( value ) ) {
			return this.each( function( j ) {
				jQuery( this ).addClass( value.call( this, j, getClass( this ) ) );
			} );
		}

		classes = classesToArray( value );

		if ( classes.length ) {
			while ( ( elem = this[ i++ ] ) ) {
				curValue = getClass( elem );
				cur = elem.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );

				if ( cur ) {
					j = 0;
					while ( ( clazz = classes[ j++ ] ) ) {
						if ( cur.indexOf( " " + clazz + " " ) < 0 ) {
							cur += clazz + " ";
						}
					}

					// Only assign if different to avoid unneeded rendering.
					finalValue = stripAndCollapse( cur );
					if ( curValue !== finalValue ) {
						elem.setAttribute( "class", finalValue );
					}
				}
			}
		}

		return this;
	},

	removeClass: function( value ) {
		var classes, elem, cur, curValue, clazz, j, finalValue,
			i = 0;

		if ( isFunction( value ) ) {
			return this.each( function( j ) {
				jQuery( this ).removeClass( value.call( this, j, getClass( this ) ) );
			} );
		}

		if ( !arguments.length ) {
			return this.attr( "class", "" );
		}

		classes = classesToArray( value );

		if ( classes.length ) {
			while ( ( elem = this[ i++ ] ) ) {
				curValue = getClass( elem );

				// This expression is here for better compressibility (see addClass)
				cur = elem.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );

				if ( cur ) {
					j = 0;
					while ( ( clazz = classes[ j++ ] ) ) {

						// Remove *all* instances
						while ( cur.indexOf( " " + clazz + " " ) > -1 ) {
							cur = cur.replace( " " + clazz + " ", " " );
						}
					}

					// Only assign if different to avoid unneeded rendering.
					finalValue = stripAndCollapse( cur );
					if ( curValue !== finalValue ) {
						elem.setAttribute( "class", finalValue );
					}
				}
			}
		}

		return this;
	},

	toggleClass: function( value, stateVal ) {
		var type = typeof value,
			isValidValue = type === "string" || Array.isArray( value );

		if ( typeof stateVal === "boolean" && isValidValue ) {
			return stateVal ? this.addClass( value ) : this.removeClass( value );
		}

		if ( isFunction( value ) ) {
			return this.each( function( i ) {
				jQuery( this ).toggleClass(
					value.call( this, i, getClass( this ), stateVal ),
					stateVal
				);
			} );
		}

		return this.each( function() {
			var className, i, self, classNames;

			if ( isValidValue ) {

				// Toggle individual class names
				i = 0;
				self = jQuery( this );
				classNames = classesToArray( value );

				while ( ( className = classNames[ i++ ] ) ) {

					// Check each className given, space separated list
					if ( self.hasClass( className ) ) {
						self.removeClass( className );
					} else {
						self.addClass( className );
					}
				}

			// Toggle whole class name
			} else if ( value === undefined || type === "boolean" ) {
				className = getClass( this );
				if ( className ) {

					// Store className if set
					dataPriv.set( this, "__className__", className );
				}

				// If the element has a class name or if we're passed `false`,
				// then remove the whole classname (if there was one, the above saved it).
				// Otherwise bring back whatever was previously saved (if anything),
				// falling back to the empty string if nothing was stored.
				if ( this.setAttribute ) {
					this.setAttribute( "class",
						className || value === false ?
						"" :
						dataPriv.get( this, "__className__" ) || ""
					);
				}
			}
		} );
	},

	hasClass: function( selector ) {
		var className, elem,
			i = 0;

		className = " " + selector + " ";
		while ( ( elem = this[ i++ ] ) ) {
			if ( elem.nodeType === 1 &&
				( " " + stripAndCollapse( getClass( elem ) ) + " " ).indexOf( className ) > -1 ) {
					return true;
			}
		}

		return false;
	}
} );




var rreturn = /\r/g;

jQuery.fn.extend( {
	val: function( value ) {
		var hooks, ret, valueIsFunction,
			elem = this[ 0 ];

		if ( !arguments.length ) {
			if ( elem ) {
				hooks = jQuery.valHooks[ elem.type ] ||
					jQuery.valHooks[ elem.nodeName.toLowerCase() ];

				if ( hooks &&
					"get" in hooks &&
					( ret = hooks.get( elem, "value" ) ) !== undefined
				) {
					return ret;
				}

				ret = elem.value;

				// Handle most common string cases
				if ( typeof ret === "string" ) {
					return ret.replace( rreturn, "" );
				}

				// Handle cases where value is null/undef or number
				return ret == null ? "" : ret;
			}

			return;
		}

		valueIsFunction = isFunction( value );

		return this.each( function( i ) {
			var val;

			if ( this.nodeType !== 1 ) {
				return;
			}

			if ( valueIsFunction ) {
				val = value.call( this, i, jQuery( this ).val() );
			} else {
				val = value;
			}

			// Treat null/undefined as ""; convert numbers to string
			if ( val == null ) {
				val = "";

			} else if ( typeof val === "number" ) {
				val += "";

			} else if ( Array.isArray( val ) ) {
				val = jQuery.map( val, function( value ) {
					return value == null ? "" : value + "";
				} );
			}

			hooks = jQuery.valHooks[ this.type ] || jQuery.valHooks[ this.nodeName.toLowerCase() ];

			// If set returns undefined, fall back to normal setting
			if ( !hooks || !( "set" in hooks ) || hooks.set( this, val, "value" ) === undefined ) {
				this.value = val;
			}
		} );
	}
} );

jQuery.extend( {
	valHooks: {
		option: {
			get: function( elem ) {

				var val = jQuery.find.attr( elem, "value" );
				return val != null ?
					val :

					// Support: IE <=10 - 11 only
					// option.text throws exceptions (#14686, #14858)
					// Strip and collapse whitespace
					// https://html.spec.whatwg.org/#strip-and-collapse-whitespace
					stripAndCollapse( jQuery.text( elem ) );
			}
		},
		select: {
			get: function( elem ) {
				var value, option, i,
					options = elem.options,
					index = elem.selectedIndex,
					one = elem.type === "select-one",
					values = one ? null : [],
					max = one ? index + 1 : options.length;

				if ( index < 0 ) {
					i = max;

				} else {
					i = one ? index : 0;
				}

				// Loop through all the selected options
				for ( ; i < max; i++ ) {
					option = options[ i ];

					// Support: IE <=9 only
					// IE8-9 doesn't update selected after form reset (#2551)
					if ( ( option.selected || i === index ) &&

							// Don't return options that are disabled or in a disabled optgroup
							!option.disabled &&
							( !option.parentNode.disabled ||
								!nodeName( option.parentNode, "optgroup" ) ) ) {

						// Get the specific value for the option
						value = jQuery( option ).val();

						// We don't need an array for one selects
						if ( one ) {
							return value;
						}

						// Multi-Selects return an array
						values.push( value );
					}
				}

				return values;
			},

			set: function( elem, value ) {
				var optionSet, option,
					options = elem.options,
					values = jQuery.makeArray( value ),
					i = options.length;

				while ( i-- ) {
					option = options[ i ];

					/* eslint-disable no-cond-assign */

					if ( option.selected =
						jQuery.inArray( jQuery.valHooks.option.get( option ), values ) > -1
					) {
						optionSet = true;
					}

					/* eslint-enable no-cond-assign */
				}

				// Force browsers to behave consistently when non-matching value is set
				if ( !optionSet ) {
					elem.selectedIndex = -1;
				}
				return values;
			}
		}
	}
} );

// Radios and checkboxes getter/setter
jQuery.each( [ "radio", "checkbox" ], function() {
	jQuery.valHooks[ this ] = {
		set: function( elem, value ) {
			if ( Array.isArray( value ) ) {
				return ( elem.checked = jQuery.inArray( jQuery( elem ).val(), value ) > -1 );
			}
		}
	};
	if ( !support.checkOn ) {
		jQuery.valHooks[ this ].get = function( elem ) {
			return elem.getAttribute( "value" ) === null ? "on" : elem.value;
		};
	}
} );




// Return jQuery for attributes-only inclusion


support.focusin = "onfocusin" in window;


var rfocusMorph = /^(?:focusinfocus|focusoutblur)$/,
	stopPropagationCallback = function( e ) {
		e.stopPropagation();
	};

jQuery.extend( jQuery.event, {

	trigger: function( event, data, elem, onlyHandlers ) {

		var i, cur, tmp, bubbleType, ontype, handle, special, lastElement,
			eventPath = [ elem || document ],
			type = hasOwn.call( event, "type" ) ? event.type : event,
			namespaces = hasOwn.call( event, "namespace" ) ? event.namespace.split( "." ) : [];

		cur = lastElement = tmp = elem = elem || document;

		// Don't do events on text and comment nodes
		if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
			return;
		}

		// focus/blur morphs to focusin/out; ensure we're not firing them right now
		if ( rfocusMorph.test( type + jQuery.event.triggered ) ) {
			return;
		}

		if ( type.indexOf( "." ) > -1 ) {

			// Namespaced trigger; create a regexp to match event type in handle()
			namespaces = type.split( "." );
			type = namespaces.shift();
			namespaces.sort();
		}
		ontype = type.indexOf( ":" ) < 0 && "on" + type;

		// Caller can pass in a jQuery.Event object, Object, or just an event type string
		event = event[ jQuery.expando ] ?
			event :
			new jQuery.Event( type, typeof event === "object" && event );

		// Trigger bitmask: & 1 for native handlers; & 2 for jQuery (always true)
		event.isTrigger = onlyHandlers ? 2 : 3;
		event.namespace = namespaces.join( "." );
		event.rnamespace = event.namespace ?
			new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" ) :
			null;

		// Clean up the event in case it is being reused
		event.result = undefined;
		if ( !event.target ) {
			event.target = elem;
		}

		// Clone any incoming data and prepend the event, creating the handler arg list
		data = data == null ?
			[ event ] :
			jQuery.makeArray( data, [ event ] );

		// Allow special events to draw outside the lines
		special = jQuery.event.special[ type ] || {};
		if ( !onlyHandlers && special.trigger && special.trigger.apply( elem, data ) === false ) {
			return;
		}

		// Determine event propagation path in advance, per W3C events spec (#9951)
		// Bubble up to document, then to window; watch for a global ownerDocument var (#9724)
		if ( !onlyHandlers && !special.noBubble && !isWindow( elem ) ) {

			bubbleType = special.delegateType || type;
			if ( !rfocusMorph.test( bubbleType + type ) ) {
				cur = cur.parentNode;
			}
			for ( ; cur; cur = cur.parentNode ) {
				eventPath.push( cur );
				tmp = cur;
			}

			// Only add window if we got to document (e.g., not plain obj or detached DOM)
			if ( tmp === ( elem.ownerDocument || document ) ) {
				eventPath.push( tmp.defaultView || tmp.parentWindow || window );
			}
		}

		// Fire handlers on the event path
		i = 0;
		while ( ( cur = eventPath[ i++ ] ) && !event.isPropagationStopped() ) {
			lastElement = cur;
			event.type = i > 1 ?
				bubbleType :
				special.bindType || type;

			// jQuery handler
			handle = ( dataPriv.get( cur, "events" ) || {} )[ event.type ] &&
				dataPriv.get( cur, "handle" );
			if ( handle ) {
				handle.apply( cur, data );
			}

			// Native handler
			handle = ontype && cur[ ontype ];
			if ( handle && handle.apply && acceptData( cur ) ) {
				event.result = handle.apply( cur, data );
				if ( event.result === false ) {
					event.preventDefault();
				}
			}
		}
		event.type = type;

		// If nobody prevented the default action, do it now
		if ( !onlyHandlers && !event.isDefaultPrevented() ) {

			if ( ( !special._default ||
				special._default.apply( eventPath.pop(), data ) === false ) &&
				acceptData( elem ) ) {

				// Call a native DOM method on the target with the same name as the event.
				// Don't do default actions on window, that's where global variables be (#6170)
				if ( ontype && isFunction( elem[ type ] ) && !isWindow( elem ) ) {

					// Don't re-trigger an onFOO event when we call its FOO() method
					tmp = elem[ ontype ];

					if ( tmp ) {
						elem[ ontype ] = null;
					}

					// Prevent re-triggering of the same event, since we already bubbled it above
					jQuery.event.triggered = type;

					if ( event.isPropagationStopped() ) {
						lastElement.addEventListener( type, stopPropagationCallback );
					}

					elem[ type ]();

					if ( event.isPropagationStopped() ) {
						lastElement.removeEventListener( type, stopPropagationCallback );
					}

					jQuery.event.triggered = undefined;

					if ( tmp ) {
						elem[ ontype ] = tmp;
					}
				}
			}
		}

		return event.result;
	},

	// Piggyback on a donor event to simulate a different one
	// Used only for `focus(in | out)` events
	simulate: function( type, elem, event ) {
		var e = jQuery.extend(
			new jQuery.Event(),
			event,
			{
				type: type,
				isSimulated: true
			}
		);

		jQuery.event.trigger( e, null, elem );
	}

} );

jQuery.fn.extend( {

	trigger: function( type, data ) {
		return this.each( function() {
			jQuery.event.trigger( type, data, this );
		} );
	},
	triggerHandler: function( type, data ) {
		var elem = this[ 0 ];
		if ( elem ) {
			return jQuery.event.trigger( type, data, elem, true );
		}
	}
} );


// Support: Firefox <=44
// Firefox doesn't have focus(in | out) events
// Related ticket - https://bugzilla.mozilla.org/show_bug.cgi?id=687787
//
// Support: Chrome <=48 - 49, Safari <=9.0 - 9.1
// focus(in | out) events fire after focus & blur events,
// which is spec violation - http://www.w3.org/TR/DOM-Level-3-Events/#events-focusevent-event-order
// Related ticket - https://bugs.chromium.org/p/chromium/issues/detail?id=449857
if ( !support.focusin ) {
	jQuery.each( { focus: "focusin", blur: "focusout" }, function( orig, fix ) {

		// Attach a single capturing handler on the document while someone wants focusin/focusout
		var handler = function( event ) {
			jQuery.event.simulate( fix, event.target, jQuery.event.fix( event ) );
		};

		jQuery.event.special[ fix ] = {
			setup: function() {
				var doc = this.ownerDocument || this,
					attaches = dataPriv.access( doc, fix );

				if ( !attaches ) {
					doc.addEventListener( orig, handler, true );
				}
				dataPriv.access( doc, fix, ( attaches || 0 ) + 1 );
			},
			teardown: function() {
				var doc = this.ownerDocument || this,
					attaches = dataPriv.access( doc, fix ) - 1;

				if ( !attaches ) {
					doc.removeEventListener( orig, handler, true );
					dataPriv.remove( doc, fix );

				} else {
					dataPriv.access( doc, fix, attaches );
				}
			}
		};
	} );
}
var location = window.location;

var nonce = Date.now();

var rquery = ( /\?/ );



// Cross-browser xml parsing
jQuery.parseXML = function( data ) {
	var xml;
	if ( !data || typeof data !== "string" ) {
		return null;
	}

	// Support: IE 9 - 11 only
	// IE throws on parseFromString with invalid input.
	try {
		xml = ( new window.DOMParser() ).parseFromString( data, "text/xml" );
	} catch ( e ) {
		xml = undefined;
	}

	if ( !xml || xml.getElementsByTagName( "parsererror" ).length ) {
		jQuery.error( "Invalid XML: " + data );
	}
	return xml;
};


var
	rbracket = /\[\]$/,
	rCRLF = /\r?\n/g,
	rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
	rsubmittable = /^(?:input|select|textarea|keygen)/i;

function buildParams( prefix, obj, traditional, add ) {
	var name;

	if ( Array.isArray( obj ) ) {

		// Serialize array item.
		jQuery.each( obj, function( i, v ) {
			if ( traditional || rbracket.test( prefix ) ) {

				// Treat each array item as a scalar.
				add( prefix, v );

			} else {

				// Item is non-scalar (array or object), encode its numeric index.
				buildParams(
					prefix + "[" + ( typeof v === "object" && v != null ? i : "" ) + "]",
					v,
					traditional,
					add
				);
			}
		} );

	} else if ( !traditional && toType( obj ) === "object" ) {

		// Serialize object item.
		for ( name in obj ) {
			buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
		}

	} else {

		// Serialize scalar item.
		add( prefix, obj );
	}
}

// Serialize an array of form elements or a set of
// key/values into a query string
jQuery.param = function( a, traditional ) {
	var prefix,
		s = [],
		add = function( key, valueOrFunction ) {

			// If value is a function, invoke it and use its return value
			var value = isFunction( valueOrFunction ) ?
				valueOrFunction() :
				valueOrFunction;

			s[ s.length ] = encodeURIComponent( key ) + "=" +
				encodeURIComponent( value == null ? "" : value );
		};

	// If an array was passed in, assume that it is an array of form elements.
	if ( Array.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {

		// Serialize the form elements
		jQuery.each( a, function() {
			add( this.name, this.value );
		} );

	} else {

		// If traditional, encode the "old" way (the way 1.3.2 or older
		// did it), otherwise encode params recursively.
		for ( prefix in a ) {
			buildParams( prefix, a[ prefix ], traditional, add );
		}
	}

	// Return the resulting serialization
	return s.join( "&" );
};

jQuery.fn.extend( {
	serialize: function() {
		return jQuery.param( this.serializeArray() );
	},
	serializeArray: function() {
		return this.map( function() {

			// Can add propHook for "elements" to filter or add form elements
			var elements = jQuery.prop( this, "elements" );
			return elements ? jQuery.makeArray( elements ) : this;
		} )
		.filter( function() {
			var type = this.type;

			// Use .is( ":disabled" ) so that fieldset[disabled] works
			return this.name && !jQuery( this ).is( ":disabled" ) &&
				rsubmittable.test( this.nodeName ) && !rsubmitterTypes.test( type ) &&
				( this.checked || !rcheckableType.test( type ) );
		} )
		.map( function( i, elem ) {
			var val = jQuery( this ).val();

			if ( val == null ) {
				return null;
			}

			if ( Array.isArray( val ) ) {
				return jQuery.map( val, function( val ) {
					return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
				} );
			}

			return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
		} ).get();
	}
} );


var
	r20 = /%20/g,
	rhash = /#.*$/,
	rantiCache = /([?&])_=[^&]*/,
	rheaders = /^(.*?):[ \t]*([^\r\n]*)$/mg,

	// #7653, #8125, #8152: local protocol detection
	rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
	rnoContent = /^(?:GET|HEAD)$/,
	rprotocol = /^\/\//,

	/* Prefilters
	 * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
	 * 2) These are called:
	 *    - BEFORE asking for a transport
	 *    - AFTER param serialization (s.data is a string if s.processData is true)
	 * 3) key is the dataType
	 * 4) the catchall symbol "*" can be used
	 * 5) execution will start with transport dataType and THEN continue down to "*" if needed
	 */
	prefilters = {},

	/* Transports bindings
	 * 1) key is the dataType
	 * 2) the catchall symbol "*" can be used
	 * 3) selection will start with transport dataType and THEN go to "*" if needed
	 */
	transports = {},

	// Avoid comment-prolog char sequence (#10098); must appease lint and evade compression
	allTypes = "*/".concat( "*" ),

	// Anchor tag for parsing the document origin
	originAnchor = document.createElement( "a" );
	originAnchor.href = location.href;

// Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
function addToPrefiltersOrTransports( structure ) {

	// dataTypeExpression is optional and defaults to "*"
	return function( dataTypeExpression, func ) {

		if ( typeof dataTypeExpression !== "string" ) {
			func = dataTypeExpression;
			dataTypeExpression = "*";
		}

		var dataType,
			i = 0,
			dataTypes = dataTypeExpression.toLowerCase().match( rnothtmlwhite ) || [];

		if ( isFunction( func ) ) {

			// For each dataType in the dataTypeExpression
			while ( ( dataType = dataTypes[ i++ ] ) ) {

				// Prepend if requested
				if ( dataType[ 0 ] === "+" ) {
					dataType = dataType.slice( 1 ) || "*";
					( structure[ dataType ] = structure[ dataType ] || [] ).unshift( func );

				// Otherwise append
				} else {
					( structure[ dataType ] = structure[ dataType ] || [] ).push( func );
				}
			}
		}
	};
}

// Base inspection function for prefilters and transports
function inspectPrefiltersOrTransports( structure, options, originalOptions, jqXHR ) {

	var inspected = {},
		seekingTransport = ( structure === transports );

	function inspect( dataType ) {
		var selected;
		inspected[ dataType ] = true;
		jQuery.each( structure[ dataType ] || [], function( _, prefilterOrFactory ) {
			var dataTypeOrTransport = prefilterOrFactory( options, originalOptions, jqXHR );
			if ( typeof dataTypeOrTransport === "string" &&
				!seekingTransport && !inspected[ dataTypeOrTransport ] ) {

				options.dataTypes.unshift( dataTypeOrTransport );
				inspect( dataTypeOrTransport );
				return false;
			} else if ( seekingTransport ) {
				return !( selected = dataTypeOrTransport );
			}
		} );
		return selected;
	}

	return inspect( options.dataTypes[ 0 ] ) || !inspected[ "*" ] && inspect( "*" );
}

// A special extend for ajax options
// that takes "flat" options (not to be deep extended)
// Fixes #9887
function ajaxExtend( target, src ) {
	var key, deep,
		flatOptions = jQuery.ajaxSettings.flatOptions || {};

	for ( key in src ) {
		if ( src[ key ] !== undefined ) {
			( flatOptions[ key ] ? target : ( deep || ( deep = {} ) ) )[ key ] = src[ key ];
		}
	}
	if ( deep ) {
		jQuery.extend( true, target, deep );
	}

	return target;
}

/* Handles responses to an ajax request:
 * - finds the right dataType (mediates between content-type and expected dataType)
 * - returns the corresponding response
 */
function ajaxHandleResponses( s, jqXHR, responses ) {

	var ct, type, finalDataType, firstDataType,
		contents = s.contents,
		dataTypes = s.dataTypes;

	// Remove auto dataType and get content-type in the process
	while ( dataTypes[ 0 ] === "*" ) {
		dataTypes.shift();
		if ( ct === undefined ) {
			ct = s.mimeType || jqXHR.getResponseHeader( "Content-Type" );
		}
	}

	// Check if we're dealing with a known content-type
	if ( ct ) {
		for ( type in contents ) {
			if ( contents[ type ] && contents[ type ].test( ct ) ) {
				dataTypes.unshift( type );
				break;
			}
		}
	}

	// Check to see if we have a response for the expected dataType
	if ( dataTypes[ 0 ] in responses ) {
		finalDataType = dataTypes[ 0 ];
	} else {

		// Try convertible dataTypes
		for ( type in responses ) {
			if ( !dataTypes[ 0 ] || s.converters[ type + " " + dataTypes[ 0 ] ] ) {
				finalDataType = type;
				break;
			}
			if ( !firstDataType ) {
				firstDataType = type;
			}
		}

		// Or just use first one
		finalDataType = finalDataType || firstDataType;
	}

	// If we found a dataType
	// We add the dataType to the list if needed
	// and return the corresponding response
	if ( finalDataType ) {
		if ( finalDataType !== dataTypes[ 0 ] ) {
			dataTypes.unshift( finalDataType );
		}
		return responses[ finalDataType ];
	}
}

/* Chain conversions given the request and the original response
 * Also sets the responseXXX fields on the jqXHR instance
 */
function ajaxConvert( s, response, jqXHR, isSuccess ) {
	var conv2, current, conv, tmp, prev,
		converters = {},

		// Work with a copy of dataTypes in case we need to modify it for conversion
		dataTypes = s.dataTypes.slice();

	// Create converters map with lowercased keys
	if ( dataTypes[ 1 ] ) {
		for ( conv in s.converters ) {
			converters[ conv.toLowerCase() ] = s.converters[ conv ];
		}
	}

	current = dataTypes.shift();

	// Convert to each sequential dataType
	while ( current ) {

		if ( s.responseFields[ current ] ) {
			jqXHR[ s.responseFields[ current ] ] = response;
		}

		// Apply the dataFilter if provided
		if ( !prev && isSuccess && s.dataFilter ) {
			response = s.dataFilter( response, s.dataType );
		}

		prev = current;
		current = dataTypes.shift();

		if ( current ) {

			// There's only work to do if current dataType is non-auto
			if ( current === "*" ) {

				current = prev;

			// Convert response if prev dataType is non-auto and differs from current
			} else if ( prev !== "*" && prev !== current ) {

				// Seek a direct converter
				conv = converters[ prev + " " + current ] || converters[ "* " + current ];

				// If none found, seek a pair
				if ( !conv ) {
					for ( conv2 in converters ) {

						// If conv2 outputs current
						tmp = conv2.split( " " );
						if ( tmp[ 1 ] === current ) {

							// If prev can be converted to accepted input
							conv = converters[ prev + " " + tmp[ 0 ] ] ||
								converters[ "* " + tmp[ 0 ] ];
							if ( conv ) {

								// Condense equivalence converters
								if ( conv === true ) {
									conv = converters[ conv2 ];

								// Otherwise, insert the intermediate dataType
								} else if ( converters[ conv2 ] !== true ) {
									current = tmp[ 0 ];
									dataTypes.unshift( tmp[ 1 ] );
								}
								break;
							}
						}
					}
				}

				// Apply converter (if not an equivalence)
				if ( conv !== true ) {

					// Unless errors are allowed to bubble, catch and return them
					if ( conv && s.throws ) {
						response = conv( response );
					} else {
						try {
							response = conv( response );
						} catch ( e ) {
							return {
								state: "parsererror",
								error: conv ? e : "No conversion from " + prev + " to " + current
							};
						}
					}
				}
			}
		}
	}

	return { state: "success", data: response };
}

jQuery.extend( {

	// Counter for holding the number of active queries
	active: 0,

	// Last-Modified header cache for next request
	lastModified: {},
	etag: {},

	ajaxSettings: {
		url: location.href,
		type: "GET",
		isLocal: rlocalProtocol.test( location.protocol ),
		global: true,
		processData: true,
		async: true,
		contentType: "application/x-www-form-urlencoded; charset=UTF-8",

		/*
		timeout: 0,
		data: null,
		dataType: null,
		username: null,
		password: null,
		cache: null,
		throws: false,
		traditional: false,
		headers: {},
		*/

		accepts: {
			"*": allTypes,
			text: "text/plain",
			html: "text/html",
			xml: "application/xml, text/xml",
			json: "application/json, text/javascript"
		},

		contents: {
			xml: /\bxml\b/,
			html: /\bhtml/,
			json: /\bjson\b/
		},

		responseFields: {
			xml: "responseXML",
			text: "responseText",
			json: "responseJSON"
		},

		// Data converters
		// Keys separate source (or catchall "*") and destination types with a single space
		converters: {

			// Convert anything to text
			"* text": String,

			// Text to html (true = no transformation)
			"text html": true,

			// Evaluate text as a json expression
			"text json": JSON.parse,

			// Parse text as xml
			"text xml": jQuery.parseXML
		},

		// For options that shouldn't be deep extended:
		// you can add your own custom options here if
		// and when you create one that shouldn't be
		// deep extended (see ajaxExtend)
		flatOptions: {
			url: true,
			context: true
		}
	},

	// Creates a full fledged settings object into target
	// with both ajaxSettings and settings fields.
	// If target is omitted, writes into ajaxSettings.
	ajaxSetup: function( target, settings ) {
		return settings ?

			// Building a settings object
			ajaxExtend( ajaxExtend( target, jQuery.ajaxSettings ), settings ) :

			// Extending ajaxSettings
			ajaxExtend( jQuery.ajaxSettings, target );
	},

	ajaxPrefilter: addToPrefiltersOrTransports( prefilters ),
	ajaxTransport: addToPrefiltersOrTransports( transports ),

	// Main method
	ajax: function( url, options ) {

		// If url is an object, simulate pre-1.5 signature
		if ( typeof url === "object" ) {
			options = url;
			url = undefined;
		}

		// Force options to be an object
		options = options || {};

		var transport,

			// URL without anti-cache param
			cacheURL,

			// Response headers
			responseHeadersString,
			responseHeaders,

			// timeout handle
			timeoutTimer,

			// Url cleanup var
			urlAnchor,

			// Request state (becomes false upon send and true upon completion)
			completed,

			// To know if global events are to be dispatched
			fireGlobals,

			// Loop variable
			i,

			// uncached part of the url
			uncached,

			// Create the final options object
			s = jQuery.ajaxSetup( {}, options ),

			// Callbacks context
			callbackContext = s.context || s,

			// Context for global events is callbackContext if it is a DOM node or jQuery collection
			globalEventContext = s.context &&
				( callbackContext.nodeType || callbackContext.jquery ) ?
					jQuery( callbackContext ) :
					jQuery.event,

			// Deferreds
			deferred = jQuery.Deferred(),
			completeDeferred = jQuery.Callbacks( "once memory" ),

			// Status-dependent callbacks
			statusCode = s.statusCode || {},

			// Headers (they are sent all at once)
			requestHeaders = {},
			requestHeadersNames = {},

			// Default abort message
			strAbort = "canceled",

			// Fake xhr
			jqXHR = {
				readyState: 0,

				// Builds headers hashtable if needed
				getResponseHeader: function( key ) {
					var match;
					if ( completed ) {
						if ( !responseHeaders ) {
							responseHeaders = {};
							while ( ( match = rheaders.exec( responseHeadersString ) ) ) {
								responseHeaders[ match[ 1 ].toLowerCase() ] = match[ 2 ];
							}
						}
						match = responseHeaders[ key.toLowerCase() ];
					}
					return match == null ? null : match;
				},

				// Raw string
				getAllResponseHeaders: function() {
					return completed ? responseHeadersString : null;
				},

				// Caches the header
				setRequestHeader: function( name, value ) {
					if ( completed == null ) {
						name = requestHeadersNames[ name.toLowerCase() ] =
							requestHeadersNames[ name.toLowerCase() ] || name;
						requestHeaders[ name ] = value;
					}
					return this;
				},

				// Overrides response content-type header
				overrideMimeType: function( type ) {
					if ( completed == null ) {
						s.mimeType = type;
					}
					return this;
				},

				// Status-dependent callbacks
				statusCode: function( map ) {
					var code;
					if ( map ) {
						if ( completed ) {

							// Execute the appropriate callbacks
							jqXHR.always( map[ jqXHR.status ] );
						} else {

							// Lazy-add the new callbacks in a way that preserves old ones
							for ( code in map ) {
								statusCode[ code ] = [ statusCode[ code ], map[ code ] ];
							}
						}
					}
					return this;
				},

				// Cancel the request
				abort: function( statusText ) {
					var finalText = statusText || strAbort;
					if ( transport ) {
						transport.abort( finalText );
					}
					done( 0, finalText );
					return this;
				}
			};

		// Attach deferreds
		deferred.promise( jqXHR );

		// Add protocol if not provided (prefilters might expect it)
		// Handle falsy url in the settings object (#10093: consistency with old signature)
		// We also use the url parameter if available
		s.url = ( ( url || s.url || location.href ) + "" )
			.replace( rprotocol, location.protocol + "//" );

		// Alias method option to type as per ticket #12004
		s.type = options.method || options.type || s.method || s.type;

		// Extract dataTypes list
		s.dataTypes = ( s.dataType || "*" ).toLowerCase().match( rnothtmlwhite ) || [ "" ];

		// A cross-domain request is in order when the origin doesn't match the current origin.
		if ( s.crossDomain == null ) {
			urlAnchor = document.createElement( "a" );

			// Support: IE <=8 - 11, Edge 12 - 15
			// IE throws exception on accessing the href property if url is malformed,
			// e.g. http://example.com:80x/
			try {
				urlAnchor.href = s.url;

				// Support: IE <=8 - 11 only
				// Anchor's host property isn't correctly set when s.url is relative
				urlAnchor.href = urlAnchor.href;
				s.crossDomain = originAnchor.protocol + "//" + originAnchor.host !==
					urlAnchor.protocol + "//" + urlAnchor.host;
			} catch ( e ) {

				// If there is an error parsing the URL, assume it is crossDomain,
				// it can be rejected by the transport if it is invalid
				s.crossDomain = true;
			}
		}

		// Convert data if not already a string
		if ( s.data && s.processData && typeof s.data !== "string" ) {
			s.data = jQuery.param( s.data, s.traditional );
		}

		// Apply prefilters
		inspectPrefiltersOrTransports( prefilters, s, options, jqXHR );

		// If request was aborted inside a prefilter, stop there
		if ( completed ) {
			return jqXHR;
		}

		// We can fire global events as of now if asked to
		// Don't fire events if jQuery.event is undefined in an AMD-usage scenario (#15118)
		fireGlobals = jQuery.event && s.global;

		// Watch for a new set of requests
		if ( fireGlobals && jQuery.active++ === 0 ) {
			jQuery.event.trigger( "ajaxStart" );
		}

		// Uppercase the type
		s.type = s.type.toUpperCase();

		// Determine if request has content
		s.hasContent = !rnoContent.test( s.type );

		// Save the URL in case we're toying with the If-Modified-Since
		// and/or If-None-Match header later on
		// Remove hash to simplify url manipulation
		cacheURL = s.url.replace( rhash, "" );

		// More options handling for requests with no content
		if ( !s.hasContent ) {

			// Remember the hash so we can put it back
			uncached = s.url.slice( cacheURL.length );

			// If data is available and should be processed, append data to url
			if ( s.data && ( s.processData || typeof s.data === "string" ) ) {
				cacheURL += ( rquery.test( cacheURL ) ? "&" : "?" ) + s.data;

				// #9682: remove data so that it's not used in an eventual retry
				delete s.data;
			}

			// Add or update anti-cache param if needed
			if ( s.cache === false ) {
				cacheURL = cacheURL.replace( rantiCache, "$1" );
				uncached = ( rquery.test( cacheURL ) ? "&" : "?" ) + "_=" + ( nonce++ ) + uncached;
			}

			// Put hash and anti-cache on the URL that will be requested (gh-1732)
			s.url = cacheURL + uncached;

		// Change '%20' to '+' if this is encoded form body content (gh-2658)
		} else if ( s.data && s.processData &&
			( s.contentType || "" ).indexOf( "application/x-www-form-urlencoded" ) === 0 ) {
			s.data = s.data.replace( r20, "+" );
		}

		// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
		if ( s.ifModified ) {
			if ( jQuery.lastModified[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-Modified-Since", jQuery.lastModified[ cacheURL ] );
			}
			if ( jQuery.etag[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-None-Match", jQuery.etag[ cacheURL ] );
			}
		}

		// Set the correct header, if data is being sent
		if ( s.data && s.hasContent && s.contentType !== false || options.contentType ) {
			jqXHR.setRequestHeader( "Content-Type", s.contentType );
		}

		// Set the Accepts header for the server, depending on the dataType
		jqXHR.setRequestHeader(
			"Accept",
			s.dataTypes[ 0 ] && s.accepts[ s.dataTypes[ 0 ] ] ?
				s.accepts[ s.dataTypes[ 0 ] ] +
					( s.dataTypes[ 0 ] !== "*" ? ", " + allTypes + "; q=0.01" : "" ) :
				s.accepts[ "*" ]
		);

		// Check for headers option
		for ( i in s.headers ) {
			jqXHR.setRequestHeader( i, s.headers[ i ] );
		}

		// Allow custom headers/mimetypes and early abort
		if ( s.beforeSend &&
			( s.beforeSend.call( callbackContext, jqXHR, s ) === false || completed ) ) {

			// Abort if not done already and return
			return jqXHR.abort();
		}

		// Aborting is no longer a cancellation
		strAbort = "abort";

		// Install callbacks on deferreds
		completeDeferred.add( s.complete );
		jqXHR.done( s.success );
		jqXHR.fail( s.error );

		// Get transport
		transport = inspectPrefiltersOrTransports( transports, s, options, jqXHR );

		// If no transport, we auto-abort
		if ( !transport ) {
			done( -1, "No Transport" );
		} else {
			jqXHR.readyState = 1;

			// Send global event
			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxSend", [ jqXHR, s ] );
			}

			// If request was aborted inside ajaxSend, stop there
			if ( completed ) {
				return jqXHR;
			}

			// Timeout
			if ( s.async && s.timeout > 0 ) {
				timeoutTimer = window.setTimeout( function() {
					jqXHR.abort( "timeout" );
				}, s.timeout );
			}

			try {
				completed = false;
				transport.send( requestHeaders, done );
			} catch ( e ) {

				// Rethrow post-completion exceptions
				if ( completed ) {
					throw e;
				}

				// Propagate others as results
				done( -1, e );
			}
		}

		// Callback for when everything is done
		function done( status, nativeStatusText, responses, headers ) {
			var isSuccess, success, error, response, modified,
				statusText = nativeStatusText;

			// Ignore repeat invocations
			if ( completed ) {
				return;
			}

			completed = true;

			// Clear timeout if it exists
			if ( timeoutTimer ) {
				window.clearTimeout( timeoutTimer );
			}

			// Dereference transport for early garbage collection
			// (no matter how long the jqXHR object will be used)
			transport = undefined;

			// Cache response headers
			responseHeadersString = headers || "";

			// Set readyState
			jqXHR.readyState = status > 0 ? 4 : 0;

			// Determine if successful
			isSuccess = status >= 200 && status < 300 || status === 304;

			// Get response data
			if ( responses ) {
				response = ajaxHandleResponses( s, jqXHR, responses );
			}

			// Convert no matter what (that way responseXXX fields are always set)
			response = ajaxConvert( s, response, jqXHR, isSuccess );

			// If successful, handle type chaining
			if ( isSuccess ) {

				// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
				if ( s.ifModified ) {
					modified = jqXHR.getResponseHeader( "Last-Modified" );
					if ( modified ) {
						jQuery.lastModified[ cacheURL ] = modified;
					}
					modified = jqXHR.getResponseHeader( "etag" );
					if ( modified ) {
						jQuery.etag[ cacheURL ] = modified;
					}
				}

				// if no content
				if ( status === 204 || s.type === "HEAD" ) {
					statusText = "nocontent";

				// if not modified
				} else if ( status === 304 ) {
					statusText = "notmodified";

				// If we have data, let's convert it
				} else {
					statusText = response.state;
					success = response.data;
					error = response.error;
					isSuccess = !error;
				}
			} else {

				// Extract error from statusText and normalize for non-aborts
				error = statusText;
				if ( status || !statusText ) {
					statusText = "error";
					if ( status < 0 ) {
						status = 0;
					}
				}
			}

			// Set data for the fake xhr object
			jqXHR.status = status;
			jqXHR.statusText = ( nativeStatusText || statusText ) + "";

			// Success/Error
			if ( isSuccess ) {
				deferred.resolveWith( callbackContext, [ success, statusText, jqXHR ] );
			} else {
				deferred.rejectWith( callbackContext, [ jqXHR, statusText, error ] );
			}

			// Status-dependent callbacks
			jqXHR.statusCode( statusCode );
			statusCode = undefined;

			if ( fireGlobals ) {
				globalEventContext.trigger( isSuccess ? "ajaxSuccess" : "ajaxError",
					[ jqXHR, s, isSuccess ? success : error ] );
			}

			// Complete
			completeDeferred.fireWith( callbackContext, [ jqXHR, statusText ] );

			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxComplete", [ jqXHR, s ] );

				// Handle the global AJAX counter
				if ( !( --jQuery.active ) ) {
					jQuery.event.trigger( "ajaxStop" );
				}
			}
		}

		return jqXHR;
	},

	getJSON: function( url, data, callback ) {
		return jQuery.get( url, data, callback, "json" );
	},

	getScript: function( url, callback ) {
		return jQuery.get( url, undefined, callback, "script" );
	}
} );

jQuery.each( [ "get", "post" ], function( i, method ) {
	jQuery[ method ] = function( url, data, callback, type ) {

		// Shift arguments if data argument was omitted
		if ( isFunction( data ) ) {
			type = type || callback;
			callback = data;
			data = undefined;
		}

		// The url can be an options object (which then must have .url)
		return jQuery.ajax( jQuery.extend( {
			url: url,
			type: method,
			dataType: type,
			data: data,
			success: callback
		}, jQuery.isPlainObject( url ) && url ) );
	};
} );


jQuery._evalUrl = function( url ) {
	return jQuery.ajax( {
		url: url,

		// Make this explicit, since user can override this through ajaxSetup (#11264)
		type: "GET",
		dataType: "script",
		cache: true,
		async: false,
		global: false,
		"throws": true
	} );
};


jQuery.fn.extend( {
	wrapAll: function( html ) {
		var wrap;

		if ( this[ 0 ] ) {
			if ( isFunction( html ) ) {
				html = html.call( this[ 0 ] );
			}

			// The elements to wrap the target around
			wrap = jQuery( html, this[ 0 ].ownerDocument ).eq( 0 ).clone( true );

			if ( this[ 0 ].parentNode ) {
				wrap.insertBefore( this[ 0 ] );
			}

			wrap.map( function() {
				var elem = this;

				while ( elem.firstElementChild ) {
					elem = elem.firstElementChild;
				}

				return elem;
			} ).append( this );
		}

		return this;
	},

	wrapInner: function( html ) {
		if ( isFunction( html ) ) {
			return this.each( function( i ) {
				jQuery( this ).wrapInner( html.call( this, i ) );
			} );
		}

		return this.each( function() {
			var self = jQuery( this ),
				contents = self.contents();

			if ( contents.length ) {
				contents.wrapAll( html );

			} else {
				self.append( html );
			}
		} );
	},

	wrap: function( html ) {
		var htmlIsFunction = isFunction( html );

		return this.each( function( i ) {
			jQuery( this ).wrapAll( htmlIsFunction ? html.call( this, i ) : html );
		} );
	},

	unwrap: function( selector ) {
		this.parent( selector ).not( "body" ).each( function() {
			jQuery( this ).replaceWith( this.childNodes );
		} );
		return this;
	}
} );


jQuery.expr.pseudos.hidden = function( elem ) {
	return !jQuery.expr.pseudos.visible( elem );
};
jQuery.expr.pseudos.visible = function( elem ) {
	return !!( elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length );
};




jQuery.ajaxSettings.xhr = function() {
	try {
		return new window.XMLHttpRequest();
	} catch ( e ) {}
};

var xhrSuccessStatus = {

		// File protocol always yields status code 0, assume 200
		0: 200,

		// Support: IE <=9 only
		// #1450: sometimes IE returns 1223 when it should be 204
		1223: 204
	},
	xhrSupported = jQuery.ajaxSettings.xhr();

support.cors = !!xhrSupported && ( "withCredentials" in xhrSupported );
support.ajax = xhrSupported = !!xhrSupported;

jQuery.ajaxTransport( function( options ) {
	var callback, errorCallback;

	// Cross domain only allowed if supported through XMLHttpRequest
	if ( support.cors || xhrSupported && !options.crossDomain ) {
		return {
			send: function( headers, complete ) {
				var i,
					xhr = options.xhr();

				xhr.open(
					options.type,
					options.url,
					options.async,
					options.username,
					options.password
				);

				// Apply custom fields if provided
				if ( options.xhrFields ) {
					for ( i in options.xhrFields ) {
						xhr[ i ] = options.xhrFields[ i ];
					}
				}

				// Override mime type if needed
				if ( options.mimeType && xhr.overrideMimeType ) {
					xhr.overrideMimeType( options.mimeType );
				}

				// X-Requested-With header
				// For cross-domain requests, seeing as conditions for a preflight are
				// akin to a jigsaw puzzle, we simply never set it to be sure.
				// (it can always be set on a per-request basis or even using ajaxSetup)
				// For same-domain requests, won't change header if already provided.
				if ( !options.crossDomain && !headers[ "X-Requested-With" ] ) {
					headers[ "X-Requested-With" ] = "XMLHttpRequest";
				}

				// Set headers
				for ( i in headers ) {
					xhr.setRequestHeader( i, headers[ i ] );
				}

				// Callback
				callback = function( type ) {
					return function() {
						if ( callback ) {
							callback = errorCallback = xhr.onload =
								xhr.onerror = xhr.onabort = xhr.ontimeout =
									xhr.onreadystatechange = null;

							if ( type === "abort" ) {
								xhr.abort();
							} else if ( type === "error" ) {

								// Support: IE <=9 only
								// On a manual native abort, IE9 throws
								// errors on any property access that is not readyState
								if ( typeof xhr.status !== "number" ) {
									complete( 0, "error" );
								} else {
									complete(

										// File: protocol always yields status 0; see #8605, #14207
										xhr.status,
										xhr.statusText
									);
								}
							} else {
								complete(
									xhrSuccessStatus[ xhr.status ] || xhr.status,
									xhr.statusText,

									// Support: IE <=9 only
									// IE9 has no XHR2 but throws on binary (trac-11426)
									// For XHR2 non-text, let the caller handle it (gh-2498)
									( xhr.responseType || "text" ) !== "text"  ||
									typeof xhr.responseText !== "string" ?
										{ binary: xhr.response } :
										{ text: xhr.responseText },
									xhr.getAllResponseHeaders()
								);
							}
						}
					};
				};

				// Listen to events
				xhr.onload = callback();
				errorCallback = xhr.onerror = xhr.ontimeout = callback( "error" );

				// Support: IE 9 only
				// Use onreadystatechange to replace onabort
				// to handle uncaught aborts
				if ( xhr.onabort !== undefined ) {
					xhr.onabort = errorCallback;
				} else {
					xhr.onreadystatechange = function() {

						// Check readyState before timeout as it changes
						if ( xhr.readyState === 4 ) {

							// Allow onerror to be called first,
							// but that will not handle a native abort
							// Also, save errorCallback to a variable
							// as xhr.onerror cannot be accessed
							window.setTimeout( function() {
								if ( callback ) {
									errorCallback();
								}
							} );
						}
					};
				}

				// Create the abort callback
				callback = callback( "abort" );

				try {

					// Do send the request (this may raise an exception)
					xhr.send( options.hasContent && options.data || null );
				} catch ( e ) {

					// #14683: Only rethrow if this hasn't been notified as an error yet
					if ( callback ) {
						throw e;
					}
				}
			},

			abort: function() {
				if ( callback ) {
					callback();
				}
			}
		};
	}
} );




// Prevent auto-execution of scripts when no explicit dataType was provided (See gh-2432)
jQuery.ajaxPrefilter( function( s ) {
	if ( s.crossDomain ) {
		s.contents.script = false;
	}
} );

// Install script dataType
jQuery.ajaxSetup( {
	accepts: {
		script: "text/javascript, application/javascript, " +
			"application/ecmascript, application/x-ecmascript"
	},
	contents: {
		script: /\b(?:java|ecma)script\b/
	},
	converters: {
		"text script": function( text ) {
			jQuery.globalEval( text );
			return text;
		}
	}
} );

// Handle cache's special case and crossDomain
jQuery.ajaxPrefilter( "script", function( s ) {
	if ( s.cache === undefined ) {
		s.cache = false;
	}
	if ( s.crossDomain ) {
		s.type = "GET";
	}
} );

// Bind script tag hack transport
jQuery.ajaxTransport( "script", function( s ) {

	// This transport only deals with cross domain requests
	if ( s.crossDomain ) {
		var script, callback;
		return {
			send: function( _, complete ) {
				script = jQuery( "<script>" ).prop( {
					charset: s.scriptCharset,
					src: s.url
				} ).on(
					"load error",
					callback = function( evt ) {
						script.remove();
						callback = null;
						if ( evt ) {
							complete( evt.type === "error" ? 404 : 200, evt.type );
						}
					}
				);

				// Use native DOM manipulation to avoid our domManip AJAX trickery
				document.head.appendChild( script[ 0 ] );
			},
			abort: function() {
				if ( callback ) {
					callback();
				}
			}
		};
	}
} );




var oldCallbacks = [],
	rjsonp = /(=)\?(?=&|$)|\?\?/;

// Default jsonp settings
jQuery.ajaxSetup( {
	jsonp: "callback",
	jsonpCallback: function() {
		var callback = oldCallbacks.pop() || ( jQuery.expando + "_" + ( nonce++ ) );
		this[ callback ] = true;
		return callback;
	}
} );

// Detect, normalize options and install callbacks for jsonp requests
jQuery.ajaxPrefilter( "json jsonp", function( s, originalSettings, jqXHR ) {

	var callbackName, overwritten, responseContainer,
		jsonProp = s.jsonp !== false && ( rjsonp.test( s.url ) ?
			"url" :
			typeof s.data === "string" &&
				( s.contentType || "" )
					.indexOf( "application/x-www-form-urlencoded" ) === 0 &&
				rjsonp.test( s.data ) && "data"
		);

	// Handle iff the expected data type is "jsonp" or we have a parameter to set
	if ( jsonProp || s.dataTypes[ 0 ] === "jsonp" ) {

		// Get callback name, remembering preexisting value associated with it
		callbackName = s.jsonpCallback = isFunction( s.jsonpCallback ) ?
			s.jsonpCallback() :
			s.jsonpCallback;

		// Insert callback into url or form data
		if ( jsonProp ) {
			s[ jsonProp ] = s[ jsonProp ].replace( rjsonp, "$1" + callbackName );
		} else if ( s.jsonp !== false ) {
			s.url += ( rquery.test( s.url ) ? "&" : "?" ) + s.jsonp + "=" + callbackName;
		}

		// Use data converter to retrieve json after script execution
		s.converters[ "script json" ] = function() {
			if ( !responseContainer ) {
				jQuery.error( callbackName + " was not called" );
			}
			return responseContainer[ 0 ];
		};

		// Force json dataType
		s.dataTypes[ 0 ] = "json";

		// Install callback
		overwritten = window[ callbackName ];
		window[ callbackName ] = function() {
			responseContainer = arguments;
		};

		// Clean-up function (fires after converters)
		jqXHR.always( function() {

			// If previous value didn't exist - remove it
			if ( overwritten === undefined ) {
				jQuery( window ).removeProp( callbackName );

			// Otherwise restore preexisting value
			} else {
				window[ callbackName ] = overwritten;
			}

			// Save back as free
			if ( s[ callbackName ] ) {

				// Make sure that re-using the options doesn't screw things around
				s.jsonpCallback = originalSettings.jsonpCallback;

				// Save the callback name for future use
				oldCallbacks.push( callbackName );
			}

			// Call if it was a function and we have a response
			if ( responseContainer && isFunction( overwritten ) ) {
				overwritten( responseContainer[ 0 ] );
			}

			responseContainer = overwritten = undefined;
		} );

		// Delegate to script
		return "script";
	}
} );




// Support: Safari 8 only
// In Safari 8 documents created via document.implementation.createHTMLDocument
// collapse sibling forms: the second one becomes a child of the first one.
// Because of that, this security measure has to be disabled in Safari 8.
// https://bugs.webkit.org/show_bug.cgi?id=137337
support.createHTMLDocument = ( function() {
	var body = document.implementation.createHTMLDocument( "" ).body;
	body.innerHTML = "<form></form><form></form>";
	return body.childNodes.length === 2;
} )();


// Argument "data" should be string of html
// context (optional): If specified, the fragment will be created in this context,
// defaults to document
// keepScripts (optional): If true, will include scripts passed in the html string
jQuery.parseHTML = function( data, context, keepScripts ) {
	if ( typeof data !== "string" ) {
		return [];
	}
	if ( typeof context === "boolean" ) {
		keepScripts = context;
		context = false;
	}

	var base, parsed, scripts;

	if ( !context ) {

		// Stop scripts or inline event handlers from being executed immediately
		// by using document.implementation
		if ( support.createHTMLDocument ) {
			context = document.implementation.createHTMLDocument( "" );

			// Set the base href for the created document
			// so any parsed elements with URLs
			// are based on the document's URL (gh-2965)
			base = context.createElement( "base" );
			base.href = document.location.href;
			context.head.appendChild( base );
		} else {
			context = document;
		}
	}

	parsed = rsingleTag.exec( data );
	scripts = !keepScripts && [];

	// Single tag
	if ( parsed ) {
		return [ context.createElement( parsed[ 1 ] ) ];
	}

	parsed = buildFragment( [ data ], context, scripts );

	if ( scripts && scripts.length ) {
		jQuery( scripts ).remove();
	}

	return jQuery.merge( [], parsed.childNodes );
};


/**
 * Load a url into a page
 */
jQuery.fn.load = function( url, params, callback ) {
	var selector, type, response,
		self = this,
		off = url.indexOf( " " );

	if ( off > -1 ) {
		selector = stripAndCollapse( url.slice( off ) );
		url = url.slice( 0, off );
	}

	// If it's a function
	if ( isFunction( params ) ) {

		// We assume that it's the callback
		callback = params;
		params = undefined;

	// Otherwise, build a param string
	} else if ( params && typeof params === "object" ) {
		type = "POST";
	}

	// If we have elements to modify, make the request
	if ( self.length > 0 ) {
		jQuery.ajax( {
			url: url,

			// If "type" variable is undefined, then "GET" method will be used.
			// Make value of this field explicit since
			// user can override it through ajaxSetup method
			type: type || "GET",
			dataType: "html",
			data: params
		} ).done( function( responseText ) {

			// Save response for use in complete callback
			response = arguments;

			self.html( selector ?

				// If a selector was specified, locate the right elements in a dummy div
				// Exclude scripts to avoid IE 'Permission Denied' errors
				jQuery( "<div>" ).append( jQuery.parseHTML( responseText ) ).find( selector ) :

				// Otherwise use the full result
				responseText );

		// If the request succeeds, this function gets "data", "status", "jqXHR"
		// but they are ignored because response was set above.
		// If it fails, this function gets "jqXHR", "status", "error"
		} ).always( callback && function( jqXHR, status ) {
			self.each( function() {
				callback.apply( this, response || [ jqXHR.responseText, status, jqXHR ] );
			} );
		} );
	}

	return this;
};




// Attach a bunch of functions for handling common AJAX events
jQuery.each( [
	"ajaxStart",
	"ajaxStop",
	"ajaxComplete",
	"ajaxError",
	"ajaxSuccess",
	"ajaxSend"
], function( i, type ) {
	jQuery.fn[ type ] = function( fn ) {
		return this.on( type, fn );
	};
} );




jQuery.expr.pseudos.animated = function( elem ) {
	return jQuery.grep( jQuery.timers, function( fn ) {
		return elem === fn.elem;
	} ).length;
};




jQuery.offset = {
	setOffset: function( elem, options, i ) {
		var curPosition, curLeft, curCSSTop, curTop, curOffset, curCSSLeft, calculatePosition,
			position = jQuery.css( elem, "position" ),
			curElem = jQuery( elem ),
			props = {};

		// Set position first, in-case top/left are set even on static elem
		if ( position === "static" ) {
			elem.style.position = "relative";
		}

		curOffset = curElem.offset();
		curCSSTop = jQuery.css( elem, "top" );
		curCSSLeft = jQuery.css( elem, "left" );
		calculatePosition = ( position === "absolute" || position === "fixed" ) &&
			( curCSSTop + curCSSLeft ).indexOf( "auto" ) > -1;

		// Need to be able to calculate position if either
		// top or left is auto and position is either absolute or fixed
		if ( calculatePosition ) {
			curPosition = curElem.position();
			curTop = curPosition.top;
			curLeft = curPosition.left;

		} else {
			curTop = parseFloat( curCSSTop ) || 0;
			curLeft = parseFloat( curCSSLeft ) || 0;
		}

		if ( isFunction( options ) ) {

			// Use jQuery.extend here to allow modification of coordinates argument (gh-1848)
			options = options.call( elem, i, jQuery.extend( {}, curOffset ) );
		}

		if ( options.top != null ) {
			props.top = ( options.top - curOffset.top ) + curTop;
		}
		if ( options.left != null ) {
			props.left = ( options.left - curOffset.left ) + curLeft;
		}

		if ( "using" in options ) {
			options.using.call( elem, props );

		} else {
			curElem.css( props );
		}
	}
};

jQuery.fn.extend( {

	// offset() relates an element's border box to the document origin
	offset: function( options ) {

		// Preserve chaining for setter
		if ( arguments.length ) {
			return options === undefined ?
				this :
				this.each( function( i ) {
					jQuery.offset.setOffset( this, options, i );
				} );
		}

		var rect, win,
			elem = this[ 0 ];

		if ( !elem ) {
			return;
		}

		// Return zeros for disconnected and hidden (display: none) elements (gh-2310)
		// Support: IE <=11 only
		// Running getBoundingClientRect on a
		// disconnected node in IE throws an error
		if ( !elem.getClientRects().length ) {
			return { top: 0, left: 0 };
		}

		// Get document-relative position by adding viewport scroll to viewport-relative gBCR
		rect = elem.getBoundingClientRect();
		win = elem.ownerDocument.defaultView;
		return {
			top: rect.top + win.pageYOffset,
			left: rect.left + win.pageXOffset
		};
	},

	// position() relates an element's margin box to its offset parent's padding box
	// This corresponds to the behavior of CSS absolute positioning
	position: function() {
		if ( !this[ 0 ] ) {
			return;
		}

		var offsetParent, offset, doc,
			elem = this[ 0 ],
			parentOffset = { top: 0, left: 0 };

		// position:fixed elements are offset from the viewport, which itself always has zero offset
		if ( jQuery.css( elem, "position" ) === "fixed" ) {

			// Assume position:fixed implies availability of getBoundingClientRect
			offset = elem.getBoundingClientRect();

		} else {
			offset = this.offset();

			// Account for the *real* offset parent, which can be the document or its root element
			// when a statically positioned element is identified
			doc = elem.ownerDocument;
			offsetParent = elem.offsetParent || doc.documentElement;
			while ( offsetParent &&
				( offsetParent === doc.body || offsetParent === doc.documentElement ) &&
				jQuery.css( offsetParent, "position" ) === "static" ) {

				offsetParent = offsetParent.parentNode;
			}
			if ( offsetParent && offsetParent !== elem && offsetParent.nodeType === 1 ) {

				// Incorporate borders into its offset, since they are outside its content origin
				parentOffset = jQuery( offsetParent ).offset();
				parentOffset.top += jQuery.css( offsetParent, "borderTopWidth", true );
				parentOffset.left += jQuery.css( offsetParent, "borderLeftWidth", true );
			}
		}

		// Subtract parent offsets and element margins
		return {
			top: offset.top - parentOffset.top - jQuery.css( elem, "marginTop", true ),
			left: offset.left - parentOffset.left - jQuery.css( elem, "marginLeft", true )
		};
	},

	// This method will return documentElement in the following cases:
	// 1) For the element inside the iframe without offsetParent, this method will return
	//    documentElement of the parent window
	// 2) For the hidden or detached element
	// 3) For body or html element, i.e. in case of the html node - it will return itself
	//
	// but those exceptions were never presented as a real life use-cases
	// and might be considered as more preferable results.
	//
	// This logic, however, is not guaranteed and can change at any point in the future
	offsetParent: function() {
		return this.map( function() {
			var offsetParent = this.offsetParent;

			while ( offsetParent && jQuery.css( offsetParent, "position" ) === "static" ) {
				offsetParent = offsetParent.offsetParent;
			}

			return offsetParent || documentElement;
		} );
	}
} );

// Create scrollLeft and scrollTop methods
jQuery.each( { scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function( method, prop ) {
	var top = "pageYOffset" === prop;

	jQuery.fn[ method ] = function( val ) {
		return access( this, function( elem, method, val ) {

			// Coalesce documents and windows
			var win;
			if ( isWindow( elem ) ) {
				win = elem;
			} else if ( elem.nodeType === 9 ) {
				win = elem.defaultView;
			}

			if ( val === undefined ) {
				return win ? win[ prop ] : elem[ method ];
			}

			if ( win ) {
				win.scrollTo(
					!top ? val : win.pageXOffset,
					top ? val : win.pageYOffset
				);

			} else {
				elem[ method ] = val;
			}
		}, method, val, arguments.length );
	};
} );

// Support: Safari <=7 - 9.1, Chrome <=37 - 49
// Add the top/left cssHooks using jQuery.fn.position
// Webkit bug: https://bugs.webkit.org/show_bug.cgi?id=29084
// Blink bug: https://bugs.chromium.org/p/chromium/issues/detail?id=589347
// getComputedStyle returns percent when specified for top/left/bottom/right;
// rather than make the css module depend on the offset module, just check for it here
jQuery.each( [ "top", "left" ], function( i, prop ) {
	jQuery.cssHooks[ prop ] = addGetHookIf( support.pixelPosition,
		function( elem, computed ) {
			if ( computed ) {
				computed = curCSS( elem, prop );

				// If curCSS returns percentage, fallback to offset
				return rnumnonpx.test( computed ) ?
					jQuery( elem ).position()[ prop ] + "px" :
					computed;
			}
		}
	);
} );


// Create innerHeight, innerWidth, height, width, outerHeight and outerWidth methods
jQuery.each( { Height: "height", Width: "width" }, function( name, type ) {
	jQuery.each( { padding: "inner" + name, content: type, "": "outer" + name },
		function( defaultExtra, funcName ) {

		// Margin is only for outerHeight, outerWidth
		jQuery.fn[ funcName ] = function( margin, value ) {
			var chainable = arguments.length && ( defaultExtra || typeof margin !== "boolean" ),
				extra = defaultExtra || ( margin === true || value === true ? "margin" : "border" );

			return access( this, function( elem, type, value ) {
				var doc;

				if ( isWindow( elem ) ) {

					// $( window ).outerWidth/Height return w/h including scrollbars (gh-1729)
					return funcName.indexOf( "outer" ) === 0 ?
						elem[ "inner" + name ] :
						elem.document.documentElement[ "client" + name ];
				}

				// Get document width or height
				if ( elem.nodeType === 9 ) {
					doc = elem.documentElement;

					// Either scroll[Width/Height] or offset[Width/Height] or client[Width/Height],
					// whichever is greatest
					return Math.max(
						elem.body[ "scroll" + name ], doc[ "scroll" + name ],
						elem.body[ "offset" + name ], doc[ "offset" + name ],
						doc[ "client" + name ]
					);
				}

				return value === undefined ?

					// Get width or height on the element, requesting but not forcing parseFloat
					jQuery.css( elem, type, extra ) :

					// Set width or height on the element
					jQuery.style( elem, type, value, extra );
			}, type, chainable ? margin : undefined, chainable );
		};
	} );
} );


jQuery.each( ( "blur focus focusin focusout resize scroll click dblclick " +
	"mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
	"change select submit keydown keypress keyup contextmenu" ).split( " " ),
	function( i, name ) {

	// Handle event binding
	jQuery.fn[ name ] = function( data, fn ) {
		return arguments.length > 0 ?
			this.on( name, null, data, fn ) :
			this.trigger( name );
	};
} );

jQuery.fn.extend( {
	hover: function( fnOver, fnOut ) {
		return this.mouseenter( fnOver ).mouseleave( fnOut || fnOver );
	}
} );




jQuery.fn.extend( {

	bind: function( types, data, fn ) {
		return this.on( types, null, data, fn );
	},
	unbind: function( types, fn ) {
		return this.off( types, null, fn );
	},

	delegate: function( selector, types, data, fn ) {
		return this.on( types, selector, data, fn );
	},
	undelegate: function( selector, types, fn ) {

		// ( namespace ) or ( selector, types [, fn] )
		return arguments.length === 1 ?
			this.off( selector, "**" ) :
			this.off( types, selector || "**", fn );
	}
} );

// Bind a function to a context, optionally partially applying any
// arguments.
// jQuery.proxy is deprecated to promote standards (specifically Function#bind)
// However, it is not slated for removal any time soon
jQuery.proxy = function( fn, context ) {
	var tmp, args, proxy;

	if ( typeof context === "string" ) {
		tmp = fn[ context ];
		context = fn;
		fn = tmp;
	}

	// Quick check to determine if target is callable, in the spec
	// this throws a TypeError, but we will just return undefined.
	if ( !isFunction( fn ) ) {
		return undefined;
	}

	// Simulated bind
	args = slice.call( arguments, 2 );
	proxy = function() {
		return fn.apply( context || this, args.concat( slice.call( arguments ) ) );
	};

	// Set the guid of unique handler to the same of original handler, so it can be removed
	proxy.guid = fn.guid = fn.guid || jQuery.guid++;

	return proxy;
};

jQuery.holdReady = function( hold ) {
	if ( hold ) {
		jQuery.readyWait++;
	} else {
		jQuery.ready( true );
	}
};
jQuery.isArray = Array.isArray;
jQuery.parseJSON = JSON.parse;
jQuery.nodeName = nodeName;
jQuery.isFunction = isFunction;
jQuery.isWindow = isWindow;
jQuery.camelCase = camelCase;
jQuery.type = toType;

jQuery.now = Date.now;

jQuery.isNumeric = function( obj ) {

	// As of jQuery 3.0, isNumeric is limited to
	// strings and numbers (primitives or objects)
	// that can be coerced to finite numbers (gh-2662)
	var type = jQuery.type( obj );
	return ( type === "number" || type === "string" ) &&

		// parseFloat NaNs numeric-cast false positives ("")
		// ...but misinterprets leading-number strings, particularly hex literals ("0x...")
		// subtraction forces infinities to NaN
		!isNaN( obj - parseFloat( obj ) );
};




// Register as a named AMD module, since jQuery can be concatenated with other
// files that may use define, but not via a proper concatenation script that
// understands anonymous AMD modules. A named AMD is safest and most robust
// way to register. Lowercase jquery is used because AMD module names are
// derived from file names, and jQuery is normally delivered in a lowercase
// file name. Do this after creating the global so that if an AMD module wants
// to call noConflict to hide this version of jQuery, it will work.

// Note that for maximum portability, libraries that are not jQuery should
// declare themselves as anonymous modules, and avoid setting a global if an
// AMD loader is present. jQuery is a special case. For more information, see
// https://github.com/jrburke/requirejs/wiki/Updating-existing-libraries#wiki-anon

if ( typeof define === "function" && define.amd ) {
	define( "jquery", [], function() {
		return jQuery;
	} );
}




var

	// Map over jQuery in case of overwrite
	_jQuery = window.jQuery,

	// Map over the $ in case of overwrite
	_$ = window.$;

jQuery.noConflict = function( deep ) {
	if ( window.$ === jQuery ) {
		window.$ = _$;
	}

	if ( deep && window.jQuery === jQuery ) {
		window.jQuery = _jQuery;
	}

	return jQuery;
};

// Expose jQuery and $ identifiers, even in AMD
// (#7102#comment:10, https://github.com/jquery/jquery/pull/557)
// and CommonJS for browser emulators (#13566)
if ( !noGlobal ) {
	window.jQuery = window.$ = jQuery;
}




return jQuery;
} );

},{}],5:[function(require,module,exports){
module.exports = function (canvasID, starsAmount, color = '#000000', radius = 1, lineWidth = 0.05) {
  var canvas = document.getElementById(canvasID),
    ctx = canvas.getContext('2d');

  canvas.width = document.getElementById(canvasID).offsetWidth;
  canvas.height = document.getElementById(canvasID).offsetHeight;

  var stars = [], // Array that contains the stars
    FPS = 60, // Frames per second
    x = starsAmount, // Number of stars
    mouse = {
      x: 0,
      y: 0
    }; // mouse location

  // Push stars to array

  for (var i = 0; i < x; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * radius + radius,
      vx: Math.floor(Math.random() * 50) - 25,
      vy: Math.floor(Math.random() * 50) - 25
    });
  }

  canvas.addEventListener('mousemove', function(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  // Draw the scene

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = "lighter";

    for (var i = 0, x = stars.length; i < x; i++) {
      var s = stars[i];

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.stroke();
    }

    ctx.beginPath();
    for (var i = 0, x = stars.length; i < x; i++) {
      var starI = stars[i];
      ctx.moveTo(starI.x, starI.y);
      if (distance(mouse, starI) < 150) ctx.lineTo(mouse.x, mouse.y);
      for (var j = 0, x = stars.length; j < x; j++) {
        var starII = stars[j];
        if (distance(starI, starII) < 150) {
          //ctx.globalAlpha = (1 / 150 * distance(starI, starII).toFixed(1));
          ctx.lineTo(starII.x, starII.y);
        }
      }
    }
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  function distance(point1, point2) {
    var xs = 0;
    var ys = 0;

    xs = point2.x - point1.x;
    xs = xs * xs;

    ys = point2.y - point1.y;
    ys = ys * ys;

    return Math.sqrt(xs + ys);
  }

  // Update star locations

  function update() {
    for (var i = 0, x = stars.length; i < x; i++) {
      var s = stars[i];

      s.x += s.vx / FPS;
      s.y += s.vy / FPS;

      if (s.x < 0 || s.x > canvas.width) s.vx = -s.vx;
      if (s.y < 0 || s.y > canvas.height) s.vy = -s.vy;
    }
  }



  // Update and draw

  function tick() {
    draw();
    update();
    requestAnimationFrame(tick);
  }


  tick();
  
}


},{}],6:[function(require,module,exports){
function image() {
  // Init
  var container = document.querySelector(".banner"),
    inner = document.querySelector(".head-img");

  // Mouse
  var mouse = {
    _x: 0,
    _y: 0,
    x: 0,
    y: 0,
    updatePosition: function(event) {
      var e = event || window.event;
      this.x = e.clientX - this._x;
      this.y = (e.clientY - this._y) * -1;
    },
    setOrigin: function(e) {
      this._x = e.offsetLeft + Math.floor(e.offsetWidth / 2);
      this._y = e.offsetTop + Math.floor(e.offsetHeight / 2);
    },
    show: function() {
      return "(" + this.x + ", " + this.y + ")";
    }
  };

  // Track the mouse position relative to the center of the container.
  mouse.setOrigin(container);

  //-----------------------------------------

  var counter = 0;
  var updateRate = 10;
  var isTimeToUpdate = function() {
    return counter++ % updateRate === 0;
  };

  //-----------------------------------------

  var onMouseEnterHandler = function(event) {
    update(event);
  };

  var onMouseLeaveHandler = function() {
    inner.style = "";
  };

  var onMouseMoveHandler = function(event) {
    if (isTimeToUpdate()) {
      update(event);
    }
  };

  //-----------------------------------------

  var update = function(event) {
    mouse.updatePosition(event);
    updateTransformStyle(
      (mouse.y / inner.offsetHeight / 2).toFixed(2),
      (mouse.x / inner.offsetWidth / 2).toFixed(2)
    );
  };

  var updateTransformStyle = function(x, y) {
    var style = `rotateY(${y / 5}deg) rotateX(${x / 5}deg) translateX(${0 - y * 50}px) translateY(${x * 50}px)`;
    inner.style.transform = style;
    inner.style.webkitTransform = style;
    inner.style.mozTransform = style;
    inner.style.msTransform = style;
    inner.style.oTransform = style;
  };


  //-----------------------------------------

  container.onmouseenter = onMouseEnterHandler;
  container.onmouseleave = onMouseLeaveHandler;
  container.onmousemove = onMouseMoveHandler;
}

module.exports = image
},{}],7:[function(require,module,exports){
const $ = require('jquery');
const anime = require('animejs');
const viewport = require('./viewport.js')
const onscroll = require('./scroll.js')
const AOS = require('aos');
const IMask = require('imask');
const anchors = require('./smooth-scroll.js')


AOS.init();

viewport()

//nav 

$('.header__shower-btn').click(function(event) {
	$('.links__list').toggleClass('active');
});

// phone number input

var phoneInput = document.getElementById('phone');
var maskOptions = {
  mask: '+{7}(000)000-00-00'
};
var mask = new IMask(phoneInput, maskOptions);



// cross rotate

let cross = document.getElementById('cross__img');
let crossRotation = anime({
	targets: cross,
	rotate: 90,
	easing: 'linear',
	loop: true,
	autoplay: false
})

$('#cross__img').hover(function() {
	crossRotation.play()
}, function() {
	crossRotation.pause()
});



// progressbar;

let sum = 0;
$('.checkbox-item').each(function(){
	sum += Number($(this).attr('data-price'))
});

$('.checkbox-item').click(function(event) {
	let price = 0;
	let checked = $('.checkbox-item').filter(function(index) {
		return $(this).is(':checked');
	});

	checked.each(function(){
		price += Number($(this).attr('data-price'));
	})

	let k = sum / price;
	let progress = 100 / k;

	$('.progressfill').css({
		left: progress.toString() + '%',
		transform: 'translateX(-' + progress.toString() + '%)'
	});

	$('.progressbar__amount').html(`$${price}`)
});



// dark mode 

$('.switcher').click(function(event) {
	switcher.play();
	$('.mode').toggleClass('--dark');
});


let wobbleSwitcher = setInterval(()=> {
	wobble.play();
}, 8000)

let wobble = anime({
	targets: '.switcher',
	rotate: [6, '-4', 2, '-1', 1],
	duration: 1000,
	easing: 'linear',
	autoplay: false
})

let switcher = anime({
	targets: '.switcher',
	translateY: 15,
	duration: 200,
 	direction: 'alternate',
	autoplay: false
})

},{"./scroll.js":8,"./smooth-scroll.js":9,"./viewport.js":10,"animejs":1,"aos":2,"imask":3,"jquery":4}],8:[function(require,module,exports){
let $topTitle = $(".summary__top-title");
let $midTitle = $('.summary__mid-title')
let $sculpture = {
    head: $('.sculpture #head'),
    torso: $('.sculpture #torso'),
    hips: $('.sculpture #hips'),
    legs: $('.sculpture #legs'),
    all: $('.sculpture .sctulpture__block'),
    parent: $('.sculpture #sculpture'),
    isClose: true,
};
let $window = $(window);
let darkMode = $('.mode').is('.--dark');

$('.switcher').click(function() {
    darkMode ? changeSculptureParts(brightParts) : changeSculptureParts(darkParts);
    darkMode = !darkMode;
    $sculpture.all.removeAttr('style');
    $sculpture.isClose = true;
});

function changeSculptureParts (parts) {
    $('#head__img').html(parts.head);
    $('#torso__img').html(parts.torso);
    $('#hips__img').html(parts.hips);
    $('#legs__img').html(parts.legs);
}

const darkParts = {
    legs: '<image x="0" y="0" width="484" height="548" xlink:href="data:image/png;base64,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"></image>',
    hips: '<image x="0" y="0" width="414" height="427" xlink:href="data:image/png;base64,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"></image>',
};

const brightParts = {
}

function isScrolledIntoView($elem) {
    let docViewTop = $window.scrollTop();
    let docViewBottom = docViewTop + $window.height();
    let elemTop = $elem.offset().top;
    let elemBottom = elemTop + $elem.height();
    return ((elemBottom <= docViewBottom) && (elemTop >= docViewTop));
}

function isSculptureIntoView(part){
    let docViewTop = $window.scrollTop();
    let docViewBottom = docViewTop + $window.height();
    let sculptureHeight = $('.sculpture').height();
    let sculptureTop = $('.sculpture').offset().top;
    let sculpturePart = sculptureHeight / 4;
    let elemBottom = sculptureTop + (sculpturePart * part);
    let elemTop = elemBottom - sculpturePart;
    return ((elemBottom <= docViewBottom) && (elemTop >= docViewTop));
}

// sculptureMode();

let onScroll = $(document).on("scroll", function () {
    if (isScrolledIntoView($topTitle)) {
    	$('.summary__top-title i').each(function(i, el){
    		setTimeout(function(){
    			el.classList.add('fill')
    		}, i * 200)
    	})
    }else{
        $('.summary__top-title i').each(function(i, el){
            setTimeout(function(){
                el.classList.remove('fill')
            }, i * 200)
        })
    };
    if (isScrolledIntoView($midTitle)) {
    	$midTitle.addClass('active')
    }else{
        $midTitle.removeClass('active')
    };
    if (isSculptureIntoView(1) && $sculpture.isClose) {
        // $sculpture.head.find('.sculpture__description').css('opacity', 1);
        $sculpture.torso.css('transform', 'translate(79px, 218px)');
        $sculpture.hips.css('transform', 'translate(12px, 532px)');
        $sculpture.legs.css('transform', 'translate(0px, 906px)');
    }
    else if (isSculptureIntoView(2) && $sculpture.isClose) {
        // $sculpture.torso.find('.sculpture__description').css('opacity', 1);
        $sculpture.hips.css('transform', 'translate(12px, 599px)');
        $sculpture.legs.css('transform', 'translate(0px, 974px)');
    }
    else if (isSculptureIntoView(3) && $sculpture.isClose) {
        // $sculpture.hips.find('.sculpture__description').css('opacity', 1);
        $sculpture.legs.css('transform', 'translate(0px, 1025px)');
    }
    else if (isSculptureIntoView(4)) {
        $sculpture.isClose = false;
        // $sculpture.legs.find('.sculpture__description').css('opacity', 1);
    }
});

$('.title__main').hover(function() {
    if(!$(this).hasClass('visible')) $(this).parent().siblings('.sculpture__description').css('opacity', '1');
}, function() {
    if(!$(this).hasClass('visible')) $(this).parent().siblings('.sculpture__description').css('opacity', '0');
})

$('.title__main').click(function(event) {
    const id = $(this).attr('data-index');
    $(`.item-index[data-index="${id}"]`).addClass('active')
    $(this).addClass('visible').parent().siblings('.sculpture__description').css('opacity', '1');
});;


module.exports = onScroll;
},{}],9:[function(require,module,exports){
module.exports = $('a[href*="#"]')
  // Remove links that don't actually link to anything
  .not('[href="#"]')
  .not('[href="#0"]')
  .click(function(event) {
    // On-page links
    if (
      location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') 
      && 
      location.hostname == this.hostname
    ) {
      // Figure out element to scroll to
      var target = $(this.hash);
      target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
      // Does a scroll target exist?
      if (target.length) {
        // Only prevent default if animation is actually gonna happen
        event.preventDefault();
        $('html, body').animate({
          scrollTop: target.offset().top
        }, 1000, function() {
          // Callback after animation
          // Must change focus!
          var $target = $(target);
          $target.focus();
          if ($target.is(":focus")) { // Checking if the target was focused
            return false;
          } else {
            $target.attr('tabindex','-1'); // Adding tabindex for elements not focusable
            $target.focus(); // Set focus again
          };
        });
      }
    }
  });
},{}],10:[function(require,module,exports){
const сanvas = require('./canvas.js');
const head = require('./head.js');

module.exports = () => {
	$('#summary__bg').attr({
		height: window.innerHeight,
	});


	const vw = $(window).width();

	if (vw > 1440) {
		let headBg = сanvas('canvas', 50);
		let summaryBg = сanvas('summary__bg', 250, 2, 0.2);
	}else if (vw <= 1440 && vw > 475) {

		$('#canvas').attr('height', 400);

		let headBg = сanvas('canvas', 50);
		let summaryBg = сanvas('summary__bg', 200, 2, 0.2);


	}else if (vw <= 475) {
		
		$('#canvas').attr('height', 400);

		let headBg = сanvas('canvas', 20);
		let summaryBg = сanvas('summary__bg', 30, 2, 0.2);
	}


	head();
}
},{"./canvas.js":5,"./head.js":6}]},{},[7]);