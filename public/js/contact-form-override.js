(function () {
  var FORM_SELECTOR = "form.framer-iiob8";
  var ENDPOINT = "https://formsubmit.co/leratk22@gmail.com";

  function makeHiddenInput(name, value) {
    var input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    return input;
  }

  function hasHidden(form, name) {
    return !!form.querySelector('input[type="hidden"][name="' + name + '"]');
  }

  function patchForm() {
    var originalForm = document.querySelector(FORM_SELECTOR);
    if (!originalForm || originalForm.dataset.formOverrideApplied === "1") {
      return;
    }

    // Replace node to remove Framer runtime listeners bound to the original form.
    var form = originalForm.cloneNode(true);
    form.dataset.formOverrideApplied = "1";
    form.action = ENDPOINT;
    form.method = "POST";
    form.target = "_blank";
    form.acceptCharset = "UTF-8";

    if (!hasHidden(form, "_subject")) {
      form.appendChild(makeHiddenInput("_subject", "New message from portfolio contact form"));
    }
    if (!hasHidden(form, "_captcha")) {
      form.appendChild(makeHiddenInput("_captcha", "false"));
    }
    if (!hasHidden(form, "_template")) {
      form.appendChild(makeHiddenInput("_template", "table"));
    }

    // Light UX feedback: disable submit briefly to avoid accidental double posts.
    form.addEventListener(
      "submit",
      function () {
        var buttons = form.querySelectorAll('button[type="submit"]');
        buttons.forEach(function (button) {
          button.disabled = true;
        });
        window.setTimeout(function () {
          buttons.forEach(function (button) {
            button.disabled = false;
          });
        }, 2500);
      },
      { capture: true }
    );

    originalForm.replaceWith(form);
  }

  window.addEventListener("load", function () {
    window.setTimeout(patchForm, 0);
  });
})();
