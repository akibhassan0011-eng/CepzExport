(function () {
  'use strict';

  const USERNAME = 'nur';
  const AMOUNT = '150.00';

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;

  while ((node = walker.nextNode())) {
    let t = node.nodeValue;
    if (!t) continue;

    if (/User\s*ID\s*:/i.test(t)) {
      node.nodeValue = 'User ID: ' + USERNAME;
    }

    if (/\b0\.00\b/.test(t)) {
      node.nodeValue = t.replace(/\b0\.00\b/g, AMOUNT);
    }

    if (/Zero\s+Only/i.test(t)) {
      node.nodeValue = 'Taka One hundred and fifty Only';
    }
  }
})();
