const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Load independent server instances without opening ports or using real credentials.
async function loadServer(env, fetch) {
  const filename = path.join(__dirname, 'server.js');
  const realRequire = createRequire(filename);
  const context = {
    require: (name) => name === './recording-date'
      ? { ...realRequire(name), initializeRecordingCalendar: () => new Promise(() => {}) }
      : realRequire(name),
    module: { exports: {} }, Buffer, URL, console, setTimeout, setInterval,
    process: { env: { ADMIN_SESSION_SECRET: 'test-secret-with-at-least-32-bytes-long', ...env } }, fetch,
  };
  vm.runInNewContext(`${await fs.readFile(filename, 'utf8')}
module.exports = { app, readContent, mutateContent, makeSession, contentStorageStatus, normalizeHomepageBuilder, resolveKeywordShelfVideos,
  setVideos: (videos) => { youtubeVideos = async () => ({ videos }); } };`, context, { filename });
  return context.module.exports;
}

async function route(server, method, routePath, body = {}) {
  const layer = server.app.router.stack.find((item) => item.route?.path === routePath && item.route.methods[method]);
  assert.ok(layer, `${method} ${routePath} is registered`);
  const req = { body, get: (name) => name === 'authorization' ? `Bearer ${server.makeSession('admin')}` : undefined };
  const res = { statusCode: 200, set() { return this; }, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  await layer.route.stack.at(-1).handle(req, res);
  return res;
}

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'torat-cms-test-'));
  try {
    const remote = new Map();
    let failWrites = false;
    const github = async (url, options = {}) => {
      const target = new URL(url);
      const reply = (status, value) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
      if (target.pathname.includes('/git/ref/heads/')) return reply(200, { object: { sha: 'test-head' } });
      assert.ok(target.pathname.includes('/contents/'), 'only mock GitHub storage requests are permitted');
      const file = target.pathname.split('/contents/')[1];
      if (options.method === 'PUT') {
        if (failWrites) return reply(403, {});
        remote.set(file, JSON.parse(options.body).content);
        return reply(200, {});
      }
      return remote.has(file) ? reply(200, { sha: 'test-blob', encoding: 'base64', content: remote.get(file) }) : reply(404, null);
    };
    const env = { TORAT_TSION_DATA_DIR: directory, GITHUB_CONTENTS_TOKEN: 'fake-test-token', GITHUB_CONTENTS_REPOSITORY: 'test/private-cms' };
    const first = await loadServer(env, github);
    const normalized = first.normalizeHomepageBuilder({ draft: { sections: [{ type: 'keyword-shelf', rules: { keywords: [' Shabbat Shalom ', '', ' Shabbos '] } }] } }).draft.sections[0];
    assert.deepEqual(Array.from(normalized.rules.keywords), ['Shabbat Shalom', 'Shabbos']);
    assert.equal(normalized.rules.searchDescriptions, false, 'new shelves default to title matching');
    const ruleCatalog = [{ id: 'phrase', title: 'Shabbat Shalom class' }, { id: 'both', title: 'Shabbos and Shabbat Shalom' }, { id: 'description', title: 'Other class', description: 'Shabbat Shalom' }];
    assert.deepEqual(Array.from(first.resolveKeywordShelfVideos(normalized, ruleCatalog)), ['phrase', 'both']);
    normalized.rules.matchMode = 'all';
    assert.deepEqual(Array.from(first.resolveKeywordShelfVideos(normalized, ruleCatalog)), ['both']);
    const document = { design: {}, sections: [{ id: 'shabbat', type: 'keyword-shelf', title: 'Shabbat learning', rules: { keywords: ['Shabbat', 'Shabbos'], matchMode: 'any', searchDescriptions: false } }] };
    assert.equal((await route(first, 'put', '/api/admin/home-builder/draft', document)).statusCode, 200);
    const published = await route(first, 'post', '/api/admin/home-builder/publish');
    assert.equal(published.statusCode, 200);
    assert.equal(published.body.storage.persistent, true);
    assert.ok(remote.has('content.json'), 'publish writes to durable storage');

    // New instance, no local files/cache: rules must still be present.
    const restarted = await loadServer(env, github);
    const catalog = [
      { id: 'one', title: 'Shabbat laws', publishedAt: '2026-11-01' },
      { id: 'description-only', title: 'Another class', description: 'Shabbat' },
      { id: 'unrelated', title: 'Emunah' },
    ];
    restarted.setVideos(catalog);
    let publicHome = await route(restarted, 'get', '/api/home-builder');
    assert.deepEqual(Array.from(publicHome.body.sections[0].videoIds), ['one']);
    assert.deepEqual(Array.from(publicHome.body.sections[0].rules.keywords), ['Shabbat', 'Shabbos']);
    catalog.push({ id: 'new-upload', title: 'Shabbos preparation', publishedAt: '2026-11-07' });
    publicHome = await route(restarted, 'get', '/api/home-builder');
    assert.deepEqual(Array.from(publicHome.body.sections[0].videoIds), ['new-upload', 'one'], 'future matching shiurim join automatically');

    await route(restarted, 'put', '/api/admin/home-builder/draft', { design: {}, sections: [] });
    assert.equal((await route(restarted, 'get', '/api/home-builder')).body.sections.length, 1, 'saving a draft must not change the published shelf');
    const nextInstance = await loadServer(env, github);
    assert.equal((await nextInstance.readContent()).homepageBuilder.published.sections[0].id, 'shabbat');

    const temporary = await loadServer({ TORAT_TSION_DATA_DIR: directory }, github);
    assert.equal(temporary.contentStorageStatus().persistent, false);
    assert.match((await route(temporary, 'post', '/api/admin/home-builder/publish')).body.storage.warning, /temporarily/);
    const unpublished = await loadServer({ TORAT_TSION_DATA_DIR: path.join(directory, 'unpublished') }, github);
    await route(unpublished, 'put', '/api/admin/home-builder/draft', document);
    assert.equal((await route(unpublished, 'get', '/api/home-builder')).body.sections.length, 0, 'unpublished shelves must not leak publicly');

    failWrites = true;
    assert.equal((await route(nextInstance, 'post', '/api/admin/home-builder/publish')).statusCode, 500, 'failed durable writes must not claim publish success');
    console.log('Homepage publish, restart persistence, title matching, future uploads, and storage failure tests passed');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
