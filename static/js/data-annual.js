
import { auth } from "./fb-init.js";

/**
 * Annual Report tab logic: Fetches and displays downloadable files from GCS
 */

async function fetchWithAuth(url) {
    const options = {};
    if (auth.currentUser) {
        try {
            const token = await auth.currentUser.getIdToken();
            options.headers = { "Authorization": `Bearer ${token}` };
        } catch (e) {
            console.warn("Could not get ID token for annual report fetch:", e);
        }
    }
    return fetch(url, options);
}

export async function loadAnnualReports() {
    const listContainer = document.getElementById("AnnualReportList");
    if (!listContainer) return;

    listContainer.innerHTML = "<p>Loading reports...</p>";

    try {
        // We use the proxy with ?list=1 to get the file list
        const res = await fetchWithAuth("/smokeday/smoke_id/?list=1");
        if (!res.ok) {
            if (res.status === 401) {
                listContainer.innerHTML = "<p>Please sign in to view and download reports.</p>";
            } else {
                throw new Error(`Failed to fetch: ${res.status}`);
            }
            return;
        }

        const files = await res.json();
        if (!files || files.length === 0) {
            listContainer.innerHTML = "<p>No reports available at this moment.</p>";
            return;
        }

        listContainer.innerHTML = "";
        const listWrapper = document.createElement("div");
        listWrapper.className = "datadb-download-list";

        files.forEach(file => {
            // Filter out directories if any (though delimiter should handle it)
            if (file.endsWith("/")) return;

            const item = document.createElement("div");
            item.className = "datadb-download-item";

            const nameSpan = document.createElement("span");
            nameSpan.className = "datadb-download-name";
            nameSpan.textContent = file;

            const btn = document.createElement("button");
            btn.className = "datadb-query-btn";
            btn.textContent = "Download";
            btn.setAttribute("aria-label", `Download ${file}`);

            btn.onclick = async () => {
                // To trigger a download with the correct name, we can use a fetch or direct link
                // If the proxy gives the file, we can use an <a> tag with download attribute if CORS allows
                const url = `/smokeday/smoke_id/${file}`;
                const link = document.createElement("a");
                link.href = url;
                link.download = file;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            item.appendChild(nameSpan);
            item.appendChild(btn);
            listWrapper.appendChild(item);
        });

        listContainer.appendChild(listWrapper);
    } catch (err) {
        console.error("Error loading annual reports:", err);
        listContainer.innerHTML = "<p>Error loading reports. Please try again later.</p>";
    }
}

// Initial load if tab is active, or wait for tab change event
document.addEventListener("DOMContentLoaded", () => {
    // Check if we are already on the annual tab (unlikely but possible on direct link)
    if (document.getElementById("annual")?.classList.contains("active")) {
        loadAnnualReports();
    }
});

// Listen for tab changes
window.addEventListener("tabOpenAnnual", () => {
    loadAnnualReports();
});

// Listen for auth changes to refresh the list
window.addEventListener("authStateChanged", () => {
    if (document.getElementById("annual")?.classList.contains("active")) {
        loadAnnualReports();
    }
});

