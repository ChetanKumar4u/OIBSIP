# Level 2 — Calculator

A responsive four-function calculator built with HTML, CSS Grid, and vanilla JavaScript. Expressions are parsed explicitly; the project does not use `eval()`.

## Features

- Number and decimal input, addition, subtraction, multiplication, and division
- Operator precedence and chained operations
- Clear and backspace controls
- Keyboard support
- Friendly errors for malformed expressions and division by zero
- Accessible live display and responsive keypad

## Run and test

1. Open `index.html` in a browser.
2. Try `5 + 3 × 2 =` (result: `11`), then `C`.
3. Try `8 ÷ 0 =` to see the division-by-zero message.
4. Run the parser checks from the repository root with `node --test WebDev-L2-Calculator/calculator.test.cjs`.
