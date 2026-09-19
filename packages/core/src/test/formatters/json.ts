import type { RunReport } from '../run'

/*
=begin pod :kind<export>

=head2 formatJson

The report as one JSON document.

=end pod
*/
export const formatJson = (report: RunReport): string => `${JSON.stringify(report, null, 2)}\n`
