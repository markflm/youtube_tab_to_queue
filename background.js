chrome.action.onClicked.addListener(async (activeTab) => {
    console.log("Action clicked, processing YouTube tabs...");
  const allTabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });

  if (allTabs.length > 1) {
    const activeYoutubeTab = allTabs.find(tab => tab.active);
    const otherYoutubeTabs = allTabs.filter(tab => !tab.active);

    const videoIds = otherYoutubeTabs.map(tab => {
      // extract the video ID from the URL (e.g., "v=ID")
      const url = new URL(tab.url);
      return url.searchParams.get("v");
    }).filter(id => id); // filter out any tabs without a video ID
console.log("Other youtube tabs found:", otherYoutubeTabs);
 for (const inactive of otherYoutubeTabs) {
  console.log(`Injecting content script into tab ${inactive.id}`);
      await injectContentScript(inactive.id);
    }
    if (videoIds.length > 0) {
      // await chrome.tabs.sendMessage(activeYoutubeTab.id, {
      //   action: "addToQueue",
      //   videos: videoIds
      // });
    }

    // const tabIdsToRemove = otherYoutubeTabs.map(tab => tab.id);
    // await chrome.tabs.remove(tabIdsToRemove);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ytt2p_playerTime') {
    // put it in the extension's storage to reference when content script reloads
    chrome.storage.local.set({ 'ytt2p_playerTime': message.value });
  }
});


async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['inactiveTabInjected.js']
    });
    console.log(`Content script injected into tab ${tabId}`);
  } catch (error) {
    console.error(`Failed to inject content script into tab ${tabId}:`, error);
  }
}