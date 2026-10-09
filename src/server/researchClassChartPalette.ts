/**
 * One identity-based palette shared by all three researcher dashboard charts.
 * Keep these colors fixed even when series are filtered, reordered or reloaded.
 * The browser scripts in both chart runtimes interpolate the same code below.
 */
export const RESEARCH_CLASS_COLORS: Readonly<Record<string, string>> = {
  '5-1': '#3B82F6', // intervention: blue
  '5-2': '#10B981', // intervention: green
  '5-3': '#A855F7', // intervention: purple
  '6-C1': '#F59E0B', // comparison class 1: vermilion
  '6-C2': '#EC4899', // comparison class 2: pink
  '6-1': '#EAB308', // additional classes: mustard
  '6-2': '#06B6D4', // additional classes: teal
  '6-3': '#F97316', // additional classes: brown
  '5-C1': '#EF4444',
  '5-C2': '#D946EF',
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
