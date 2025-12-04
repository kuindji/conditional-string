# @kuindji/conditional-string

Type-safe conditional string template parser with compile-time inference for TypeScript.

## Features

- **Compile-time type safety**: Results are inferred at the type level based on condition values
- **Static type override**: Use `.with<Data>()` to specify static types for return type computation
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

### Static Type Override with `.with<Data>()`

When you need to specify a static type for return type computation while allowing runtime values to vary, use the `.with<Data>()` method:

```typescript
import { conditionalString } from "@kuindji/conditional-string";

// Runtime value determined dynamically
const showAdmin = Math.random() > 0.5;

const template = `User /*if:isAdmin*/[ADMIN]/*endif*/`;

// Using .with<Data>() to specify static type for return type computation
const result = conditionalString.with<{ isAdmin: true }>()(
    template,
    { isAdmin: showAdmin },  // Runtime value can be boolean
);

// Return type is computed as if isAdmin is always true: "User [ADMIN]"
// But runtime result depends on actual showAdmin value
```

This is useful when:
- You want predictable return types regardless of runtime values
- You're building type-safe query builders where the schema is known at compile time
- You need to decouple type computation from runtime data

The `.with<Data>()` method:
- Uses `Data` for **return type computation**
- Accepts runtime data with matching keys but **unrestricted value types**
- Template type is still **inferred automatically**

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

### `conditionalString<Template, Data>(template, data)`

Processes a string template with conditional comments. Both `Template` and `Data` types are inferred.

**Parameters:**

- `template`: The string with conditional comments
- `data`: An object with condition values

**Returns:** `ConditionalStringResult<Template, Data>` - The processed string with conditionals resolved

---

### `conditionalString.with<StaticData>()(template, data)`

Creates a typed version where `StaticData` is used for return type computation, but runtime data values are unrestricted.

**Type Parameters:**

- `StaticData`: The type used for computing the return type

**Parameters:**

- `template`: The string with conditional comments (type is inferred)
- `data`: An object with keys matching `StaticData`, but values can be any type

**Returns:** `ConditionalStringResult<Template, StaticData>` - The processed string with type computed using `StaticData`

**Example:**

```typescript
// Static type says isAdmin is true, so return type includes "[ADMIN]"
// Runtime data can have isAdmin as any boolean
const result = conditionalString.with<{ isAdmin: true }>()(
    `User /*if:isAdmin*/[ADMIN]/*endif*/`,
    { isAdmin: someRuntimeBoolean },
);
```

---

### `ConditionalStringResult<Template, Data>`

A utility type that computes the resulting string type based on the template and data types.

## License

MIT
