// Lets node:test import app modules that use the "@/…" alias and extensionless relative imports
// (Node >= 22.18 strips TypeScript types natively). Used by `npm test` and `npm run test:team` via --import.
import { register } from "node:module";

register("./alias-loader.mjs", import.meta.url);
