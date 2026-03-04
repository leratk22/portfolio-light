(function () {
  var FORM_SELECTOR = "form.framer-iiob8";
  var AJAX_ENDPOINT = "https://formsubmit.co/ajax/leratk22@gmail.com";
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

  function patchForm() {
    var originalForm = document.querySelector(FORM_SELECTOR);
    if (!originalForm || originalForm.dataset.formOverrideApplied === "1") {
      return;
    }

    // Replace node to remove Framer runtime listeners bound to the original form.
    var form = originalForm.cloneNode(true);
    form.dataset.formOverrideApplied = "1";
    form.setAttribute("novalidate", "novalidate");

    clearHoneypots(form);

    var submitContainer = form.querySelector(".framer-1s43u42-container");
    var statusEl = makeStatusElement();
    if (submitContainer && submitContainer.parentNode) {
      submitContainer.parentNode.appendChild(statusEl);
    } else {
      form.appendChild(statusEl);
    }

    form.addEventListener(
      "submit",
      function (event) {
        event.preventDefault();

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

        var buttons = form.querySelectorAll('button[type="submit"]');
        buttons.forEach(function (button) {
          button.disabled = true;
        });

        setStatus(statusEl, "Отправляю сообщение...", "info");

        var payload = new FormData();
        payload.append("name", nameValue);
        payload.append("email", emailValue);
        payload.append("message", messageValue);
        payload.append("_subject", "New message from portfolio contact form");
        payload.append("_captcha", "false");
        payload.append("_template", "table");

        fetch(AJAX_ENDPOINT, {
          method: "POST",
          body: payload,
          headers: {
            Accept: "application/json"
          }
        })
          .then(function (response) {
            return response.json().catch(function () {
              return {};
            });
          })
          .then(function (data) {
            var ok = String(data.success).toLowerCase() === "true";
            var message = String(data.message || "");

            if (ok) {
              form.reset();
              setStatus(statusEl, "Сообщение отправлено. Спасибо!", "success");
              return;
            }

            if (message.toLowerCase().indexOf("activation") !== -1) {
              setStatus(
                statusEl,
                "Форма не активирована. Проверь email leratk22@gmail.com (включая Спам) и нажми ссылку Activate Form от FormSubmit.",
                "error"
              );
              return;
            }

            setStatus(statusEl, "Не удалось отправить сообщение. Попробуй еще раз чуть позже.", "error");
          })
          .catch(function () {
            setStatus(statusEl, "Ошибка отправки. Проверь интернет и попробуй снова.", "error");
          })
          .finally(function () {
            buttons.forEach(function (button) {
              button.disabled = false;
            });
          });
      },
      { capture: true }
    );

    originalForm.replaceWith(form);
  }

  window.addEventListener("load", function () {
    window.setTimeout(patchForm, 0);
  });
})();
