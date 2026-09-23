(async function () {
  'use strict';

  const url = new URL(window.location.href);
  const section = url.searchParams.get("Section");

  if (section !== "CEPZ-Import") {
    console.log("⛔ Not CEPZ-Import page");
    return;
  }

  const CONTROL_URL = "https://script.google.com/macros/s/AKfycbw-PBZ-GIHkmniFWp1y_Cb8BV2JzsaBRzfYqitCzevebScPqCkz_HINFaDmJpqVMZCN/exec";
  const API_URL = "https://script.google.com/macros/s/AKfycbz8TW1bL4KFZfyjs42Sr14esMWbpzwjNFk3q8AfkUXy1J6WJrEzePaQ0zPrkSKmeXT5/exec";

  // 🔹 সমাধান: Import সেকশনের জন্য আলাদা ইউনিক ক্যাশ কী
  const CACHE_KEY = 'receipt_cepz_import_cache_v2';

  // Network Request Helper (CORS ও Mixed Content সমস্যা এড়াতে)
  function httpGet(targetUrl) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: targetUrl,
        onload: function (response) {
          if (response.status >= 200 && response.status < 300) {
            try {
              const data = JSON.parse(response.responseText);
              resolve(data);
            } catch (e) {
              reject("JSON Parse Error: " + e.message);
            }
          } else {
            reject("HTTP Error Status: " + response.status);
          }
        },
        onerror: function (err) {
          reject(err);
        }
      });
    });
  }

  try {
    const ctrl = await httpGet(`${CONTROL_URL}?t=${Date.now()}`);

    if (ctrl.status !== "ON") {
      console.log("⛔ Script OFF from Google Sheet");
      return;
    }

    await runMainScript();

  } catch (err) {
    console.error("Initialization error:", err);
  }

  async function runMainScript() {
    try {
      const pageText = document.body.innerText;

      let startDate, endDate;
      const rangeMatch = pageText.match(/Date:\s*(\d{4}-\d{2}-\d{2})\s+To\s+(\d{4}-\d{2}-\d{2})/i);
      const singleMatch = pageText.match(/Date:\s*(\d{4}-\d{2}-\d{2})/);

      if (rangeMatch) {
        startDate = new Date(rangeMatch[1]);
        endDate = new Date(rangeMatch[2]);
      } else if (singleMatch) {
        startDate = new Date(singleMatch[1]);
        endDate = new Date(singleMatch[1]);
      } else {
        console.warn("⚠️ No Valid Date found on page.");
        return;
      }

      // 🔹 পৃথক ক্যাশ কী দিয়ে ডাটা চেক
      let cachedData = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
        renderTableData(cachedData, startDate, endDate);
      }

      // API থেকে নতুন ডাটা আনুন
      const incomingData = await httpGet(`${API_URL}?t=${Date.now()}`);

      if (incomingData && Array.isArray(incomingData) && incomingData.length > 0) {
        const currentCacheString = JSON.stringify(cachedData);
        const incomingDataString = JSON.stringify(incomingData);

        if (currentCacheString !== incomingDataString) {
          localStorage.setItem(CACHE_KEY, JSON.stringify(incomingData));
          renderTableData(incomingData, startDate, endDate);
        }
      }

    } catch (err) {
      console.error("Error running main script:", err);
    }
  }

  function renderTableData(dataArray, startDate, endDate) {
    const customRows = document.querySelectorAll(".inserted-by-script");
    customRows.forEach(row => row.remove());

    const filteredData = dataArray.filter(row => {
      if (!row[3]) return false;
      const dt = new Date(row[3]);
      if (isNaN(dt)) return false;

      const checkDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
      const sDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const eDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      return checkDate >= sDate && checkDate <= eDate;
    });

    if (filteredData.length === 0) return;

    const table = document.querySelector("table[border='1']");
    if (!table) return;
    const tbody = table.querySelector("tbody") || table;

    const timeToMinutes = t => {
      if (!t) return 0;
      const parts = t.split(":");
      if (parts.length < 2) return 0;
      return (parseInt(parts[0]) * 60) + parseInt(parts[1]);
    };

    filteredData.forEach((data) => {
      const [name, numStr, code, dateTime] = data;
      const num = parseFloat(numStr) || 0;
      const dt = new Date(dateTime);

      if (isNaN(dt)) return;

      const timeOnly = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
      const newTimeVal = timeToMinutes(timeOnly);

      let rate = 125;
      const rawRows = Array.from(tbody.querySelectorAll("tr:not(.inserted-by-script)"));
      for (let r of rawRows) {
        const rowTime = r.children[6]?.textContent?.trim();
        if (rowTime === timeOnly) {
          const foundRate = parseFloat(r.children[8]?.textContent?.trim());
          if (!isNaN(foundRate)) {
            rate = foundRate;
            break;
          }
        }
      }

      const total = num * rate;
      const newRow = document.createElement("tr");
      newRow.className = "inserted-by-script";

      newRow.innerHTML = `
          <td align="center">0</td>
          <td align="center" class="script-mr-cell">NEED_INCREMENT</td>
          <td>${name || ''}</td>
          <td>${code || ''}</td>
          <td>&nbsp;</td>
          <td></td>
          <td>${timeOnly}</td>
          <td align="right">${num}</td>
          <td align="right">${rate.toFixed(2)}</td>
          <td align="right">${total.toFixed(2)}</td>
      `;

      let inserted = false;
      const currentRows = Array.from(tbody.querySelectorAll("tr"));
      const currentTotalRow = currentRows.find(r => r.textContent.includes("Total"));

      for (let r of currentRows) {
        if (r === currentTotalRow) break;
        const existingTimeVal = timeToMinutes(r.children[6]?.textContent?.trim());
        if (newTimeVal < existingTimeVal) {
          r.parentNode.insertBefore(newRow, r);
          inserted = true;
          break;
        }
      }

      if (!inserted) {
        if (currentTotalRow) {
          currentTotalRow.parentNode.insertBefore(newRow, currentTotalRow);
        } else {
          tbody.appendChild(newRow);
        }
      }
    });

    // ─── SMART SERIAL & MR FIX LOGIC ───
    const allFinalRows = Array.from(tbody.querySelectorAll("tr"));
    const finalTotalRow = allFinalRows.find(r => r.textContent.includes("Total"));

    let currentSL = 1;
    let lastValidMR = 0;

    for (let r of allFinalRows) {
      if (r === finalTotalRow) break;

      if (r.querySelector("th") || (r.children[0] && r.children[0].textContent.includes("SL"))) {
        continue;
      }

      if (r.children[0]) {
        r.children[0].textContent = currentSL++;
      }

      if (r.children[1]) {
        const isScriptRow = r.children[1].classList.contains("script-mr-cell");

        if (!isScriptRow) {
          lastValidMR = parseInt(r.children[1].textContent) || lastValidMR;
        } else {
          lastValidMR = lastValidMR + 1;
          r.children[1].textContent = lastValidMR;
        }
      }
    }

    console.log(`📊 CEPZ-Import Rendered. Site MR preserved & Script MR auto-incremented.`);
  }
})();
