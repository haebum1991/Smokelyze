
/**
 * 네트워크 통신 엔진: 서버에서 데이터를 가져오고 압축을 해제하며, JSON 구조가 유효한지 검증하는 역할을 담당
 */
 
import * as utils from "./utils.js";
import { auth } from "./fb-init.js";

export async function fetchGeoJSON(url) {
    if (utils.isRecentlyFailed && utils.isRecentlyFailed(url)) return null;

    try {
        const fetchOptions = {};

        // Add Authorization header if user is logged in
        if (auth.currentUser) {
            try {
                const idToken = await auth.currentUser.getIdToken();
                fetchOptions.headers = {
                    "Authorization": `Bearer ${idToken}`
                };
            } catch (tokenError) {
                console.warn("Could not get ID token:", tokenError);
            }
        }

        const res = await fetch(url, fetchOptions);
        if (!res.ok) {
            if (utils.failedUrls) utils.failedUrls.set(url, Date.now());
            return null;
        }

        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        let parsed;
        if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
            const stream = new Response(buffer).body.pipeThrough(new DecompressionStream("gzip"));
            parsed = await new Response(stream).json();
        } else {
            const text = new TextDecoder("utf-8").decode(buffer);
            parsed = JSON.parse(text);
        }

        if (!parsed || typeof parsed !== "object") {
            console.warn("Invalid JSON structure from " + url);
            return null;
        }

        return parsed;
    } catch (e) {
        console.warn("fetchGeoJSON failed for " + url, e);
        return null;
    }
}

