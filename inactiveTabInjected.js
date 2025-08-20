// Log tab information for debugging
console.log("=== Inactive Tab Script Injected ===");
console.log("Tab Title:", document.title);
console.log("Tab URL:", window.location.href);
console.log("Tab Domain:", window.location.hostname);
console.log("Tab Pathname:", window.location.pathname);
console.log("User Agent:", navigator.userAgent);
console.log("Timestamp:", new Date().toISOString());
console.log("Document Ready State:", document.readyState);
console.log("=====================================");

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


function getVideoId(url) {
    const start = url.indexOf('?v=');
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



// for detecting if an inactive tab has its own playlist, and if so collecting all the video IDs

waitForElement('a#wc-endpoint[href]', true, 5000)
    .then(videoHrefs => {
        console.log("videoHrefs found:", videoHrefs);
        
        if (videoHrefs && videoHrefs.length > 0) {
            const arrayedList = [...videoHrefs];
            const videoIds = arrayedList.map(href => getVideoId(href.href));
            if (videoIds.length > 0) {
                // Dispatch a custom event with the data
                console.log("dispatching: ", videoIds)
                const event = new CustomEvent("queueVideos", {
                    detail: {
                        videos: videoIds
                    }
                });
                window.dispatchEvent(event);
            }
        }
    })
    .catch((err) => {
        console.error("Error finding videoHrefs:", err);
        console.log("NO videoHrefs found:", null);
    });