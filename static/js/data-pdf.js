
/**
 * PDF Modal Viewer for PWA
 * Provides a modal with close button to view PDFs without getting stuck
 */

function openPDFModal(pdfUrl) {
    // Create modal overlay
    const modal = document.createElement("div");
    modal.id = "pdf-modal";
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: calc(var(--z-highest) + 10);
        display: flex;
        flex-direction: column;
        animation: fadeIn 0.3s ease;
    `;

    // Create header with close button
    const header = document.createElement("div");
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 2rem;
        background: var(--header-grad-start);
        border-bottom: 0.1rem solid var(--card-shadow);
    `;

    const title = document.createElement("span");
    title.textContent = "PDF Viewer";
    title.style.cssText = `
        color: var(--color-white);
        font-size: 1.8rem;
        font-weight: bold;
    `;

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "✕ Close";
    closeBtn.style.cssText = `
        padding: 0.8rem 1.6rem;
        background: var(--card-shadow);
        color: var(--color-bg);
        border: none;
        border-radius: var(--border-radius-0p8rem);
        font-size: 1.6rem;
        font-weight: bold;
        cursor: pointer;
        transition: transform 0.2s ease;
    `;

    closeBtn.onclick = () => {
        modal.style.animation = "fadeOut 0.3s ease";
        setTimeout(() => modal.remove(), 300);
    };

    // Add hover effect for desktop
    if (window.matchMedia("(hover: hover)").matches) {
        closeBtn.onmouseenter = () => {
            closeBtn.style.transform = "scale(1.05)";
        };
        closeBtn.onmouseleave = () => {
            closeBtn.style.transform = "scale(1)";
        };
    }

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Create PDF iframe
    const iframe = document.createElement("iframe");
    iframe.src = pdfUrl;
    iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
        background: white;
    `;

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(iframe);
    document.body.appendChild(modal);

    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === "Escape") {
            closeBtn.click();
            document.removeEventListener("keydown", handleEscape);
        }
    };
    document.addEventListener("keydown", handleEscape);
}

// Add CSS animations
if (!document.getElementById("pdf-modal-styles")) {
    const style = document.createElement("style");
    style.id = "pdf-modal-styles";
    style.textContent = `
        @keyframes fadeIn {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }
        
        @keyframes fadeOut {
            from {
                opacity: 1;
            }
            to {
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Auto-convert PDF links to modal
document.addEventListener("DOMContentLoaded", function () {
    const pdfLinks = document.querySelectorAll("a[href$='.pdf']");

    pdfLinks.forEach(link => {
        // Only convert if target="_blank" (external links)
        if (link.getAttribute("target") === "_blank") {
            link.addEventListener("click", function (e) {
                e.preventDefault();
                openPDFModal(this.href);
            });
        }
    });
});

