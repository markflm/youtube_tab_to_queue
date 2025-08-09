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

    if (videoIds.length > 0) {
      await chrome.tabs.sendMessage(activeYoutubeTab.id, {
        action: "addToQueue",
        videos: videoIds
      });
    }

    const tabIdsToRemove = otherYoutubeTabs.map(tab => tab.id);
    await chrome.tabs.remove(tabIdsToRemove);
  }
});