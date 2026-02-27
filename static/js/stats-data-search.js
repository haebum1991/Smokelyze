
import { ExcludeLayerGroups, DATASET_SOURCE_MAP } from "./layers-def.js";
import { ESML, highlightLocation, clearHighlight } from "./utils.js";
import { loadedGeoJSON } from "./loader.js";

const MAX_RESULTS = 50;

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

function createSearchUIElement(id, labelText, placeholder) {
    const wrapper = document.createElement("div");
    wrapper.id = id;
    Object.assign(wrapper.style, {
        position: "relative",
        width: "100%"
    });

    const label = document.createElement("label");
    label.textContent = labelText;
    Object.assign(label.style, {
        display: "block",
        color: "var(--text-main)"
    });

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
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

    return { wrapper, input, resultsList };
}

/**
 * Generic result renderer
 */
function renderSearchResults(matches, query, listElement, onSelect) {
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

        // Initial highlight for the first item
        if (idx === 0) {
            li.style.backgroundColor = "Yellow";
        }

        const p = match.feature.properties;
        let text = "";
        const label = (match.display.layerLabel || "").trim();
        const state = (match.display.state || "").trim();
        const name = (match.display.name || "Unknown Site").trim();
        const aqs = (match.display.aqs || "").toString().trim();

        if (label) text += "[" + label + "] ";
        if (state) text += "[" + state + "] ";
        text += name;
        if (aqs) text += " (" + aqs + ")";

        li.innerHTML = highlightText(text, query);

        li.addEventListener("click", () => {
            onSelect(match.feature, text);
            listElement.style.display = "none";
        });

        li.addEventListener("mouseover", () => {
            const items = listElement.querySelectorAll("li");
            items.forEach(item => item.style.backgroundColor = "transparent");
            li.style.backgroundColor = "Yellow";
        });

        fragment.appendChild(li);
    });

    listElement.appendChild(fragment);
    listElement.style.display = "block";
}

/**
 * Handle keyboard events for search inputs
 */
function setupKeyboardNavigation(input, listElement) {
    input.addEventListener("keydown", function (e) {
        const items = listElement.querySelectorAll("li");
        if (items.length === 0 || listElement.style.display === "none") return;

        let currentIndex = Array.from(items).findIndex(li => li.style.backgroundColor === "yellow" || li.style.backgroundColor.toLowerCase() === "yellow");

        if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
            e.preventDefault();
            if (currentIndex !== -1) items[currentIndex].style.backgroundColor = "transparent";
            currentIndex = (currentIndex + 1) % items.length;
            items[currentIndex].style.backgroundColor = "Yellow";
            items[currentIndex].scrollIntoView({ block: "nearest" });
        } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
            e.preventDefault();
            if (currentIndex !== -1) items[currentIndex].style.backgroundColor = "transparent";
            currentIndex = (currentIndex - 1 + items.length) % items.length;
            items[currentIndex].style.backgroundColor = "Yellow";
            items[currentIndex].scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter") {
            if (currentIndex !== -1) {
                e.preventDefault();
                items[currentIndex].click();
            }
        } else if (e.key === "Escape") {
            listElement.style.display = "none";
        }
    });
}

// --- Specific Implementation for Published Data ---
function getSearchableDataPublished() {
    if (!loadedGeoJSON) return [];
    const select = document.getElementById("MapDataSelect");
    if (!select) return [];
    const dataset = select.value;
    const sourceKey = DATASET_SOURCE_MAP[dataset] || dataset;
    const geoData = loadedGeoJSON[sourceKey];
    if (!geoData || !geoData.features) return [];
    return geoData.features.map(f => ({ ...f, _sourceKey: sourceKey }));
}

function injectSearchUIPublished() {
    if (document.getElementById("SiteSearchWrapperPublished")) return;
    const targetSelect = document.getElementById("MapDataSelect");
    if (!targetSelect) return;

    const { wrapper, input, resultsList } = createSearchUIElement(
        "SiteSearchWrapperPublished",
        "Site search (name, AQS, ...):",
        "Type to search..."
    );

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
    
    input.parentNode.appendChild(resultsList); // Ensure resultsList is after input
    setupKeyboardNavigation(input, resultsList);
    
    input.addEventListener("input", function (e) {
        const query = e.target.value.trim().toLowerCase();
        if (query.length === 0) {
            resultsList.style.display = "none";
            return;
        }

        const features = getSearchableDataPublished();
        const matches = [];
        for (let i = 0; i < features.length; i++) {
            if (matches.length >= MAX_RESULTS) break;
            const f = features[i];
            const p = f.properties;
            const name = (p.site_name || p.name || "").toLowerCase();
            const aqs = (p.AQS_O3 || p.AQS_PM || p.AQS || "").toString().toLowerCase();
            const state = (p.state || "").toLowerCase();

            if (name.includes(query) || aqs.includes(query) || state.includes(query)) {
                matches.push({
                    feature: f,
                    display: {
                        state: p.state,
                        aqs: p.AQS_O3 || p.AQS_PM || p.AQS,
                        name: p.site_name || p.name
                    }
                });
            }
        }

        renderSearchResults(matches, query, resultsList, (feature, text) => {
            highlightLocation(feature.geometry.coordinates, feature.properties, feature._sourceKey);
            input.value = text;
        });
    });

    document.addEventListener("click", function (e) {
        if (!wrapper.contains(e.target)) {
            resultsList.style.display = "none";
        }
    });
}

