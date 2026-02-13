
import { auth } from "./fb-init.js";

/**
 * Helper to fetch with Firebase Auth Token
 */
async function fetchWithAuth(url, options = {}) {
    const fetchOptions = { ...options };
    if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        fetchOptions.headers = {
            ...fetchOptions.headers,
            "Authorization": `Bearer ${idToken}`
        };
    }
    return fetch(url, fetchOptions);
}

/**
 * Annual Report Data Handler
 * Groups them by year and categorizes into Preliminary vs Finalized.
 */

async function loadAnnualReports() {
    const tablePM = document.getElementById("AnnualReportTableBody_PM");
    const tableO3 = document.getElementById("AnnualReportTableBody_O3");

    if (tablePM) tablePM.innerHTML = "<tr><td colspan='3' style='text-align:center; padding: 3rem;'>Loading reports...</td></tr>";
    if (tableO3) tableO3.innerHTML = "<tr><td colspan='3' style='text-align:center; padding: 3rem;'>Loading reports...</td></tr>";

    try {
        const res = await fetchWithAuth("/smokeday/smoke_id/?list=1");

        if (!res.ok) {
            const errorMsg = res.status === 401 ? "Please sign in to view reports." : `Server error: ${res.status}`;
            if (tablePM) tablePM.innerHTML = `<tr><td colspan='3' style='text-align:center; padding: 2rem;'>${errorMsg}</td></tr>`;
            if (tableO3) tableO3.innerHTML = `<tr><td colspan='3' style='text-align:center; padding: 2rem;'>${errorMsg}</td></tr>`;
            return;
        }

        const files = await res.json();
        if (!files || files.length === 0) {
            const noDataMsg = "No annual reports found.";
            if (tablePM) tablePM.innerHTML = `<tr><td colspan='3' style='text-align:center; padding: 3rem;'>${noDataMsg}</td></tr>`;
            if (tableO3) tableO3.innerHTML = `<tr><td colspan='3' style='text-align:center; padding: 3rem;'>${noDataMsg}</td></tr>`;
            return;
        }

        // 1. Group by Type (pm/o3) and Year
        const reportsByType = { pm: {}, o3: {} };

        files.forEach(filename => {
            const match = filename.match(/smoke_(pm|o3)_(\d{4}).*as_of_(\d{4})_(\d{2})_(\d{2})/);
            if (!match) return;

            const type = match[1]; // "pm" or "o3"
            const dataYear = match[2];
            const asOfDate = `${match[3]}-${match[4]}-${match[5]}`;
            const cleanTitle = `smoke_${type}_${dataYear}`;

            if (!reportsByType[type][dataYear]) reportsByType[type][dataYear] = [];
            reportsByType[type][dataYear].push({
                filename,
                dataYear,
                asOfDate,
                title: cleanTitle
            });
        });

        // 2. Render Tables
        renderTypeTable("pm", reportsByType.pm, tablePM);
        renderTypeTable("o3", reportsByType.o3, tableO3);

    } catch (err) {
        console.error("Error loading annual reports:", err);
        const errHtml = `<tr><td colspan='3' style='text-align:center; color: var(--color-red); padding: 2rem;'>Error: ${err.message}</td></tr>`;
        if (tablePM) tablePM.innerHTML = errHtml;
        if (tableO3) tableO3.innerHTML = errHtml;
    }
}

/**
 * Helper to render a specific type table (PM or O3)
 */
function renderTypeTable(type, reportsByYear, tableBody) {
    if (!tableBody) return;

    const sortedYears = Object.keys(reportsByYear).sort((a, b) => b - a);

    if (sortedYears.length === 0) {
        tableBody.innerHTML = `<tr><td colspan='3' style='text-align:center; padding: 3rem;'>No ${type.toUpperCase()} reports found.</td></tr>`;
        return;
    }

    tableBody.innerHTML = "";
    sortedYears.forEach(year => {
        const records = reportsByYear[year];
        records.sort((a, b) => new Date(a.asOfDate) - new Date(b.asOfDate));

        let prelim = null;
        let final = null;

        if (records.length === 1) {
            const currentYear = new Date().getFullYear();
            if (parseInt(year) < currentYear - 1) {
                final = records[0];
            } else {
                prelim = records[0];
            }
        } else {
            prelim = records[0];
            final = records[records.length - 1];
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="datadb-year-cell">${year}</td>
            <td>${renderDownloadCell(prelim, "Preliminary", year)}</td>
            <td>${renderDownloadCell(final, "Finalized", year)}</td>
        `;
        tableBody.appendChild(tr);
    });
}

function renderDownloadCell(record, type, year) {
    if (!record) {
        let msg = "";
        if (type === "Preliminary") {
            msg = "No preliminary version";
        } else {
            // Finalized follows the logic: Available in Sep of (year + 1)
            const targetYear = parseInt(year) + 1;
            msg = `Expected update: Sep ${targetYear}`;
        }
        return `<div class="datadb-empty-cell">${msg}</div>`;
    }

    return `
        <div class="datadb-report-card">
            <span class="datadb-report-name">${record.title}</span>
            <span class="datadb-report-date">(as of ${record.asOfDate})</span>
            <button class="datadb-download-btn-small" onclick="downloadReport('${record.filename}')">
                Download
            </button>
        </div>
    `;
}

function downloadReport(filename) {
    const path = `/smokeday/smoke_id/${filename}`;
    // Use direct navigation for downloads.
    // The gcs-proxy returns a 302 redirect. Using fetch() on a 302 to another origin (GCS)
    // often triggers CORS errors. window.location.href handles this as a normal browser navigation.
    window.location.href = path;
}
window.downloadReport = downloadReport;

// Global Event Listeners
window.addEventListener("tabOpenAnnual", () => loadAnnualReports());
window.addEventListener("authStateChanged", () => {
    // Only refresh if the annual tab is currently active
    if (document.getElementById("annual")?.classList.contains("active")) {
        loadAnnualReports();
    }
});

// Initial load if user lands directly on this tab or auth is already ready
document.addEventListener("DOMContentLoaded", () => {
    if (window.firebaseAuthReady && document.getElementById("annual")?.classList.contains("active")) {
        loadAnnualReports();
    }
});

