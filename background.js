chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "ANALYZE_IMAGE") {
    fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + request.key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001:free",
        messages: [{ role: "user", content: [
          { type: "text", text: "Реши задачу." },
          { type: "image_url", image_url: { url: request.img } }
        ]}]
      })
    })
    .then(r => r.json())
    .then(data => sendResponse({ data: data.choices[0].message.content }))
    .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});
