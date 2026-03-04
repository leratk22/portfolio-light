(function () {
  var FORM_SELECTOR = "form.framer-iiob8";
  var AJAX_ENDPOINT = "https://formsubmit.co/ajax/leratk22@gmail.com";
  var FALLBACK_ENDPOINT = "https://formsubmit.co/leratk22@gmail.com";
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

      fetch(AJAX_ENDPOINT, {
        method: "POST",
        body: buildPayload(nameValue, emailValue, messageValue),
        headers: {
          Accept: "application/json"
        }
      })
        .then(function (response) {
          return response
            .json()
            .catch(function () {
              return {};
            })
            .then(function (data) {
              return {
                response: response,
                data: data
              };
            });
        })
        .then(function (result) {
          var data = result.data || {};
          var success = String(data.success || "").toLowerCase();
          var message = String(data.message || "");

          if (isActivationMessage(message)) {
            var activationError = new Error("activation_required");
            activationError.isActivation = true;
            throw activationError;
          }

          if (success === "true" || (result.response.ok && success !== "false")) {
            form.reset();
            setStatus(statusEl, "Сообщение отправлено. Спасибо!", "success");
            return;
          }

          throw new Error("ajax_not_confirmed");
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

          return fetch(FALLBACK_ENDPOINT, {
            method: "POST",
            mode: "no-cors",
            body: buildPayload(nameValue, emailValue, messageValue)
          })
            .then(function () {
              form.reset();
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
