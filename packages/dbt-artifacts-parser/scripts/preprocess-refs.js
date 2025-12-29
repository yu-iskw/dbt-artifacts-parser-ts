#!/usr/bin/env node
/**
 * Pre-processes JSON schema files that have root-level $ref patterns
 * by expanding all $ref references using json-schema-ref-parser.
 *
 * Usage: node preprocess-refs.js <input-file> <output-file> [cwd]
 *
 * If the input file has a root-level $ref, it will be dereferenced and written to output-file.
 * If not, the input file will be copied to output-file as-is.
 */

const fs = require("fs");
const path = require("path");
const $RefParser = require("@apidevtools/json-schema-ref-parser");

const inputFile = process.argv[2];
const outputFile = process.argv[3];
const cwd = process.argv[4] || path.dirname(inputFile);

if (!inputFile || !outputFile) {
  console.error(
    "Usage: node preprocess-refs.js <input-file> <output-file> [cwd]",
  );
  process.exit(1);
}

async function preprocessSchema() {
  try {
    // Read the input JSON file
    const inputPath = path.resolve(inputFile);
    const schema = JSON.parse(fs.readFileSync(inputPath, "utf8"));

    // Check if the schema has a root-level $ref
    const hasRootRef =
      schema.$ref &&
      typeof schema.$ref === "string" &&
      schema.$ref.startsWith("#/");

    if (hasRootRef) {
      // Pre-process: dereference all $refs
      console.error(
        `  Pre-processing ${path.basename(inputFile)} (root-level $ref detected)`,
      );

      const options = {
        resolve: {
          file: {
            canRead: true,
          },
          http: false, // Disable HTTP resolution for security
        },
      };

      // Dereference the schema using the file path so $ref resolution works correctly
      const dereferenced = await $RefParser.dereference(inputPath, options);

      // Write the dereferenced schema to the output file
      fs.writeFileSync(
        outputFile,
        JSON.stringify(dereferenced, null, 2),
        "utf8",
      );
    } else {
      // No root-level $ref, just copy the file
      fs.copyFileSync(inputPath, outputFile);
    }

    process.exit(0);
  } catch (error) {
    console.error(`Error pre-processing ${inputFile}:`, error.message);
    process.exit(1);
  }
}

preprocessSchema();
