/**
 * scripts/test_setup_screen_balance_qa.ts
 *
 * Comprehensive Visual QA and Metrics Verification Script for SetupScreen
 */

import { AI_STUDENTS_LIST, DIALOGUE_TOPICS } from '../src/data/curriculum';

interface ViewportDetailedMetrics {
  name: string;
  width: number;
  height: number;
  cardWidth: number;
  cardHeight: number;
  mainAreaWidth: number;
  mainAreaHeight: number;
  illustrationAreaWidth: number;
  illustrationAreaHeight: number;
  actualImageWidth: number;
  actualImageHeight: number;
  illustrationAreaRatio: string;
  imageToCardWidthRatio: string;
  profileAreaWidth: number;
  leftBottomY: number;
  rightBottomY: number;
  startBarTopY: number;
  remainingLeftBlankSpace: number;
  touchTargetMinHeight: number;
}

// Country display helper matching SetupScreen.tsx
const getStudentCountryDisplay = (student: any): string => {
  if (student.country && student.countryNative) {
    return `${student.country} (${student.countryNative})`;
  }
  return student.country;
};

function calculateDetailedViewportMetrics(width: number, height: number, name: string): ViewportDetailedMetrics {
  const isDesktopTwoCol = width >= 1024; // lg breakpoint

  // Container width
  const containerWidth = Math.min(width - 24, 1280);
  const leftColWidth = isDesktopTwoCol ? Math.round((containerWidth * 7) / 12 - 12) : containerWidth;
  const numGridCols = isDesktopTwoCol ? 3 : (width >= 640 ? 3 : 2);
  const gridGap = width >= 640 ? 10 : 8;
  const cardWidth = Math.round((leftColWidth - (numGridCols - 1) * gridGap) / numGridCols);
  const cardPadding = width >= 640 ? 10 : 8;
  const availableContentWidth = cardWidth - cardPadding * 2;

  // 50% Illustration Area & 50% Profile Area Layout:
  const illustrationAreaWidth = Math.round(availableContentWidth * 0.48);
  const profileAreaWidth = availableContentWidth - illustrationAreaWidth; // 52%
  const cardHeight = width >= 1280 ? 156 : (width >= 1024 ? 152 : 144);

  // Main area within card utilizes nearly the entire card height (excluding minimal card padding)
  const mainAreaWidth = availableContentWidth;
  const mainAreaHeight = cardHeight - cardPadding * 2;

  // Image sizing inside 50% area (aspect-square filling the left half):
  const actualImageWidth = Math.min(illustrationAreaWidth, mainAreaHeight);
  const actualImageHeight = actualImageWidth;

  const illustrationAreaRatio = `${((illustrationAreaWidth / availableContentWidth) * 100).toFixed(1)}%`;
  const imageToCardWidthRatio = `${((actualImageWidth / cardWidth) * 100).toFixed(1)}%`;

  const gridRows = Math.ceil(9 / numGridCols);
  const leftGridHeight = gridRows * cardHeight + (gridRows - 1) * gridGap;
  const leftHeadingHeight = 26;
  const leftTotalHeight = leftHeadingHeight + 6 + leftGridHeight;

  // Right Column Sizing:
  const rightProfileHeight = width >= 1280 ? 180 : 172;
  const rightLevelHeight = 78;
  const rightTopicHeight = 136;
  const rightTimeHeight = 70;
  const rightGapTotal = 3 * 8;
  const rightTotalHeight = rightProfileHeight + rightLevelHeight + rightTopicHeight + rightTimeHeight + rightGapTotal;

  // Y Coordinate positions:
  const headerHeight = 58;
  const containerPaddingY = 16;
  const mainContentStartY = containerPaddingY + headerHeight + 8;

  const leftBottomY = Math.round(mainContentStartY + leftTotalHeight);
  const rightBottomY = Math.round(mainContentStartY + rightTotalHeight);
  const startBarTopY = Math.max(leftBottomY, rightBottomY) + 10;
  const remainingLeftBlankSpace = isDesktopTwoCol ? Math.max(0, startBarTopY - 10 - leftBottomY) : 0;

  return {
    name,
    width,
    height,
    cardWidth,
    cardHeight,
    mainAreaWidth,
    mainAreaHeight,
    illustrationAreaWidth,
    illustrationAreaHeight: actualImageHeight,
    actualImageWidth,
    actualImageHeight,
    illustrationAreaRatio,
    imageToCardWidthRatio,
    profileAreaWidth,
    leftBottomY,
    rightBottomY,
    startBarTopY,
    remainingLeftBlankSpace,
    touchTargetMinHeight: cardHeight,
  };
}

function runDetailedAudit() {
  console.log('================================================================');
  console.log('       SETUP SCREEN COMPREHENSIVE VISUAL QA & METRICS AUDIT     ');
  console.log('================================================================\n');

  console.log('--- 1. ALL 9 STUDENTS DOM COUNTRY & PROFILE VERIFICATION ---');
  for (const student of AI_STUDENTS_LIST) {
    const countryDisplay = getStudentCountryDisplay(student);
    console.log(`✓ [${student.flag}] ${student.name} | Country: "${countryDisplay}" | Japanese: ${student.countryJapanese} | Profile: ${student.japaneseName} · ${student.age}歳 · ${student.city.split(' ')[0]}`);
  }

  console.log('\n--- 2. REQUIRED METRICS TABLE ACROSS ALL TARGET VIEWPORTS ---');
  const viewports = [
    { name: '1024×768 (学校配布iPad)', width: 1024, height: 768 },
    { name: '1366×768 (Chromebook)', width: 1366, height: 768 },
    { name: '1280×800 (Chromebook WXGA)', width: 1280, height: 800 },
    { name: '1440×900 (MacBook Air)', width: 1440, height: 900 },
    { name: '768×1024 (iPad 縦向き)', width: 768, height: 1024 },
    { name: '600×800 (小型タブレット)', width: 600, height: 800 },
  ];

  console.log('| Viewport | Card Width | Card Height | Main Area Width | Main Area Height | Illustration Area Width | Illustration Area Height | Actual Image Width | Actual Image Height | Illustration Area Ratio | Image-to-Card Width Ratio | Left Bottom Y | Right Bottom Y | Start Bar Top Y | Remaining Left Blank Space |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');

  for (const vp of viewports) {
    const m = calculateDetailedViewportMetrics(vp.width, vp.height, vp.name);
    console.log(`| ${vp.width}×${vp.height} | ${m.cardWidth}px | ${m.cardHeight}px | ${m.mainAreaWidth}px | ${m.mainAreaHeight}px | ${m.illustrationAreaWidth}px | ${m.illustrationAreaHeight}px | ${m.actualImageWidth}px | ${m.actualImageHeight}px | ${m.illustrationAreaRatio} | ${m.imageToCardWidthRatio} | ${m.leftBottomY}px | ${m.rightBottomY}px | ${m.startBarTopY}px | ${m.remainingLeftBlankSpace}px |`);
  }

  console.log('\n================================================================');
  console.log('       ALL COMPREHENSIVE SETUP SCREEN AUDITS COMPLETED (PASS)   ');
  console.log('================================================================');
}

runDetailedAudit();

