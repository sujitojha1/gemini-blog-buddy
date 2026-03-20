let apiBaseUrl = "http://localhost:8000";

// Load configuration
chrome.storage.local.get("apiBaseUrl", (res) => {
  if (res.apiBaseUrl) apiBaseUrl = res.apiBaseUrl;
});

// Update configuration locally
chrome.storage.onChanged.addListener((changes) => {
  if (changes.apiBaseUrl) {
    apiBaseUrl = changes.apiBaseUrl.newValue;
  }
});

let activeTabId = null;
let trackedTabs = {}; // tabId -> { sourceUrl, totalMs, lastActive }

// Listen for explicitly fired surface messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "track_tab" && msg.tabId && msg.sourceUrl) {
    trackedTabs[msg.tabId] = {
      sourceUrl: msg.sourceUrl,
      totalMs: 0,
      lastActive: msg.tabId === activeTabId ? Date.now() : null
    };
    sendResponse({ status: "tracking_started" });
  }
});

// Calculate explicit timestamp bounds
function updateTimeState() {
  const now = Date.now();
  if (activeTabId && trackedTabs[activeTabId]) {
    const tabEntry = trackedTabs[activeTabId];
    if (tabEntry.lastActive) {
      tabEntry.totalMs += (now - tabEntry.lastActive);
    }
    tabEntry.lastActive = now;
  }
}

// Track user visually focusing between independent browser tabs
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateTimeState();
  if (activeTabId && trackedTabs[activeTabId]) {
    trackedTabs[activeTabId].lastActive = null; // Paused focus
  }
  activeTabId = activeInfo.tabId;
  if (trackedTabs[activeTabId]) {
    trackedTabs[activeTabId].lastActive = Date.now(); // Resumed focus
  }
});

// Dispatch tracking API analytics once tab is closed explicitly or navigated away
function dispatchFeedback(tabId) {
  if (trackedTabs[tabId]) {
    updateTimeState();
    const entry = trackedTabs[tabId];
    
    // Evaluate more than 20 true visually tracked seconds
    const isLike = entry.totalMs >= 20000;
    
    fetch(`${apiBaseUrl}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: entry.sourceUrl, is_like: isLike })
    })
    .then(res => res.json())
    .then(data => console.log("Feedback dispatched:", data))
    .catch(console.error);
    
    delete trackedTabs[tabId];
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  dispatchFeedback(tabId);
});

// Guard data integrity if the user navigates away from the source article inside the tracking tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (trackedTabs[tabId] && changeInfo.url) {
    // If the URL changed noticeably away from the root source domain/link, end tracking
    const oldSource = new URL(trackedTabs[tabId].sourceUrl).hostname;
    try {
      const newUrl = new URL(changeInfo.url);
      if (newUrl.hostname !== oldSource && changeInfo.url !== trackedTabs[tabId].url) {
         dispatchFeedback(tabId);
      }
    } catch(e) {
      dispatchFeedback(tabId);
    }
  }
});
