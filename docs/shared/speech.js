(function (global) {
  "use strict";

  const Recognition = global.SpeechRecognition || global.webkitSpeechRecognition;

  function isSupported() {
    return typeof Recognition === "function";
  }

  function create(options) {
    if (!isSupported()) return null;
    const opts = Object.assign(
      {
        lang: "en-US",
        continuous: true,
        interimResults: true,
        maxAlternatives: 1,
        reconnectDelay: 250,
        interimCommitMs: 800,
        maxSilenceMs: 10000,
      },
      options || {}
    );

    let recognition = null;
    let listening = false;
    let desiredActive = false;
    let interimBuffer = "";
    let interimTimer = null;
    let silenceTimer = null;

    function notifyStatus(status, detail) {
      if (typeof opts.onStatus === "function") {
        opts.onStatus(status, detail || {});
      }
    }

    function notifyError(error, detail) {
      if (typeof opts.onError === "function") {
        opts.onError(error, detail || {});
      }
    }

    function resetSilenceTimer() {
      if (!opts.maxSilenceMs || opts.maxSilenceMs <= 0) return;
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        notifyStatus("timeout");
        if (typeof opts.onTimeout === "function") {
          opts.onTimeout();
        }
      }, opts.maxSilenceMs);
    }

    function clearInterimTimer() {
      if (interimTimer) {
        clearTimeout(interimTimer);
        interimTimer = null;
      }
    }

    function commitInterim() {
      clearInterimTimer();
      if (!interimBuffer) return;
      const text = interimBuffer;
      interimBuffer = "";
      if (typeof opts.onInterimCommit === "function") {
        opts.onInterimCommit(text);
      }
    }

    function ensureRecognition() {
      if (recognition) return;
      recognition = new Recognition();
      recognition.lang = opts.lang;
      recognition.interimResults = !!opts.interimResults;
      recognition.continuous = !!opts.continuous;
      recognition.maxAlternatives = opts.maxAlternatives;

      recognition.onstart = function () {
        listening = true;
        resetSilenceTimer();
        notifyStatus("listening");
      };

      recognition.onresult = function (event) {
        let interim = "";
        let receivedFinal = false;
        let lastDetail = null;
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (!result || !result[0]) continue;
          const transcript = String(result[0].transcript || "").trim();
          const detail = {
            confidence: typeof result[0].confidence === "number" ? result[0].confidence : null,
            rawEvent: event,
            resultIndex: i,
          };
          if (result.isFinal) {
            commitInterim();
            if (transcript) {
              receivedFinal = true;
              if (typeof opts.onResult === "function") {
                opts.onResult(transcript, detail);
              }
            }
          } else if (transcript) {
            interim += transcript + " ";
            lastDetail = detail;
          }
        }
        interimBuffer = interim.trim();
        if (interimBuffer) {
          if (typeof opts.onInterim === "function") {
            opts.onInterim(interimBuffer, lastDetail || { rawEvent: event });
          }
          clearInterimTimer();
          interimTimer = setTimeout(() => {
            commitInterim();
          }, opts.interimCommitMs);
        }
        if (receivedFinal) {
          resetSilenceTimer();
        }
      };

      recognition.onerror = function (event) {
        const error = event && event.error ? event.error : "unknown";
        notifyStatus("error", { error });
        notifyError(error, { rawEvent: event });
        if (error === "not-allowed" || error === "service-not-allowed") {
          desiredActive = false;
        }
      };

      recognition.onend = function () {
        listening = false;
        clearInterimTimer();
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
        notifyStatus(desiredActive ? "reconnecting" : "idle");
        if (desiredActive) {
          setTimeout(() => {
            tryStart();
          }, opts.reconnectDelay);
        }
      };
    }

    function tryStart() {
      ensureRecognition();
      if (!recognition || listening) return;
      try {
        recognition.start();
      } catch (err) {
        if (err && err.name === "InvalidStateError") return;
        notifyError(err && err.message ? err.message : err, { exception: err });
      }
    }

    function stop() {
      desiredActive = false;
      clearInterimTimer();
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
      if (recognition) {
        try {
          recognition.stop();
        } catch (err) {
          // ignore stop errors
        }
      }
    }

    return {
      start() {
        desiredActive = true;
        tryStart();
      },
      stop,
      destroy() {
        stop();
        recognition = null;
      },
      commitInterim,
      isListening() {
        return listening;
      },
    };
  }

  global.sharedSpeech = {
    isSupported,
    create,
  };
})(window);
