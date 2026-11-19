(function () {
  "use strict";

  function tokenize(source) {
    const tokens = [];
    let position = 0;
    const pattern = /\s*(?:(\d+(?:\.\d*)?|\.\d+)|([+\-*/]))/y;

    while (position < source.length) {
      pattern.lastIndex = position;
      const match = pattern.exec(source);
      if (!match) throw new Error("Check the expression and try again.");
      tokens.push(match[1] !== undefined
        ? { type: "number", value: Number(match[1]) }
        : { type: "operator", value: match[2] });
      position = pattern.lastIndex;
    }

    return tokens;
  }

  function evaluateExpression(source) {
    const tokens = tokenize(source);
    if (tokens.length === 0) throw new Error("Enter an expression first.");
    let index = 0;

    function parsePrimary() {
      const token = tokens[index];
      if (token && token.type === "operator" && (token.value === "+" || token.value === "-")) {
        index += 1;
        const value = parsePrimary();
        return token.value === "-" ? -value : value;
      }
      if (!token || token.type !== "number") throw new Error("Check the expression and try again.");
      index += 1;
      return token.value;
    }

    function parseTerm() {
      let value = parsePrimary();
      while (tokens[index] && tokens[index].type === "operator" && (tokens[index].value === "*" || tokens[index].value === "/")) {
        const operator = tokens[index].value;
        index += 1;
        const right = parsePrimary();
        if (operator === "/" && right === 0) throw new Error("Cannot divide by zero.");
        value = operator === "*" ? value * right : value / right;
      }
      return value;
    }

    function parseExpression() {
      let value = parseTerm();
      while (tokens[index] && tokens[index].type === "operator" && (tokens[index].value === "+" || tokens[index].value === "-")) {
        const operator = tokens[index].value;
        index += 1;
        const right = parseTerm();
        value = operator === "+" ? value + right : value - right;
      }
      return value;
    }

    const result = parseExpression();
    if (index !== tokens.length || !Number.isFinite(result)) {
      throw new Error("Check the expression and try again.");
    }
    return result;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { evaluateExpression };
  }
  if (typeof document === "undefined") return;

  const display = document.getElementById("display");
  const message = document.getElementById("message");
  const keypad = document.querySelector(".keypad");
  let expression = "";
  let showingResult = false;

  function render() {
    display.textContent = expression ? expression.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−") : "0";
  }

  function appendDigit(digit) {
    if (showingResult) expression = "";
    showingResult = false;
    message.textContent = "";
    expression += digit;
    render();
  }

  function appendOperator(operator) {
    if (showingResult) showingResult = false;
    message.textContent = "";
    if (!expression) {
      if (operator !== "-") return;
      expression = "-";
    } else if (/[+\-*/]$/.test(expression)) {
      const trailingOperators = expression.match(/[+\-*/]+$/)[0];
      if (operator === "-" && trailingOperators.length === 1 && trailingOperators !== "-") {
        expression += operator;
      } else {
        expression = expression.slice(0, -trailingOperators.length) + operator;
      }
    } else {
      expression += operator;
    }
    render();
  }

  function appendDecimal() {
    if (showingResult) expression = "";
    showingResult = false;
    message.textContent = "";
    const currentNumber = expression.split(/[+\-*/]/).pop();
    if (currentNumber.includes(".")) return;
    expression += currentNumber === "" ? "0." : ".";
    render();
  }

  function calculate() {
    if (!expression) return;
    try {
      const result = evaluateExpression(expression);
      expression = String(Number(result.toPrecision(12)));
      display.textContent = expression;
      message.textContent = "";
      showingResult = true;
    } catch (error) {
      message.textContent = error.message;
      showingResult = false;
    }
  }

  function clear() {
    expression = "";
    showingResult = false;
    message.textContent = "";
    render();
  }

  function backspace() {
    if (showingResult) return clear();
    expression = expression.slice(0, -1);
    message.textContent = "";
    render();
  }

  keypad.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.digit !== undefined) appendDigit(button.dataset.digit);
      else if (button.dataset.operator) appendOperator(button.dataset.operator);
      else if (button.dataset.action === "decimal") appendDecimal();
      else if (button.dataset.action === "equals") calculate();
      else if (button.dataset.action === "clear") clear();
      else if (button.dataset.action === "backspace") backspace();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (/^\d$/.test(event.key)) appendDigit(event.key);
    else if (["+", "-", "*", "/"].includes(event.key)) appendOperator(event.key);
    else if (event.key === ".") appendDecimal();
    else if (event.key === "Enter" || event.key === "=") { event.preventDefault(); calculate(); }
    else if (event.key === "Backspace") backspace();
    else if (event.key === "Escape") clear();
  });
  render();
}());
