use v6;
use Test;
plan 43;

my $r;

#---
=pod
B<I am a formatting code>
#---

$r = $=pod[0].contents[0].contents[0];
isa-ok $r, Pod::FormattingCode;
is $r.type, 'B';
is $r.contents[0], 'I am a formatting code', 'a single FC becomes a single FC';

#---
=pod
The basic C<ln> command is: C<ln> B<R<source_file> R<target_file>>
#---

$r = $=pod[1].contents[0].contents;
is $r[0], 'The basic ';
isa-ok $r[1], Pod::FormattingCode;
is $r[1].type, 'C';
is $r[1].contents, 'ln';
is $r[2], ' command is: ';
isa-ok $r[3], Pod::FormattingCode;
is $r[3].type, 'C';
is $r[3].contents, 'ln';
isa-ok $r[5], Pod::FormattingCode;
is $r[4], " ";
is $r[5].type, 'B';
$r = $r[5].contents;
isa-ok $r[0], Pod::FormattingCode;
is $r[0].type, 'R';
is $r[0].contents, 'source_file';
is $r[1], ' ';
isa-ok $r[2], Pod::FormattingCode;
is $r[2].type, 'R';
is $r[2].contents, 'target_file';

#---
=pod
L<C<b>|a>
L<C<b>|a>
#---

$r = $=pod[2].contents[0].contents;
for $r[0], $r[2] -> $link {
    is $link.type, 'L';
    isa-ok $link.contents[0], Pod::FormattingCode;
    is $link.contents[0].contents, 'b';
    is $link.meta, 'a';
}

#---
=begin pod

=head1 A heading

This is Pod too. Specifically, this is a simple C<para> block

    $this = pod('also');  # Specifically, a code block

=end pod
#---

$r = $=pod[3];
is $r.contents.elems, 3;
isa-ok $r.contents[0], Pod::Block;
is $r.contents[0].contents[0].contents, 'A heading';
is $r.contents[1].contents[0],
   'This is Pod too. Specifically, this is a simple ';
isa-ok $r.contents[1].contents[1], Pod::FormattingCode;
is $r.contents[1].contents[1].type, 'C';
is $r.contents[1].contents[1].contents, 'para';
is $r.contents[1].contents[2], ' block';
isa-ok $r.contents[2], Pod::Block::Code;
is $r.contents[2].contents,
   q[$this = pod('also');  # Specifically, a code block];

#---
=pod V<C<boo> B<bar> asd>
#---

$r = $=pod[4];
is $r.contents[0].contents, 'C<boo> B<bar> asd';

# RT #114510
=pod C< infix:<+> >
=pod C<< infix:<+> >>

for @$=pod[5, 6] {
    is .contents[0].contents[0].contents[0], "infix:<+> ", "Can parse nested angles in formatting codes"
}

=pod B< < B<foo> > >


$r = $=pod[7];
is $r.contents[0].contents[0].contents[1].contents[0], 'foo','FC inside balanced <>';

# vim: ft=perl6
