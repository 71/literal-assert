/**
 * Throws an exception if the given operator name is invalid.
 */
function ensureOperatorIsValid(operator: string) {
  if (/^[a-zA-Z]+( [a-zA-Z]+)*$/.test(operator)) {
    if (operator === "and" || operator === "or") {
      throw new Error("invalid reserved operator " + operator);
    }

    return;
  }

  if (!/^[^\s."`()[\]{}#]+$/.test(operator)) {
    throw new Error("invalid operator " + operator);
  }

  if (operator === "||" || operator === "&&") {
    throw new Error("invalid reserved operator " + operator);
  }
}

/**
 * Throws an exception if the given function name is invalid.
 */
function ensureFunctionNameIsValid(functionName: string) {
  if (!/^\w+$/.test(functionName)) {
    throw new Error("invalid function name " + functionName);
  }

  if (functionName === "and" || functionName === "or") {
    throw new Error("invalid reserved function name " + functionName);
  }
}

/**
 * Throws an error if the given array has a length different from `this`,
 * which must be a number.
 */
function throwIfLengthIsNot(this: number, args: any[]) {
  if (this !== args.length) {
    throw new Error("expected " + this + " argument(s), but got " + args.length);
  }
}

/**
 * Returns the index of the end of the quote started at `code[-1]` with the
 * given character.
 */
function indexOfEndOfString(code: string, quote: string) {
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];

    if (ch === "\\") {
      // Skip escaped character.
      i++;
    } else if (ch === quote) {
      return i;
    } else if (quote === "`" && ch === "$" && i + 1 < code.length && code[i + 1] === "{") {
      i += indexOfClosingBracket(code.slice(i += 2), "}");
    }
  }

  return code.length;
}

/**
 * Returns the index of the end of the block started at `code[-1]` with the
 * mirror of the given character.
 */
function indexOfClosingBracket(code: string, bracket: string) {
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];

    if (ch === "'" || ch === '"' || ch === "`" || ch === "/") {
      i += indexOfEndOfString(code.slice(++i), ch);
    } else if (ch === "(") {
      i += indexOfClosingBracket(code.slice(++i), ")");
    } else if (ch === "[") {
      i += indexOfClosingBracket(code.slice(++i), "]");
    } else if (ch === "{") {
      i += indexOfClosingBracket(code.slice(++i), "}");
    } else if (ch === bracket) {
      return i;
    }
  }

  return code.length;
}

/**
 * Returns the given string with all ranges between quotes and between
 * brackets replaced by the character `#`. This ensures that user code
 * containing strings and patterns may not conflict with the rather simple
 * parsing strategy we use in `compileAssertion`.
 */
function getStringToParse(code: string) {
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    let len = 0;

    if (ch === '"' || ch === "`" || ch === "/") {
      len = indexOfEndOfString(code.slice(++i), ch);
    } else if (ch === "'" && /[^a-zA-Z]/.test(code[i - 1])) {
      len = indexOfEndOfString(code.slice(++i), ch);
    } else if (ch === "(") {
      len = indexOfClosingBracket(code.slice(++i), ")");
    } else if (ch === "[") {
      len = indexOfClosingBracket(code.slice(++i), "]");
    } else if (ch === "{") {
      len = indexOfClosingBracket(code.slice(++i), "}");
    } else {
      continue;
    }

    code = code.slice(0, i) + "#".repeat(len) + code.slice(i + len);
    i += len;
  }

  return code;
}

/**
 * Returns the number of groups in the given `RegExp`.
 */
function countGroups(re: RegExp) {
  return new RegExp(" |" + re.source, re.flags).exec(" ")!.length - 1;
}

/**
 * Returns a string allowing a `RegExp` to match the given string.
 */
