(function () {
  var FORM_SELECTOR = "form.framer-iiob8";
  var AJAX_ENDPOINT = "https://formsubmit.co/ajax/leratk22@gmail.com";
  var FALLBACK_ENDPOINT = "https://formsubmit.co/leratk22@gmail.com";
  var AJAX_TIMEOUT_MS = 10000;
  var AJAX_ATTEMPTS = 2;
  var AJAX_RETRY_DELAY_MS = 600;
  var HONEYPOT_NAMES = [
    "website",
    "company",
    "message",
    "subject",
    "title",
    "description",
    "feedback",
    "notes",
    "details",
    "remarks",
    "comments"
  ];

  function hasHidden(form, name) {
    return !!form.querySelector('input[type="hidden"][name="' + name + '"]');
  }

  function makeStatusElement() {
    var status = document.createElement("div");
    status.setAttribute("aria-live", "polite");
    status.style.marginTop = "12px";
    status.style.fontFamily = "Inter, sans-serif";
    status.style.fontSize = "14px";
    status.style.lineHeight = "1.4";
    status.style.color = "#454545";
    status.style.display = "none";
    return status;
  }

  function setStatus(statusEl, text, kind) {
    statusEl.textContent = text;
    statusEl.style.display = "block";

    if (kind === "success") {
      statusEl.style.color = "#0e7a41";
    } else if (kind === "error") {
      statusEl.style.color = "#b42318";
    } else {
      statusEl.style.color = "#454545";
    }
  }

  function clearHoneypots(form) {
    HONEYPOT_NAMES.forEach(function (name) {
      form.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
        input.remove();
      });
    });
  }

  function stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
  }

  function isSubmitClickForForm(event, form) {
    var target = event.target;
    if (!target || typeof target.closest !== "function") {
      return false;
    }

    var button = target.closest('button[type="submit"], input[type="submit"]');
    return !!button && form.contains(button);
  }

  function buildPayload(nameValue, emailValue, messageValue) {
    var payload = new FormData();
    payload.append("name", nameValue);
    payload.append("email", emailValue);
    payload.append("message", messageValue);
    payload.append("_subject", "New message from portfolio contact form");
    payload.append("_captcha", "false");
    payload.append("_template", "table");
    return payload;
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function postAjax(nameValue, emailValue, messageValue) {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timeoutId = null;

    if (controller) {
      timeoutId = window.setTimeout(function () {
        controller.abort();
      }, AJAX_TIMEOUT_MS);
    }

    return fetch(AJAX_ENDPOINT, {
      method: "POST",
      body: buildPayload(nameValue, emailValue, messageValue),
      headers: {
        Accept: "application/json"
      },
      signal: controller ? controller.signal : undefined
    }).finally(function () {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    });
  }

  function parseAjaxResponse(response) {
    return response
      .json()
      .catch(function () {
        return {};
      })
      .then(function (data) {
        var safeData = data || {};
        var success = String(safeData.success || "").toLowerCase();
        var message = String(safeData.message || "");

        if (isActivationMessage(message)) {
          var activationError = new Error("activation_required");
          activationError.isActivation = true;
          throw activationError;
        }

        if (success === "true" || (response.ok && success !== "false")) {
          return {
            ok: true,
            data: safeData
          };
        }

        throw new Error("ajax_not_confirmed");
      });
  }

  function tryAjaxSubmit(nameValue, emailValue, messageValue) {
    var attempt = 0;

    function runAttempt() {
      attempt += 1;
      return postAjax(nameValue, emailValue, messageValue)
        .then(parseAjaxResponse)
        .catch(function (error) {
          if (error && error.isActivation) {
            throw error;
          }

          if (attempt >= AJAX_ATTEMPTS) {
            throw error;
          }

          return delay(AJAX_RETRY_DELAY_MS).then(runAttempt);
        });
    }

    return runAttempt();
  }

  function submitFallbackForm(nameValue, emailValue, messageValue) {
    return new Promise(function (resolve, reject) {
      if (navigator.onLine === false) {
        reject(new Error("offline"));
        return;
      }

      var iframe = document.createElement("iframe");
      var iframeName = "formsubmit-fallback-" + Date.now();
      iframe.name = iframeName;
      iframe.style.display = "none";
      iframe.setAttribute("aria-hidden", "true");

      var fallbackForm = document.createElement("form");
      fallbackForm.method = "POST";
      fallbackForm.action = FALLBACK_ENDPOINT;
      fallbackForm.target = iframeName;
      fallbackForm.style.display = "none";

      var fields = {
        name: nameValue,
        email: emailValue,
        message: messageValue,
        _subject: "New message from portfolio contact form",
        _captcha: "false",
        _template: "table"
      };

      Object.keys(fields).forEach(function (key) {
        var input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = String(fields[key]);
        fallbackForm.appendChild(input);
      });

      function cleanup() {
        window.setTimeout(function () {
          fallbackForm.remove();
          iframe.remove();
        }, 50);
      }

      iframe.addEventListener(
        "load",
        function () {
          cleanup();
          resolve({ confirmed: true });
        },
        { once: true }
      );

      document.body.appendChild(iframe);
      document.body.appendChild(fallbackForm);

      try {
        fallbackForm.submit();
      } catch (submitError) {
        cleanup();
        reject(submitError);
        return;
      }

      // If cross-origin policies suppress iframe load events, assume fire-and-forget success.
      window.setTimeout(function () {
        cleanup();
        resolve({ confirmed: false });
      }, 1800);
    });
  }

  function isActivationMessage(message) {
    return String(message || "").toLowerCase().indexOf("activation") !== -1;
  }

  function patchForm() {
    var originalForm = document.querySelector(FORM_SELECTOR);
    if (!originalForm || originalForm.dataset.formOverrideApplied === "1") {
      return;
    }

    // Replace node to remove Framer runtime listeners bound to the original form.
    var form = originalForm.cloneNode(true);
    form.dataset.formOverrideApplied = "1";
    form.dataset.customSubmit = "1";
    form.setAttribute("novalidate", "novalidate");
    form.setAttribute("action", "#");
    form.setAttribute("method", "post");
    form.setAttribute("data-fs-form", "custom-contact");

    clearHoneypots(form);

    var submitContainer = form.querySelector(".framer-1s43u42-container");
    var statusEl = makeStatusElement();
    if (submitContainer && submitContainer.parentNode) {
      submitContainer.parentNode.appendChild(statusEl);
    } else {
      form.appendChild(statusEl);
    }

    var isSubmitting = false;

    function submitForm() {
      if (isSubmitting) {
        return;
      }

      var nameInput = form.querySelector('input[name="Name"]');
      var emailInput = form.querySelector('input[name="Email"]');
      var messageInput = form.querySelector('textarea[name="Message"]');

      var nameValue = nameInput ? nameInput.value.trim() : "";
      var emailValue = emailInput ? emailInput.value.trim() : "";
      var messageValue = messageInput ? messageInput.value.trim() : "";

      if (!nameValue || !emailValue || !messageValue) {
        setStatus(statusEl, "Заполни, пожалуйста, имя, email и сообщение.", "error");
        return;
      }

      isSubmitting = true;

      var buttons = form.querySelectorAll('button[type="submit"], input[type="submit"]');
      buttons.forEach(function (button) {
        button.disabled = true;
      });

      setStatus(statusEl, "Отправляю сообщение...", "info");

      tryAjaxSubmit(nameValue, emailValue, messageValue)
        .then(function () {
          form.reset();
          setStatus(statusEl, "Сообщение отправлено. Спасибо!", "success");
        })
        .catch(function (error) {
          if (error && error.isActivation) {
            setStatus(
              statusEl,
              "Форма не активирована. Проверь email leratk22@gmail.com (включая Спам) и нажми ссылку Activate Form от FormSubmit.",
              "error"
            );
            return;
          }

          return submitFallbackForm(nameValue, emailValue, messageValue)
            .then(function (result) {
              form.reset();
              if (result && result.confirmed === false) {
                setStatus(
                  statusEl,
                  "Сообщение отправлено. Если не получу его в течение суток, напиши напрямую: leratk22@gmail.com",
                  "success"
                );
                return;
              }

              setStatus(statusEl, "Сообщение отправлено. Спасибо!", "success");
            })
            .catch(function () {
              setStatus(statusEl, "Ошибка отправки. Проверь интернет и попробуй снова.", "error");
            });
        })
        .finally(function () {
          isSubmitting = false;
          buttons.forEach(function (button) {
            button.disabled = false;
          });
        });
    }

    form.addEventListener(
      "submit",
      function (event) {
        stopEvent(event);
        submitForm();
      },
      { capture: true }
    );

    window.addEventListener(
      "submit",
      function (event) {
        if (event.target === form || (event.target && event.target.dataset && event.target.dataset.customSubmit === "1")) {
          stopEvent(event);
          submitForm();
        }
      },
      true
    );

    window.addEventListener(
      "click",
      function (event) {
        if (isSubmitClickForForm(event, form)) {
          stopEvent(event);
          submitForm();
        }
      },
      true
    );

    originalForm.replaceWith(form);
  }

  window.addEventListener("load", function () {
    window.setTimeout(patchForm, 0);
  });
})();
