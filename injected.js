if (window.ytcfg && typeof window.ytcfg.get === 'function') {
    const visitorData = window.ytcfg.get("VISITOR_DATA");
    if (visitorData) {
        // Dispatch a custom event with the data
        const event = new CustomEvent("visitorDataEvent", {
            detail: {
                visitorData: visitorData
            }
        });
        window.dispatchEvent(event);
    }
}