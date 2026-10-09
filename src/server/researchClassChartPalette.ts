/**
 * One identity-based palette shared by all three researcher dashboard charts.
 * Keep these colors fixed even when series are filtered, reordered or reloaded.
 * The browser scripts in both chart runtimes interpolate the same code below.
 */
export const RESEARCH_CLASS_COLORS: Readonly<Record<string, string>> = {
  '5-1': '#0072B2', // intervention: blue
  '5-2': '#009E73', // intervention: green
  '5-3': '#7851A9', // intervention: purple
  '6-C1': '#D55E00', // comparison class 1: vermilion
  '6-C2': '#C54A89', // comparison class 2: pink
  '6-1': '#B38B00', // additional classes: mustard
  '6-2': '#006D77', // additional classes: teal
  '6-3': '#8B5E3C', // additional classes: brown
  '5-C1': '#B3261E',
  '5-C2': '#8F3985',
  UNKNOWN: '#94A3B8',
};
const fallbackColors = [
  '#26734D', '#A34B28', '#4F46A5', '#946400',
  '#AE396C', '#467386', '#74614B', '#8051A8',
  '#246A7F', '#A15728',
];

// Browser-side mapping is embedded into both existing HTML injection scripts.
// It does not depend on filter order, rendering order or a separate HTTP request.
export const RESEARCH_CLASS_PALETTE_BROWSER_SCRIPT = `
  var fixedColors=${JSON.stringify(RESEARCH_CLASS_COLORS)};
  var fallbackColors=${JSON.stringify(fallbackColors)};
  function classColor(classId,condition){
    var id=String(classId||'unknown').trim().toUpperCase();
    if(fixedColors[id])return fixedColors[id];
    var hash=0;for(var i=0;i<id.length;i+=1)hash=((hash*31)+id.charCodeAt(i))>>>0;
    return fallbackColors[hash%fallbackColors.length];
  }
`;
