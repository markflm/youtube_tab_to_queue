function injectScript(file_path, tag) {
    var node = document.getElementsByTagName(tag)[0];
    var script = document.createElement('script');
    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src', file_path);
    node.appendChild(script);
}

// inject script to run in the page's context
injectScript(chrome.runtime.getURL('activeTabInjected.js'), 'body');

// global vars to hold page-specific values
let googVisitorId;
let clientVersion;
let hl
let gl;
let finalVideoInQueue;

// listen for the custom event from the injected script
window.addEventListener("pageValues", function (event) {
    if (event.detail) {
        googVisitorId = event.detail.visitorData;
        clientVersion = event.detail.clientVersion;
        hl = event.detail.hl;
        gl = event.detail.gl;

    }
});



async function timeoutHack(ms = 1000) {
    // kill time waiting for something to appear on the page
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

// helper function to wait for an element to appear in the DOM
async function waitForElement(selector, getAll = false, timeout = 1000) {
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

async function createInitialQueuePlaylist() {

    async function executeQueueSequence() {
        try {
            //#contents is a valid CSS ID selector that targets a specific element with the id="contents".

            //Step 0: check if a queue already exists
            const originalQueueVideoElements = await waitForElement(`
                a#wc-endpoint[href]
            `.trim(), true, 1000).catch((error) => {
                console.warn("No existing queue found");
                return [];
            });
            console.debug("Queue video elements found:", originalQueueVideoElements);

            // Step 1: Find and click the more actions button
            const moreActionsButton = await waitForElement(`
                #contents #items button[aria-label="More actions"],
                #contents #items button.yt-spec-button-shape-next--icon-button[aria-label="More actions"],
                #contents #items button[aria-label="More actions"][class*="yt-spec-button-shape-next"]
            `.trim());

            moreActionsButton.click();


            // Step 2: Wait for menu to appear and click "Add to queue"
            const addToQueueButton = await waitForElement(`
[role="menuitem"][tabindex="0"]
            `.trim(), false, 3000);
            console.debug("Add to Queue button found:", addToQueueButton);
            addToQueueButton.click();

            // Step 3: wait for 2nd video in the new queue to appear; this is where we can get the queue ID
            const queueVideoElement = await waitForElement(`
                a#wc-endpoint[href]
            `.trim(), false, 5000);

            if (!queueVideoElement?.href) {
                throw new Error("Queue video element not found or does not have a valid href.");
            }

            // hack - sleep for 3 seconds if there were already queue videos present. Give the added video time to appear so the xpath finds the right one
            if (originalQueueVideoElements.length >= 1) {
                console.debug("Pre-existing queue detected - waiting 3 seconds for the queue to update...");
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            try {
                // maybe more brittle than the css selector but w/e
                const xpath = "/html/body/ytd-app/div[1]/ytd-page-manager/ytd-watch-flexy/div[5]/div[2]/div/ytd-playlist-panel-renderer/div/div[3]/ytd-playlist-panel-video-renderer[last()]/div/ytd-menu-renderer/yt-icon-button/button";
                const result = document.evaluate(
                    xpath,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                );
                finalVideoInQueue = result.singleNodeValue;
            }
            catch (error) {
                console.error("Error finding final video in queue 3-dot element:", error);
                finalVideoInQueue = null;
            }

            await timeoutHack(2000); // wait a bit to ensure the href is fully updated
            return getListId(queueVideoElement.href);

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

async function makeEditCall(playlistId, videoIds, request) {
    return fetch("https://www.youtube.com/youtubei/v1/browse/edit_playlist?prettyPrint=false", {
        "headers": {
            "accept": "*/*",
            "cache-control": "no-cache",
            "content-type": "application/json",
            "pragma": "no-cache",
            "priority": "u=1, i",
            "sec-fetch-mode": "same-origin",
            "sec-fetch-site": "same-origin",
            "x-goog-authuser": "1",
            "x-goog-visitor-id": googVisitorId,
            "x-origin": "https://www.youtube.com",
            "x-youtube-client-version": request.clientVersion || "2.20250803.10.00",
        },
        "referrer": "https://www.youtube.com",
        "referrerPolicy": "origin-when-cross-origin",
        "body": JSON.stringify({
            "context": {
                //will want to replace every part of this client object with the actual values where possible
                "client": {
                    "hl": hl,
                    "gl": gl,
                    "clientName": "WEB",
                    "clientVersion": request.clientVersion || "2.20250803.10.00", // hard required
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
            "actions":
                [...new Set(request.videos)].map(videoId => ({
                    "addedVideoId": videoId,
                    "action": "ACTION_ADD_VIDEO"
                }))
            ,
            "playlistId": playlistId
        }),
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
    })
}


chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "addToQueue") {
        let playlistId = null;
        //do we have a valid queue already?
        //Step 0: check if a queue already exists
        const originalQueueVideoElements = await waitForElement(`
                a#wc-endpoint[href]
            `.trim(), true, 1000).catch((error) => {
            console.warn("No existing queue found");
            return [];
        });
        console.debug("Queue video elements found:", originalQueueVideoElements);

        if (originalQueueVideoElements.length >= 1) {
            console.debug("Pre-existing queue detected - getting queue ID");
            const queueVideoElement = await waitForElement(`
                a#wc-endpoint[href]
            `.trim(), false, 5000);

            if (!queueVideoElement?.href) {
                throw new Error("Queue video element not found or does not have a valid href.");
            }
            playlistId = getListId(queueVideoElement.href);
            await makeEditCall(playlistId, request.videos, request).catch((error) => {
                console.error("Error adding videos to existing queue:", error);
            });

            // Step 1: Find and click the more actions button
            const moreActionsButton = await waitForElement(`
                yt-lockup-metadata-view-model button[aria-label="More actions"],
                yt-lockup-metadata-view-model button.yt-spec-button-shape-next--icon-button[aria-label="More actions"],
                yt-lockup-metadata-view-model button[aria-label="More actions"][class*="yt-spec-button-shape-next"]
            `.trim());

            moreActionsButton.click();


            // Step 2: Wait for menu to appear and click "Add to queue"
            const addToQueueButton = await waitForElement(`
[role="menuitem"][tabindex="0"]
            `.trim(), false, 3000);
            console.debug("Add to Queue button found:", addToQueueButton);
            addToQueueButton.click();
            console.debug("3 second timeout hack")
            await timeoutHack(3000); // wait a bit to ensure the added video has appeared

            try {
                // maybe more brittle than the css selector but w/e
                const xpath = "/html/body/ytd-app/div[1]/ytd-page-manager/ytd-watch-flexy/div[5]/div[2]/div/ytd-playlist-panel-renderer/div/div[3]/ytd-playlist-panel-video-renderer[last()]";
                const result = document.evaluate(
                    xpath,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                );
                finalVideoInQueue = result.singleNodeValue;
                console.log("Final video in queue found:", finalVideoInQueue);
            }
            catch (error) {
                console.error("Error finding final video in queue:", error);
                finalVideoInQueue = null;
            }

            if (finalVideoInQueue) {
                const newElementBefore = document.createElement('div');
                newElementBefore.textContent = "This video was added to the queue to facilitate a queue refresh. YouTube won't allow us to remove it automatically, but you can";
                const styles = {
                    color: 'red',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    marginBottom: '10px',
                }
                for (const property in styles) {
                    newElementBefore.style[property] = styles[property];
                }
                finalVideoInQueue.before(newElementBefore);
                         await timeoutHack(500); // wait a tick
                finalVideoInQueue.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
            else {
                console.debug("No pre-existing queue found, creating a new one");

            // Step 1: Find and click the more actions button
            const moreActionsButton = await waitForElement(`
                yt-lockup-metadata-view-model button[aria-label="More actions"],
                yt-lockup-metadata-view-model button.yt-spec-button-shape-next--icon-button[aria-label="More actions"],
                yt-lockup-metadata-view-model button[aria-label="More actions"][class*="yt-spec-button-shape-next"]
            `.trim());

            moreActionsButton.click();


            // Step 2: Wait for menu to appear and click "Add to queue"
            const addToQueueButton = await waitForElement(`
[role="menuitem"][tabindex="0"]
            `.trim(), false, 3000);
            console.debug("Add to Queue button found:", addToQueueButton);
            addToQueueButton.click();
            console.debug("3 second timeout hack")
            await timeoutHack(3000); // wait a bit to ensure the added video has appeared

            // get the playlist ID from the queue video element
            const queueVideoElement = await waitForElement(`
                a#wc-endpoint[href]
            `.trim(), false, 5000);

            if (!queueVideoElement?.href) {
                throw new Error("Queue video element not found or does not have a valid href.");
            }
            playlistId = getListId(queueVideoElement.href);

            try {
                // maybe more brittle than the css selector but w/e
                const xpath = "/html/body/ytd-app/div[1]/ytd-page-manager/ytd-watch-flexy/div[5]/div[2]/div/ytd-playlist-panel-renderer/div/div[3]/ytd-playlist-panel-video-renderer[last()]";
                const result = document.evaluate(
                    xpath,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                );
                finalVideoInQueue = result.singleNodeValue;
                console.log("Final video in queue found:", finalVideoInQueue);
            }
            catch (error) {
                console.error("Error finding final video in queue:", error);
                finalVideoInQueue = null;
            }
            await makeEditCall(playlistId, request.videos, request).catch((error) => {
                console.error("Error adding videos to existing queue:", error);
            });
await timeoutHack(2500); // wait a bit for edit playlist request to process in the background

window.location.reload();
            if (finalVideoInQueue) {
                const newElementBefore = document.createElement('div');
                newElementBefore.textContent = "This video was added to the queue to facilitate a queue refresh. YouTube won't allow us to remove it automatically, but you can";
                const styles = {
                    color: 'red',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    marginBottom: '10px',
                }
                for (const property in styles) {
                    newElementBefore.style[property] = styles[property];
                }
                finalVideoInQueue.before(newElementBefore);
                         await timeoutHack(500); // wait a tick
                finalVideoInQueue.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            }
        }
        else {
            console.error("Unknown action received in content script:", request.action);
        }
    }
);