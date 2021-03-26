type KeyValuePairs<T extends readonly any[], Then, Else = never>
  = T extends []
    ? Then
    : T extends [any, infer Key, ...infer Rest]
      ? Key extends string ? KeyValuePairs<Rest, Then, Else> : Else
      : Else;

function stringify(value: unknown, text: string, indent: string, maxLen: number, seen = new Set()) {
  switch (typeof value) {
  case "bigint":
  case "boolean":
  case "number":
  case "undefined":
    return text + value;

  case "symbol":
    return text + value.toString();

  case "string":
    return text + JSON.stringify(value);

  case "function":
    const f = value.toString();

    if (f.startsWith("class")) {
      return text + "class " + value.name;
    }

    return text + (value.name || "ƒ") + /\(.*?\)/.exec(f)![0];

  case "object":
    if (value === null) {
      return text + "null";
    }

    indent += "  ";

    const count = seen.size,
          comma = maxLen === 0 ? "," + indent : ", ";

    if (seen.add(value).size === count) {
      return text + "...";
    }

    seen.add(value);

    if (value instanceof Map) {
      text += "Map ";
      value = [...value].sort();
    }

    if (value instanceof Set) {
      text += "Set ";
      value = [...value].sort();
    }

    if (Array.isArray(value)) {
      text += "[";

      if (maxLen === 0) {
        text += indent;
      }

      for (let i = 0; i < value.length; i++) {
        const itemText = stringify(value[i], text, indent, maxLen, seen);

        if (itemText === undefined) {
          return undefined;
        }

        text = itemText;

        if (maxLen > 0 && text.length > maxLen) {
          return undefined;
        }

        if (i + 1 < value.length) {
          text += comma;
        }
      }

      if (maxLen === 0) {
        text += "," + indent.slice(0, indent.length - 2);
      }

      text += "]";

      return text;
    }

    const str = (value as object).toString();

    if (typeof str === "string" && !str.startsWith("[object ")) {
      if (maxLen > 0 && (text.length + str.length > maxLen || str.includes("\n"))) {
        return undefined;
      }
      return text + str;
    }

    let isFirstProperty = true;

    for (const key in value as any) {
      if (isFirstProperty) {
        text += maxLen === 0 ? "{" + indent : "{ ";
        isFirstProperty = false;
      } else {
        text += comma;
      }

      if (/^[\p{L}0-9$_]+$/u.test(key)) {
        text += key;
      } else {
        text += JSON.stringify(key);
      }

      text += ": ";

      const itemText = stringify((value as any)[key], text, indent, maxLen, seen);

      if (itemText === undefined) {
        return undefined;
      }

      text = itemText;

      if (maxLen > 0 && text.length > maxLen) {
        return undefined;
      }
    }

    if (isFirstProperty) {
      text += "{}";
    } else {
      text += maxLen === 0 ? "}" : " }";
    }

    return text;
  }
}

type Range = [index: number, start: number, end: number];
const templateArgRe = /_\[(\d+)\]/g;

function stringifyShortTemplateArgs(
  text: string,
  templateArgs: readonly any[],
  rangeOffset: number,
  ranges: Range[],
) {
  let result = "",
      index = 0;

  templateArgRe.lastIndex = 0;

  for (let match = templateArgRe.exec(text); match !== null; match = templateArgRe.exec(text)) {
    const n = +match[1];

    result += text.slice(index, index + match.index);
    index += match.index + match[0].length;

    const stringified = stringify(templateArgs[n], "", "\n", 6);

    if (stringified === undefined) {
      ranges.push([-n, rangeOffset + result.length, rangeOffset + result.length + 5]);
      result += "(...)";
    } else {
      result += stringified;
    }
  }

  return result + text.slice(index);
}

function stringifyTemplateArgs(text: string, templateArgs: readonly any[], maxLen: number) {
  let result = "",
      index = 0;

  templateArgRe.lastIndex = 0;

  for (let match = templateArgRe.exec(text); match !== null; match = templateArgRe.exec(text)) {
    const n = +match[1];

    result += text.slice(index, index + match.index);
    index += match.index + match[0].length;

    const stringified = stringify(templateArgs[n], result, "\n  ", maxLen);

    if (stringified === undefined) {
      return undefined;
    }

    result = stringified;
  }

  return result + text.slice(index);
}

function stringifyAssertionNoInlineValue(error: AssertionError, ranges: Range[]) {
  ranges.length = 0;

  const strings = error.strings.raw,
        argumentSources = error.argumentSources,
        templateArgs = error.assertArgumentValues;
  let assertion = "  ";

  for (let i = 0; i < argumentSources.length; i++) {
    const rawArgumentSource = argumentSources[i];

    assertion += strings[i];

    const start = assertion.length;

    assertion += stringifyShortTemplateArgs(rawArgumentSource, templateArgs, start, ranges);

    if (ranges.length > 0) {
      const [_, rangeStart, rangeEnd] = ranges[ranges.length - 1];

      if (start === rangeStart && assertion.length === rangeEnd) {
        continue;
      }
    }

    ranges.push([i, start, assertion.length]);
  }

  return assertion + strings[strings.length - 1];
}

