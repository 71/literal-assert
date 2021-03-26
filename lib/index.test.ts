import { AssertionError, assert } from ".";

/**
 * Asserts that the given condition is false and will throw an error. Also saves
 * a snapshot of that error to avoid regressions.
 */
function assertFalse(strings: TemplateStringsArray, ...args: any[]) {
  expect(() => assert(strings, ...args)).toThrowErrorMatchingSnapshot();
}

describe("infix operator", () => {
  test("'===' with numbers", () => {
    assert`${2 + 2} === 4`;
    assert`${21 * 2} === ${84} / 2`;
  });

  test("'===' with numbers", () => {
    assertFalse`${[1, 2, 3]}.length === 1`;
  });

  test("'===' with strings", () => {
    // Show that the parsing is not "too dumb": the first " is " is not seen as
    // an operator.
    assert`" is ".slice(1, 3) === ${"is"}`;
    assertFalse`" is ".slice(1, 3) === ${"no"}`;
  });

  test("'===' with letters", () => {
    // This example shows what happens when strings get too long and must be
    // split.
    const letters = (length: number) =>
      Array.from({ length }, (_, i) => String.fromCharCode(97 + i));

    assert`${letters(26)}.length === ${26}`;
    assertFalse`${letters(12)}.length === ${26}`;
    assertFalse`${letters(16)}.length === ${26}`;
  });

  test("'matches'", () => {
    assert`${"foo"} matches /^\w+$/`;
    assertFalse`${"not foo"} matches /^\w+$/`;
  });

  test("'does not match'", () => {
    assert`${"abc"} does not match /\d+/`;
    assert`${"abc"} doesn't match ${/[A-Z]/}`;
    assertFalse`${"abc"} doesn't match /[a-z]/`;
  });

  test("'throws'", () => {
    assert`${() => assert`null is undefined`} throws ${AssertionError}`;
    assertFalse`${() => (undefined as any).foo()} throws ${AssertionError}`;
  });
});

describe("postfix operator", () => {
  test("'throws'", () => {
    assert`${() => assert`${0} is ${-0}`} throws`;
    assertFalse`${() => assert`${0} === ${-0}`} throws`;
  });
});
