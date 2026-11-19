const form = document.getElementById("converter-form");
const input = document.getElementById("temperature");
const unitSelect = document.getElementById("input-unit");
const error = document.getElementById("input-error");

const celsiusResult = document.getElementById("celsius-result");
const fahrenheitResult = document.getElementById("fahrenheit-result");
const kelvinResult = document.getElementById("kelvin-result");

function formatTemperature(value, unit) {
  if (!Number.isFinite(value)) return "Invalid value";
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return `${rounded.toFixed(2)} ${unit}`;
}

function showError(message) {
  error.textContent = message;
  input.setAttribute("aria-invalid", "true");
  [celsiusResult, fahrenheitResult, kelvinResult].forEach((element) => {
    element.textContent = "—";
    element.classList.remove("invalid");
  });
}

function clearError() {
  error.textContent = "";
  input.removeAttribute("aria-invalid");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const rawValue = input.value.trim();

  if (rawValue === "") {
    showError("Please enter a temperature value.");
    input.focus();
    return;
  }

  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(rawValue)) {
    showError("Please enter a valid numeric temperature.");
    input.focus();
    return;
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    showError("Please enter a finite numeric temperature.");
    return;
  }

  let celsius;
  switch (unitSelect.value) {
    case "fahrenheit":
      celsius = (value - 32) * 5 / 9;
      break;
    case "kelvin":
      celsius = value - 273.15;
      break;
    default:
      celsius = value;
  }

  if (celsius < -273.15) {
    showError("Below absolute zero is not possible (−273.15 °C).");
    [celsiusResult, fahrenheitResult, kelvinResult].forEach((element) => {
      element.textContent = "Absolute zero exceeded";
      element.classList.add("invalid");
    });
    input.focus();
    return;
  }

  clearError();
  const fahrenheit = celsius * 9 / 5 + 32;
  const kelvin = celsius + 273.15;

  celsiusResult.textContent = formatTemperature(celsius, "°C");
  fahrenheitResult.textContent = formatTemperature(fahrenheit, "°F");
  kelvinResult.textContent = formatTemperature(kelvin, "K");
});

input.addEventListener("input", () => {
  if (error.textContent) clearError();
});
