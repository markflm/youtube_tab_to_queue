// Function to inject a script into the page
function injectScript(file_path, tag) {
    var node = document.getElementsByTagName(tag)[0];
    var script = document.createElement('script');
    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src', file_path);
    node.appendChild(script);
}

// Inject our script to run in the page's context
injectScript(chrome.runtime.getURL('injected.js'), 'body');
let googVisitorId;

// Listen for the custom event from the injected script
window.addEventListener("visitorDataEvent", function(event) {
    if (event.detail && event.detail.visitorData) {
        console.log("Found VISITOR_DATA:", event.detail.visitorData);
        googVisitorId = event.detail.visitorData;
    }
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in content script:", request);


    console.log("Google Visitor ID:", googVisitorId);
    fetch("https://www.youtube.com/youtubei/v1/browse/edit_playlist?prettyPrint=false", {
  "headers": {
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.9",
    // doesn't seem necessary, but leaving it commented out for now
   // "authorization": "="",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "pragma": "no-cache",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Google Chrome\";v=\"137\", \"Chromium\";v=\"137\", \"Not/A)Brand\";v=\"24\"",
    "sec-ch-ua-arch": "\"arm\"",
    "sec-ch-ua-bitness": "\"64\"",
    "sec-ch-ua-form-factors": "\"Desktop\"",
    "sec-ch-ua-full-version": "\"137.0.7151.121\"",
    "sec-ch-ua-full-version-list": "\"Google Chrome\";v=\"137.0.7151.121\", \"Chromium\";v=\"137.0.7151.121\", \"Not/A)Brand\";v=\"24.0.0.0\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": "\"\"",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-ch-ua-platform-version": "\"15.5.0\"",
    "sec-ch-ua-wow64": "?0",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "same-origin",
    "sec-fetch-site": "same-origin",
    // "x-client-data": "CIe2yQEIpbbJAQipncoBCNH2ygEIlKHLAQiGoM0BCP2lzgEI3dbOAQij8s4BCJL2zgEImPfOARjQ+s4B",
    "x-goog-authuser": "1",
    "x-goog-visitor-id": googVisitorId,
    "x-origin": "https://www.youtube.com",
    "x-youtube-bootstrap-logged-in": "true",
    "x-youtube-client-name": "1",
    "x-youtube-client-version": "2.20250803.10.00"
  },
  "referrer": "https://www.youtube.com/watch?v=g_NrnWD9wVw",
  "referrerPolicy": "origin-when-cross-origin",
  "body": JSON.stringify({
   "context":{
      "client":{
         "hl":"en",
         "gl":"US",
         "deviceMake":"Apple",
         "deviceModel":"",
         "userAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36,gzip(gfe)",
         "clientName":"WEB",
         "clientVersion":"2.20250803.10.00",
         "osName":"Macintosh",
         "osVersion":"10_15_7",
         "originalUrl":"https://www.youtube.com/watch?v=g_NrnWD9wVw",
 "acceptHeader":"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      },
      "user":{
         "lockedSafetyMode":false
      },
      "request":{
         "useSsl":true
      }
   },
   "actions":[
      {
         "addedVideoId":"WK2JDPZbu1Q",
         "action":"ACTION_ADD_VIDEO"
      }
   ],
   "playlistId":"TLPQMDYwODIwMjXCk7hMyS1v_w"
}),
  "method": "POST",
  "mode": "cors",
  "credentials": "include"
}).then((res) => {
  console.log("Fetch response:", res);
}).catch((error) => {
  console.error("Error creating playlist:", error);
});
  if (request.action === "addToQueue") {
    // You would need to refine these selectors based on YouTube's current DOM structure
    // This is a simplified example of the logic you'd need.
    request.videos.forEach(videoId => {
      const videoElement = document.querySelector(`a[href*="v=${videoId}"]`);
      console.log("Processing video ID:", videoId, videoElement);
      if (videoElement) {
        // Find the 'three-dot menu' button next to the video
        const menuButton = videoElement.closest('ytd-compact-video-renderer, ytd-rich-grid-video-renderer')
                                     ?.querySelector('yt-icon-button');

                                     console.log("Menu button found:", menuButton);
        if (menuButton) {
          menuButton.click();
          // Wait for the menu to open and find the "Add to queue" button
          setTimeout(() => {
            const addToQueueButton = document.querySelector('ytd-menu-service-item-renderer #text:contains("Add to queue")');
            if (addToQueueButton) {
              addToQueueButton.click();
            }
          }, 500); // Wait for half a second for the menu to render
        }
      }
    });
  }
});