function escapeForRegExp(text: string) {
  // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Attemps to map groups in the given match to the text in the given string.
 */
function mapRegExpMatch(match: RegExpExecArray, to: string) {
  to = to.substr(match.index, match[0].length);

  const matches = [to];

  for (let from = match[0], i = 1; i < match.length; i++) {
    if (match[i] === undefined) {
      continue;
    }

    const start = from.indexOf(match[i]);

    to = to.slice(start);
    from = from.slice(start);

    matches.push(to.slice(0, match[i].length));
  }

  return matches;
}

/**
 * Returns a new RegExp that can match the given name wrapped inside the given
 * prefix and suffix.
 */
function extendRegExp(previousRegExp: RegExp, pattern: string) {
  if (previousRegExp.source === "^ ") {
    return new RegExp(pattern);
  }

  return new RegExp(pattern + "|" + previousRegExp.source);
}

/**
 * Returns a new array that is the concatenation of the specified element
 * repeated `count` times and of the given array.
 */
function extendWithRepeated<T>(array: readonly T[], item: T, count: number) {
  const copy = [];

  for (let i = 0; i < count; i++) {
    copy.push(item);
  }

  copy.push(...array);

  return copy;
}

/**
 * Like `String.prototype.split(RegExp)`, but returns the [start, end]
 * indices corresponding to each string of the split.
 */
function splitRange(text: string, re: RegExp) {
  const sections: [start: number, end: number][] = [];

  for (let start = 0;;) {
    const match = re.exec(text);

    if (match === null) {
      sections.push([start, start + text.length]);

      return sections;
    }

    sections.push([start, match.index]);

    text = text.slice(match.index + match[0].length);
    start += match.index + match[0].length;
  }
}

type AssertionFunction<Arguments extends readonly any[]>
  = (values: Arguments, valueStrings: readonly string[]) => AssertionResult;
type ValidationFunction
  = (values: readonly string[], operatorOrNameMatch: readonly string[]) => void;

type BinaryOperatorInfo
  = readonly [validateArguments: ValidationFunction | undefined,
              re: RegExp, f: AssertionFunction<[left: any, ...right: any[]]>];
type FunctionInfo
  = readonly [validateArguments: ValidationFunction | undefined,
              f: AssertionFunction<[...args: any[]]>];
type UnaryOperatorInfo
  = readonly [validateArgument: ValidationFunction | undefined,
              f: AssertionFunction<[operand: any]>];
type CustomPattern
  = (match: readonly string[], embedValue: (value: any) => string) => string;

type Pattern = CustomPattern | BinaryOperatorInfo | FunctionInfo | UnaryOperatorInfo;

interface PatternsDictionary {
  readonly patterns: readonly Pattern[];
  readonly regExp: RegExp;
}

/**
 * Compiles the given strings into a JavaScript function that can be used to
 * check that the condition they represent is true.
 */
function compileAssertion(patterns: PatternsDictionary, strings: TemplateStringsArray) {
  const args = Array.from({ length: strings.length - 1 }, (_, i) => `_[${i}]`),
        code = String.raw(strings, ...args).trim(),
        codeToParse = getStringToParse(code),
        calledFunctions: AssertionFunction<any[]>[] = [],
        conjunctions: string[][] = [];

  for (const [conjStart, conjEnd] of splitRange(codeToParse, / +(\|\||or) +/g)) {
    const conditions: string[] = [],
          conjToParse = codeToParse.slice(conjStart, conjEnd);

    for (const [condStartRel, condEndRel] of splitRange(conjToParse, / +(&&|and) +/g)) {
      const condStart = conjStart + condStartRel,
            condEnd = conjStart + condEndRel,
            cond = code.slice(condStart, condEnd),
            condToParse = codeToParse.slice(condStart, condEnd),
            match = patterns.regExp.exec(condToParse);

      if (match === null) {
        throw new Error("condition does not correspond to any pattern: " + cond);
      }

      const patternIndex = match.findIndex((group, i) => group !== undefined && i > 0) - 1,
            patternInfo = patterns.patterns[patternIndex],
            operatorOrNameMatch = mapRegExpMatch(match, cond).slice(1);

      if (typeof patternInfo === "function") {
        // Custom pattern.
        const code = patternInfo(operatorOrNameMatch, (value) => {
          let index = calledFunctions.indexOf(value);

          if (index === -1) {
            index = calledFunctions.push(value) - 1;
          }

          return `this[${index}]`;
        });

        conditions.push(code);
        continue;
      }

      let funcToCall: AssertionFunction<any>,
          argsCode: string[];

      if (patternInfo.length === 2) {
        const [validate, func] = patternInfo;

        if (match[0].startsWith(" ")) {
          // Postfix operator.
          const argCode = cond.slice(0, match.index);

          argsCode = [argCode];
        } else if (match[0].endsWith(" ")) {
          // Prefix operator.
          const argCode = cond.slice(match[0].length);

          argsCode = [argCode];
        } else {
          // Function.
          const argsToParse = condToParse.slice(match[0].length, condToParse.length - 1),
                argsRanges = splitRange(argsToParse, / *, */g),
                diff = match[0].length;

          argsCode = argsRanges.map(([start, end]) => cond.slice(diff + start, diff + end));
        }

        validate?.(argsCode, operatorOrNameMatch);
        funcToCall = func;
      } else {
        // Binary operator.
        const [validate, re, func] = patternInfo,
              subcondRanges = splitRange(condToParse, re);

        argsCode = subcondRanges.map(([start, end]) => cond.slice(start, end));

        validate?.(argsCode, operatorOrNameMatch);
        funcToCall = func;
      }

      let calledFunctionIndex = calledFunctions.indexOf(funcToCall);

      if (calledFunctionIndex === -1) {
        calledFunctionIndex = calledFunctions.length;
        calledFunctions.push(funcToCall);
      }

      const argsCodeString = argsCode.join(", "),
            argsCodeJsonString = argsCodeString === "..._"
              ? JSON.stringify([cond])
              : JSON.stringify([cond, ...argsCode]);

      conditions.push(`this[${calledFunctionIndex}]([${argsCodeString}], ${argsCodeJsonString})`);
    }

    conjunctions.push(conditions);
  }

  let body = "const errors = [];\n\n";

  for (let i = 0; i < conjunctions.length; i++) {
    body += "try {\n";

    for (const disjunction of conjunctions[i]) {
      body += "  " + disjunction + ";\n";
    }

    body += "  return;\n";
    body += "} catch (e) {\n";
    body += "  errors.push(e);\n";
    body += "}\n\n";
  }

  body += "throw errors[0];\n";

  const func = new Function("_", body).bind(calledFunctions);

  return func as (args: any[]) => void;
}

/**
 * Returns a function of type `Assert` that uses the given object to parse
 * conditions.
 */
function makeAssert(assertions: PatternsDictionary): Assert {
  const cache = new WeakMap<TemplateStringsArray, (args: any[]) => void>();

  function assert(strings: TemplateStringsArray, ...args: any[]) {
    let func = cache.get(strings);

    if (func === undefined) {
      cache.set(strings, func = compileAssertion(assertions, strings));
    }

    func(args);
  }

  return Object.assign(assert, {
    source(strings: TemplateStringsArray) {
      let func = cache.get(strings);

      if (func === undefined) {
        cache.set(strings, func = compileAssertion(assertions, strings));
      }

      const code = func.toString(),
            body = code.slice(code.indexOf("{") + 2, code.length - 1);

      return body;
    },

    withFunction(
      name: string | RegExp,
      validateArguments: PatternFunction<"f()"> | number | ValidationFunction | undefined,
      handler?: PatternFunction<"f()">,
    ) {
      if (handler === undefined) {
        handler = validateArguments as any;
        validateArguments = undefined;
      } else if (typeof validateArguments === "number") {
        validateArguments = throwIfLengthIsNot.bind(validateArguments);
      }

      let numberOfGroups: number,
          pattern: RegExp;

      if (typeof name === "string") {
        ensureFunctionNameIsValid(name);

        numberOfGroups = 1;
        pattern = new RegExp("^(" + escapeForRegExp(name) + ")\\(.+\\)$");
      } else {
        numberOfGroups = 1 + countGroups(name);
        pattern = new RegExp("^(" + name.source + ")\\(.+\\)$", name.flags);
      }

      const funcInfo = [
        validateArguments as ValidationFunction,
        handler as AssertionFunction<any[]>,
      ] as const;

      return makeAssert({
        patterns: extendWithRepeated(assertions.patterns, funcInfo, numberOfGroups),
        regExp: extendRegExp(assertions.regExp, pattern.source),
      });
    },

    withInfixOperator(
      operator: string | RegExp,
      validateArguments: PatternFunction<"_ + _"> | ValidationFunction | undefined,
      handler?: PatternFunction<"_ + _">,
    ) {
      if (handler === undefined) {
        handler = validateArguments as any;
        validateArguments = undefined;
      }

      let numberOfGroups: number,
          pattern: RegExp;

      if (typeof operator === "string") {
        ensureOperatorIsValid(operator);

        numberOfGroups = 1;
        pattern = new RegExp(" +(" + escapeForRegExp(operator) + ") +");
      } else {
        numberOfGroups = 1 + countGroups(operator);
        pattern = new RegExp(" +(" + operator.source + ") +", operator.flags);
      }

      const operatorInfo = [
        validateArguments as ValidationFunction,
        pattern,
        handler as AssertionFunction<[any, ...any[]]>,
      ] as const;

      return makeAssert({
        patterns: extendWithRepeated(assertions.patterns, operatorInfo, numberOfGroups),
        regExp: extendRegExp(assertions.regExp, pattern.source),
      });
    },

    withPrefixOperator(
      operator: string | RegExp,
      validateArgument: PatternFunction<"+ _"> | ValidationFunction | undefined,
      handler?: PatternFunction<"+ _">,
    ) {
      if (handler === undefined) {
        handler = validateArgument as any;
        validateArgument = undefined;
      }

      let numberOfGroups: number,
          pattern: RegExp;

      if (typeof operator === "string") {
        ensureOperatorIsValid(operator);

        numberOfGroups = 1;
        pattern = new RegExp("^(" + escapeForRegExp(operator) + ") +");
      } else {
        numberOfGroups = 1 + countGroups(operator);
        pattern = new RegExp("^(" + operator.source + ") +", operator.flags);
      }

      const operatorInfo = [
        validateArgument as ValidationFunction,
        handler as AssertionFunction<[any]>,
      ] as const;

      return makeAssert({
        patterns: extendWithRepeated(assertions.patterns, operatorInfo, numberOfGroups),
        regExp: extendRegExp(assertions.regExp, pattern.source),
      });
    },

    withPostfixOperator(
      operator: string | RegExp,
      validateArgument: PatternFunction<"_ +"> | ValidationFunction | undefined,
      handler?: PatternFunction<"_ +">,
    ) {
      if (handler === undefined) {
        handler = validateArgument as any;
        validateArgument = undefined;
      }

      let numberOfGroups: number,
          pattern: RegExp;

      if (typeof operator === "string") {
        ensureOperatorIsValid(operator);

        numberOfGroups = 1;
        pattern = new RegExp(" +(" + escapeForRegExp(operator) + ")$");
      } else {
        numberOfGroups = 1 + countGroups(operator);
        pattern = new RegExp(" +(" + operator.source + ")$", operator.flags);
      }

      const operatorInfo = [
        validateArgument as ValidationFunction,
        handler as AssertionFunction<[any]>,
      ] as const;

      return makeAssert({
        patterns: extendWithRepeated(assertions.patterns, operatorInfo, numberOfGroups),
        regExp: extendRegExp(assertions.regExp, pattern.source),
      });
    },

    withPattern(
      pattern: RegExp | string,
      handler: AssertionFunction<any>
            | ((match: readonly string[], embedValue: (value: any) => string) => string),
    ) {
      if (typeof pattern !== "string") {
        const numberOfGroups = 1 + countGroups(pattern);

        pattern = new RegExp("^(" + pattern.source + ")$", pattern.flags);

        return makeAssert({
          patterns: extendWithRepeated(assertions.patterns, handler as any, numberOfGroups),
          regExp: extendRegExp(assertions.regExp, pattern.source),
        });
      }

      let match: RegExpExecArray | null;

      if (match = /^_ ([a-zA-Z ]+|\S+?)( _| \.\.\.|)$/.exec(pattern)) {
        const [_, operator, rest] = match;

        if (rest === " ...") {
          return this.withInfixOperator(operator, handler as AssertionFunction<[any, ...any[]]>);
        }

        if (rest === "") {
          return this.withPostfixOperator(operator, handler as AssertionFunction<[any]>);
        }

        return this.withInfixOperator(operator, throwIfLengthIsNot.bind(2),
                                      handler as AssertionFunction<[any, any]>);
      } else if (match = /^(\S+)(\((?:\.\.\.|\w+(, *\w+)*)?\)| _)$/.exec(pattern)) {
        const [_, name, rest] = match;

        if (!rest.startsWith("(")) {
          return this.withPrefixOperator(name, handler as AssertionFunction<[any]>);
        }

        if (rest === "...") {
          return this.withFunction(name, handler as AssertionFunction<any[]>);
        }

        const argsCount = rest === "" ? 0 : rest.split(/, */g).length;

        return this.withFunction(name, argsCount, handler as AssertionFunction<any[]>);
      } else {
        throw new Error("invalid pattern: " + pattern);
      }
    },
  });
}

/**
 * Forbidden characters and strings in operators.
 */
type Forbidden = '"' | "`" | "(" | ")" | "[" | "]" | "{" | "}" | "&&" | "||" | "and" | "or" | " _ ";

/**
 * Allowed characters in identifiers.
 */
type Identifier = "_" | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
                | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m"
                | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z"
                | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M"
                | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";

/**
 * Returns the type `Then` if `String` only contains strings in `Allowed`, and
 * `Else` otherwise.
 */
type IfAll<Allowed extends string, String extends string, Then, Else = never>
  = String extends ""
    ? Then
    : String extends `${Allowed}${infer Rest}` ? IfAll<Allowed, Rest, Then, Else> : Else;

/**
 * Returns the type `Then` if `Needle` is in `Haystack`, and `Else` otherwise.
 */
type IfAny<Needle extends string, Haystack extends string, Then, Else = never>
  = Haystack extends `${string}${Needle}${string}` ? Then : Else;

/**
 * Return type of an assertion: `void`. Assertions don't return anything, and
 * throw an error if they fail.
 */
type AssertionResult = void;

/**
 * Maps a pattern given to `assert.withPattern` into the type of the
 * corresponding function.
 */
export type PatternFunction<T extends string>
  = T extends `${infer FunctionName}(${infer Arguments})`
      ? IfAll<Identifier, FunctionName,
              IfAll<Identifier | " " | ",", Arguments, AssertionFunction<[...args: any[]]>>>
  : T extends `_ ${infer Operator} ...`
      ? IfAny<Forbidden, Operator, never, AssertionFunction<[left: any, ...right: any[]]>>
  : T extends `_ ${infer Operator} _`
      ? IfAny<Forbidden, Operator, never, AssertionFunction<[left: any, right: any]>>
  : T extends `_ ${infer Operator}`
      ? IfAny<Forbidden, Operator, never, AssertionFunction<[operand: any]>>
  : T extends `${infer Operator} _`
      ? IfAny<Forbidden, Operator, never, AssertionFunction<[operand: any]>>
  : never;

/**
 * The type of the `assert` function.
 *
 * `assert` takes a [JavaScript template literal](
 * https://developer.mozilla.org/docs/Web/JavaScript/Reference/Template_literals)
 * string as input, and ensures that the condition it describes is `true`.
 *
 * The string must contain conditions defined with the `withPattern` function,
 * which can be further grouped in conjunctions and disjunctions. For instance,
 * the string `a && b || c && d` (which may also be written
 * `a and b or c and d`) is interpreted as `(a && b) || (c && d)`. Do note that
 * parenthesized expressions are not supported.
 *
 * @see assert
 */
export interface Assert {
  (strings: TemplateStringsArray, ...args: any[]): void;

  /**
   * Returns the source string of the function that will perform the assertion,
   * useful for debugging what was generated.
   */
  source(strings: TemplateStringsArray, ...args: unknown[]): string;

  /**
   * Equivalent to `withFunction(name, () => {}, handler)`.
   *
   * @see withFunction
   */
  withFunction(
    name: string | RegExp,
    handler: PatternFunction<"f()">,
  ): Assert;

  /**
   * Returns a new `assert` function where conditions matching a call to a
   * function with the given name are checked by the given function.
   *
   * `validateArguments` will be called when a new condition is parsed with an
   * array of strings, each of which corresponds to the source code of a given
   * argument. If these arguments are invalid, an exception should be raised.
   *
   * @see withPattern
   */
  withFunction(
    name: string | RegExp,
    validateArguments: number | ValidationFunction,
    handler: PatternFunction<"f()">,
  ): Assert;

  /**
   * Equivalent to `withInfixOperator(operator, () => {}, handler)`.
   *
   * @see withInfixOperator
   */
  withInfixOperator(
    operator: string | RegExp,
    handler: PatternFunction<"_ + _">,
  ): Assert;

  /**
   * Returns a new `assert` function where conditions matching a pattern of the
   * type `<lhs> <operator> <rhs>` are checked by the given function. The
   * operator may appear multiple times, in which case the given function will
   * be called with more than two arguments in its array.
   *
   * `validateArguments` will be called when a new condition is parsed with an
   * array of strings, each of which corresponds to the source code of a given
   * argument. If these arguments are invalid, an exception should be raised.
   *
   * @see withPattern
   */
  withInfixOperator(
    operator: string | RegExp,
    validateArguments: ValidationFunction,
    handler: PatternFunction<"_ + _">,
  ): Assert;

  /**
   * Equivalent to `withPrefixOperator(operator, () => {}, handler)`.
   *
   * @see withPrefixOperator
   */
  withPrefixOperator(
    operator: string | RegExp,
    handler: PatternFunction<"+ _">,
  ): Assert;

  /**
   * Returns a new `assert` function where conditions matching a pattern of the
   * type `<operator> <operand>` are checked by the given function.
   *
   * `validateArgument` will be called when a new condition is parsed with an
   * array with a single string which corresponds to the source code of the
   * given argument. If this argument is invalid, an exception should be raised.
   *
   * @see withPattern
   */
  withPrefixOperator(
    operator: string | RegExp,
    validateArgument: ValidationFunction,
    handler: PatternFunction<"+ _">,
  ): Assert;

  /**
   * Equivalent to `withPostfixOperator(operator, () => {}, handler)`.
   *
   * @see withPostfixOperator
   */
  withPostfixOperator(
    operator: string | RegExp,
    handler: PatternFunction<"_ +">,
  ): Assert;

  /**
   * Returns a new `assert` function where conditions matching a pattern of the
   * type `<operand> <operator>` are checked by the given function.
   *
   * `validateArgument` will be called when a new condition is parsed with an
   * array with a single string which corresponds to the source code of the
   * given argument. If this argument is invalid, an exception should be raised.
   *
   * @see withPattern
   */
  withPostfixOperator(
    operator: string | RegExp,
    validateArgument: ValidationFunction,
    handler: PatternFunction<"_ +">,
  ): Assert;

  /**
   * Returns a new `assert` function where conditions matching the given
   * pattern are checked by the given function.
   *
   * The following patterns are supported:
   * - The function pattern `<function name>(<argument names,*>)`; if no
   *   argument is given, the function will receive all values passed to
   *   `assert`.
   * - The binary pattern `_ <operator name> _`, which defines a binary
   *   operator.
   * - The n-ary pattern `_ <operator name> ...`, which defines an n-ary (with
   *   n >= 2) operator.
   * - The prefix pattern `_ <operator name>`, which defines a prefix operator.
   * - The suffix pattern `<operator name> _`, which defines a suffix operator.
   *
   * Operators can either be alphabetic identifiers (including spaces), or
   * non-whitespace characters. The characters `` ."'`()[]{}#`` and the
   * operators `and`, `or`, `&&` and `||` are reserved.
   *
   * The `handler` must throw an error if the condition it checks is false, and
   * is given two arrays. The first one contains the value of each argument,
   * and the second one contains the source code of the condition followed by
   * the string representation of each argument where the interpolation part of
   * the string is replaced by `_[i]`, with `i` a literal integer.
   */
  withPattern<Pattern extends string>(
    pattern: Pattern,
    handler: PatternFunction<Pattern>,
  ): Assert;

  /**
   * Returns a new `assert` function where conditions matching the given
   * pattern are processed using a computed string of JavaScript code.
   *
   * The function `makeHandler` receives the match of the pattern, as well as
   * a function that, called with any value `v`, returns a string that can be
   * embedded in the JavaScript code to reference that value `v`.
   *
   * The pattern must match the entire string.
   */
  withPattern(
    pattern: RegExp,
    makeHandler: (match: readonly string[], embedValue: (v: any) => string) => string,
  ): Assert;
}

/**
 * The base `assert` function. It does not support any comparison, and must be
 * extended with `withPattern`.
 *
 * Default implementations of `assert` are available in the `assert`, `chai`,
 * and `jest` modules.
 *
 * @see Assert
 */
export const assert = makeAssert({ patterns: [], regExp: /^ / });
