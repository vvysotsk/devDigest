// L02 demo — browser-only (Windows). Written against the screencast-demo-maker engine
// (skills/demo-film/reference/scenes-api.md) and modelled on demo/L01/scenes.mjs.
// Selectors come from ariaSnapshot() of the real pages (2026-10-04); every number in
// cues.json was read from the same snapshots.
//
// Clicks that are planned (all React state or read-only GETs; proofs in scenario.md):
// Add Skill menu, the import modal (+ Fetch preview in s3 only, user-approved),
// skill tabs, Diff, the trace drawer's "Prompt assembly" section, agent tabs.
// Everything in config.neverClick is hovered, never clicked.
//
// FILMING order — every scene is a browser scene, so it equals config.order.
// (s8, the Agents page, was cut for length; its one fact moved into s7-04.)
export const order = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's9'];
export const browser = order;

export default function scenes(stage) {
  const { sleep, record, stop, cue, shot, web, config, dry } = stage;
  const p = () => web.page;
  const { baseUrl, repoId, skills, agents, experiment, k6, importUrl, github } = config.web;
  const GH = github.repo;
  const BRANCH = github.branch;
  const gh = path => `${GH}/${path.replace('<b>', BRANCH)}`;
  const skillUrl = (id, tab) => `${baseUrl}/skills/${id}?tab=${tab}`;
  const prUrl = (rid, n) => `${baseUrl}/repos/${rid}/pulls/${n}?tab=findings`;

  // Smooth scroll that leaves `offset` px above the element, in whichever container
  // scrolls (the studio's <main> pane, or the window on GitHub), then waits until the
  // element has settled so the pointer is not sent to where the target *was*.
  const scrollTo = async (loc, offset = 120) => {
    await loc.evaluate((el, off) => {
      let c = el.parentElement;
      while (c && !(c.scrollHeight > c.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(c).overflowY))) c = c.parentElement;
      const scroller = c || document.scrollingElement;
      const base = c ? c.getBoundingClientRect().top : 0;
      const top = el.getBoundingClientRect().top - base + scroller.scrollTop - off;
      scroller.scrollTo({ top, behavior: 'smooth' });
    }, offset);
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
  // Absolute clock inside a cue: `until(0.4)` sleeps until 40 % of the clip has played.
  const clock = ms => { const t0 = Date.now(); return f => sleep(Math.max(0, f * ms - (Date.now() - t0))); };
  const heading = (name, level) => p().getByRole('heading', { name, level, exact: true }).first();
  const openGh = url => web.open(url, { wait: 'domcontentloaded', settle: 300 });
  const dialog = () => p().getByRole('dialog');

  // Pre-roll for every studio scene: the Conventions page has no repo switcher and a
  // fresh profile falls back to the FIRST repo (the seeded one), so the active repo is
  // stored in localStorage before the page is opened (repo-context.tsx: path > stored
  // > first). Profile state only, no request.
  const ensureRepo = async () => {
    await web.open(`${baseUrl}/skills`);
    await p().evaluate(id => { try { localStorage.setItem('dd-repo', id); } catch {} }, repoId);
  };
  // Expand the trace drawer's collapsed "Prompt assembly" section (TraceSection state).
  const openPromptAssembly = async () => {
    const head = dialog().getByText('Prompt assembly', { exact: true });
    await web.scrollIntoCenter(head);
    await web.clickOn(head, 700);
  };

  return {
    // ---- 1. Skills page: cards, sources, the Add menu -----------------------------
    async s1() {
      await ensureRepo();
      await web.open(`${baseUrl}/skills`);
      const repoCard = p().getByRole('button', { name: 'repo-conventions', exact: true });
      await repoCard.waitFor();
      await web.glide(300, 760, 300);
      await record('s1');
      await cue('s1-01', async ms => {
        await web.glideTo(p().getByRole('link', { name: 'DevDigest', exact: true }), 1000);
        await sleep(ms * 0.35);
        await web.glideTo(p().getByRole('link', { name: 'Skills', exact: true }), 700);
        await sleep(ms * 0.08);
        await web.glideTo(p().getByRole('link', { name: 'Agents', exact: true }), 500);
        await sleep(ms * 0.08);
        await web.glideTo(p().getByRole('link', { name: 'Conventions', exact: true }), 500);
        await sleep(ms * 0.1);
        await web.glideTo(heading('Skills', 1), 800);
      });
      await cue('s1-02', async ms => {
        const first = p().getByRole('button', { name: 'branch-coverage-check', exact: true });
        await web.glideTo(first, 900);
        await sleep(ms * 0.3);
        for (const name of ['breaking-change', 'deprecation-policy', 'response-schema', 'semver-discipline']) {
          const card = p().getByRole('button', { name, exact: true });
          await web.scrollIntoCenter(card);
          await web.glideTo(card.getByText('Imported', { exact: true }), 500);
          await web.glideTo(card.getByText('1 agent', { exact: true }), 400);
          await sleep(ms * 0.07);
        }
      });
      await cue('s1-03', async ms => {
        const add = p().getByRole('button', { name: 'Add Skill', exact: true });
        await web.scrollIntoCenter(add);
        await web.clickOn(add, 800);                           // kit Dropdown, React state
        await sleep(ms * 0.15);
        await web.glideTo(p().getByRole('button', { name: 'Create skill', exact: true }), 600);
        await sleep(ms * 0.1);
        await web.glideTo(p().getByRole('button', { name: 'Import from file', exact: true }), 500);
        await sleep(ms * 0.1);
        await web.glideTo(p().getByRole('button', { name: 'Import from URL', exact: true }), 500);
        await sleep(ms * 0.15);
        await web.clickOn(heading('Skills', 1), 500);          // outside click closes the menu
      });
      if (dry) shot('dry-s1');
      await stop();
    },

    // ---- 2. Skill detail: Preview, Versioning, Diff -------------------------------
    async s2() {
      await ensureRepo();
      await web.open(`${baseUrl}/skills`);
      const card = p().getByRole('button', { name: 'repo-conventions', exact: true });
      await card.waitFor();
      await web.scrollIntoCenter(card);
      await web.glide(300, 760, 300);
      await record('s2');
      await cue('s2-01', async ms => {
        await web.clickOn(card, 900);                          // router.push → ?tab=preview
        await heading('repo-conventions', 1).waitFor();
        await web.prep();
        await sleep(ms * 0.25);
        await web.glideTo(heading('repo-conventions', 1), 800);
        await sleep(ms * 0.1);
        await web.glideTo(heading('repo-conventions', 1).locator('..').getByText('Extracted', { exact: true }), 700);
        await sleep(ms * 0.1);
        await web.glideTo(p().getByRole('button', { name: 'Preview', exact: true }), 700);
      });
      await cue('s2-02', async ms => {
        const h1 = heading('Implement PromiseLike for async types to allow interoperability with async/await.', 2);
        await web.glideTo(h1, 800);
        await sleep(ms * 0.2);
        await web.glideTo(p().getByText('src/result-async.ts:22', { exact: true }), 700);
        await sleep(ms * 0.12);
        await web.glideTo(p().getByText('src/result-async.ts:52', { exact: true }), 700);
        await sleep(ms * 0.1);
        const h3 = heading("Use Result's isOk() type guard to branch on success/error.", 2);
        await scrollTo(h3, 200);
        await web.glideTo(p().getByText('src/result.ts:140', { exact: true }), 700);
        await sleep(ms * 0.1);
        await web.glideTo(p().getByText('src/result.ts:1', { exact: true }), 700);
      });
      await cue('s2-03', async ms => {
        await web.clickOn(p().getByRole('button', { name: 'Versioning', exact: true }), 700);   // ?tab=versions
        const v1 = p().getByRole('button', { name: 'v1 2026-10-01 15:23', exact: true });
        await v1.waitFor();
        await sleep(ms * 0.1);
        await web.glideTo(v1, 700);
        await sleep(ms * 0.12);
        await web.glideTo(p().getByRole('button', { name: 'v2 2026-10-04 15:56 current', exact: true }), 600);
        await sleep(ms * 0.12);
        const diff = p().getByRole('button', { name: 'Diff v1 with the current version', exact: true });
        await web.clickOn(diff, 600);                          // setView state, pure lineDiff
        await p().getByText('Changes from v1 to the current v2').waitFor();
        await sleep(ms * 0.2);
        await web.glideTo(p().getByText('Changes from v1 to the current v2'), 600);
        await sleep(ms * 0.1);
        await web.glideTo(p().getByRole('button', { name: 'Restore v1', exact: true }), 600);   // hover only
      });
      if (dry) shot('dry-s2');
      await stop();
    },

    // ---- 3. Import from URL: dialog, Fetch preview, the warning, an imported skill --
    async s3() {
      await ensureRepo();
      await web.open(`${baseUrl}/skills`);
      const add = p().getByRole('button', { name: 'Add Skill', exact: true });
      await add.waitFor();
      await web.glide(300, 760, 300);
      await record('s3');
      await cue('s3-01', async ms => {
        await web.clickOn(add, 800);
        await web.clickOn(p().getByRole('button', { name: 'Import from URL', exact: true }), 700);
        const field = dialog().getByRole('textbox', { name: 'Skill URL', exact: true });
        await field.waitFor();
        await sleep(ms * 0.15);
        await web.glideTo(dialog().getByText('Import from URL', { exact: true }), 700);
        await sleep(ms * 0.15);
        await web.glideTo(field, 700);
      });
      await cue('s3-02', async ms => {
        const field = dialog().getByRole('textbox', { name: 'Skill URL', exact: true });
        await web.clickOn(field, 500);
        await field.pressSequentially(importUrl, { delay: 12 });
        await sleep(ms * 0.1);
        await web.clickOn(dialog().getByRole('button', { name: 'Fetch preview', exact: true }), 700);   // s3 only
        // Pre-generated narration: the warning MUST be on screen or the take fails.
        await dialog().getByText('No frontmatter', { exact: true }).first().waitFor({ timeout: 15000 });
      });
      await cue('s3-03', async ms => {
        const warn = dialog().getByText('No frontmatter', { exact: true }).first();
        await web.scrollIntoCenter(warn);
        await web.glideTo(warn, 800);
        await sleep(ms * 0.25);
        await web.glideTo(dialog().getByText('Type defaulted', { exact: true }).first(), 600);
        await sleep(ms * 0.08);
        await web.glideTo(dialog().getByText('Description missing', { exact: true }).first(), 600);
        await sleep(ms * 0.12);
        await web.glideTo(dialog().getByRole('button', { name: 'Save skill', exact: true }), 700);    // disabled, hover
        await sleep(ms * 0.12);
        await web.clickOn(dialog().getByRole('button', { name: 'Close', exact: true }), 600);
      });
      await cue('s3-04', async ms => {
        const fd = p().getByRole('button', { name: 'frontend-design', exact: true });
        await web.scrollIntoCenter(fd);
        await sleep(300);
        await web.glideTo(fd, 800);
        await sleep(ms * 0.3);
        await web.glideTo(fd.getByRole('switch'), 600);        // hover only
        await sleep(ms * 0.15);
        await web.glideTo(fd.getByText('0 agents', { exact: true }), 700);   // end off the toggle
      });
      if (dry) shot('dry-s3');
      await stop();
    },

    // ---- 4. Conventions page: the stored neverthrow scan ----------------------------
    async s4() {
      await ensureRepo();
      await web.open(`${baseUrl}/conventions`);
      await heading('Conventions in neverthrow', 1).waitFor();
      const card1 = p().getByRole('listitem', { name: 'In tee methods, catch and ignore errors from the side-effect function.', exact: true });
      const card2 = p().getByRole('listitem', { name: 'Implement PromiseLike for async types to allow interoperability with async/await.', exact: true });
      await card1.waitFor();
      await web.glide(300, 760, 300);
      await record('s4');
      await cue('s4-01', async ms => {
        await web.glideTo(heading('Conventions in neverthrow', 1), 900);
        await sleep(ms * 0.2);
        await web.glideTo(p().getByText(/Detected from 9 sample files/), 800);
        await sleep(ms * 0.25);
        await web.glideTo(p().getByRole('button', { name: 'ReScan', exact: true }), 800);   // hover only
      });
      await cue('s4-02', async ms => {
        await web.glideTo(p().getByText('4 of 10 accepted', { exact: true }), 800);
        await sleep(ms * 0.35);
        await web.glideTo(p().getByRole('button', { name: 'Create skill', exact: true }), 700);   // hover only
      });
      await cue('s4-03', async ms => {
        await web.glideTo(card1, 900);
        await sleep(ms * 0.3);
        await web.glideTo(card1.getByText('error handling', { exact: true }), 600);
        await sleep(ms * 0.1);
        await web.glideTo(card1.getByRole('link', { name: 'src/result-async.ts:125', exact: true }), 700);
        await sleep(ms * 0.15);
        await web.glideTo(card1.getByText('85%', { exact: true }), 700);
      });
      await cue('s4-04', async ms => {
        await web.glideTo(card1.getByRole('button', { name: 'Accept', exact: true }), 700);
        await sleep(ms * 0.08);
        await web.glideTo(card1.getByRole('button', { name: 'Reject', exact: true }), 500);
        await sleep(ms * 0.08);
        await web.glideTo(card1.getByRole('button', { name: 'Edit', exact: true }), 500);
        await sleep(ms * 0.12);
        await web.scrollIntoCenter(card2);
        await web.glideTo(card2.getByRole('button', { name: 'Accepted', exact: true }), 800);   // hover only
        await sleep(ms * 0.2);
        await web.glideTo(card2.getByRole('link', { name: 'src/result-async.ts:22', exact: true }), 700);
      });
      if (dry) shot('dry-s4');
      await stop();
    },

    // ---- 5. Evidence link → GitHub blob at the scan's sha ---------------------------
    async s5() {
      await ensureRepo();
      await web.open(`${baseUrl}/conventions`);
      const card2 = p().getByRole('listitem', { name: 'Implement PromiseLike for async types to allow interoperability with async/await.', exact: true });
      await card2.waitFor();
      const link = card2.getByRole('link', { name: 'src/result-async.ts:22', exact: true });
      const href = await link.getAttribute('href');                 // MonoLink is target=_blank
      await web.scrollIntoCenter(card2);
      await web.glide(300, 760, 300);
      await record('s5');
      await cue('s5-01', async ms => {
        const until = clock(ms);
        await web.glideTo(link, 900);
        await until(0.25);
        await openGh(href);
        const line = p().getByText(/implements PromiseLike/).first();
        await line.waitFor();
        await scrollTo(line, 220);
        await until(0.55);
        await web.glideTo(line, 900);
      });
      if (dry) shot('dry-s5');
      await stop();
    },

    // ---- 6. API Contract experiment: PR #486 without vs with skills, two traces -----
    async s6() {
      await ensureRepo();
      const url = prUrl(experiment.repoId, experiment.prNumber);
      await web.open(url);
      await p().getByText('16:07:26', { exact: true }).waitFor();
      await web.glide(300, 760, 300);
      await record('s6');
      await cue('s6-01', async ms => {
        await web.glideTo(heading('#486 Allow guest checkout without an email', 1), 1000);
        await sleep(ms * 0.45);
        await web.glideTo(p().getByRole('button', { name: /^Agent runs/ }), 800);
        await sleep(ms * 0.15);
        await web.glideTo(p().getByText('Timeline').first(), 700);
      });
      await cue('s6-02', async ms => {
        const tile = t => p().getByText(t).first();
        await web.scrollIntoCenter(tile('16:07:26'));
        await web.glideTo(tile('16:07:26'), 800);
        await sleep(ms * 0.12);
        await web.glideTo(tile('16:38:40'), 600);
        await sleep(ms * 0.3);
        await web.glideTo(tile('17:18:59'), 700);
        await sleep(ms * 0.12);
        await web.glideTo(tile('17:20:02'), 600);
      });
      await cue('s6-03', async ms => {
        const title = p().getByText('Breaking change: Customer.email made optional without mitigation').first();
        await scrollTo(title, 200);
        await web.glideTo(title, 900);
        await sleep(ms * 0.3);
        await web.glideTo(p().getByRole('link', { name: 'src/schemas/customers.ts:6', exact: true }), 700);
        await sleep(ms * 0.15);
        await web.glideTo(p().getByText('95% conf').first(), 600);
      });
      await cue('s6-04', async ms => {
        const until = clock(ms);
        await web.open(`${url}&trace=${experiment.runWith}`);
        await dialog().waitFor();
        await web.prep();
        await web.glideTo(dialog().getByText('23.6s').first(), 800);
        await until(0.3);
        await openPromptAssembly();
        const skills = dialog().getByText(/Skills · 4 · ≈ 1909 tok/);
        await skills.waitFor();
        await web.scrollIntoCenter(skills);
        await web.glideTo(skills, 700);
        await until(0.62);
        const list = dialog().getByRole('list', { name: 'Skills (dynamic)' });
        await web.glideTo(list.getByText('breaking-change', { exact: true }), 600);
        await until(0.74);
        await web.glideTo(list.getByText('≈ 566 tok').first(), 500);
        await until(0.84);
        await web.glideTo(list.getByText('deprecation-policy', { exact: true }), 600);
      });
      await cue('s6-05', async ms => {
        const until = clock(ms);
        await web.open(`${url}&trace=${experiment.runWithout}`);
        await dialog().waitFor();
        await web.prep();
        await web.glideTo(dialog().getByText('1582.6s').first(), 800);
        await until(0.25);
        await web.glideTo(dialog().getByText('3k→132.0k').first(), 600);
        await until(0.45);
        await openPromptAssembly();
        await dialog().getByText('User / diff (dynamic)').waitFor();
        if (await dialog().getByText(/^Skills ·/).count() !== 0) throw new Error('s6-05: a Skills block is present on the no-skills trace');
        await web.glideTo(dialog().getByText('System', { exact: true }), 600);
        await until(0.8);
        await web.glideTo(dialog().getByText('User / diff (dynamic)'), 600);
      });
      if (dry) shot('dry-s6');
      await stop();
    },

    // ---- 7. K6: the generated skill in a real review; the agent's Skills tab --------
    async s7() {
      await ensureRepo();
      const url = prUrl(k6.repoId, k6.prNumber);
      await web.open(`${url}&trace=${k6.runId}`);
      await dialog().waitFor();
      await web.glide(300, 760, 300);
      await record('s7');
      await cue('s7-01', async ms => {
        await web.glideTo(p().getByRole('heading', { level: 1 }).first(), 900);
        await sleep(ms * 0.3);
        await web.glideTo(p().getByText('+2 −2', { exact: false }).first(), 600);
        await sleep(ms * 0.15);
        await web.glideTo(dialog().getByText('5.9s').first(), 800);
        await sleep(ms * 0.1);
        await web.glideTo(dialog().getByText('FINDINGS').first(), 500);
      });
      await cue('s7-02', async ms => {
        const until = clock(ms);
        await openPromptAssembly();
        const skills = dialog().getByText(/Skills · 1 · ≈ 313 tok/);
        await skills.waitFor();
        await web.scrollIntoCenter(skills);
        await web.glideTo(skills, 800);
        await until(0.45);
        const row = dialog().getByRole('list', { name: 'Skills (dynamic)' });
        await web.glideTo(row.getByText('repo-conventions', { exact: true }), 600);
        await until(0.7);
        await web.glideTo(row.getByText('≈ 313 tok').first(), 500);
      });
      await cue('s7-03', async ms => {
        const until = clock(ms);
        await web.open(`${baseUrl}/agents/${agents.generalReviewer}?tab=skills`);
        const list = p().getByRole('list', { name: 'Skills' });
        await list.waitFor();
        await web.prep();
        await web.glideTo(heading('General Reviewer', 1), 800);
        await until(0.3);
        await web.glideTo(p().getByText('1 of 1 enabled', { exact: true }), 700);
        await until(0.5);
        const row = list.getByRole('listitem', { name: 'repo-conventions', exact: true });
        await web.glideTo(row.getByRole('switch'), 600);       // hover only
        await until(0.62);
        await web.glideTo(row.getByText('convention', { exact: true }), 500);
        await until(0.78);
        await web.glideTo(p().getByRole('textbox', { name: 'Filter skills…', exact: true }), 600);
        await until(0.9);
        await web.glideTo(p().getByText(/Order matters/), 500);
      });
      await cue('s7-04', async ms => {
        // The agents list is the left pane of the same master-detail page: the card
        // counters "1 skill" (General Reviewer) and "4 skills" (API Contract Reviewer,
        // the last card) are on screen without a navigation.
        await web.glideTo(p().getByText('1 skill', { exact: true }).first(), 800);
        await sleep(ms * 0.4);
        await web.glideTo(p().getByText('4 skills', { exact: true }).last(), 700);
      });
      if (dry) shot('dry-s7');
      await stop();
    },

    // ---- 9. GitHub: the spec's decisions, the server contract, the e2e flow ---------
    async s9() {
      await openGh(gh('blob/<b>/specs/HW02-conventions-and-api-contract.md#stage-2--conventions-extractor'));
      const stage2 = heading('Stage 2 — Conventions Extractor', 3);
      await stage2.waitFor();
      await scrollTo(stage2, 140);
      await sleep(800);
      await web.glide(1400, 800, 300);
      await record('s9');
      await cue('s9-01', async ms => {
        const until = clock(ms);
        await web.glideTo(stage2, 900);
        await until(0.18);
        await web.glideTo(p().getByText(/^D14 Asynchronous extraction/).first(), 800);
        await until(0.42);
        const d17 = p().getByText(/^D17 Scans and decisions/).first();
        await scrollTo(d17, 200);
        await web.glideTo(d17, 800);
        await until(0.62);
        await openGh(gh('blob/<b>/specs/HW02-conventions-and-api-contract.md#stage-3--extras'));
        const stage3 = heading('Stage 3 — extras', 3);
        await stage3.waitFor();
        await scrollTo(stage3, 140);
        await web.glideTo(p().getByText(/^D21 Import from a URL/).first(), 800);
        await until(0.86);
        await web.glideTo(p().getByText(/^D22 Work repository/).first(), 700);
      });
      await cue('s9-02', async ms => {
        const until = clock(ms);
        await openGh(gh('blob/<b>/server/specs/conventions.md'));
        const h = p().getByRole('heading', { level: 1 }).first();
        await h.waitFor();
        await web.glideTo(h, 800);
        await until(0.2);
        const guarantee = p().getByText('Guarantee', { exact: true }).first();
        await scrollTo(guarantee, 200);
        await web.glideTo(guarantee, 800);
        await until(0.45);
        // GitHub line anchors (a text locator here resolves to the hidden full-file
        // textarea): #L20 = "Accept card 1 (#47)", #L40 = "open the create-skill modal (#51)".
        await openGh(gh('blob/<b>/e2e/specs/09-conventions.flow.json#L20'));
        const l20 = p().locator('#LC20');
        await l20.waitFor();
        await scrollTo(l20, 220);
        // The line is long: bring the "Accept card 1 (#47)" label into the code view
        // horizontally (the view itself scrolls; the page does not) before pointing at it.
        const label20 = l20.getByText(/Accept card 1/).first();
        await label20.scrollIntoViewIfNeeded();
        await sleep(400);
        await web.glideTo(label20, 800);
        if (dry) shot('dry-s9-l20');
        await until(0.72);
        await openGh(gh('blob/<b>/e2e/specs/09-conventions.flow.json#L40'));
        const l40 = p().locator('#LC40');
        await l40.waitFor();
        await scrollTo(l40, 220);
        // Scroll the code view back so the (shorter) line-40 label is in view too.
        const label40 = l40.getByText(/open the create-skill modal/).first();
        await label40.scrollIntoViewIfNeeded();
        await sleep(400);
        await web.glideTo(label40, 800);
      });
      if (dry) shot('dry-s9');
      await stop();
    },
  };
}
