import { handler } from "./main.ts";

// 在 Deno Deploy 上只调用这一处 Deno.serve
Deno.serve(handler);