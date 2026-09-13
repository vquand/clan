function dollarQuoteAt(source, index) {
  if (source[index] !== '$') return null;

  const match = source.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);
  return match?.[0] ?? null;
}

export function splitSqlStatements(source) {
  const statements = [];
  let statementStart = 0;
  let quote = null;
  let dollarQuote = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      if (character === '*' && nextCharacter === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (dollarQuote) {
      if (source.startsWith(dollarQuote, index)) {
        index += dollarQuote.length - 1;
        dollarQuote = null;
      }
      continue;
    }

    if (quote) {
      if (character === quote) {
        if (nextCharacter === quote) {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === '-' && nextCharacter === '-') {
      lineComment = true;
      index += 1;
      continue;
    }

    if (character === '/' && nextCharacter === '*') {
      blockComment = true;
      index += 1;
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }

    const dollarQuoteAtIndex = dollarQuoteAt(source, index);
    if (dollarQuoteAtIndex) {
      dollarQuote = dollarQuoteAtIndex;
      index += dollarQuoteAtIndex.length - 1;
      continue;
    }

    if (character === ';') {
      const statement = source.slice(statementStart, index).trim();
      if (statement) statements.push(statement);
      statementStart = index + 1;
    }
  }

  const finalStatement = source.slice(statementStart).trim();
  if (finalStatement) statements.push(finalStatement);
  return statements;
}
