function injectScript(file_path, tag) {
    var node = document.getElementsByTagName(tag)[0];
    var script = document.createElement('script');
    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src', file_path);
    node.appendChild(script);
}

// Inject script to run in the page's context
injectScript(chrome.runtime.getURL('injected.js'), 'body');
let googVisitorId;

// Listen for the custom event from the injected script
window.addEventListener("visitorDataEvent", function (event) {
    if (event.detail && event.detail.visitorData) {
        console.log("Found VISITOR_DATA:", event.detail.visitorData);
        googVisitorId = event.detail.visitorData;
    }
});


async function createInitialQueuePlaylist() {
    // helper function to wait for an element to appear in the DOM
    function waitForElement(selector, getAll = false, timeout = 1000) {
        return new Promise((resolve, reject) => {
            const elements = document.querySelectorAll(selector);
            if (elements.length) {
                resolve(getAll ? elements : elements[0]);
                return;
            }

            const observer = new MutationObserver((mutations) => {
                const elements = document.querySelectorAll(selector);
                if (elements.length) {
                    observer.disconnect();
                    resolve(getAll ? elements : elements[0]);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Timeout after specified duration
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }

    // Chain of actions using async/await pattern
    async function executeQueueSequence() {
        try {
            //#contents is a valid CSS ID selector that targets a specific element with the id="contents".

            // Step 1: Find and click the more actions button
            const moreActionsButton = await waitForElement(`
                #items button[aria-label="More actions"],
                #items button.yt-spec-button-shape-next--icon-button[aria-label="More actions"],
                #items button[aria-label="More actions"][class*="yt-spec-button-shape-next"]
            `.trim());

            console.log("More actions button found:", moreActionsButton);
            moreActionsButton.click();

            // Step 2: Wait for menu to appear and click "Add to queue"
            const addToQueueButton = await waitForElement(`
[role="menuitem"][tabindex="0"]
            `.trim());
            console.log("Add to queue button found:", addToQueueButton);
            addToQueueButton.click();

            // Step 3: wait for 2nd video in the new queue to appear; this is where we can get the queue ID
            const queueVideoElement = await waitForElement(`
                a#wc-endpoint[href]
            `.trim(), false, 5000);
 
            console.log("Queue video element found:", queueVideoElement);
            if (!queueVideoElement?.href) {
                throw new Error("Queue video element not found or does not have a valid href.");
            }

            return getListId(queueVideoElement.href); // Return the href of the queue video element

        } catch (error) {
            console.error('Error in queue sequence:', error);
        }
    }

    return executeQueueSequence();
};

function getListId(url) {
    const start = url.indexOf('&list=');
    if (start === -1) {
        throw new Error("Could not find playlist ID in the URL: " + url);
    }

    const end = url.indexOf('&', start + 1);
    if (end === -1) {
        throw new Error("Could not find playlist ID in the URL: " + url);
    }

    // Extract the string between '&list=' and the next '&'
    return url.substring(start + 6, end);
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in content script:", request);



    if (request.action === "addToQueue") {
        createInitialQueuePlaylist().then((newQueueId) => {
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
                    "context": {
                        //will want to replace every part of the client object with the actual values
                        "client": {
                            "hl": "en",
                            "gl": "US",
                            "deviceMake": "Apple",
                            "deviceModel": "",
                            "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36,gzip(gfe)",
                            "clientName": "WEB",
                            "clientVersion": "2.20250803.10.00",
                            "osName": "Macintosh",
                            "osVersion": "10_15_7",
                            "originalUrl": "https://www.youtube.com/watch?v=g_NrnWD9wVw",
                            "acceptHeader": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                        },
                        "user": {
                            "lockedSafetyMode": false
                        },
                        "request": {
                            "useSsl": true
                        }
                    },
                    "actions": [
                        request.videos.map(videoId => ({
                            "addedVideoId": videoId,
                            "action": "ACTION_ADD_VIDEO"
                        }))
                    ],
                    "playlistId": newQueueId
                }),
                "method": "POST",
                "mode": "cors",
                "credentials": "include"
            }).then((_) => {
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }).catch((error) => {
                console.error("Error creating playlist:", error);
            });
        }).catch((error) => {
            console.error("Error creating queue:", error);
            sendResponse({ status: "error", message: error.message });
        });
    }
});