const assert = require('node:assert/strict');
const test = require('node:test');
const { fetchAllDriveFiles } = require('../drive-utils.js');

test('fetchAllDriveFiles reads every Drive API page', async () => {
  const urls = [];
  const fetchFn = async (url) => {
    urls.push(url);
    if (urls.length === 1) {
      return { ok: true, json: async () => ({ files: [{ id: 'a' }], nextPageToken: 'next-page' }) };
    }
    return { ok: true, json: async () => ({ files: [{ id: 'b' }] }) };
  };

  const result = await fetchAllDriveFiles(fetchFn, 'https://www.googleapis.com/drive/v3/files?q=x', {});

  assert.deepEqual(result, [{ id: 'a' }, { id: 'b' }]);
  assert.match(urls[0], /pageSize=1000/);
  assert.match(urls[1], /pageToken=next-page/);
});

test('fetchAllDriveFiles rejects Drive API errors instead of hiding them', async () => {
  await assert.rejects(
    fetchAllDriveFiles(async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'Invalid Credentials' } }) }), 'https://www.googleapis.com/drive/v3/files', {}),
    /Invalid Credentials/
  );
});
