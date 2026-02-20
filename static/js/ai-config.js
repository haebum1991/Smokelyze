
export function initAiConfig() {
    const aiBtnSave = document.getElementById("AiBtnSave");
    const aiApiKeyInput = document.getElementById("AiApiKey");
    const aiMessage = document.getElementById("AiMessage");

    if (!aiBtnSave || !aiApiKeyInput) return;

    // Load saved API Key on init
    const savedKey = localStorage.getItem("smokelyze_gemini_key");
    if (savedKey) {
        aiApiKeyInput.value = savedKey;
    }

    aiBtnSave.addEventListener("click", () => {
        const key = aiApiKeyInput.value.trim();
        if (key) {
            localStorage.setItem("smokelyze_gemini_key", key);
            aiMessage.innerText = "API Key has been securely saved locally!";
            aiMessage.style.color = "lightgreen";

            setTimeout(() => {
                aiMessage.innerText = "";
            }, 3000);
        } else {
            localStorage.removeItem("smokelyze_gemini_key");
            aiMessage.innerText = "API Key has been removed from local storage.";
            aiMessage.style.color = "lightcoral";
        }
    });
}

document.addEventListener("DOMContentLoaded", initAiConfig);

