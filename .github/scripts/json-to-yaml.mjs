#!/usr/bin/env node
// Reads a JSON document from stdin and writes a readable YAML rendering
// of it to stdout. Used by build-gate.yaml/main-gate.yaml to print
// gate-check's --json result legibly in the workflow log — the raw
// single-line JSON is unreadable, and Node has no built-in YAML
// serializer, so this is a small, dependency-free one instead of
// pulling in a package just for CI log formatting.
//
// Handles what a GateCheckResult actually contains: strings (including
// multi-line ones, e.g. a build's compiler output, rendered as a block
// scalar), numbers, booleans, arrays, and nested objects. Not a
// general-purpose YAML emitter (no anchors, no flow style, no exotic
// scalar types) — just enough to render this shape well.

import { readFileSync } from "node:fs";

function needsQuoting(str) {
  if (str === "") return true;
  if (/^[\s]|[\s]$/.test(str)) return true;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(str)) return true;
  if (/^(true|false|null|~|yes|no)$/i.test(str)) return true;
  if (/^-?\d+(\.\d+)?$/.test(str)) return true;
  if (/[:#]/.test(str)) return true;
  return false;
}

function scalarToYaml(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") {
    return needsQuoting(value) ? JSON.stringify(value) : value;
  }
  return JSON.stringify(value);
}

function toYaml(value, indent) {
  const pad = "  ".repeat(indent);

  if (typeof value === "string" && value.includes("\n")) {
    const body = value
      .replace(/\n+$/, "")
      .split("\n")
      .map((line) => pad + "  " + line)
      .join("\n");
    return "|\n" + body;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const body = value
      .map((item) => {
        const rendered = toYaml(item, indent + 1);
        if (rendered.startsWith("\n")) {
          return pad + "-" + rendered;
        }
        return pad + "- " + rendered;
      })
      .join("\n");
    return "\n" + body;
  }

  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    const body = keys
      .map((key) => {
        const rendered = toYaml(value[key], indent + 1);
        if (rendered.startsWith("\n") || rendered.startsWith("|")) {
          const sep = rendered.startsWith("|") ? " " : "";
          return pad + key + ":" + sep + rendered;
        }
        return pad + key + ": " + rendered;
      })
      .join("\n");
    return "\n" + body;
  }

  return scalarToYaml(value);
}

function render(rootValue) {
  if (Array.isArray(rootValue) || (rootValue !== null && typeof rootValue === "object")) {
    const body = toYaml(rootValue, 0);
    return body.startsWith("\n") ? body.slice(1) : body;
  }
  return scalarToYaml(rootValue);
}

const input = readFileSync(0, "utf-8");
const data = JSON.parse(input.split("\n")[0]);
process.stdout.write(render(data) + "\n");