function stringifyAssertion(error: AssertionError, ranges: Range[]) {
  const maxLen = AssertionError.maxSummaryLineWidth,
        strings = error.strings.raw,
        argumentSources = error.argumentSources,
        templateArgs = error.assertArgumentValues;
  let assertion = "  ";

  for (let i = 0; i < argumentSources.length; i++) {
    const rawArgumentSource = argumentSources[i],
          argumentSource = stringifyTemplateArgs(rawArgumentSource, templateArgs,
                                                 maxLen - assertion.length);

    if (argumentSource === undefined) {
      return stringifyAssertionNoInlineValue(error, ranges);
    }

    assertion += strings[i];

    const start = assertion.length;

    assertion += argumentSource;

    if (assertion.length >= maxLen) {
      return stringifyAssertionNoInlineValue(error, ranges);
    }

    ranges.push([i, start, assertion.length]);
  }

  return assertion + strings[strings.length - 1];
}

function stringifyError(error: AssertionError) {
  const ranges: Range[] = [],
        summaryLine = stringifyAssertion(error, ranges),
        maxLen = Math.max(AssertionError.maxSummaryLineWidth, summaryLine.length + 10),
        underlines: string[] = [],
        usedColumns: number[] = [],
        valueLines: string[] = [],
        argumentValues = error.argumentValues,
        templateArgs = error.assertArgumentValues;
  let lastLines = "",
      valuesInLastLines = 0;

  for (const [n, start, end] of ranges) {
    let underlineIndex = underlines.findIndex((s) => /^ +$/.test(s.slice(start, end)));

    if (underlineIndex === -1) {
      underlineIndex = underlines.push(" ".repeat(summaryLine.length)) - 1;
    }

    let column = -1;

    for (let i = start * 3; i < end * 3; i += 3) {
      const col = i / 3;

      if (!usedColumns.includes(col)) {
        if (start === col || column === col - 1) {
          // Prioritize start column and column with some space after the
          // previous one.
          column = col;
          break;
        }
        column = col;
      }
    }

    if (column === -1) {
      // Give up.
      continue;
    }

    const underline = "¯".repeat(end - start),
          underlineBefore = underlines[underlineIndex],
          underlineAfter = underlineBefore.slice(0, start) + underline + underlineBefore.slice(end);

    underlines[underlineIndex] = underlineAfter;

    const value = n < 0 || Object.is(n, -0) ? templateArgs[-n] : argumentValues[n];

    let valueString = stringify(value, "", "", maxLen);

    if (valueString === undefined) {
      lastLines += stringify(value, "\n  value #" + valuesInLastLines + ": ", "\n  ", 0);
      valueString = "value #" + valuesInLastLines;
      valuesInLastLines++;
    }

    let lineIndex = valueLines.findIndex((l) => l.length < column);

    if (lineIndex === -1) {
      lineIndex = valueLines.push(" ".repeat(column) + valueString) - 1;
    } else {
      valueLines[lineIndex] = valueLines[lineIndex]
                            + " ".repeat(column - valueLines[lineIndex].length)
                            + valueString;
    }

    usedColumns.push(column, underlineIndex, lineIndex);
  }

  for (let i = 0; i < usedColumns.length; i += 3) {
    const column = usedColumns[i],
          fromLine = usedColumns[i + 1],
          tillLine = usedColumns[i + 2];

    for (let j = fromLine; j < underlines.length; j++) {
      const underline = underlines[j];

      if (underline[column] === " " || underline[column] === "¯") {
        underlines[j] = underline.slice(0, column) + "|" + underline.slice(column + 1);
      }
    }

    for (let j = 0; j < tillLine; j++) {
      const valueLine = valueLines[j];

      if (valueLine.length < column) {
        valueLines[j] = valueLine + " ".repeat(column - valueLine.length) + "|";
      } else if (valueLine[column] === " ") {
        valueLines[j] = valueLine.slice(0, column) + "|" + valueLine.slice(column + 1);
      }
    }
  }

  let message = "assertion failed:\n" + summaryLine;

  if (valueLines.length === 0) {
    return message;
  }

  for (const underline of underlines) {
    message += "\n" + underline.trimRight();
  }

  for (const valueLine of valueLines) {
    message += "\n" + valueLine.trimRight();
  }

  if (valuesInLastLines > 0) {
    message += "\n\nwith:" + lastLines;
  }

  return message;
}

/**
 * An error thrown when an assertion fails.
 */
export class AssertionError extends Error {
  private _message?: string;

  public constructor(
    public readonly strings: TemplateStringsArray,
    public readonly argumentValues: readonly any[],
    public readonly argumentSources: readonly string[],
    public readonly assertArgumentValues: readonly any[],
  ) {
    super();
  }

  public get name() {
    return "AssertionError";
  }

  public get message() {
    if (this._message === undefined) {
      this._message = stringifyError(this);
    }

    return this._message;
  }

  public static maxSummaryLineWidth = 80;

  public static format<Args extends readonly any[]>(
    strings: KeyValuePairs<Args, TemplateStringsArray, never>,
    templateArgs: readonly any[],
    ...args: Args
  ): AssertionError {
    const argumentValues: any[] = [],
          argumentSources: string[] = [],
          assertionStrings = Object.assign([] as string[], { raw: [] as string[] });

    for (let i = 0; i < args.length; i += 2) {
      argumentValues.push(args[i]);
      argumentSources.push(args[i + 1]);

      assertionStrings.push(strings[i + 1]);
      assertionStrings.raw.push(strings.raw[i + 1]);
    }

    assertionStrings.push(strings[strings.length - 1]);
    assertionStrings.raw.push(strings.raw[strings.raw.length - 1]);

    return new AssertionError(assertionStrings, argumentValues, argumentSources, templateArgs);
  }

  public static assert(
    condition: boolean,
    buildError: (fmt: typeof AssertionError.format) => AssertionError,
  ): asserts condition {
    if (!condition) {
      throw buildError(this.format);
    }
  }
}
