
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "show_status" || request.action === "show_result") {
        showGhostToast(request.text, request.action === "show_status");
    }
});

let ghostToast = null;

function showGhostToast(text, isThinking) {

    if (ghostToast) {
        ghostToast.remove();
    }

    ghostToast = document.createElement('div');
    ghostToast.innerText = text;


    Object.assign(ghostToast.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: 'rgba(20, 20, 20, 0.8)',
        color: isThinking ? '#9ca3af' : '#10b981',
        padding: '6px 12px',
        borderRadius: '4px',
        fontSize: '11px',
        fontFamily: 'sans-serif',
        zIndex: '999999',
        pointerEvents: 'none',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        opacity: '0',
        transition: 'opacity 0.3s ease-in-out'
    });

    document.body.appendChild(ghostToast);


    requestAnimationFrame(() => {
        ghostToast.style.opacity = '1';
    });


    if (!isThinking) {
        setTimeout(() => {
            if (ghostToast) {
                ghostToast.style.opacity = '0';
                setTimeout(() => ghostToast.remove(), 300);
            }
        }, 15000);
    }
}
