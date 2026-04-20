document.addEventListener('DOMContentLoaded', () => {


    const el = {
        capBtn:        document.getElementById('capBtn'),
        res:           document.getElementById('res'),
        loader:        document.getElementById('ouroboros-loader'),
        loaderText:    document.getElementById('loaderText'),
        groqKey:       document.getElementById('groqKey'),
        geminiKey:     document.getElementById('geminiKey'),
        customPrompt:  document.getElementById('customPrompt'),
        saveBtn:       document.getElementById('saveBtn'),
        tabs:          document.querySelectorAll('.nav-btn'),
        pages:         document.querySelectorAll('.content'),
        historyList:   document.getElementById('historyList'),
        clearHistory:  document.getElementById('clearHistory'),
        navIndicator:  document.getElementById('navIndicator'),
        provBtns:      document.querySelectorAll('.prov-btn'),
        statusDot:     document.getElementById('statusDot'),
        statusText:    document.getElementById('statusText'),
        groqStatus:    document.getElementById('groqStatus'),
        geminiStatus:  document.getElementById('geminiStatus'),
    };

    let activeProvider = 'groq'; // default

    const updateNav = (targetTab) => {
        const activeTab = targetTab || document.querySelector('.nav-btn.active');
        if (!activeTab) return;

        const rect    = activeTab.getBoundingClientRect();
        const navRect = activeTab.parentElement.getBoundingClientRect();
        el.navIndicator.style.transform = `translateY(${rect.top - navRect.top}px)`;

        el.tabs.forEach(t => t.classList.remove('active'));
        activeTab.classList.add('active');

        el.pages.forEach(p => p.classList.remove('active'));
        document.getElementById(activeTab.dataset.tab).classList.add('active');

        if (activeTab.dataset.tab === 'history') renderHistory();
        if (activeTab.dataset.tab === 'config')  loadConfig();
    };

    el.tabs.forEach(btn => btn.addEventListener('click', () => updateNav(btn)));
    setTimeout(() => updateNav(), 60);


    el.provBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            el.provBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeProvider = btn.dataset.provider;
            chrome.storage.local.set({ activeProvider });
            refreshStatusBadge();
        });
    });


    async function refreshStatusBadge() {
        const cfg = await chrome.storage.local.get(['groqKey', 'geminiKey', 'activeProvider']);
        const prov = cfg.activeProvider || activeProvider;

        el.provBtns.forEach(b => {
            b.classList.toggle('active', b.dataset.provider === prov);
        });
        activeProvider = prov;

        const key = prov === 'groq' ? cfg.groqKey : cfg.geminiKey;
        if (key) {
            el.statusDot.className  = 'status-dot ok';
            el.statusText.textContent = prov.toUpperCase() + ' · Key Set';
            el.capBtn.disabled = false;
        } else {
            el.statusDot.className  = 'status-dot err';
            el.statusText.textContent = 'No key for ' + prov.toUpperCase();
            el.capBtn.disabled = true;
        }
    }


    async function loadConfig() {
        const cfg = await chrome.storage.local.get(['groqKey', 'geminiKey', 'customPrompt', 'activeProvider']);

        el.groqKey.value      = cfg.groqKey      || '';
        el.geminiKey.value    = cfg.geminiKey     || '';
        el.customPrompt.value = cfg.customPrompt  || 'Реши кратко.';

        updateKeyStatus(el.groqStatus,   !!cfg.groqKey);
        updateKeyStatus(el.geminiStatus, !!cfg.geminiKey);
    }

    function updateKeyStatus(el, isSet) {
        el.textContent = isSet ? '✓ Key saved' : '✗ Not set';
        el.className   = 'key-status ' + (isSet ? 'set' : 'unset');
    }

    el.saveBtn.addEventListener('click', () => {
        const groqVal   = el.groqKey.value.trim();
        const geminiVal = el.geminiKey.value.trim();
        const prompt    = el.customPrompt.value.trim() || 'Реши кратко.';

        chrome.storage.local.set({
            groqKey:      groqVal   || null,
            geminiKey:    geminiVal || null,
            customPrompt: prompt
        }, () => {
            updateKeyStatus(el.groqStatus,   !!groqVal);
            updateKeyStatus(el.geminiStatus, !!geminiVal);
            el.saveBtn.textContent = '✓ Saved!';
            refreshStatusBadge();
            setTimeout(() => { el.saveBtn.textContent = 'Save Config'; }, 1500);
        });
    });


    el.capBtn.addEventListener('click', async () => {
        const cfg = await chrome.storage.local.get(['groqKey', 'geminiKey', 'customPrompt', 'activeProvider']);
        const prov   = cfg.activeProvider || 'groq';
        const key    = prov === 'groq' ? cfg.groqKey : cfg.geminiKey;
        const prompt = cfg.customPrompt || 'Реши кратко.';

        if (!key) {
            el.res.innerHTML = `<span style="color:#ef4444">Ошибка:</span> Нет ключа для ${prov.toUpperCase()}. Зайди в Env.`;
            return;
        }

        // Show loader
        el.loader.style.display  = 'flex';
        el.capBtn.style.display  = 'none';
        el.res.textContent       = '';
        el.loaderText.textContent = prov === 'groq' ? 'Groq Processing...' : 'Gemini Processing...';

        try {
            // Capture screenshot
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const imgDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

            let resultText;
            if (prov === 'groq') {
                resultText = await callGroq(key, prompt, imgDataUrl);
            } else {
                resultText = await callGemini(key, prompt, imgDataUrl);
            }

            el.res.textContent = resultText;
            await saveToHistory(resultText, prov);

        } catch (err) {
            el.res.innerHTML = `<span style="color:#ef4444">Error [${prov}]:</span> ${err.message}`;
        } finally {
            el.loader.style.display = 'none';
            el.capBtn.style.display = 'block';
        }
    });

    // ── GROQ API ─────────────────────────────────────────────────

    async function callGroq(key, prompt, imgDataUrl) {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-4-scout-17b-16e-instruct',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text',      text: prompt },
                        { type: 'image_url', image_url: { url: imgDataUrl } }
                    ]
                }],
                max_tokens: 1024
            })
        });

        const data = await response.json();

        if (!response.ok) {
            const msg = data?.error?.message || `HTTP ${response.status}`;
            throw new Error(msg);
        }
        if (data.error) throw new Error(data.error.message);

        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error('Empty response from Groq');
        return content;
    }

    // ── GEMINI API ───────────────────────────────────────────────

    async function callGemini(key, prompt, imgDataUrl) {
        // imgDataUrl = "data:image/png;base64,..."
        const base64 = imgDataUrl.split(',')[1];

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: 'image/png', data: base64 } }
                        ]
                    }],
                    generationConfig: { maxOutputTokens: 1024 }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            const msg = data?.error?.message || `HTTP ${response.status}`;
            throw new Error(msg);
        }

        const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) {

            const reason = data?.candidates?.[0]?.finishReason;
            throw new Error(reason ? `Blocked: ${reason}` : 'Empty response from Gemini');
        }
        return content;
    }


    async function saveToHistory(text, provider) {
        const d = await chrome.storage.local.get('history');
        const h = d.history || [];
        const preview = text.length > 120 ? text.substring(0, 120) + '…' : text;
        h.unshift({ text: preview, provider: provider.toUpperCase(), ts: Date.now() });
        await chrome.storage.local.set({ history: h.slice(0, 20) });
    }

    async function renderHistory() {
        const d = await chrome.storage.local.get('history');
        const list = d.history || [];

        if (!list.length) {
            el.historyList.innerHTML = '<div class="hist-empty">DUMP IS EMPTY</div>';
            return;
        }

        el.historyList.innerHTML = list.map(item => {
            const date = new Date(item.ts || 0).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
            const prov = item.provider || '?';
            // Escape HTML to prevent XSS
            const safe = (item.text || item)
                .toString()
                .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            return `<div class="hist-item">
                <div class="hist-meta">${prov} · ${date}</div>
                ${safe}
            </div>`;
        }).join('');
    }

    el.clearHistory.addEventListener('click', () => {
        chrome.storage.local.set({ history: [] }, renderHistory);
    });

    refreshStatusBadge();
});
