# literal-assert

Literal assert provides an `assert` [JavaScript template literal](
https://developer.mozilla.org/docs/Web/JavaScript/Reference/Template_literals)
that checks for assertions.

## Example

```js
assert`${foo} === ${bar}`;
assert`${baz} doesn't match /^\w+$/ or ${() => quux()} throws`;
assert`0 < ${x} < 10 and ${y}.length >= 0`;
```

## Syntax

The syntax supported by `assert` is fairly simple:
- Conditions are strings that must match a user-provided pattern. For instance,
  `_ === _`, `_ < ...`, `- _` and `_ throws` respectively match the strings
  `?.length === 1`, `0 < ? < ?.length < 10`, `- ?` and `? throws` where `?`
  represents a user input in the `assert` call (i.e. an interpolation
  `${foo}`).
- Conditions can be joined in conjunctions with `and` or `&&`.
- Conjunctions can be joined in disjunctions with `or` or `||`.

For instance, the string `a and b or c && d` will throw an error neither
`a and b` nor `c && d` is true.

Parentheses are not supported.

## Adding patterns

By default, `assert` does not support any pattern. In order to make it useful,
users are expected to add patterns manually by calling one of the `withPattern`
functions on `assert`.

Please refer to the documentation of the [`Assert`](
./src/lib.ts#:~:text=interface%20Assert) interface for more information.

As a short example:
```js
const myAssert = assert
  .withPattern("_ is _", ([a, b]) => expect(a).toBe(b))
  .withInfixOperator(/is(n't| not)/, ([a, b]) => expect(a).not.toBe(b))
;

// Expressions can be mixed in with JavaScript:
myAssert`${2 + 2} is 4`;
myAssert`${21 * 2} is ${84} / 2`;
myAssert`" is ".slice(1, 3) is ${"is"}`;

// Arbitrary RegExps can be used:
myAssert`${"foo"} isn't "bar"`;
myAssert`false is not true`;
```

## To-do

1. Provide more default patterns for the [jest](./src/jest.ts),
   [chai](./src/chai.ts), and [assert](./src/assert.ts) implementations.
2. Add more tests for the [jest](./src/jest.test.ts),
   [chai](./src/chai.test.ts), and [assert](./src/assert.test.ts)
   implementations.
3. Publish the package on npm.
