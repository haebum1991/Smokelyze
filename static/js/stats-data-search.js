
import { ExcludeLayerGroups, DATASET_SOURCE_MAP } from "./layers-def.js";
import { ESML, highlightLocation } from "./utils.js";
import { loadedGeoJSON } from "./loader.js";

const MAX_RESULTS = 50;

function getSearchableData() {
    if (!loadedGeoJSON) return [];

    const select = document.getElementById("MapDataSelect");
    if (!select) return [];

    const dataset = select.value;
    const sourceKey = DATASET_SOURCE_MAP[dataset] || dataset;

    const geoData = loadedGeoJSON[sourceKey];
    if (!geoData || !geoData.features) return [];

    return geoData.features;
}

function highlightText(text, query) {
    if (!query) return ESML(text);
    // Escape regex special chars in query to prevent crashes
    const safeQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const parts = text.split(new RegExp("(" + safeQuery + ")", "gi"));

    return parts.map(function (part) {
        const escaped = ESML(part);
        if (part.toLowerCase() === query.toLowerCase()) {
            return "<strong style='color: Red;'>" + escaped + "</strong>";
        }
        return escaped;
    }).join("");
}

export function injectSearchUI() {
    if (document.getElementById("SiteSearchWrapper")) return;

    const targetSelect = document.getElementById("MapDataSelect");
    if (!targetSelect) return;

    const wrapper = document.createElement("div");
    wrapper.id = "SiteSearchWrapper";
    Object.assign(wrapper.style, {
        position: "relative",
        width: "100%"
    });

    const label = document.createElement("label");
    label.textContent = "Site search (name, AQS, ...):";
    label.setAttribute("for", "stats-site-search-input");
    Object.assign(label.style, {
        display: "block",
        color: "var(--text-main)"
    });

    const input = document.createElement("input");
    input.id = "stats-site-search-input";
    input.type = "text";
    input.placeholder = "Type to search...";
    Object.assign(input.style, {
        width: "100%",
        padding: "0.4rem",
        borderRadius: "0.4rem",
        backgroundColor: "var(--color-bg)",
        border: "0.1rem solid var(--card-shadow)",
        color: "var(--text-strong)",
        boxSizing: "border-box",
        fontSize: "1.6rem"
    });

    const resultsList = document.createElement("ul");
    resultsList.id = "stats-site-search-results";
    Object.assign(resultsList.style, {
        position: "absolute",
        top: "100%",
        left: "0",
        right: "0",
        maxHeight: "20rem",
        overflowY: "auto",
        backgroundColor: "var(--color-white)",
        border: "0.1rem solid var(--border-soft)",
        color: "var(--color-black)",
        borderRadius: "0 0 0.4rem 0.4rem",
        listStyle: "none",
        padding: "0",
        margin: "0",
        zIndex: "1000",
        display: "none",
        boxShadow: "0 0.4rem 0.6rem rgba(0,0,0,0.1)"
    });

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    wrapper.appendChild(resultsList);

    let appendTarget = targetSelect;
    const exportWrapper = document.getElementById("ExportBtnWrapper");
    if (exportWrapper && exportWrapper.contains(targetSelect)) {
        appendTarget = exportWrapper;
    }

    if (appendTarget.nextSibling) {
        appendTarget.parentNode.insertBefore(wrapper, appendTarget.nextSibling);
    } else {
        appendTarget.parentNode.appendChild(wrapper);
    }

    let selectedIndex = -1;

    // --- Event Delegation for Results List ---
    resultsList.addEventListener("click", function (e) {
        const li = e.target.closest("li");
        if (!li) return;

        const index = parseInt(li.getAttribute("data-index"), 10);
        if (isNaN(index)) return;

        if (li.featureData) {
            selectSite(li.featureData);
            input.value = li.textContent;
            resultsList.style.display = "none";
        }
    });

    resultsList.addEventListener("mouseover", function (e) {
        const li = e.target.closest("li");
        if (!li) return;
        // clear previous selected
        const current = resultsList.querySelector("li[style*='background-color: yellow']");
        if (current) current.style.backgroundColor = "transparent";

        const currentClass = resultsList.querySelector(".selected");
        if (currentClass) currentClass.classList.remove("selected");

        li.style.backgroundColor = "Yellow";

        const all = resultsList.querySelectorAll("li");
        for (let i = 0; i < all.length; i++) {
            if (all[i] === li) {
                selectedIndex = i;
                break;
            }
        }
    });

    resultsList.addEventListener("mouseleave", function () {
        const current = resultsList.querySelector("li[style*='background-color: yellow']");
        if (current) current.style.backgroundColor = "transparent";
        selectedIndex = -1;
    });

    function updateSelection(items) {
        items.forEach(function (item, index) {
            if (index === selectedIndex) {
                item.style.backgroundColor = "Yellow";
                item.scrollIntoView({ block: "nearest" });
            } else {
                item.style.backgroundColor = "transparent";
            }
        });
    }

    input.addEventListener("keydown", function (e) {
        const items = resultsList.querySelectorAll("li");
        if (items.length === 0) return;

        if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
            e.preventDefault();
            selectedIndex++;
            if (selectedIndex >= items.length) selectedIndex = 0;
            updateSelection(items);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            selectedIndex--;
            if (selectedIndex < 0) selectedIndex = items.length - 1;
            updateSelection(items);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < items.length) {
                items[selectedIndex].click();
            } else {
                const val = input.value;
                if (!val) return;

                const f = getSearchableData();
                for (let i = 0; i < f.length; i++) {
                    const p = f[i].properties;
                    if (!p) continue;

                    const state = p.state || "";
                    const aqs = p.AQS_O3 || p.AQS || "";
                    const name = p.site_name || p.name || "";

                    let displayString = "";
                    if (state) displayString += "[" + state + "] ";
                    if (name) displayString += name + " ";
                    if (aqs) displayString += "(" + aqs + ")";
                    if (!displayString) displayString = "Unknown Site";

                    if (displayString === val) {
                        selectSite(f[i]);
                        input.setAttribute("autocomplete", "off");
                        resultsList.style.display = "none";
                        return;
                    }
                }
            }
        }
    });

    input.addEventListener("focus", function () {
        if (input.value.length === 0) {
            input.setAttribute("autocomplete", "on");
        }
    });

    input.addEventListener("input", function (e) {
        const query = e.target.value.trim().toLowerCase();

        if (query.length > 0) {
            input.setAttribute("autocomplete", "off");
        } else {
            input.setAttribute("autocomplete", "on");
        }

        selectedIndex = -1;

        if (query.length === 0) {
            resultsList.style.display = "none";
            return;
        }

        const f = getSearchableData();
        const matches = [];
        for (let i = 0; i < f.length; i++) {
            if (matches.length >= MAX_RESULTS) break;

            const p = f[i].properties;
            if (!p) continue;

            const state = (p.state || "").toLowerCase();
            const aqs = (p.AQS_O3 || p.AQS || "").toString().toLowerCase();
            const name = (p.site_name || p.name || "").toLowerCase();

            let display = "";
            if (p.state) display += "[" + p.state + "] ";
            if (p.site_name || p.name) display += (p.site_name || p.name) + " ";
            if (p.AQS_O3 || p.AQS) display += "(" + (p.AQS_O3 || p.AQS) + ")";
            const displayLower = display.toLowerCase();

            if (state.includes(query) || aqs.includes(query) || name.includes(query) || displayLower.includes(query)) {
                matches.push({
                    feature: f[i],
                    display: {
                        state: p.state,
                        aqs: p.AQS_O3 || p.AQS,
                        name: p.site_name || p.name
                    }
                });
            }
        }

        renderResults(matches, query, resultsList);
    });

    input.addEventListener("change", function (e) {
        const val = e.target.value;
        if (!val) return;

        const f = getSearchableData();
        for (let i = 0; i < f.length; i++) {
            const p = f[i].properties;
            if (!p) continue;

            const state = p.state || "";
            const aqs = p.AQS_O3 || p.AQS || "";
            const name = p.site_name || p.name || "";

            let displayString = "";
            if (state) displayString += "[" + state + "] ";
            if (name) displayString += name + " ";
            if (aqs) displayString += "(" + aqs + ")";
            if (!displayString) displayString = "Unknown Site";

            if (displayString === val) {
                selectSite(f[i]);
                resultsList.style.display = "none";
                return;
            }
        }
    });

    document.addEventListener("click", function (e) {
        if (!wrapper.contains(e.target)) {
            resultsList.style.display = "none";
        }
    });
}

