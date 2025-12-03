# @kuindji/conditional-string

Type-safe conditional string template parser with compile-time inference for TypeScript.

## Features

- **Compile-time type safety**: Results are inferred at the type level based on condition values
- **Simple syntax**: Uses comment syntax `/*if:condition*/.../*endif*/` that works with any string
- **Negation support**: Use `!` prefix for negated conditions
- **Dot notation**: Access nested properties with `user.isAdmin` syntax
- **Nested conditions**: Supports arbitrary nesting of conditional blocks
- **Zero runtime dependencies**: Lightweight and fast

## Installation

```bash
npm install @kuindji/conditional-string
# or
bun add @kuindji/conditional-string
# or
yarn add @kuindji/conditional-string
```

## Usage

### Basic Example

```typescript
import { conditionalString } from "@kuindji/conditional-string";

const template = `
  Hello /*if:showName*/World/*endif*/!
  /*if:showGreeting*/Have a nice day!/*endif*/
`;

const result = conditionalString(
    template,
    {
        showName: true,
        showGreeting: false,
    } as const,
);

// Result: "Hello World!\n"
// TypeScript knows the exact string type at compile time!
```

### SQL Example

```typescript
import { conditionalString } from "@kuindji/conditional-string";

const sql = `
  SELECT * FROM users 
  WHERE 1=1 
  /*if:includeDeleted*/AND deleted = false/*endif*/
  /*if:filterActive*/AND active = true/*endif*/
`;

const result = conditionalString(
    sql,
    {
        includeDeleted: true,
        filterActive: false,
    } as const,
);

// Result: "SELECT * FROM users WHERE 1=1 AND deleted = false"
```

### Negation

Use `!` to negate a condition:

```typescript
const template = `Welcome /*if:!isGuest*/back/*endif*/!`;

conditionalString(template, { isGuest: false } as const);
// Result: "Welcome back!"

conditionalString(template, { isGuest: true } as const);
// Result: "Welcome !"
```

### Dot Notation for Nested Properties

Access nested object properties using dot notation:

```typescript
const template =
    `User: /*if:user.isAdmin*/[ADMIN] /*endif*//*if:user.name*/John/*endif*/`;

conditionalString(template, { user: { isAdmin: true, name: true } } as const);
// Result: "User: [ADMIN] John"
```

### Nested Conditions

Conditions can be nested arbitrarily:

```typescript
const template = `Start /*if:a*/A /*if:b*/B/*endif*//*endif*/ End`;

conditionalString(template, { a: true, b: true } as const);
// Result: "Start A B End"

conditionalString(template, { a: true, b: false } as const);
// Result: "Start A  End"

conditionalString(template, { a: false, b: true } as const);
// Result: "Start  End"
```

### Real-World SQL Example

```typescript
const getUsersQuery = `
  SELECT u.id, u.name, u.email
  FROM users u
  WHERE 1=1
  /*if:searchTerm*/AND (u.name ILIKE $1 OR u.email ILIKE $1)/*endif*/
  /*if:roleFilter*/AND u.role = $2/*endif*/
  /*if:activeOnly*/AND u.active = true/*endif*/
  ORDER BY u.created_at DESC
`;

const query = conditionalString(
    getUsersQuery,
    {
        searchTerm: "john",
        roleFilter: null,
        activeOnly: true,
    } as const,
);

// Results in:
// SELECT u.id, u.name, u.email
// FROM users u
// WHERE 1=1
// AND (u.name ILIKE $1 OR u.email ILIKE $1)
// AND u.active = true
// ORDER BY u.created_at DESC
```

## Type Safety

The library provides compile-time type inference. When using literal types (via `as const`), TypeScript will compute the exact resulting string type:

```typescript
import { type ConditionalStringResult } from "@kuindji/conditional-string";

// The type is computed at compile time
type Result = ConditionalStringResult<
    "Hello /*if:flag*/World/*endif*/!",
    { flag: true; }
>;
// Result = "Hello World!"

type Result2 = ConditionalStringResult<
    "Hello /*if:flag*/World/*endif*/!",
    { flag: false; }
>;
// Result2 = "Hello !"
```

If the condition values are not literal types (e.g., widened `boolean` instead of `true` or `false`), the result type falls back to `string`.

## Truthy/Falsy Values

The library follows JavaScript truthy/falsy semantics:

- **Falsy**: `false`, `0`, `""`, `null`, `undefined`
- **Truthy**: Everything else, including empty arrays `[]` and empty objects `{}`

## Syntax

```
/*if:condition*/content/*endif*/
```

- `condition`: The property name to check (supports dot notation and `!` prefix)
- `content`: The content to include when the condition is truthy

## API

### `conditionalString<Template, Data>(template: Template, data: Data): ConditionalStringResult<Template, Data>`

Processes a string template with conditional comments.

**Parameters:**

- `template`: The string with conditional comments
- `data`: An object with condition values

**Returns:** The processed string with conditionals resolved

### `ConditionalStringResult<Template, Data>`

A utility type that computes the resulting string type based on the template and data types.

## License

MIT
