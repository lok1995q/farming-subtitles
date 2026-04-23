(function () {
  try {
    const playerResponse = window.ytInitialPlayerResponse;

    const tracklist =
      playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

    window.postMessage(
      {
        source: "YT_PAGE_BRIDGE",
        type: "CAPTION_TRACKS_RESULT",
        payload: tracklist.map((track, index) => ({
          index,
          languageCode: track.languageCode,
          name: track.name?.simpleText || track.name,
          kind: track.kind || "standard",
          vssId: track.vssId,
          baseUrl: track.baseUrl
        }))
      },
      "*"
    );
  } catch (error) {
    window.postMessage(
      {
        source: "YT_PAGE_BRIDGE",
        type: "CAPTION_TRACKS_ERROR",
        payload: String(error)
      },
      "*"
    );
  }
})();