function renderResults(matches, query, listElement) {
    listElement.innerHTML = "";
    if (matches.length === 0) {
        listElement.style.display = "none";
        return;
    }

    const fragment = document.createDocumentFragment();

    matches.forEach(function (match, idx) {
        const li = document.createElement("li");
        Object.assign(li.style, {
            padding: "0.4rem 0.6rem",
            cursor: "pointer",
            borderBottom: "0.1rem solid var(--border-soft)",
            fontSize: "1.6rem"
        });

        li.setAttribute("data-index", idx);
        li.featureData = match.feature;

        let text = "";
        // ... (omitted)
        if (match.display.state) text += "[" + match.display.state + "] ";
        if (match.display.name) text += match.display.name + " ";
        if (match.display.aqs) text += "(" + match.display.aqs + ")";
        if (!text) text = "Unknown Site";

        li.innerHTML = highlightText(text, query);
        fragment.appendChild(li);
    });

    listElement.appendChild(fragment);
    listElement.style.display = "block";
}

function selectSite(f) {
    if (!f || !f.geometry || !f.geometry.coordinates) return;

    const select = document.getElementById("MapDataSelect");
    const coords = f.geometry.coordinates;
    let sourceKey = null;
    if (select) {
        const dataset = select.value;
        sourceKey = DATASET_SOURCE_MAP[dataset] || dataset;
    }

    if (highlightLocation) {
        highlightLocation(coords, f.properties, sourceKey);
    }
}

function init() {
    function updateVisibility() {
        const searchWrapper = document.getElementById("SiteSearchWrapper");
        if (!searchWrapper) return;

        const checkboxes = document.querySelectorAll("input[type=checkbox][id^='layer-']");
        let hasActiveLayer = false;
        const EXCLUDED = ExcludeLayerGroups.searchSite;

        for (let i = 0; i < checkboxes.length; i++) {
            const cb = checkboxes[i];
            const shortId = cb.id.replace("layer-", "");
            if (EXCLUDED.includes(shortId)) continue;

            if (cb.checked) {
                hasActiveLayer = true;
                break;
            }
        }

        if (hasActiveLayer) {
            searchWrapper.style.display = "block";
        } else {
            searchWrapper.style.display = "none";
        }
    }

    function setupCheckboxListeners() {
        const checkboxes = document.querySelectorAll("input[type=checkbox][id^='layer-']");
        checkboxes.forEach(function (cb) {
            cb.addEventListener("change", updateVisibility);
        });
    }

    if (document.getElementById("MapDataSelect")) {
        injectSearchUI();
        setupCheckboxListeners();
        updateVisibility();
    } else {
        const observer = new MutationObserver(function (mutations, obs) {
            if (document.getElementById("MapDataSelect")) {
                obs.disconnect();
                injectSearchUI();
                setupCheckboxListeners();
                updateVisibility();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
}

// Auto-init
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

