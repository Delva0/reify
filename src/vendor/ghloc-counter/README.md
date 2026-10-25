# ghloc counter

Source: https://github.com/subtle-byte/ghloc

Revision: 4d52e65853353de0709214e818e6d7bcbf525f36. MIT license retained in LICENSE and /licenses/ghloc-counter.txt.

nonempty-lines.js translates internal/service/loc_count/file_counter.go to a streaming JavaScript counter. It preserves the original byte rules, including the final unterminated line and binary input returning 1. File types use the extension, or the entire basename when there is no extension, following getLangName in stat.go.

../../build/git-blob-lines.mjs reads immutable Git blobs through one git cat-file --batch process. Only metadata and counts are included in the published tree manifest.
