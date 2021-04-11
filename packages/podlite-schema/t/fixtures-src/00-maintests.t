# test implicit para
#---
=begin pod
  =begin para
  sdsd
   sdasd
 
        ddsds
  d
  =end para
=end pod
#---

# test vmargin
#---
=begin pod
  twest
  =for para
  sdsdsdsd

  jjj
=end pod
#---

# test Named blocks
#---
=begin pod
=for Named
  text
=begin Named
sdsdsdsd ssd s
  asdasdasdasd

dd
=end Named

=end pod
#---

#---
=head1 Test

text

=head2 Testing
continue

test

#---


#  Value is...       Specify with...           Or with...            Or with...
#  ===============   =======================   =================   ===========
#  List              :key[$e1,$e2,...]         :key($e1,$e2,...)
#  Hash              :key{$k1=>$v1,$k2=>$v2}
#  Boolean (true)    :key                      :key(True)
#  Boolean (false)   :!key                     :key(False)
#  String            :key<str>                 :key('str')         :key("str")
#  Number            :key(42)                  :key(2.3)

#---
=begin table :k1<str> :k2('str') :k3("str") :k4["str"] :k5(Q[str])

=end table
#---

#---
=config table :k1<very long string, comma> :k2<2 23  23 > :k3<'23', 23233, 333>
#---

#---
=code
  sdkljsalkdjlsd
  asdasdasdasdsad
=for code
  sdkljsalkdjlsd
  asdasdasdasdsad
=begin code
  sdkljsalkdjlsd
  asdasdasdasdsad
=end code
#---

#---
=config C<>  :allow<B>
#---

#---
=begin SYNOPSIS
Para inside SYNOPSIS
=end SYNOPSIS
#---

# Empty fcode #3
#---
=para
teZ<s>tZ<>
#---

# N<> Footnote
#---
=para
Use a C<for> loop instead.N<The Perl 6 C<for> loop is far more
powerful than its Perl 5 predecessor.> Preferably with an explicit
iterator variable.
#---


# X<> indexing terms
#---
=para
A X<hash|hashes, definition of; associative arrays>
is an unordered X<collection> of X<scalar|scalars> values indexed by their
associated string X<|puns, deliberate> key. X<> empty
#---

# U<> formatting code
#---
=para
The C<U<>> formatting code specifies that the contained text is
U<unusual> or distinctive;
#---

# T<>  and K<> formatting codes
#---
=para
Such content would typically be rendered in a K<fixed-width font>
Such content would typically be rendered in a T<fixed-width font>
#---

# Ambient code
#---
=d
Such content would typically be rendered in a K<fixed-width font>
Such content would typically be rendered in a T<fixed-width font>
=head1 test
=begin pod
test
e
=head1 sd

=end pod
=head2 test 

ambient again
#---

#---
=begin pod
=item

test

=end pod
#---

# Empty fcode #14
#---
=begin code
=begin item1
First
=end item1
=end code
#---
