/**
 * Shared x-axis date-label thinning for the research dashboard.
 * Labels are purely presentational; graph points and their x coordinates remain untouched.
 *
 * SVG uses a 460-unit viewBox. Spacing is evaluated in those same units,
 * allowing the result to work when the browser scales the chart responsively.
 */
export const RESEARCH_DATE_TICK_BROWSER_SCRIPT = `
  function selectResearchDateTicks(dates,xAt,maxLabels,fontSize){
    var n=Array.isArray(dates)?dates.length:0;
    if(n===0)return [];
    if(n===1)return [0];
    var last=n-1,first=0;
    var size=Number(fontSize)||10;
    // 0.75em per character is deliberately conservative for bold MM-DD labels.
    function labelWidth(i){return Math.max(size*2,String(dates[i]||'').slice(5).length*size*.75)}
    function requiredGap(a,b){return (labelWidth(a)+labelWidth(b))/2+8}
    var result=[first];
    if(xAt(last)-xAt(first)<requiredGap(first,last))return [last];
    var stride=Math.max(1,Math.ceil(n/Math.max(2,Number(maxLabels)||7)));
    for(var i=1;i<last;i++){
      if(i%stride!==0)continue;
      var prev=result[result.length-1];
      // Reserve the right edge for the final date before accepting intermediate labels.
      if(xAt(i)-xAt(prev)<requiredGap(prev,i))continue;
      if(xAt(last)-xAt(i)<requiredGap(i,last))continue;
      result.push(i);
    }
    result.push(last);
    return result;
  }
`;
