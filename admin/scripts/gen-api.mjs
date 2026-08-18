#!/usr/bin/env node
/**
 * Regenerate the typed API client from the backend's OpenAPI schema.
 *
 *   pnpm gen:api                       # reads http://localhost:8000/openapi.json
 *   API_URL=https://api.example pnpm gen:api
 *   pnpm gen:api --offline             # regenerate types from the checked-in snapshot
 *
 * Both the snapshot (openapi.json) and the generated types are committed so the frontend build
 * never needs a live backend (frontend spec §8).
 */
import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import openapiTS, { astToString } from "openapi-typescript";

const here = path.dirname(fileURLToPath(import.meta.url));
const snapshotPath = path.join(here, "..", "openapi.json");
const outputPath = path.join(here, "..", "src", "lib", "api", "generated.ts");

const offline = process.argv.includes("--offline");
const source = `${process.env.API_URL ?? "http://localhost:8000"}/openapi.json`;

async function loadSchema() {
  if (offline) {
    return JSON.parse(await readFile(snapshotPath, "utf8"));
  }
  try {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const schema = await response.json();
    await writeFile(snapshotPath, `${JSON.stringify(schema, null, 2)}\n`);
    console.log(`fetched schema from ${source}`);
    return schema;
  } catch (error) {
    console.warn(`could not reach ${source} (${error.message}); using checked-in snapshot`);
    return JSON.parse(await readFile(snapshotPath, "utf8"));
  }
}

const schema = await loadSchema();
const ast = await openapiTS(schema);
const banner = `/**
 * Generated from the Rolewire FastAPI OpenAPI schema. Do not edit by hand.
 * Regenerate with: pnpm gen:api
 */
`;
await writeFile(outputPath, banner + astToString(ast));
console.log(`wrote ${path.relative(process.cwd(), outputPath)}`);
