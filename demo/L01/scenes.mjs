// L01 demo — browser-only (Windows). Written against the screencast-demo-maker engine
// (skills/demo-film/reference/scenes-api.md). Selectors were taken from ariaSnapshot()
// of the real pages; numbers quoted in cues.json were checked against the same pages.
//
// FILMING order — every scene is a browser scene, so it equals config.order.
export const order = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
export const browser = order;

const GH = 'https://github.com/vvysotsk/devDigest';
const BRANCH = 'lesson-1';
const SECURITY_RUN = '632a135c-a2bc-4af5-934d-b06c8652eaee';

export default function scenes(stage) {
  const { sleep, record, stop, cue, shot, web, config, dry } = stage;
  const p = () => web.page;
  const { baseUrl, repoId, prNumber } = config.web;
  const listUrl = `${baseUrl}/repos/${repoId}/pulls?status=stale`;
  const prUrl = `${baseUrl}/repos/${repoId}/pulls/${prNumber}?tab=findings`;
  const gh = path => `${GH}/${path.replace('<b>', BRANCH)}`;

  // Smooth scroll that leaves `offset` px above the element, in whichever container
  // scrolls: the window on GitHub (its sticky file header would otherwise cover a heading
  // scrolled to block:'start'), the <main> content pane in the studio.
  const scrollTo = async (loc, offset = 120) => {
    await loc.evaluate((el, off) => {
      let c = el.parentElement;
      while (c && !(c.scrollHeight > c.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(c).overflowY))) c = c.parentElement;
      const scroller = c || document.scrollingElement;
      const base = c ? c.getBoundingClientRect().top : 0;
      const top = el.getBoundingClientRect().top - base + scroller.scrollTop - off;
      scroller.scrollTo({ top, behavior: 'smooth' });
    }, offset);
    // A locator measured mid-scroll sends the pointer to where the target *was*: wait
    // until the element sits at the offset, or stops moving (clamped at the page end).
    await loc.evaluate((el, off) => new Promise(res => {
      const t0 = performance.now(); let last = null, still = 0;
      const tick = () => {
        const y = el.getBoundingClientRect().top;
        still = last !== null && Math.abs(y - last) < 0.5 ? still + 1 : 0; last = y;
        if (Math.abs(y - off) < 2 || still >= 10 || performance.now() - t0 > 3000) res(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), offset);
  };
  // Absolute clock inside a cue: `until(0.4)` sleeps until 40 % of the clip has played,
  // however long the page loads before it took.
  const clock = ms => { const t0 = Date.now(); return f => sleep(Math.max(0, f * ms - (Date.now() - t0))); };
  const heading = (name, level = 2) => p().getByRole('heading', { name, level, exact: true }).first();
  // Glide to a point offset from an element's centre (e.g. the column header above a cell).
  const glideNear = async (loc, dx, dy, ms) => {
    const b = await loc.boundingBox();
    await web.glide(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, ms);
  };
  const openGh = url => web.open(url, { wait: 'domcontentloaded', settle: 300 });

  return {
    // ---- 1. PR list: COST and FINDINGS columns ----------------------------------
    async s1() {
      await web.open(listUrl);
      const row = p().getByRole('button', { name: '22 findings in this run' });
      await row.waitFor();
      await web.glide(300, 700, 300);                        // park away from the row
      await record('s1');
      await cue('s1-01', async ms => {
        await web.glideTo(p().getByRole('link', { name: 'DevDigest' }), 1200);
        await sleep(ms * 0.45);
        await web.glideTo(p().getByRole('heading', { name: 'Pull Requests', level: 1 }), 1000);
        await sleep(ms * 0.25);
        await web.glideTo(p().getByText('feat: add analytics dashboard').first(), 1100);
      });
      await cue('s1-02', async ms => {
        await web.glideTo(p().getByText('$0.021', { exact: true }), 1200);
        await sleep(ms * 0.5);
        await glideNear(p().getByText('$0.021', { exact: true }), 0, -46, 800);   // COST header
      });
      await cue('s1-03', async ms => {
        await glideNear(row, 0, -46, 1000);                  // FINDINGS header, popover stays shut
        await sleep(ms * 0.3);
        await glideNear(row, -70, -46, 700);
        await sleep(ms * 0.2);
        await glideNear(row, 0, -46, 700);
      });
      if (dry) shot('dry-s1');
      await stop();
    },

    // ---- 2. PR list: the read-only popover ----------------------------------------
    async s2() {
      await web.open(listUrl);
      const row = p().getByRole('button', { name: '22 findings in this run' });
      await row.waitFor();
      await web.glide(300, 700, 300);
      await record('s2');
      await cue('s2-01', async ms => {
        await sleep(ms * 0.15);
        await web.hoverInto(row, { dx: 30, dy: 90, hold: 1500 });   // opens below the trigger
        await sleep(ms * 0.15);
        await web.glide(web.pos[0], web.pos[1] + 60, 900);
      });
      await cue('s2-02', async ms => {
        await sleep(ms * 0.1);
        await web.wheel(180, 4, 45);                          // slow scroll inside the popover
        await sleep(ms * 0.25);
        await web.wheel(160, 4, 45);
      });
      if (dry) shot('dry-s2');
      await stop();
    },

    // ---- 3. PR page: Timeline with cost per run -----------------------------------
    async s3() {
      await web.open(prUrl);
      await p().getByText('$0.0034').first().waitFor();
      await web.glide(300, 760, 300);
      await record('s3');
      await cue('s3-01', async ms => {
        await web.glideTo(p().getByRole('button', { name: /^Agent runs/ }), 1200);
        await sleep(ms * 0.35);
        await web.glideTo(p().getByText('Timeline').first(), 1000);
      });
      await cue('s3-02', async ms => {
        await sleep(ms * 0.08);
        await web.glideTo(p().getByText('$0.0034').first(), 1200);
        await sleep(ms * 0.2);
        await web.glideTo(p().getByText('$0.013').first(), 1000);
        await sleep(ms * 0.17);
        await web.glideTo(p().getByText('$0.005').first(), 1000);
        await sleep(ms * 0.2);
        await web.glideTo(p().getByText('$0.0034').first(), 1000);
      });
      await cue('s3-03', async ms => {
        await web.glideTo(p().getByRole('button', { name: '15 findings in this run' }), 1000);
        await sleep(ms * 0.3);
        const reviewRuns = p().getByText('Review runs').first();
        await web.scrollIntoCenter(reviewRuns);
        await sleep(700);
        await web.glideTo(reviewRuns, 1000);
      });
      if (dry) shot('dry-s3');
      await stop();
    },

    // ---- 4. Review runs: pills, Hide low confidence, chips, Accept / Reject --------
    async s4() {
      await web.open(prUrl);
      const card = p().getByRole('button', { name: /^Performance Reviewer request changes/ });
      await card.waitFor();
      const pills = p().getByRole('group', { name: 'Findings by severity' });
      const toggle = p().getByRole('switch');
      const critical = p().getByRole('button', { name: 'Critical', exact: true });
      // Pre-roll state: card expanded, toggle off, no chip pressed (React state, reset by the reload).
      if (!(await pills.isVisible())) await card.click();
      await pills.waitFor();
      await scrollTo(card, 150);                             // below the sticky title + tabs
      await sleep(900);
      await web.glide(300, 780, 300);
      if (dry) shot('dry-s4-start');
      await record('s4');
      await cue('s4-01', async ms => {
        await web.glideTo(card, 1000);
        await sleep(ms * 0.3);
        await web.glideTo(p().getByText('PR SCORE').first(), 900);
        await sleep(ms * 0.12);
        await web.glideTo(p().getByText('1 Critical'), 800);
        await sleep(ms * 0.1);
        await web.glideTo(p().getByText('14 Warning'), 800);
      });
      await cue('s4-02', async () => {
        await glideNear(p().getByText('14 Warning'), 90, 0, 900);
      });
      await cue('s4-03', async ms => {
        await web.glideTo(pills, 800);
        await sleep(ms * 0.2);
        await web.clickOn(toggle, 900);
        await sleep(ms * 0.25);
        await web.glideTo(p().getByText('1 Critical'), 900);
        await sleep(ms * 0.15);
        await web.glideTo(p().getByText('Potential NoSQL injection in analytics aggregation pipeline'), 900);
      });
      await cue('s4-04', async ms => {
        await web.clickOn(toggle, 700);
        await sleep(ms * 0.12);
        await web.glideTo(critical, 800);
        await sleep(ms * 0.06);
        await web.glideTo(p().getByRole('button', { name: 'Warning', exact: true }), 600);
        await sleep(ms * 0.06);
        await web.glideTo(p().getByRole('button', { name: 'Suggestion', exact: true }), 600);
        await sleep(ms * 0.14);
        await web.clickOn(critical, 700);
        await sleep(ms * 0.2);
        await web.clickOn(critical, 300);
      });
      await cue('s4-05', async ms => {
        await web.glideTo(p().getByRole('button', { name: 'Accept' }).first(), 1100);   // hover only
        await sleep(ms * 0.35);
        await web.glideTo(p().getByRole('button', { name: 'Reject' }).first(), 700);    // hover only
      });
      if (dry) shot('dry-s4');
      await stop();
    },

    // ---- 5. Trace drawer: Stats and Findings --------------------------------------
    async s5() {
      await web.open(prUrl);
      const traceBtn = p().getByRole('button', { name: 'Open run trace & logs' }).nth(1);   // Security Reviewer tile
      await traceBtn.waitFor();
      await web.glide(300, 760, 300);
      const dialog = p().getByRole('dialog');
      await record('s5');
      await cue('s5-01', async ms => {
        await web.clickOn(traceBtn, 1000);
        try { await dialog.waitFor({ timeout: 4000 }); }
        catch { await web.open(`${prUrl}&trace=${SECURITY_RUN}`); }
        await web.prep();
        await sleep(ms * 0.2);
        await web.glideTo(dialog.getByText('Stats', { exact: true }), 900);
        await sleep(ms * 0.08);
        await web.glideTo(dialog.getByText('$0.013', { exact: true }), 900);
        await sleep(ms * 0.2);
        await web.glideTo(dialog.getByText('32.2s', { exact: true }), 800);
      });
      await cue('s5-02', async ms => {
        const group = dialog.getByRole('group', { name: 'Findings' });
        await web.scrollIntoCenter(group);
        await sleep(800);
        await web.glideTo(group, 900);
        await sleep(ms * 0.25);
        const first = dialog.getByText('Global rate limit increase weakens');
        await web.glideTo(first, 900);
        await sleep(ms * 0.15);
        const second = dialog.getByText('Inconsistent visitor key hashing in view tracking');
        await web.scrollIntoCenter(second);
        await sleep(700);
        await web.glideTo(second, 900);
      });
      if (dry) shot('dry-s5');
      await stop();
    },

    // ---- 6. GitHub: root CLAUDE.md ------------------------------------------------
    async s6() {
      await openGh(gh('blob/<b>/CLAUDE.md'));
      await heading('DevDigest — course starter', 1).waitFor();
      await scrollTo(heading('DevDigest — course starter', 1), 140);
      await sleep(900);
      await web.glide(1400, 800, 300);
      await record('s6');
      await cue('s6-01', async ms => {
        await sleep(ms * 0.15);
        await scrollTo(heading('Map'));
        await web.glideTo(heading('Map'), 1100);
        await sleep(ms * 0.45);
        await scrollTo(heading('Commands'));
        await web.glideTo(heading('Commands'), 1000);
      });
      await cue('s6-02', async ms => {
        await scrollTo(heading('Stack (per package)'));
        await web.glideTo(heading('Stack (per package)'), 1000);
        await sleep(ms * 0.4);
        await scrollTo(heading('Verification'));
        await web.glideTo(heading('Verification'), 1000);
        await sleep(ms * 0.2);
        await web.glideTo(p().getByText('No linter is configured').first(), 900);
        if (dry) shot('dry-s6-02');
      });
      await cue('s6-03', async ms => {
        await scrollTo(heading('Naming conventions'));
        await web.glideTo(heading('Naming conventions'), 1000);
        await sleep(ms * 0.35);
        await scrollTo(heading('Do not touch'));
        await web.glideTo(p().getByText('Migrations', { exact: true }).first(), 1000);
        await sleep(ms * 0.2);
        await web.glideTo(p().getByText('Lock files', { exact: true }).first(), 900);
      });
      if (dry) shot('dry-s6');
      await stop();
    },

    // ---- 7. GitHub: engineering-insights skill, then client/INSIGHTS.md ----------
    async s7() {
      await openGh(gh('blob/<b>/.claude/skills/engineering-insights/SKILL.md'));
      const nameRow = p().getByRole('row', { name: /^name engineering-insights/ });
      await nameRow.waitFor();
      await scrollTo(nameRow, 160);
      await sleep(900);
      await web.glide(1400, 800, 300);
      await record('s7');
      await cue('s7-01', async ms => {
        await web.glideTo(nameRow, 1000);
        await sleep(ms * 0.15);
        const desc = p().getByRole('rowheader', { name: 'description' });
        await web.glideTo(desc, 800);
        await sleep(ms * 0.1);
        const b = await p().getByRole('row', { name: /^description Captures/ }).boundingBox();
        await web.glide(b.x + 200, b.y + 18, 900);
        await web.glide(b.x + 200, b.y + b.height - 18, ms * 0.45);
      });
      await cue('s7-02', async ms => {
        await openGh(gh('blob/<b>/client/INSIGHTS.md'));
        const h = heading("What Doesn't Work");
        await h.waitFor();
        await scrollTo(h, 100);
        await sleep(600);
        await web.glideTo(h, 900);
        await sleep(ms * 0.15);
        await web.glideTo(p().getByText('2026-09-24: A CSS custom property').first(), 900);
        await sleep(ms * 0.1);
        await web.glideTo(p().getByText('src/app/repos/[repoId]/pulls/styles.ts:97-105').first(), 1100);
      });
      if (dry) shot('dry-s7');
      await stop();
    },

    // ---- 8. GitHub: docs/ and specs/ per package, Read when, the lesson PR ---------
    async s8() {
      await openGh(gh('tree/<b>/server/docs'));
      const arch = p().getByRole('link', { name: 'architecture.md, (File)' });
      await arch.waitFor();
      await web.glide(1400, 800, 300);
      await record('s8');
      await cue('s8-01', async ms => {
        const until = clock(ms);
        await web.glideTo(p().getByRole('heading', { name: 'docs', level: 1 }), 900);
        await web.glideTo(arch, 900);
        await until(0.27);
        await openGh(gh('tree/<b>/server/specs'));
        const flow = p().getByRole('link', { name: 'review-flow.md, (File)' });
        await flow.waitFor();
        await web.glideTo(flow, 900);
        await until(0.55);
        await openGh(gh('blob/<b>/server/CLAUDE.md#read-when'));
        const rw = heading('Read when');
        await rw.waitFor();
        await scrollTo(rw);
        await web.glideTo(rw, 800);
        await until(0.8);
        await web.glideTo(p().getByText('docs/architecture.md').first(), 700);
        await until(0.88);
        await web.glideTo(p().getByText('specs/review-flow.md').first(), 600);
        if (dry) shot('dry-s8-01');
      });
      await cue('s8-02', async ms => {
        const until = clock(ms);
        await openGh(gh('pull/1'));
        const phase = name => p().getByRole('listitem').filter({ hasText: new RegExp('^' + name + ':') });
        const toPhase = async (name, glideMs) => {
          const b = await phase(name).boundingBox();
          await web.glide(b.x + 60, b.y + 16, glideMs);
        };
        await phase('Initiation').waitFor();
        await scrollTo(phase('Initiation'), 220);
        await toPhase('Initiation', 800);
        await until(0.42);
        await toPhase('Planning', 700);
        await until(0.54);
        await toPhase('Implementation', 700);
        await until(0.68);
        await toPhase('Validation', 700);
        await until(0.82);
        await toPhase('Completion', 700);
      });
      if (dry) shot('dry-s8');
      await stop();
    },
  };
}
