(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.DianDriveUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function appendParam(url, key, value) {
    return url + (url.includes('?') ? '&' : '?') + encodeURIComponent(key) + '=' + encodeURIComponent(value);
  }

  async function fetchAllDriveFiles(fetchFn, baseUrl, options) {
    var url = appendParam(baseUrl, 'pageSize', '1000');
    var files = [];

    while (url) {
      var response = await fetchFn(url, options);
      var data = await response.json();
      if (!response.ok) {
        throw new Error((data.error && data.error.message) || ('Drive API 오류 (' + response.status + ')'));
      }
      files = files.concat(data.files || []);
      url = data.nextPageToken ? appendParam(baseUrl, 'pageSize', '1000') + '&pageToken=' + encodeURIComponent(data.nextPageToken) : '';
    }
    return files;
  }

  return { fetchAllDriveFiles: fetchAllDriveFiles };
});
