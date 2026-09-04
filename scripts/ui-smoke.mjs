import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const issues = [];
const notes = [];

function issue(page, msg, extra = '') {
  issues.push(`[${page}] ${msg}${extra ? ` — ${extra}` : ''}`);
}

async function collectConsole(page, label) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return {
    flush() {
      for (const err of errors) {
        if (err.includes('favicon') || err.includes('net::ERR_FAILED')) continue;
        issue(label, err);
      }
    },
  };
}

async function goto(page, path) {
  const res = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
  return res;
}

async function visibleText(page, selector) {
  const el = page.locator(selector).first();
  if (!(await el.count())) return '';
  return (await el.innerText()).trim();
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Home
  {
    const log = await collectConsole(page, 'home');
    const res = await goto(page, '/');
    if (!res || res.status() >= 400) issue('home', `HTTP ${res?.status()}`);
    if (!(await page.locator('h1').count())) issue('home', 'missing h1');
    if (!(await page.getByRole('link', { name: 'Glossary' }).count())) issue('home', 'missing Glossary nav');
    if (await page.getByRole('link', { name: 'Attack Paths' }).count()) {
      issue('home', 'Attack Paths still in nav while feature is disabled');
    }
    log.flush();
    notes.push('home: ok');
  }

  // Topics index
  {
    const log = await collectConsole(page, 'topics');
    await goto(page, '/topics');
    const search = page.locator('#search-input');
    if (!(await search.count())) issue('topics', 'missing search input');
    else {
      const ph = await search.getAttribute('placeholder');
      if (!ph) issue('topics', 'search has no placeholder');
    }
    if (await page.getByText('Offensive phases', { exact: true }).count()) {
      issue('topics', 'Offensive phases label still visible');
    }
    const phaseChips = page.locator('#phase-filters');
    if (await phaseChips.isVisible().catch(() => false)) {
      issue('topics', 'tactic chips visible before selecting Offensive');
    }
    const offensive = page.locator('.tag-filter-btn[data-tag-value="offensive"]');
    const defensive = page.locator('.tag-filter-btn[data-tag-value="defensive"]');
    if (await offensive.count()) {
      await offensive.click();
      await page.waitForTimeout(150);
      const visible = await page.locator('#phase-filters').evaluate((el) => getComputedStyle(el).display !== 'none');
      if (!visible) issue('topics', 'tactic chips did not appear after Offensive');
      await defensive.click();
      await page.waitForTimeout(150);
      const hidden = await page.locator('#phase-filters').evaluate((el) => getComputedStyle(el).display === 'none');
      if (!hidden) issue('topics', 'tactic chips still visible after Defensive');
    } else {
      issue('topics', 'Offensive filter missing');
    }
    log.flush();
    notes.push('topics filters: exercised');
  }

  // Topic detail
  {
    const log = await collectConsole(page, 'topic');
    await goto(page, '/topics/gke-anonymous-reconnaissance');
    const h1 = await visibleText(page, 'h1');
    if (!h1) issue('topic', 'missing title');
    const bannerStance = page.locator('.ks-banner-offensive .ks-stance, .ks-banner-defensive .ks-stance');
    if (await bannerStance.count()) issue('topic', 'stance bar still in topic header');
    const crumb = page.locator('.ks-crumb a');
    const crumbHrefs = await crumb.evaluateAll((els) => els.map((a) => a.getAttribute('href')));
    if (!crumbHrefs.some((h) => h === '/topics')) issue('topic', 'Topics crumb not linked');
    if (!crumbHrefs.some((h) => (h || '').includes('category=offensive'))) issue('topic', 'category crumb not linked');
    if (!crumbHrefs.some((h) => (h || '').includes('phase='))) issue('topic', 'tactic crumb not linked');
    if (await page.getByText('Sections', { exact: true }).count()) issue('topic', 'Sections still in meta panel');
    const meta = await visibleText(page, '.ks-meta-panel');
    if (meta && /ATT&CK mapped/i.test(meta)) issue('topic', 'ATT&CK count still in meta panel');
    if (meta && !/Last updated/i.test(meta)) issue('topic', 'Last updated missing from meta panel');
    const pre = page.locator('pre[data-language="bash"], pre[data-language="yaml"], pre[data-language="json"]').first();
    if (await pre.count()) {
      await pre.hover();
      const langLabel = page.locator('.ks-code-lang');
      if (await langLabel.count()) issue('topic', 'language label still on snippet', await langLabel.first().innerText());
      const copy = pre.locator('.copy-button');
      if (!(await copy.count())) issue('topic', 'copy button missing on snippet');
    }
    log.flush();
    notes.push(`topic: ${h1}`);
  }

  // ATT&CK map
  {
    const log = await collectConsole(page, 'techniques');
    await goto(page, '/techniques');
    const selected = page.locator('.ks-matrix-cell.is-selected');
    if (await selected.count()) issue('techniques', 'a technique is selected on first load');
    const placeholder = page.locator('#matrix-placeholder');
    if (!(await placeholder.isVisible())) issue('techniques', 'placeholder not visible on first load');
    const cell = page.locator('.ks-matrix-cell').first();
    if (await cell.count()) {
      await cell.click();
      await page.waitForTimeout(200);
      if (await placeholder.isVisible()) issue('techniques', 'placeholder still visible after select');
      if (!(await page.locator('#matrix-detail-body').isVisible())) issue('techniques', 'detail body not shown after select');
      const id = await visibleText(page, '#detail-id');
      if (!id) issue('techniques', 'selected technique id empty');
    } else {
      issue('techniques', 'no matrix cells');
    }
    log.flush();
    notes.push('techniques: placeholder + select');
  }

  // Glossary
  {
    const log = await collectConsole(page, 'glossary');
    await goto(page, '/glossary');
    const search = page.locator('#glossary-search');
    if (!(await search.getAttribute('placeholder'))) issue('glossary', 'search has no placeholder');
    await search.fill('zzzz-no-match-xyz');
    await page.waitForTimeout(150);
    const empty = page.locator('#glossary-empty');
    if (await empty.count()) {
      const hidden = await empty.evaluate((el) => el.classList.contains('hidden'));
      if (hidden) issue('glossary', 'empty state not shown for no matches');
    }
    log.flush();
    notes.push('glossary: search empty state');
  }

  // Command palette
  {
    const log = await collectConsole(page, 'palette');
    await goto(page, '/');
    await page.keyboard.press('Meta+k');
    const palette = page.locator('#command-palette');
    const open = await palette.evaluate((el) => !el.hasAttribute('hidden')).catch(() => false);
    if (!open) {
      await page.locator('[data-open-palette]').click();
    }
    const input = page.locator('#command-palette-input');
    if (!(await input.isVisible())) issue('palette', 'palette input not visible');
    const ph = await input.getAttribute('placeholder');
    if (!ph) issue('palette', 'palette has no placeholder');
    await input.fill('recon');
    await page.waitForTimeout(150);
    const items = page.locator('.ks-palette-item');
    if (!(await items.count())) issue('palette', 'no results for recon');
    await page.keyboard.press('Escape');
    log.flush();
    notes.push('palette: search');
  }

  // Dark mode
  {
    const log = await collectConsole(page, 'dark');
    await goto(page, '/topics/gke-anonymous-reconnaissance');
    await page.locator('.theme-toggle-btn').first().click();
    await page.waitForTimeout(200);
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (!isDark) issue('dark', 'html.dark not applied after toggle');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    notes.push(`dark body bg: ${bg}`);
    await page.locator('.theme-toggle-btn').first().click();
    log.flush();
  }

  // Attack paths disabled
  {
    const res = await goto(page, '/attack-paths');
    const url = page.url();
    if (url.includes('/attack-paths') && res && res.status() === 200) {
      issue('attack-paths', 'feature still reachable while disabled', url);
    } else {
      notes.push(`attack-paths redirected to ${url}`);
    }
  }

  await browser.close();

  console.log('\n=== UI smoke notes ===');
  for (const n of notes) console.log('·', n);
  console.log('\n=== Issues ===');
  if (!issues.length) {
    console.log('none');
    process.exit(0);
  }
  for (const i of issues) console.log('✗', i);
  process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
