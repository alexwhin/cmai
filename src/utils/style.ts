import chalkDefault from "chalk";
const chalk = (chalkDefault as { default?: typeof chalkDefault }).default || chalkDefault;

export type Color = "white" | "green" | "red" | "cyan" | "magenta" | "gray";

export type SymbolType = "success" | "error" | "warning" | "info" | "regenerate" | "edit" | "exit";

export function color(name: Color, text: string): string {
  if (process.env.NODE_ENV === "test") {
    switch (name) {
      case "green":
        return `GREEN[${text}]`;
      case "red":
        return `RED[${text}]`;
      case "cyan":
        return `CYAN[${text}]`;
      case "magenta":
        return `MAGENTA[${text}]`;
      case "gray":
        return `GRAY[${text}]`;
      case "white":
      default:
        return `WHITE[${text}]`;
    }
  }

  switch (name) {
    case "green":
      return chalk.green(text);
    case "red":
      return chalk.red(text);
    case "cyan":
      return chalk.cyan(text);
    case "magenta":
      return chalk.magenta(text);
    case "gray":
      return chalk.gray(text);
    case "white":
    default:
      return chalk.white(text);
  }
}

export function bold(text: string): string {
  if (process.env.NODE_ENV === "test") {
    return `BOLD[${text}]`;
  }
  return chalk.bold(text);
}

export function dim(text: string): string {
  if (process.env.NODE_ENV === "test") {
    return `DIM[${text}]`;
  }
  return chalk.dim(text);
}

export function styledSymbol(type: SymbolType, symbol: string): string {
  if (process.env.NODE_ENV === "test") {
    switch (type) {
      case "success":
        return `GREEN[${symbol}]`;
      case "error":
        return `RED[${symbol}]`;
      case "warning":
        return `YELLOW[${symbol}]`;
      case "info":
        return `CYAN[${symbol}]`;
      case "regenerate":
      case "edit":
      case "exit":
      default:
        return `DIM[${symbol}]`;
    }
  }

  switch (type) {
    case "success":
      return chalk.green(symbol);
    case "error":
      return chalk.red(symbol);
    case "warning":
      return chalk.yellow(symbol);
    case "info":
      return chalk.cyan(symbol);
    case "regenerate":
    case "edit":
    case "exit":
    default:
      return chalk.dim(symbol);
  }
}