// --- Specific Implementation for AirNow Data ---
function getSearchableDataAirNow() {
    if (!loadedGeoJSON) return [];
    const allFeatures = [];
    const airnowCheckboxes = document.querySelectorAll("input[type=checkbox][id^='layer-airnow']");
    airnowCheckboxes.forEach(checkbox => {
        if (!checkbox.checked) return;
        const datasetKey = checkbox.id.replace("layer-", "");
        const sourceKey = DATASET_SOURCE_MAP[datasetKey] || datasetKey;
        const actualKey = Object.keys(loadedGeoJSON).find(key => key.startsWith(sourceKey));
        const geoData = actualKey ? loadedGeoJSON[actualKey] : null;
        const label = checkbox.parentElement?.textContent?.trim() || null;
        if (geoData && geoData.features) {
            geoData.features.forEach(f => {
                allFeatures.push({ ...f, _layerLabel: label, _sourceKey: sourceKey });
            });
        }
    });
    return allFeatures;
}

function injectSearchUIAirNow() {
    const target = document.getElementById("SiteSearchWrapperAirNow");
    if (!target || target.children.length > 0) return;

    const { wrapper, input, resultsList } = createSearchUIElement(
        "SiteSearchInnerWrapperAirNow",
        "Site search (name, AQS, ...):",
        "Type to search..."
    );

    target.appendChild(wrapper);
    setupKeyboardNavigation(input, resultsList);
    
    input.addEventListener("input", function (e) {
        const query = e.target.value.trim().toLowerCase();
        if (query.length === 0) {
            resultsList.style.display = "none";
            return;
        }

        const data = getSearchableDataAirNow();
        const matches = [];
        for (let i = 0; i < data.length; i++) {
            if (matches.length >= MAX_RESULTS) break;
            const f = data[i];
            const p = f.properties;
            const name = (p.site_name || p.name || "").toLowerCase();
            const aqs = (p.AQS_O3 || p.AQS_PM || p.AQS || "").toString().toLowerCase();
            const state = (p.state || "").toLowerCase();
            if (name.includes(query) || aqs.includes(query) || state.includes(query)) {
                matches.push({
                    feature: f,
                    display: {
                        layerLabel: f._layerLabel,
                        state: p.state,
                        aqs: p.AQS_O3 || p.AQS_PM || p.AQS,
                        name: p.site_name || p.name
                    }
                });
            }
        }

        renderSearchResults(matches, query, resultsList, (feature, text) => {
            highlightLocation(feature.geometry.coordinates, feature.properties, feature._sourceKey);
            input.value = text;
        });
    });

    document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) {
            resultsList.style.display = "none";
        }
    });
}

// --- Visibility Management ---
export function updateSearchVisibility() {
    let hasActiveLayer = false;
    let hasActiveAirNow = false;
    
    // 1. Published search visibility
    const searchWrapper = document.getElementById("SiteSearchWrapperPublished");
    if (searchWrapper) {
        const checkboxes = document.querySelectorAll("input[type=checkbox][id^='layer-']");
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
        searchWrapper.style.display = hasActiveLayer ? "block" : "none";
    }

    // 2. AirNow search visibility
    const airnowSearchWrapper = document.getElementById("SiteSearchWrapperAirNow");
    if (airnowSearchWrapper) {
        const airnowCheckboxes = document.querySelectorAll("input[type=checkbox][id^='layer-airnow']");
        for (let i = 0; i < airnowCheckboxes.length; i++) {
            if (airnowCheckboxes[i].checked) {
                hasActiveAirNow = true;
                break;
            }
        }
        airnowSearchWrapper.style.display = hasActiveAirNow ? "block" : "none";
    }
    
    // [Refined] Clear highlight/tooltip if no searchable layers are active
    if (!hasActiveLayer && !hasActiveAirNow) {
        clearHighlight();
    }
}

let isCheckboxIntercepted = false;
function setupGlobalCheckboxObserver() {
    if (isCheckboxIntercepted) return;

    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked");
    if (!descriptor) return;

    Object.defineProperty(HTMLInputElement.prototype, "checked", {
        set(val) {
            descriptor.set.call(this, val);
            if (this.id && this.id.startsWith("layer-")) {
                if (val === false) {
                    updateSearchVisibility();
                }
            }
        },
        get() {
            if (!(this instanceof HTMLInputElement)) {
                return descriptor.get.call(this);
            }
            return descriptor.get.call(this);
        },
        configurable: true,
        enumerable: true
    });
    isCheckboxIntercepted = true;
}

// --- Initialization ---
function init() {
    setupGlobalCheckboxObserver();

    const mapDataExists = !!document.getElementById("MapDataSelect");
    const airnowSearchExists = !!document.getElementById("SiteSearchWrapperAirNow");

    if (mapDataExists || airnowSearchExists) {
        if (mapDataExists) injectSearchUIPublished();
        if (airnowSearchExists) injectSearchUIAirNow();

        // Initial check
        updateSearchVisibility();

        // [Refined] Manual listeners removed to wait for data loading.
        // loaders will call updateSearchVisibility() explicitly when done.
    } else {
        const observer = new MutationObserver(() => {
            const currentPublished = document.getElementById("MapDataSelect");
            const currentAirnow = document.getElementById("SiteSearchWrapperAirNow");

            if (currentPublished) injectSearchUIPublished();
            if (currentAirnow) injectSearchUIAirNow();

            if (currentPublished || currentAirnow) {
                updateSearchVisibility();

                // Manual listeners removed to wait for data loading.

                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

