/* ==========================================================================
   Elements
   ========================================================================== */
const display = document.querySelector("#display");
const keypad = document.querySelector(".button");
const calculator = document.querySelector(".calculator");
const themeToggler = document.querySelector(".theme-toggler");

/* ==========================================================================
   State & constants
   ========================================================================== */
const OPERATORS = ["+", "-", "*", "/"];
const MESSAGE_TIME = 2000; // how long messages stay on screen (ms)

const MESSAGES = {
  empty: "Empty!",
  divideByZero: "Divide by 0!",
  invalid: "Invalid input",
};

let expression = ""; // what the user has typed so far
let showingResult = false; // true right after "=" is pressed
let messageTimer = null;

class CalcError extends Error {}

/* ==========================================================================
   Display helpers
   ========================================================================== */
function render(text = expression) {
  display.textContent = text;
  display.scrollLeft = display.scrollWidth; // keep the latest input in view
}

function showMessage(text) {
  render(text);
  messageTimer = setTimeout(() => render(), MESSAGE_TIME);
}

/* ==========================================================================
   Safe expression evaluator (replaces eval)
   Supports: + - * / ( ) decimals and a leading minus, e.g. -(2+3)*4
   ========================================================================== */
function evaluate(input) {
  const tokens = input.match(/\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[-+*/()]/g);

  // Reject anything that isn't made only of valid tokens
  if (!tokens || tokens.join("") !== input) {
    throw new CalcError(MESSAGES.invalid);
  }

  let position = 0;
  const peek = () => tokens[position];
  const next = () => tokens[position++];

  // expression = term (("+" | "-") term)*
  function parseExpression() {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const operator = next();
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  // term = factor (("*" | "/") factor)*
  function parseTerm() {
    let value = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const operator = next();
      const right = parseFactor();
      if (operator === "*") {
        value *= right;
      } else {
        if (right === 0) throw new CalcError(MESSAGES.divideByZero);
        value /= right;
      }
    }
    return value;
  }

  // factor = number | "(" expression ")" | "-" factor
  function parseFactor() {
    const token = next();

    if (token === "-") return -parseFactor();

    if (token === "(") {
      const value = parseExpression();
      if (next() !== ")") throw new CalcError(MESSAGES.invalid);
      return value;
    }

    const number = Number(token);
    if (Number.isNaN(number)) throw new CalcError(MESSAGES.invalid);
    return number;
  }

  const result = parseExpression();
  if (position < tokens.length) throw new CalcError(MESSAGES.invalid);
  return result;
}

/* ==========================================================================
   Input rules
   ========================================================================== */
const lastChar = () => expression.slice(-1);
const currentNumber = () => expression.match(/[\d.]*$/)[0];

function addDigit(digit) {
  if (lastChar() === ")") return; // no implicit multiplication like (2)3

  // Replace a lone "0" so we never get numbers like 007
  if (currentNumber() === "0") expression = expression.slice(0, -1);

  expression += digit;
}

function addDecimal() {
  if (lastChar() === ")") return;

  const current = currentNumber();
  if (current.includes(".")) return; // only one decimal point per number

  expression += current === "" ? "0." : ".";
}

function addOperator(operator) {
  const last = lastChar();
  const nothingToTheLeft = expression === "" || last === "(";

  // Only a leading minus is allowed here, e.g. "-5" or "(-5)"
  if (nothingToTheLeft) {
    if (operator === "-") expression += operator;
    return;
  }

  if (OPERATORS.includes(last)) {
    const beforeLast = expression.slice(-2, -1);
    const lastIsLeadingMinus = beforeLast === "" || beforeLast === "(";
    if (lastIsLeadingMinus) return;

    // Two operators in a row: the newest one replaces the old one
    expression = expression.slice(0, -1) + operator;
    return;
  }

  expression += operator;
}

function addOpenBracket() {
  const last = lastChar();
  const allowed = expression === "" || OPERATORS.includes(last) || last === "(";
  if (allowed) expression += "(";
}

function addCloseBracket() {
  const open = (expression.match(/\(/g) || []).length;
  const close = (expression.match(/\)/g) || []).length;
  const last = lastChar();

  if (open <= close) return; // nothing to close
  if (OPERATORS.includes(last) || last === "(") return; // nothing inside yet

  expression += ")";
}

/* ==========================================================================
   Actions
   ========================================================================== */
function calculate() {
  if (expression === "") {
    showMessage(MESSAGES.empty);
    return;
  }

  try {
    const result = evaluate(expression);

    // Round to 12 significant digits so 0.1 + 0.2 shows 0.3, not 0.30000000000000004
    expression = String(Number(result.toPrecision(12)));
    showingResult = true;
    render();
  } catch (error) {
    showMessage(error instanceof CalcError ? error.message : MESSAGES.invalid);
  }
}

function handleInput(id) {
  clearTimeout(messageTimer);

  if (id === "equal") {
    calculate();
    return;
  }

  if (id === "clear") {
    expression = "";
    showingResult = false;
  } else if (id === "backspace") {
    expression = expression.slice(0, -1);
    showingResult = false;
  } else {
    // After a result: an operator continues from it, anything else starts fresh
    if (showingResult) {
      showingResult = false;
      if (!OPERATORS.includes(id) && id !== ")") expression = "";
    }

    if (OPERATORS.includes(id)) addOperator(id);
    else if (id === ".") addDecimal();
    else if (id === "(") addOpenBracket();
    else if (id === ")") addCloseBracket();
    else addDigit(id);
  }

  render();
}

/* ==========================================================================
   Events: mouse / touch
   ========================================================================== */
keypad.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button) handleInput(button.id);
});

/* ==========================================================================
   Events: keyboard
   ========================================================================== */
const KEY_MAP = {
  Enter: "equal",
  "=": "equal",
  Backspace: "backspace",
  Escape: "clear",
  Delete: "clear",
};

const ACTION_IDS = new Set(["equal", "backspace", "clear"]);

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target === themeToggler) return; // the toggler handles its own keys

  const id = KEY_MAP[event.key] ?? event.key;
  const isCalculatorKey = ACTION_IDS.has(id) || /^[0-9+\-*/.()]$/.test(id);

  if (isCalculatorKey) {
    event.preventDefault(); // stops Enter from also "clicking" a focused button
    handleInput(id);
  }
});

/* ==========================================================================
   Theme toggle
   ========================================================================== */
function toggleTheme() {
  const isDark = calculator.classList.toggle("dark");
  themeToggler.classList.toggle("active", isDark);
  themeToggler.setAttribute("aria-pressed", String(isDark));
}

themeToggler.setAttribute(
  "aria-pressed",
  String(calculator.classList.contains("dark")),
);

themeToggler.addEventListener("click", toggleTheme);

themeToggler.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    toggleTheme();
  }
});
