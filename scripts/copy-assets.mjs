import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "src", "ui", "garuda-logo.png");
const destinationDir = path.join(root, "dist", "ui");
const destination = path.join(destinationDir, "garuda-logo.png");

mkdirSync(destinationDir, { recursive: true });
cpSync(source, destination);
