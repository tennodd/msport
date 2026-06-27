// Admin-only web method to run the Phase 3 bootstrap from the Velo IDE.
// Not an HTTP endpoint — per the refactor doc, bootstrap stays off the public
// surface. Invoke `runBootstrap(rows1c, { dryRun, skip, pageSize })` from the
// editor, starting with dryRun:true and a small pageSize, then walk `nextSkip`.
//
// rows1c is the parsed 1C export (see backend/bootstrap.js for the row shape).
// For large catalogs, consider loading rows1c from a Media file instead of
// passing ~39k rows as an argument on every batch — TBD once base1.xlsx lands.

import { Permissions, webMethod } from 'wix-web-module';
import { bootstrapMcodeIndex } from 'backend/bootstrap';

export const runBootstrap = webMethod(
    Permissions.Admin,
    (rows1c, options) => bootstrapMcodeIndex(rows1c, options)
);
