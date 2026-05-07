/* =begin pod
=head2 C<runLint>

Stub entry point for the C<podlite lint> subcommand. Returns the exit code
the CLI should propagate. Until rules land (Track 7 phase 2), it logs a
placeholder and exits cleanly.

=end pod */
export function runLint(files: string[]): number {
  console.log(`lint: stub — received ${files.length} file(s); rules not yet implemented`)
  return 0
}
