// Halsa login theme behavior (plan Appendix A). Vanilla, no inline scripts, no dependencies.
// Loaded synchronously in <head> by template.ftl, so the dark-mode class is set before first paint.
(function () {
  'use strict';

  // Dark mode follows the system; these pages have no toggle.
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function applyScheme() {
    document.documentElement.classList.toggle('dark', !!(media && media.matches));
  }
  applyScheme();
  if (media && media.addEventListener) {
    media.addEventListener('change', applyScheme);
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  // OTP inputs: digits only, so a pasted "123 456" or "123-456" still works.
  function setupOtpInputs() {
    document.querySelectorAll('input[data-halsa-otp]').forEach(function (input) {
      input.addEventListener('input', function () {
        var digits = input.value.replace(/\D/g, '');
        var max = Number(input.getAttribute('maxlength')) || digits.length;
        if (digits !== input.value || digits.length > max) {
          input.value = digits.slice(0, max);
        }
      });
    });
  }

  // "Copiar" buttons: copy the text of the element named by data-halsa-copy.
  function setupCopyButtons() {
    document.querySelectorAll('button[data-halsa-copy]').forEach(function (button) {
      var label = button.querySelector('[data-halsa-copy-label]');
      var original = label ? label.textContent : '';
      button.addEventListener('click', function () {
        var source = document.getElementById(button.getAttribute('data-halsa-copy'));
        if (!source || !navigator.clipboard) return;
        var text = source.textContent.replace(/\s+/g, '');
        navigator.clipboard.writeText(text).then(function () {
          if (!label) return;
          label.textContent = button.getAttribute('data-label-done') || original;
          window.setTimeout(function () {
            label.textContent = original;
          }, 2000);
        });
      });
    });
  }

  // Password policy checklist: tick each rule as the user types. The server still validates.
  var RULES = {
    length: function (value, n) {
      return value.length >= n;
    },
    lowerCase: function (value, n) {
      return (value.match(/\p{Ll}/gu) || []).length >= n;
    },
    upperCase: function (value, n) {
      return (value.match(/\p{Lu}/gu) || []).length >= n;
    },
    digits: function (value, n) {
      return (value.match(/\d/g) || []).length >= n;
    },
    specialChars: function (value, n) {
      return (value.match(/[^\p{L}\p{N}\s]/gu) || []).length >= n;
    },
  };

  function setupPolicyHints() {
    document.querySelectorAll('[data-halsa-policy-for]').forEach(function (hint) {
      var input = document.getElementById(hint.getAttribute('data-halsa-policy-for'));
      if (!input) return;
      var items = hint.querySelectorAll('li[data-rule]');
      function update() {
        items.forEach(function (item) {
          var check = RULES[item.getAttribute('data-rule')];
          if (!check) return;
          item.setAttribute(
            'data-met',
            String(check(input.value, Number(item.getAttribute('data-value')))),
          );
        });
      }
      input.addEventListener('input', update);
      update();
    });
  }

  onReady(function () {
    setupOtpInputs();
    setupCopyButtons();
    setupPolicyHints();
  });
})();
