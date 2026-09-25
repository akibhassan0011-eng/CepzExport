(async function () {
  'use strict';

  // 🎯 Target User ID to match
  const TARGET_USER_ID = "nur";

  // 🔍 Extract User ID from the web page
  const pageText = document.body.innerText;
  const userMatch = pageText.match(/User\s*ID\s*:\s*([^\s]+)/i);
  const currentPageUserId = userMatch ? userMatch[1].trim() : "";

  // 🛑 Stop execution if User ID does not match
  if (currentPageUserId.toLowerCase() !== TARGET_USER_ID.toLowerCase()) {
    console.log(`⛔ User ID mismatch! Page User: "${currentPageUserId}", Expected: "${TARGET_USER_ID}". Script stopped.`);
    return;
  }

  console.log(`✅ User ID matched (${TARGET_USER_ID}). Proceeding with execution...`);

  // 🔄 Flexible Section Match
  const currentUrl = window.location.href;
  if (!currentUrl.includes("Section=CEPZ-Export") || !currentUrl.includes("Export")) {
    console.log("⛔ URL does not match Welfare Export criteria.");
    return;
  }

  console.log("📌 Section matched! Fetching Control Status...");

  const CONTROL_URL = "https://script.google.com/macros/s/AKfycbzP1GCQGBq7McENvs_SR_fOQdSLm2nPbo1g1gQcWIT41_DeRkrfnrQbSAA_g3p12TGU/exec";
  const API_URL = "https://script.google.com/macros/s/AKfycbw4Ia1ktZaiTEKmo87U0glJXMWE1rDpN1QjjgBN6aUTvlx2Z7aiQRsYK5GLKiPBJbmz/exec";

  try {
    const ctrlRes = await fetch(`${CONTROL_URL}?t=${Date.now()}`);
    const ctrl = await ctrlRes.json();

    console.log("📊 Control status received:", ctrl.status);

    if (ctrl.status !== "ON") {
      console.log("⛔ Script OFF from Google Sheet");
      return;
    }

    console.log("🚀 Running Main Script...");
    await runMainScript();

  } catch (err) {
    console.error("❌ Initialization/Fetch error:", err);
  }

  // 🛠️ YYYY-MM-DD ফরম্যাটে সঠিক স্থানীয় তারিখ বের করার ফাংশন
  function parseSheetDateToYYYYMMDD(dateStr) {
    if (!dateStr) return "";

    const str = String(dateStr).trim();

    // যদি M/D/YYYY বা MM/DD/YYYY ফরম্যাটে থাকে (যেমন: "9/26/2026 16:06:30")
    if (str.includes("/")) {
      const datePart = str.split(" ")[0];
      const parts = datePart.split("/");
      if (parts.length === 3) {
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }

    // ISO Format (যেমন: "2026-09-26T09:43:30.000Z") বা Standard Date
    const dt = new Date(dateStr);
    if (!isNaN(dt)) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    return "";
  }

  // 🛠️ সময় বের করার সঠিক ফাংশন (hh:mm)
  function parseTimeToHHMM(dateTimeStr) {
    if (!dateTimeStr) return "00:00";

    const str = String(dateTimeStr).trim();

    // যদি সাধারণ "9/4/2026 16:06:30" ফরম্যাটে থাকে
    if (str.includes(" ")) {
      const timePart = str.split(" ")[1];
      if (timePart) {
        const tArr = timePart.split(":");
        return `${tArr[0].padStart(2, '0')}:${tArr[1].padStart(2, '0')}`;
      }
    }

    // ISO/Standard Date Object (যেমন: "2026-09-26T09:43:30.000Z")
    const dt = new Date(dateTimeStr);
    if (!isNaN(dt)) {
      const h = String(dt.getHours()).padStart(2, '0');
      const m = String(dt.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }

    return "00:00";
  }

  async function runMainScript() {
    try {
      const pageText = document.body.innerText;

      let startDateStr, endDateStr;
      const rangeMatch = pageText.match(/Date:\s*(\d{4}-\d{2}-\d{2})\s+To\s+(\d{4}-\d{2}-\d{2})/i);
      const singleMatch = pageText.match(/Date:\s*(\d{4}-\d{2}-\d{2})/);

      if (rangeMatch) {
        startDateStr = rangeMatch[1];
        endDateStr = rangeMatch[2];
      } else if (singleMatch) {
        startDateStr = singleMatch[1];
        endDateStr = singleMatch[1];
      } else {
        console.warn("⚠️ No Valid Date found on page. Script paused.");
        return;
      }

      console.log(`📅 Page Date range detected: ${startDateStr} To ${endDateStr}`);

      let cachedData = JSON.parse(localStorage.getItem('receipt_perfect_cache'));
      if (cachedData && cachedData.length > 0) {
        renderTableData(cachedData, startDateStr, endDateStr);
      }

      console.log("📥 Fetching fresh data from Google Sheet API...");
      const res = await fetch(`${API_URL}?t=${Date.now()}`);
      const incomingData = await res.json();

      console.log("📦 Total rows fetched from Google Sheet:", incomingData?.length || 0);

      if (incomingData && incomingData.length > 0) {
        if (!cachedData || JSON.stringify(cachedData) !== JSON.stringify(incomingData)) {
          localStorage.setItem('receipt_perfect_cache', JSON.stringify(incomingData));
          renderTableData(incomingData, startDateStr, endDateStr);
        }
      }

    } catch (err) {
      console.error("❌ Error running main script:", err);
    }
  }

  function renderTableData(dataArray, startDateStr, endDateStr) {
    const customRows = document.querySelectorAll(".inserted-by-script");
    customRows.forEach(row => row.remove());

    const filteredData = dataArray.filter(row => {
      const rawSheetDate = row[3];
      const sheetDateYYYYMMDD = parseSheetDateToYYYYMMDD(rawSheetDate);

      if (!sheetDateYYYYMMDD) return false;

      return sheetDateYYYYMMDD >= startDateStr && sheetDateYYYYMMDD <= endDateStr;
    });

    console.log(`🔎 Matched rows for target range (${startDateStr} To ${endDateStr}):`, filteredData.length);

    if (filteredData.length === 0) {
      console.log("ℹ️ No data matched for the selected date range.");
      return;
    }

    const table = document.querySelector("table[border='1']");
    if (!table) {
      console.warn("⚠️ Table with border='1' not found on page!");
      return;
    }
    const tbody = table.querySelector("tbody") || table;

    filteredData.forEach((data) => {
      const [name, numStr, code, dateTime, , sheetMrVal] = data;
      const mrNo = sheetMrVal || "";
      const newMrNum = parseInt(mrNo, 10) || 0;
      const num = parseFloat(numStr) || 0;

      // সময় বের করা (ISO / Normal string উভয়ের জন্যই)
      const timeOnly = parseTimeToHHMM(dateTime);

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
          <td align="center">${mrNo}</td>
          <td>${name}</td>
          <td>${code}</td>
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
        if (r.querySelector("th") || (r.children[0] && r.children[0].textContent.includes("SL"))) continue;

        const existingMrNum = parseInt(r.children[1]?.textContent?.trim(), 10) || 0;

        if (existingMrNum > 0 && newMrNum < existingMrNum) {
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

    const allRows = Array.from(tbody.querySelectorAll("tr"));
    let currentSL = 1;

    allRows.forEach(row => {
      const firstCell = row.children[0];
      if (!firstCell) return;

      const cellText = firstCell.textContent.trim();

      if (row.querySelector("th") || cellText.toUpperCase().includes("SL") || row.textContent.includes("Total")) {
        return;
      }

      firstCell.textContent = currentSL++;
    });

    console.log(`📊 Rendered. Sorted by MR Number successfully.`);
  }
})();
