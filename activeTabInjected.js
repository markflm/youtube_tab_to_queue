// pull values unique to user from the page
if (window.ytcfg && typeof window.ytcfg.get === 'function') {
    const visitorData = window.ytcfg.get('VISITOR_DATA');
    const hl = window.ytcfg.get('HL')
    const gl = window.ytcfg.get('GL')
    const clientVersion = ytInitialPlayerResponse.responseContext.serviceTrackingParams[1].params[2].value;
    if (visitorData) {
        // Dispatch a custom event with the data
        const event = new CustomEvent("pageValues", {
            detail: {
                visitorData: visitorData,
                clientVersion: clientVersion,
                hl: hl || 'en',
                gl: gl || 'US'
            }
        });
        window.dispatchEvent(event);
    }
}