import fs from 'node:fs';
import { chromium } from 'playwright';

const fail = (message) => { throw new Error(`[qa:reflection-visual] ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };
const near = (a, b, tolerance, label) => assert(Math.abs(a - b) <= tolerance, `${label}: ${a} vs ${b}`);

const previousText = '前回は、相手の話を聞いてから、自分の考えをつけたして話すことができました。次は、もっと質問をして会話を続けたいです。\n\n特に、相手が言ったことについて「それはどうして？」とたずねることで、話が広がることがわかりました。これからも、相手の話に興味をもって、もっといろいろ質問してみたいです。';
const goalText = '今日は、クラスの友だちに自分の好きなことをくわしく伝えることをめあてにします。\nそのために、相手が返事しやすいように、質問もして会話を続けたいです。';
const reflectionText = '今日は、はじめは少し緊張したけれど、相手の好きなことを聞いてから、自分の好きなことをくわしく話すことができました。相手が「それはどうして？」と質問してくれて、うれしかったです。\n次は、もっと自分から質問をして、会話を続けたいです。\n\nたとえば、相手が言ったことに対して「いつから好きなの？」や「ほかにもある？」などの質問をして、もっと話を広げていきたいです。';

const record = (overrides = {}) => ({
  reflectionId: 'R-1', localDate: '2026-09-10', todayGoal: goalText,
  goalRating: 4, selfRegulationRating: 5, reflectionText,
  reflectionCharCount: [...reflectionText].length, status: 'draft', revision: 1,
  createdAt: '2026-09-10T00:00:00.000Z', updatedAt: '2026-09-10T00:00:00.000Z', submittedAt: '',
  achievements: '', languageUsed: '', thinking: '', difficultyStrategy: '', languageCultureAwareness: '', nextGoal: '',
  ...overrides,
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
await page.addInitScript(() => localStorage.setItem('my-english-growth-device-token', 'visual-test-device-token'));
await page.route('**/api/reflection/bootstrap', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, learningId: '6RSX', today: record(), previous: record({ reflectionId: 'R-0', localDate: '2026-09-09', todayGoal: '', reflectionText: previousText, reflectionCharCount: [...previousText].length, status: 'submitted' }) }),
  });
});
await page.route('**/api/reflection/save', async (route) => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, reflection: record() }) });
});

async function inspect(width, height, screenshotPath) {
  await page.setViewportSize({ width, height });
  await page.goto('http://127.0.0.1:4173/reflection/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.meg-entry-grid');
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const metrics = await page.evaluate(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`missing ${selector}`);
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return { x:r.x, y:r.y, width:r.width, height:r.height, bottom:r.bottom, right:r.right, fontSize:parseFloat(s.fontSize), background:s.backgroundImage, borderRadius:s.borderRadius };
    };
    const labels = [...document.querySelectorAll('.meg-nav button')].map((el) => el.textContent?.trim());
    const hintRects = [...document.querySelectorAll('.meg-hint-chip')].map((el) => { const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; });
    return {
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      header: rect('.meg-reference-header'),
      brand: rect('.meg-reference-brand h1'),
      grid: rect('.meg-entry-grid'),
      left: rect('.meg-entry-left'),
      right: rect('.meg-entry-right'),
      previous: rect('.meg-entry-previous'),
      hints: rect('.meg-entry-hints'),
      hintText: rect('.meg-hint-chip b'),
      submit: rect('.meg-submit'),
      goal: rect('.meg-entry-goal'),
      ratings: rect('.meg-entry-ratings'),
      reflection: rect('.meg-entry-reflection'),
      previousText: rect('.meg-previous-summary'),
      goalText: rect('.meg-entry-goal textarea'),
      reflectionText: rect('.meg-main-reflection textarea'),
      sectionHeading: rect('.meg-entry-goal .meg-section-title h2'),
      ratingLabel: rect('.meg-entry-ratings .meg-rating-block h3'),
      ratingDot: rect('.meg-rating-dot'),
      footer: rect('.meg-entry-footer'),
      labels,
      hintRects,
      bodyText: document.body.textContent || '',
    };
  });

  assert(metrics.scrollHeight <= metrics.innerHeight + 2, `${width}x${height} page scrolls vertically: ${metrics.scrollHeight} > ${metrics.innerHeight}`);
  assert(metrics.scrollWidth <= metrics.innerWidth + 2, `${width}x${height} page scrolls horizontally`);
  near(metrics.left.y, metrics.right.y, 2, `${width}x${height} column tops`);
  near(metrics.left.bottom, metrics.right.bottom, 2, `${width}x${height} column bottoms`);
  near(metrics.left.height, metrics.right.height, 2, `${width}x${height} column heights`);
  const leftRatio = metrics.left.width / metrics.grid.width;
  assert(leftRatio >= .35 && leftRatio <= .40, `${width}x${height} left column ratio ${leftRatio}`);
  assert(metrics.previous.height > metrics.hints.height, `${width}x${height} previous reflection must be taller than hints`);
  assert(metrics.submit.y >= metrics.hints.bottom - 1, `${width}x${height} submit is not below hints`);
  assert(metrics.reflection.height >= 180, `${width}x${height} reflection writing card too short`);

  const compact = height <= 700;
  const bodyFloor = compact ? 16 : 16.5;
  const headingFloor = 21;
  const ratingFloor = compact ? 14.5 : 15;
  const brandFloor = compact ? 22 : 23;
  const hintFloor = compact ? 12.5 : 13;
  const submitFloor = 19;
  assert(metrics.previousText.fontSize >= bodyFloor, `${width}x${height} previous text too small: ${metrics.previousText.fontSize}`);
  assert(metrics.goalText.fontSize >= bodyFloor, `${width}x${height} goal text too small: ${metrics.goalText.fontSize}`);
  assert(metrics.reflectionText.fontSize >= bodyFloor, `${width}x${height} reflection text too small: ${metrics.reflectionText.fontSize}`);
  assert(metrics.sectionHeading.fontSize >= headingFloor, `${width}x${height} heading too small: ${metrics.sectionHeading.fontSize}`);
  assert(metrics.ratingLabel.fontSize >= ratingFloor, `${width}x${height} rating text too small: ${metrics.ratingLabel.fontSize}`);
  assert(metrics.brand.fontSize >= brandFloor, `${width}x${height} brand title too small: ${metrics.brand.fontSize}`);
  assert(metrics.hintText.fontSize >= hintFloor, `${width}x${height} hint text too small: ${metrics.hintText.fontSize}`);
  assert(metrics.submit.fontSize >= submitFloor, `${width}x${height} submit text too small: ${metrics.submit.fontSize}`);
  assert(metrics.ratingDot.width >= 20 && metrics.ratingDot.width <= 23, `${width}x${height} rating dot wrong size: ${metrics.ratingDot.width}`);
  assert(metrics.ratingDot.borderRadius === '50%', `${width}x${height} rating control is not circular`);
  assert(metrics.labels.join('|') === '振り返り|私の成長|みんなの振り返り', `${width}x${height} nav labels differ: ${metrics.labels.join('|')}`);
  assert(!metrics.bodyText.includes('Chromebook想定') && !metrics.bodyText.includes('スクロールなし'), `${width}x${height} implementation-only badge is visible`);
  assert(metrics.bodyText.includes('My English Growth — わたしの英語の学び'), `${width}x${height} full brand title missing`);
  assert(metrics.bodyText.includes('ID: 6RSX'), `${width}x${height} ID label missing`);
  assert(metrics.bodyText.includes('小さなふりかえりが、大きな成長につながります。'), `${width}x${height} footer message missing`);
  assert(metrics.bodyText.includes('自分の考えをつたえることができた'), `${width}x${height} first rating wording missing`);
  assert(metrics.bodyText.includes('相手の話を聞いてわかろうとした'), `${width}x${height} second rating wording missing`);
  assert(metrics.hintRects.length === 7, `${width}x${height} expected seven hint chips`);
  near(metrics.hintRects[0].y, metrics.hintRects[1].y, 2, `${width}x${height} hint row 1`);
  near(metrics.hintRects[1].y, metrics.hintRects[2].y, 2, `${width}x${height} hint row 1`);
  assert(metrics.hintRects[3].y > metrics.hintRects[0].y, `${width}x${height} hints are not a 3-column grid`);

  console.log(`[qa:reflection-visual] ${width}x${height} PASS`, JSON.stringify({
    scrollHeight: metrics.scrollHeight, leftRatio: Number(leftRatio.toFixed(3)),
    leftHeight: Math.round(metrics.left.height), previousHeight: Math.round(metrics.previous.height), hintsHeight: Math.round(metrics.hints.height),
    goalHeight: Math.round(metrics.goal.height), ratingsHeight: Math.round(metrics.ratings.height), reflectionHeight: Math.round(metrics.reflection.height),
    fonts: { brand: metrics.brand.fontSize, previous: metrics.previousText.fontSize, goal: metrics.goalText.fontSize, reflection: metrics.reflectionText.fontSize, heading: metrics.sectionHeading.fontSize, rating: metrics.ratingLabel.fontSize, hint: metrics.hintText.fontSize, submit: metrics.submit.fontSize },
  }));
}

fs.mkdirSync('artifacts', { recursive: true });
await inspect(1366, 768, 'artifacts/reflection-1366x768.png');
await inspect(1366, 680, 'artifacts/reflection-1366x680.png');
await inspect(1366, 600, 'artifacts/reflection-1366x600.png');
await inspect(1280, 600, 'artifacts/reflection-1280x600.png');
await browser.close();
console.log('[qa:reflection-visual] PASS: rendered Chromebook layout matches the approved structural and typography constraints across standard and reduced browser viewports.');
